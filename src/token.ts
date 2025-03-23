import {
  CLIENT_ID,
  CLIENT_SECRET,
  GRANT_TYPE,
  TOKEN_API_URL,
  TOKEN_REFRESH_MARGIN,
} from './config'

let cachedToken = ''
let tokenExpiryTime = 0

/**
 * Retrieve an OAuth Bearer token, cached in memory to avoid frequent requests.
 */
export async function retrieveBearerToken(): Promise<string> {
  const currentTimeInSeconds = Math.floor(Date.now() / 1000)
  const isTokenStillValid =
    cachedToken &&
    tokenExpiryTime &&
    currentTimeInSeconds < tokenExpiryTime - TOKEN_REFRESH_MARGIN

  if (isTokenStillValid) {
    return cachedToken
  }

  try {
    const response = await fetch(TOKEN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: GRANT_TYPE,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Error fetching bearer token: ${response.status} ${response.statusText}`,
      )
    }

    const data = await response.json()
    cachedToken = data.access_token
    tokenExpiryTime = currentTimeInSeconds + Number(data.expires_in)
    return cachedToken
  } catch (error) {
    console.error('Error fetching bearer token:', error)
    throw error
  }
}
