import crypto from 'crypto'
import {
  DigestAuthOptions,
  DigestContext,
  DigestRequestOptions,
} from './interfaces'

/** Helper to compute MD5. */
function md5(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex')
}

/** HA1 = MD5(username:realm:password). */
function calculateHA1({
  username,
  password,
  realm,
}: DigestAuthOptions): string {
  return md5(`${username}:${realm}:${password}`)
}

/** HA2 = MD5(method:uri). */
function calculateHA2({ method, uri }: DigestAuthOptions): string {
  return md5(`${method}:${uri}`)
}

/** Response = MD5(HA1:nonce:nc:cnonce:qop:HA2). */
function calculateResponse(
  { nonce, qop }: DigestAuthOptions,
  ha1: string,
  ha2: string,
  nc: string,
  cnonce: string,
): string {
  return md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
}

/**
 * Generate the 'Digest' Authorization header.
 */
function generateDigestAuthHeader(
  options: DigestAuthOptions,
  nc: number,
): string {
  const { username, realm, nonce, uri, qop, opaque } = options
  if (!nonce) return ''

  const ha1 = calculateHA1(options)
  const ha2 = calculateHA2(options)

  const cnonce = crypto.randomBytes(8).toString('hex')
  const response = calculateResponse(
    { nonce, qop } as DigestAuthOptions,
    ha1,
    ha2,
    nc.toString().padStart(8, '0'),
    cnonce,
  )

  return [
    `Digest username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
    `qop=${qop}`,
    `nc=${nc.toString().padStart(8, '0')}`,
    `cnonce="${cnonce}"`,
    `opaque="${opaque}"`,
  ].join(', ')
}

/**
 * Parse the 'WWW-Authenticate' header for digest auth data.
 */
function parseWwwDigestAuthHeader(header: string): Partial<DigestContext> {
  const result: Partial<DigestContext> = {}

  // Remove 'Digest ' prefix
  header
    .substring(7)
    .replace(
      /(qop|realm|nonce|stale|opaque|domain)="([^"]*)"/g,
      (_match, prop, value) => {
        ;(result as any)[prop] = value // Type assertion for recognized keys
        return value
      },
    )

  return result
}

/**
 * Perform an HTTP request with Digest Authentication, retrying
 * if the server returns a 401 with new digest parameters.
 */
export async function digestRequest(
  options: DigestRequestOptions,
  digestContext: DigestContext,
): Promise<any> {
  const {
    username,
    password,
    method,
    baseUrl,
    uri,
    data = null,
    responseType = 'json',
    headers = {},
    maxRetries = 8,
  } = options

  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const authHeader = generateDigestAuthHeader(
        {
          username,
          password,
          realm: digestContext.realm,
          nonce: digestContext.nonce,
          method,
          uri,
          qop: digestContext.qop,
          opaque: digestContext.opaque,
        },
        digestContext.nc,
      )

      if (authHeader) {
        digestContext.nc += 1
      }

      const requestOptions: RequestInit = {
        method,
        headers: {
          ...headers,
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      }

      // Add body for non-GET requests
      if (method !== 'GET' && data !== null) {
        if (typeof data === 'object') {
          requestOptions.body = JSON.stringify(data)
          // Add Content-Type if not specified
          if (!headers['Content-Type']) {
            requestOptions.headers = {
              ...requestOptions.headers,
              'Content-Type': 'application/json',
            }
          }
        } else {
          requestOptions.body = data as any
        }
      }

      const response = await fetch(`${baseUrl}${uri}`, requestOptions)

      if (!response.ok) {
        if (response.status === 401) {
          const wwwAuthenticate = response.headers.get('www-authenticate')
          if (!wwwAuthenticate) {
            digestContext.realm = ''
            digestContext.nonce = ''
            digestContext.qop = 'auth'
            digestContext.opaque = ''
            digestContext.nc = 1
            attempt++
            continue
          }

          // Parse new digest parameters and retry
          const parsed = parseWwwDigestAuthHeader(wwwAuthenticate)
          if (parsed.realm) digestContext.realm = parsed.realm
          if (parsed.nonce) digestContext.nonce = parsed.nonce
          if (parsed.qop) digestContext.qop = parsed.qop
          if (parsed.opaque) digestContext.opaque = parsed.opaque
          attempt++
          continue
        }

        throw new Error(`Request failed with status: ${response.status}`)
      }

      // Process response based on responseType
      switch (responseType) {
        case 'json':
          return {
            data: await response.json(),
            status: response.status,
            headers: response.headers,
          }
        case 'text':
          return {
            data: await response.text(),
            status: response.status,
            headers: response.headers,
          }
        case 'arraybuffer':
          return {
            data: await response.arrayBuffer(),
            status: response.status,
            headers: response.headers,
          }
        case 'blob':
          return {
            data: await response.blob(),
            status: response.status,
            headers: response.headers,
          }
        default:
          return {
            data: await response.json(),
            status: response.status,
            headers: response.headers,
          }
      }
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message.includes('network')) {
        console.log('Connection was reset. Retrying...')
        attempt++
        continue
      }

      if (attempt >= maxRetries - 1) {
        throw error
      }

      attempt++
    }
  }

  throw new Error(`Failed after ${maxRetries} digest retries.`)
}
