import type { ShipmentDto } from '../services/shipments/types.js'

const COLUMNS = [
  'trackingNumber',
  'carrier',
  'status',
  'store',
  'amountCents',
  'currency',
  'orderNumber',
  'requestedDate',
  'dropoffDate',
  'receivedDate',
  'decisionDate',
  'decisionDelayDays',
  'totalDelayDays',
  'createdAt',
  'archivedAt',
  'trackingUrl',
] as const satisfies readonly (keyof ShipmentDto)[]

const escape = (value: string | number | boolean | null): string => {
  if (value === null) return ''

  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv (items: ShipmentDto[]): string {
  const rows = items.map((item) => COLUMNS.map((column) => escape(item[column])).join(','))
  return [COLUMNS.join(','), ...rows].join('\r\n')
}
