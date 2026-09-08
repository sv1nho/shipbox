import { diffDays, toIsoDate, toUtcDate } from './dates.js'
import type { IsoDate } from './dates.js'

const FIXED_HOLIDAYS = ['01-01', '05-01', '07-21', '08-15', '11-01', '11-11', '12-25']

const MOVABLE_HOLIDAY_OFFSETS = [1, 39, 50]

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

const holidaysByYear = new Map<number, Set<IsoDate>>()

export function easterSunday (year: number): IsoDate {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1

  return toIsoDate(new Date(Date.UTC(year, month - 1, day)))
}

export function belgianHolidays (year: number): Set<IsoDate> {
  const cached = holidaysByYear.get(year)
  if (cached) return cached

  const holidays = new Set<IsoDate>(
    FIXED_HOLIDAYS.map((monthDay) => `${String(year)}-${monthDay}`)
  )

  const easter = toUtcDate(easterSunday(year)).getTime()

  for (const offset of MOVABLE_HOLIDAY_OFFSETS) {
    holidays.add(toIsoDate(new Date(easter + offset * MILLISECONDS_PER_DAY)))
  }

  holidaysByYear.set(year, holidays)
  return holidays
}

export function isWeekend (date: IsoDate): boolean {
  const day = toUtcDate(date).getUTCDay()
  return day === 0 || day === 6
}

export function isHoliday (date: IsoDate): boolean {
  return belgianHolidays(Number(date.slice(0, 4))).has(date)
}

export function isWorkingDay (date: IsoDate): boolean {
  return !isWeekend(date) && !isHoliday(date)
}

export function workingDaysBetween (from: IsoDate, to: IsoDate): number {
  if (diffDays(from, to) < 0) return -workingDaysBetween(to, from)

  const end = toUtcDate(to).getTime()
  let cursor = toUtcDate(from).getTime() + MILLISECONDS_PER_DAY
  let count = 0

  while (cursor <= end) {
    if (isWorkingDay(toIsoDate(new Date(cursor)))) count += 1
    cursor += MILLISECONDS_PER_DAY
  }

  return count
}
