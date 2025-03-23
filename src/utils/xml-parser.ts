import { Parser } from 'xml2js'

export const xmlParser = new Parser({
  explicitArray: false,
  ignoreAttrs: true,
})
