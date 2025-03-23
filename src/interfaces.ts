export interface DigestAuthOptions {
  username: string
  password: string
  realm: string
  nonce: string
  method: string
  uri: string
  qop: string
  opaque: string
}

export interface DigestContext {
  realm: string
  nonce: string
  qop: string
  opaque: string
  nc: number
}

export interface DeviceConfig {
  url: string
  username: string
  password: string
}

export interface AcsEventCond {
  searchID: string
  maxResults: number
  searchResultPosition: number
  major: number
  minor: number
  startTime: string
  endTime: string
}

export interface AcsEventPostData {
  AcsEventCond: AcsEventCond
}

export interface DigestRequestOptions {
  username: string
  password: string
  method: string
  baseUrl: string
  uri: string
  data?: unknown
  headers?: Record<string, string>
  responseType?: 'json' | 'text' | 'arraybuffer' | 'blob'
  httpsAgent?: any
  maxRetries?: number
}
