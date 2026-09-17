import { parseCsv } from '../../shared/csv.js'
import { parseAmount } from '../../shared/normalize.js'

type ParsedFile = {
  rows: Record<string, unknown>[]
  problem: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const rowsOfJson = (text: string): ParsedFile => {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return { rows: [], problem: 'This file is not valid JSON.' }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.items)
      ? parsed.items
      : null

  if (list === null) {
    return { rows: [], problem: 'Expected a list of returns, or an object with an items list.' }
  }

  if (!list.every(isRecord)) return { rows: [], problem: 'Every entry must be an object.' }

  return { rows: list, problem: null }
}

export function parseImportFile (name: string, text: string): ParsedFile {
  if (text.trim() === '') return { rows: [], problem: 'This file is empty.' }

  if (name.toLowerCase().endsWith('.json')) return rowsOfJson(text)

  const rows = parseCsv(text)

  if (rows.length === 0) return { rows: [], problem: 'This file holds a header but no returns.' }

  return { rows, problem: null }
}

export function toShipmentInput (row: Record<string, unknown>): Record<string, unknown> {
  const given = Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  )

  const { amount, ...rest } = given

  if (typeof amount === 'string') {
    const cents = parseAmount(amount)
    if (cents !== null) return { ...rest, amountCents: cents }
  }

  if (typeof rest.amountCents === 'string') {
    return { ...rest, amountCents: Number(rest.amountCents) }
  }

  return rest
}
