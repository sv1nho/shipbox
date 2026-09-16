import type { IsoDate } from './shipment.js'

const TIMEZONE = 'Europe/Brussels'

const zoned = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function toIsoDateInZone (value: Date): IsoDate {
  return zoned.format(value)
}

export function today (now: Date = new Date()): IsoDate {
  return toIsoDateInZone(now)
}
