import { diffDays, toIsoDate, toUtcDate } from './dates.js'
import type { IsoDate } from './dates.js'
import { HOME_COUNTRY } from '../../config/constants.js'

type HolidayCalendar = {
  fixed: string[]
  easterOffsets: number[]
}

const CALENDARS: Record<string, HolidayCalendar> = {
  BE: {
    fixed: ['01-01', '05-01', '07-21', '08-15', '11-01', '11-11', '12-25'],
    easterOffsets: [1, 39, 50],
  },
  NL: {
    fixed: ['01-01', '04-27', '12-25', '12-26'],
    easterOffsets: [1, 39, 50],
  },
  DE: {
    fixed: ['01-01', '05-01', '10-03', '12-25', '12-26'],
    easterOffsets: [-2, 1, 39, 50],
  },
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

const holidaysByCountryAndYear = new Map<string, Set<IsoDate>>()

export const HOLIDAY_COUNTRIES = Object.keys(CALENDARS)

export function resolveCountry (country: string): string {
  return Object.hasOwn(CALENDARS, country) ? country : HOME_COUNTRY
}

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

export function holidays (year: number, country: string): Set<IsoDate> {
  const resolved = resolveCountry(country)
  const key = `${resolved}-${String(year)}`
  const cached = holidaysByCountryAndYear.get(key)
  if (cached) return cached

  const calendar = CALENDARS[resolved]
  const dates = new Set<IsoDate>(
    calendar.fixed.map((monthDay) => `${String(year)}-${monthDay}`)
  )

  const easter = toUtcDate(easterSunday(year)).getTime()

  for (const offset of calendar.easterOffsets) {
    dates.add(toIsoDate(new Date(easter + offset * MILLISECONDS_PER_DAY)))
  }

  holidaysByCountryAndYear.set(key, dates)
  return dates
}

export function isWeekend (date: IsoDate): boolean {
  const day = toUtcDate(date).getUTCDay()
  return day === 0 || day === 6
}

export function isHoliday (date: IsoDate, country: string): boolean {
  return holidays(Number(date.slice(0, 4)), country).has(date)
}

export function isWorkingDay (date: IsoDate, country: string): boolean {
  return !isWeekend(date) && !isHoliday(date, country)
}

export function workingDaysBetween (from: IsoDate, to: IsoDate, country: string): number {
  if (diffDays(from, to) < 0) return -workingDaysBetween(to, from, country)

  const end = toUtcDate(to).getTime()
  let cursor = toUtcDate(from).getTime() + MILLISECONDS_PER_DAY
  let count = 0

  while (cursor <= end) {
    if (isWorkingDay(toIsoDate(new Date(cursor)), country)) count += 1
    cursor += MILLISECONDS_PER_DAY
  }

  return count
}
