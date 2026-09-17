export { toIsoDateInZone, today } from '../../../shared/time.js'

export type { IsoDate } from '../../../shared/shipment.js'

type IsoDate = string

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

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

export function toUtcDate (value: IsoDate): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function shiftDays (from: IsoDate, days: number): IsoDate {
  const shifted = toUtcDate(from)
  shifted.setUTCDate(shifted.getUTCDate() + days)

  return toIsoDate(shifted)
}

export function diffDays (from: IsoDate, to: IsoDate): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / millisecondsPerDay)
}
