import crypto from 'crypto'

interface DigestAuthOptions {
  username: string
  password: string
  realm: string
  nonce: string
  method: string
  uri: string
  qop: string
  opaque: string
}

function md5(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex')
}

function calculateHA1({
  username,
  password,
  realm,
}: DigestAuthOptions): string {
  return md5(`${username}:${realm}:${password}`)
}

function calculateHA2({ method, uri }: DigestAuthOptions): string {
  return md5(`${method}:${uri}`)
}

function calculateResponse(
  { nonce, qop }: DigestAuthOptions,
  h1: string,
  h2: string,
  nc: string,
  cnonce: string,
): string {
  return md5(`${h1}:${nonce}:${nc}:${cnonce}:${qop}:${h2}`)
}

export function generateDigestAuthHeader(
  {
    username,
    password,
    realm,
    nonce,
    method,
    uri,
    qop,
    opaque,
  }: DigestAuthOptions,
  nc: string,
): string {
  if (!nonce) {
    return ''
  }
  const ha1 = calculateHA1({ username, password, realm } as DigestAuthOptions)
  const ha2 = calculateHA2({ method, uri } as DigestAuthOptions)
  const cnonce = crypto.randomBytes(8).toString('hex')
  const response = calculateResponse(
    { nonce, qop } as DigestAuthOptions,
    ha1,
    ha2,
    nc,
    cnonce,
  )
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", opaque="${opaque}"`
}

export function parseWwwDigestAuthHeader(header: string) {
  const result: any = {}

  header
    .substring(7)
    .replace(
      /(qop|realm|nonce|stale|opaque|domain)="([^"]*)"/g,
      (_match, prop, value) => {
        result[prop] = value
        return value
      },
    )
  return result
}
