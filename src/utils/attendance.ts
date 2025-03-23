import { AcsEventPostData } from '../interfaces'

/**
 * Build request body for ACS event searching.
 */
export function buildRequestEventPostData(
  searchID: string,
  maxResults: number,
  searchResultPosition: number,
  startDate: string,
  endDate: string,
  formattedTimezoneOffset = '+07:00',
): AcsEventPostData {
  return {
    AcsEventCond: {
      searchID,
      maxResults,
      searchResultPosition,
      major: 0,
      minor: 0,
      startTime: `${startDate}T00:00:00${formattedTimezoneOffset}`,
      endTime: `${endDate}T23:59:59${formattedTimezoneOffset}`,
    },
  }
}
