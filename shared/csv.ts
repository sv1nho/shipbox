import type { ShipmentDto } from './shipment.js'

export const CSV_COLUMNS = [
  'trackingNumber',
  'carrier',
  'status',
  'store',
  'storeSupportEmail',
  'amountCents',
  'currency',
  'orderNumber',
  'requestedDate',
  'dropoffDate',
  'receivedDate',
  'decisionDate',
  'rejectionReason',
  'decisionDelayDays',
  'totalDelayDays',
  'createdAt',
  'archivedAt',
  'trackingUrl',
] as const satisfies readonly (keyof ShipmentDto)[]

const FORMULA_START = /^[=+\-@\t\r]/

const escape = (value: string | number | boolean | null): string => {
  if (value === null) return ''

  const text = typeof value === 'string' && FORMULA_START.test(value) ? `'${value}` : String(value)

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv (items: ShipmentDto[]): string {
  const rows = items.map((item) => CSV_COLUMNS.map((column) => escape(item[column])).join(','))

  return [CSV_COLUMNS.join(','), ...rows].join('\r\n')
}

function splitRecords (text: string): string[][] {
  const records: string[][] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (quoted) {
      if (character !== '"') { cell += character; continue }
      if (text[index + 1] === '"') { cell += '"'; index += 1; continue }
      quoted = false
      continue
    }

    if (character === '"') { quoted = true; continue }
    if (character === ',') { cells.push(cell); cell = ''; continue }

    if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      cells.push(cell)
      records.push(cells)
      cells = []
      cell = ''
      continue
    }

    cell += character
  }

  if (cell !== '' || cells.length > 0) {
    cells.push(cell)
    records.push(cells)
  }

  return records.filter((record) => record.some((value) => value.trim() !== ''))
}

const plainAgain = (value: string): string =>
  value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value

export function parseCsv (text: string): Record<string, string>[] {
  const [header, ...rows] = splitRecords(text)

  if (header === undefined) return []

  const names = header.map((name) => name.trim())

  return rows.map((cells) =>
    Object.fromEntries(names.map((name, index) => [name, plainAgain((cells[index] ?? '').trim())]))
  )
}
