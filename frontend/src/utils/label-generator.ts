import JsBarcode from 'jsbarcode'
import type { LabelPayload } from '../types/index.js'
import type { CarrierConfig } from '../types/config.js'
import { COUNTRY_NAMES, POSTAL_ZONES, SVG_TEXT_CONFIG } from './variables.js'

type Prefix = 'sender' | 'recipient'

const maybeUpper = (value: string, uppercase: boolean): string =>
  uppercase ? value.toUpperCase() : value

const resolveCountry = (
  payload: LabelPayload,
  prefix: Prefix,
  config: CarrierConfig
): string => {
  const country = payload[`${prefix}_country`]
  const names = COUNTRY_NAMES[country]
  if (!names) {
    throw new Error(`Unsupported country: ${country}`)
  }
  return maybeUpper(names[payload.label_language], config.uppercaseCityCountry)
}

export const zoneFromPostal = (postalRaw: string): string => {
  const digits = postalRaw.replace(/\D/g, '')
  const postal = Number.parseInt(digits.slice(0, 4), 10)
  if (digits.length < 4 || Number.isNaN(postal)) return ''
  return (
    POSTAL_ZONES.find((zone) => postal >= zone.min && postal <= zone.max)
      ?.code ?? ''
  )
}

export const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

export const wrapText = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) return [text]

  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (testLine.length <= maxLength) {
      currentLine = testLine
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines
}

const wrapTextByPixelWidth = (
  lines: string[],
  maxPixelWidth: number,
  fontSize: number
): string[] => {
  const maxCharCount = Math.floor(maxPixelWidth / ((fontSize / 22) * 12))
  return lines.flatMap((line) => wrapText(line, maxCharCount))
}

const getRandomDigit = (except?: string): string => {
  let digit = String(Math.floor(Math.random() * 10))
  while (digit === except) {
    digit = String(Math.floor(Math.random() * 10))
  }
  return digit
}

export const obfuscateTracking = (
  tracking: string,
  tailDigitCount: number
): string => {
  const chars = tracking.split('')
  const digitIndexes: number[] = []

  for (let i = 0; i < chars.length; i += 1) {
    if (/\d/.test(chars[i])) digitIndexes.push(i)
  }

  const mutableIndexes = digitIndexes.slice(
    Math.max(0, digitIndexes.length - tailDigitCount)
  )
  if (mutableIndexes.length === 0) return tracking

  const targetChanges = Math.min(
    mutableIndexes.length,
    Math.max(1, Math.floor(mutableIndexes.length / 2))
  )

  for (let change = 0; change < targetChanges; change += 1) {
    const randomPoolIndex = Math.floor(Math.random() * mutableIndexes.length)
    const charIndex = mutableIndexes.splice(randomPoolIndex, 1)[0]
    if (charIndex === undefined) continue
    chars[charIndex] = getRandomDigit(chars[charIndex])
  }

  return chars.join('')
}

const capitalize = (value: string): string =>
  value.length === 0 ? value : value[0].toUpperCase() + value.slice(1)

const party = (payload: LabelPayload, prefix: Prefix) => (key: string) =>
  payload[`${prefix}_${key}` as keyof LabelPayload]

const nameLines = (payload: LabelPayload, prefix: Prefix): string[] => {
  const p = party(payload, prefix)
  const name = p('isCompany')
    ? capitalize(p('company') as string)
    : `${capitalize(p('firstname') as string)} ${capitalize(p('lastname') as string)}`
  return wrapText(name, prefix === 'sender' ? 40 : 35)
}

const addressLines = (
  payload: LabelPayload,
  prefix: Prefix,
  config: CarrierConfig
): { lines: string[]; addressLineCount: number } => {
  const p = party(payload, prefix)
  const address = capitalize(p('address') as string)
  const postal = p('postal') as string
  const city = p('city') as string
  const maxLen = prefix === 'sender' ? 45 : 35
  const displayCity = config.uppercaseCityCountry
    ? city.toUpperCase()
    : capitalize(city)
  const postalCity = `${postal} ${displayCity}`
  const country = resolveCountry(payload, prefix, config)

  const addressWrapped = wrapText(address, maxLen).filter(
    (line) => line.length > 0
  )
  const restWrapped = [
    ...wrapText(postalCity, maxLen),
    ...wrapText(country, maxLen)
  ].filter((line) => line.length > 0)

  return {
    lines: [...addressWrapped, ...restWrapped],
    addressLineCount: addressWrapped.length
  }
}

const linesToTspans = (
  lines: string[],
  options: { x: number; startY: number; lineHeight: number }
): string =>
  lines
    .map((line, index) => {
      const y = options.startY + index * options.lineHeight
      return `<tspan x="${options.x}" y="${y}">${escapeXml(line)}</tspan>`
    })
    .join('')

const createRecipientBox = (options: {
  x: number
  startY: number
  boxWidth: number
  boxHeight: number
  padding: number
  strokeWidth: number
}): string => {
  const { x, startY, boxWidth, boxHeight, padding, strokeWidth } = options
  return `<rect x="${x - padding}" y="${startY - padding}" width="${boxWidth}" height="${boxHeight}" fill="none" stroke="${SVG_TEXT_CONFIG.fill}" stroke-width="${strokeWidth}" rx="2" ry="2"/>`
}

const createTextElement = (options: {
  text: string
  fontSize: number
  x?: number
  y?: number
  fontWeight?: string
  textAnchor?: string
  preserveSpace?: boolean
}): string => {
  const {
    text,
    x,
    y,
    fontSize,
    fontWeight = SVG_TEXT_CONFIG.fontWeight,
    textAnchor = SVG_TEXT_CONFIG.textAnchor,
    preserveSpace = false
  } = options
  const position =
    x !== undefined && y !== undefined ? ` x="${x}" y="${y}"` : ''
  const space = preserveSpace ? ' xml:space="preserve"' : ''
  return `<text${position} font-family="${SVG_TEXT_CONFIG.fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${SVG_TEXT_CONFIG.fill}" text-anchor="${textAnchor}" direction="${SVG_TEXT_CONFIG.direction}"${space}>${text}</text>`
}

const generateBarcodeBase64 = (tracking: string): string => {
  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, tracking, {
      format: 'CODE128',
      width: 2,
      height: 70,
      displayValue: false
    })
    return canvas.toDataURL('image/png').split(',')[1] || ''
  } catch (error) {
    throw new Error(
      `Failed to generate barcode, ${error instanceof Error ? error.message : 'Unknown error'}`,
      { cause: error }
    )
  }
}

const buildSenderBlock = (
  payload: LabelPayload,
  config: CarrierConfig
): string => {
  const senderTspans = linesToTspans(
    [
      ...nameLines(payload, 'sender'),
      ...addressLines(payload, 'sender', config).lines
    ],
    {
      x: config.sender.x,
      startY: config.sender.startY,
      lineHeight: config.sender.lineHeight
    }
  )

  return `${createTextElement({ text: config.senderLabel, x: config.sender.x, y: config.sender.startY - 14, fontSize: config.sender.fontSize })}
    ${createTextElement({ text: senderTspans, fontSize: config.sender.fontSize, preserveSpace: true })}`
}

const buildRecipientNameBlock = (
  payload: LabelPayload,
  config: CarrierConfig
): string => {
  const wrappedNameLines = wrapTextByPixelWidth(
    nameLines(payload, 'recipient'),
    config.recipient.boxWidth,
    config.recipient.fontSize
  )
  const nameTspans = linesToTspans(wrappedNameLines, {
    x: config.recipient.x,
    startY: config.recipient.nameStartY,
    lineHeight: config.recipient.nameLineHeight
  })
  return createTextElement({
    text: nameTspans,
    fontSize: config.recipient.fontSize,
    preserveSpace: true
  })
}

const buildRecipientDetailsBlock = (
  payload: LabelPayload,
  config: CarrierConfig
): string => {
  const { lines, addressLineCount } = addressLines(payload, 'recipient', config)
  const wrappedLines = wrapTextByPixelWidth(
    lines,
    config.recipient.boxWidth,
    config.recipient.fontSize
  )

  return wrappedLines
    .map((line, index) => {
      const y =
        config.recipient.detailsStartY +
        index * config.recipient.detailsLineHeight
      const fontWeight = index < addressLineCount ? '400' : '700'
      return createTextElement({
        text: escapeXml(line),
        x: config.recipient.x,
        y,
        fontSize: config.recipient.fontSize,
        fontWeight
      })
    })
    .join('')
}

const CARRIER_CONFIGS: Record<string, CarrierConfig> = {
  postnl: {
    trackingTailDigitCount: 9,
    sender: { x: 24, startY: 30, lineHeight: 12, fontSize: 10 },
    recipient: {
      boxWidth: 243,
      fontSize: 11,
      boxStartY: 175,
      boxStrokeWidth: 1,
      boxPadding: 4,
      boxHeight: 110,
      nameStartY: 182.5,
      nameLineHeight: 12.5,
      detailsStartY: 194,
      detailsLineHeight: 12.5,
      x: 29
    },
    barcode: { x: 29, y: 280, width: 238, height: 70 },
    tracking: { x: 95, y: 355 },
    senderLabel: 'Afzender:',
    uppercaseCityCountry: true,
    extraMark: { text: 'AD', x: 24, y: 110, fontSize: 36, fontWeight: '700' }
  },
  bpost: {
    trackingTailDigitCount: 8,
    sender: { x: 140, startY: 42, lineHeight: 12, fontSize: 10 },
    recipient: {
      boxWidth: 190,
      fontSize: 11,
      boxStartY: 190,
      boxStrokeWidth: 2,
      boxPadding: 4,
      boxHeight: 85,
      nameStartY: 200,
      nameLineHeight: 10,
      detailsStartY: 212.5,
      detailsLineHeight: 13.5,
      x: 60
    },
    barcode: { x: 50, y: 110, width: 210, height: 70 },
    tracking: { x: 75, y: 180 },
    zone: { x: 150.5, y: 300, fontSize: 24 },
    senderLabel: 'Expéditeur/Afzender:',
    uppercaseCityCountry: false
  }
}

export const buildLabelSvg = (
  payload: LabelPayload,
  svgTemplate: string
): { svg: string; maskedTracking: string } => {
  const config = CARRIER_CONFIGS[payload.carrier]
  if (!config) {
    throw new Error(`Unsupported carrier: ${payload.carrier}`)
  }

  const barcodeBase64 = generateBarcodeBase64(payload.tracking_number)
  const maskedTracking = obfuscateTracking(
    payload.tracking_number,
    config.trackingTailDigitCount
  )
  const postalZone = zoneFromPostal(payload.recipient_postal)

  const recipientBox = createRecipientBox({
    x: config.recipient.x,
    startY: config.recipient.boxStartY,
    boxWidth: config.recipient.boxWidth,
    boxHeight: config.recipient.boxHeight,
    padding: config.recipient.boxPadding,
    strokeWidth: config.recipient.boxStrokeWidth
  })

  const overlay = `
  <g id="dynamic-label-overlay">
    ${buildSenderBlock(payload, config)}
    ${config.extraMark ? createTextElement(config.extraMark) : ''}
    ${recipientBox}
    ${buildRecipientNameBlock(payload, config)}
    ${buildRecipientDetailsBlock(payload, config)}
    <image x="${config.barcode.x}" y="${config.barcode.y}" width="${config.barcode.width}" height="${config.barcode.height}" href="data:image/png;base64,${barcodeBase64}"/>
    ${createTextElement({ text: escapeXml(maskedTracking), x: config.tracking.x, y: config.tracking.y, fontSize: 12 })}
    ${config.zone ? createTextElement({ text: escapeXml(postalZone), x: config.zone.x, y: config.zone.y, fontSize: config.zone.fontSize, fontWeight: '700', textAnchor: 'middle' }) : ''}
  </g>`

  return {
    svg: svgTemplate.replace('</svg>', `${overlay}\n</svg>`),
    maskedTracking
  }
}
