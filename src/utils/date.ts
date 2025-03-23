/**
 * Format a JavaScript Date object into 'YYYY-MM-DD'.
 * This uses a provided Intl.DateTimeFormat to get the month/day/year,
 * then reassembles them into an ISO-like format.
 */
export function formatDate(date: Date, formatter: Intl.DateTimeFormat): string {
  const [mm, dd, yyyy] = formatter.format(date).split('/')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Create a timezone offset string, e.g. "+07:00" or "-04:00",
 * based on the system's local offset for a given date.
 */
export function getFormattedTimezoneOffset(date: Date): string {
  const timezoneOffsetInMinutes = date.getTimezoneOffset()
  const timezoneSign = timezoneOffsetInMinutes < 0 ? '+' : '-'
  const timezoneHours = String(
    Math.abs(Math.floor(timezoneOffsetInMinutes / 60)),
  ).padStart(2, '0')
  const timezoneMinutes = String(
    Math.abs(timezoneOffsetInMinutes % 60),
  ).padStart(2, '0')
  return `${timezoneSign}${timezoneHours}:${timezoneMinutes}`
}
