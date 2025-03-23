export const GRANT_TYPE = process.env.GRANT_TYPE || 'client_credentials'
export const CLIENT_ID = Number(process.env.CLIENT_ID || 3)
export const CLIENT_SECRET = process.env.CLIENT_SECRET || 'supersecret'
export const TOKEN_API_URL =
  process.env.TOKEN_API_URL || 'https://app.nusawork.com/api/token'
export const TOKEN_REFRESH_MARGIN = Number(
  process.env.TOKEN_REFRESH_MARGIN || 60,
)
export const ATTENDANCE_API_BASE_URL =
  process.env.ATTENDANCE_API_BASE_URL ||
  'http://app.nusawork.com/api/attendance'
export const ATTENDANCE_API_URL =
  process.env.ATTENDANCE_API_URL ||
  'http://app.nusawork.com/api/attendance/storage'
export const LAST_DAYS = Number(process.env.LAST_DAYS || 3)
export const DEVICES = process.env.DEVICES || '[]'
