import { TIMEZONE } from '../../config/constants.js'

export type IsoDate = string

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const zoned = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function isIsoDate (value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export function toIsoDate (value: Date): IsoDate {
  return value.toISOString().slice(0, 10)
}

export function toIsoDateInZone (value: Date): IsoDate {
  return zoned.format(value)
}

export function today (now: Date = new Date()): IsoDate {
  return toIsoDateInZone(now)
}

export function toUtcDate (value: IsoDate): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function diffDays (from: IsoDate, to: IsoDate): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / millisecondsPerDay)
}
