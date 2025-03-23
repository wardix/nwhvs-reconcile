import https from 'https'
import crypto from 'crypto'
import FormData from 'form-data'
import minimist from 'minimist'
import {
  ATTENDANCE_API_BASE_URL,
  ATTENDANCE_API_URL,
  DEVICES,
  LAST_DAYS,
} from './config'
import { BASE64_1X1_PNG } from './data'
import { DigestContext } from './interfaces'
import { retrieveBearerToken } from './token'
import { digestRequest } from './digest'
import { formatDate, getFormattedTimezoneOffset } from './utils/date'
import { buildRequestEventPostData } from './utils/attendance'
import { xmlParser } from './utils/xml-parser'

// Function to create a request from FormData for use with fetch in Node.js
async function createFormDataRequest(
  url: string,
  formData: FormData,
  token: string,
) {
  return new Promise<Response>(async (resolve, reject) => {
    try {
      // Create options for the fetch request
      const options: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      }

      // Node.js specific: Convert FormData to a Buffer and use it as the body
      formData.getLength(async (err: Error | null, length: number) => {
        if (err) {
          reject(err)
          return
        }

        // Set the content length header
        options.headers = {
          ...options.headers,
          'Content-Length': length.toString(),
        }

        // Get the form data as a Buffer
        const buffer = await new Promise<Buffer>(
          (resolveBuffer, rejectBuffer) => {
            const chunks: any[] = []
            formData.on('data', (chunk: any) => chunks.push(chunk))
            formData.on('end', () => resolveBuffer(Buffer.concat(chunks)))
            formData.on('error', (err: Error) => rejectBuffer(err))
          },
        )

        // Use the buffer as the request body
        options.body = buffer

        // Make the fetch request
        try {
          const response = await fetch(url, options)
          resolve(response)
        } catch (fetchError) {
          reject(fetchError)
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

async function main(): Promise<void> {
  const args = minimist(process.argv, {
    string: ['period-start', 'period-end'],
    default: { 'period-start': '', 'period-end': '' },
  })

  if (args['period-end'] && !args['period-start']) {
    process.exit(1)
  }

  const now = new Date()
  const formattedTimezoneOffset = getFormattedTimezoneOffset(now)

  const startDate = args['period-start']
    ? new Date(`${args['period-start']}T00:00:00${formattedTimezoneOffset}`)
    : new Date(now.getTime() - LAST_DAYS * 86400000)

  const endDate = args['period-end']
    ? new Date(`${args['period-end']}T23:59:59${formattedTimezoneOffset}`)
    : args['period-start']
      ? new Date(`${args['period-start']}T23:59:59${formattedTimezoneOffset}`)
      : new Date(now.getTime())

  if (startDate.getTime() > endDate.getTime()) {
    process.exit(1)
  }

  const dateFormatter = Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const formattedStartDate = formatDate(startDate, dateFormatter)
  const formattedEndDate = formatDate(endDate, dateFormatter)

  let token: string
  try {
    token = await retrieveBearerToken()
  } catch (error) {
    console.error('Fatal error retrieving token:', error)
    process.exit(1)
  }

  console.log(
    `Reconcile attendance data ${formattedStartDate} - ${formattedEndDate}`,
  )
  console.log('Fetching attendance data ...')
  const attendanceDataSet = new Set<string>()
  const timezoneOffsetMap: Record<string, string> = {}
  let totalAttendanceRecords = 0
  let page = 0

  try {
    do {
      page++
      console.log(`Fetching attendance page: ${page}`)
      const attendanceApiUrl = `${ATTENDANCE_API_BASE_URL}/range/${formattedStartDate}/${formattedEndDate}?per_page=100&page=${page}`

      const response = await fetch(attendanceApiUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()
      const attendanceList = responseData.data || []

      for (const {
        checked_time_by_timezone: checkedTime,
        employee_id: employeeId,
        timezone_device: tzDevice,
      } of attendanceList) {
        // Cache the timezone offset if not already known
        if (!(tzDevice in timezoneOffsetMap)) {
          const formattedDate = Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: tzDevice,
            timeZoneName: 'longOffset',
          }).format(new Date())
          timezoneOffsetMap[tzDevice] = formattedDate.substring(15)
        }

        const tzOffset = timezoneOffsetMap[tzDevice] || formattedTimezoneOffset
        const timestamp = Math.floor(
          new Date(`${checkedTime.replace(' ', 'T')}${tzOffset}`).getTime() /
            1000,
        )
        attendanceDataSet.add(`${timestamp}:${employeeId}`)
      }

      totalAttendanceRecords = responseData.meta.total
    } while (page * 100 < totalAttendanceRecords)

    console.log(`${attendanceDataSet.size} attendance data records fetched.`)
  } catch (error) {
    console.error('Error fetching attendance data:', error)
    process.exit(1)
  }

  const httpsAgent = new https.Agent({ rejectUnauthorized: false })

  const devices = JSON.parse(DEVICES)
  for (const device of devices) {
    const { url: baseUrl, username, password } = device
    try {
      // Initialize digest context
      const digestContext: DigestContext = {
        realm: '',
        nonce: '',
        qop: 'auth',
        opaque: '',
        nc: 1,
      }

      const deviceInfoResp = await digestRequest(
        {
          username,
          password,
          method: 'GET',
          baseUrl,
          uri: '/ISAPI/System/deviceInfo',
          responseType: 'text',
          httpsAgent,
        },
        digestContext,
      )

      const deviceInfoData = await xmlParser.parseStringPromise(
        deviceInfoResp.data,
      )
      const deviceName =
        deviceInfoData?.DeviceInfo?.deviceName || 'Unknown Device'
      console.log(`\n== Processing device: ${deviceName} (${baseUrl}) ==`)

      const searchId = crypto.randomUUID()
      const pageSize = 24
      let offset = 0
      let totalMatches = pageSize
      let numValidRecords = 0

      while (offset < totalMatches) {
        const eventPostData = buildRequestEventPostData(
          searchId,
          pageSize,
          offset,
          formattedStartDate,
          formattedEndDate,
          formattedTimezoneOffset,
        )

        const acsEventResp = await digestRequest(
          {
            username,
            password,
            method: 'POST',
            baseUrl,
            uri: '/ISAPI/AccessControl/AcsEvent?format=json',
            data: eventPostData,
            httpsAgent,
            headers: { 'Content-Type': 'application/json' },
          },
          digestContext,
        )

        const { AcsEvent } = acsEventResp.data
        totalMatches = AcsEvent.totalMatches ?? 0
        if (!AcsEvent.InfoList) break

        for (const info of AcsEvent.InfoList) {
          if (!info.employeeNoString) {
            continue
          }

          numValidRecords += 1
          const { time, name, employeeNoString: employeeId, pictureURL } = info
          const timestamp = Math.floor(new Date(time).getTime() / 1000)
          const uniqueKey = `${timestamp}:${employeeId}`

          if (attendanceDataSet.has(uniqueKey)) {
            continue
          }

          console.log(
            `Not found in attendance data -> time: ${time}, id: ${employeeId}, name: ${name}`,
          )

          const formData = new FormData()
          if (pictureURL) {
            const pictureResponse = await digestRequest(
              {
                username,
                password,
                method: 'GET',
                baseUrl,
                uri: pictureURL.substring(baseUrl.length), // remove leading baseUrl
                httpsAgent,
                responseType: 'arraybuffer',
              },
              digestContext,
            )
            formData.append('photo', Buffer.from(pictureResponse.data), {
              filename: 'photo.jpg',
              contentType: 'image/jpeg',
            })
          } else {
            formData.append('photo', Buffer.from(BASE64_1X1_PNG, 'base64'), {
              filename: 'photo.png',
              contentType: 'image/png',
            })
          }

          formData.append('date_time', time)
          formData.append('employee_id', employeeId)
          formData.append('gate_name', deviceName)

          try {
            // Use our custom function to handle FormData with fetch
            const submitResp = await createFormDataRequest(
              ATTENDANCE_API_URL,
              formData,
              token,
            )

            if (!submitResp.ok) {
              throw new Error(`HTTP error! status: ${submitResp.status}`)
            }

            const submitData = await submitResp.json()
            console.log(`Submit response:`, submitData)
          } catch (error) {
            console.error('Error submitting clocked data:', error)
          }
        }

        offset += pageSize
        const processed = offset <= totalMatches ? offset : totalMatches
        console.log(`${processed} of ${totalMatches}`)
      }

      console.log(`Total valid records found on device: ${numValidRecords}`)
    } catch (error) {
      console.error(`Error processing device at ${baseUrl}:`, error)
    }
  }

  console.log('\nAll devices processed successfully.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error in main:', err)
  process.exit(1)
})
