import { describe, it, expect } from 'vitest'
import {
  belgianHolidays,
  easterSunday,
  isHoliday,
  isWeekend,
  isWorkingDay,
  workingDaysBetween,
} from '../../../services/shipments/working-days.js'

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25'],
  ])('places Easter %i on %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected)
  })

  it('always lands on a Sunday', () => {
    for (let year = 2020; year <= 2040; year += 1) {
      expect(isWeekend(easterSunday(year))).toBe(true)
    }
  })
})

describe('belgianHolidays', () => {
  it('lists the ten legal holidays', () => {
    expect(belgianHolidays(2026).size).toBe(10)
  })

  it.each([
    ['New Year', '2026-01-01'],
    ['Easter Monday', '2026-04-06'],
    ['Labour Day', '2026-05-01'],
    ['Ascension', '2026-05-14'],
    ['Whit Monday', '2026-05-25'],
    ['National Day', '2026-07-21'],
    ['Assumption', '2026-08-15'],
    ['All Saints', '2026-11-01'],
    ['Armistice', '2026-11-11'],
    ['Christmas', '2026-12-25'],
  ])('includes %s on %s', (_name, date) => {
    expect(belgianHolidays(2026).has(date)).toBe(true)
  })

  it('moves the movable ones with the year', () => {
    expect(belgianHolidays(2027).has('2027-03-29')).toBe(true)
    expect(belgianHolidays(2027).has('2026-04-06')).toBe(false)
  })

  it('returns the same set on a second call, the cache does not rebuild it', () => {
    expect(belgianHolidays(2026)).toBe(belgianHolidays(2026))
  })
})

describe('isWeekend', () => {
  it.each([['2026-06-06', 'saturday'], ['2026-06-07', 'sunday']])('flags %s, a %s', (date) => {
    expect(isWeekend(date)).toBe(true)
  })

  it.each(['2026-06-05', '2026-06-08'])('does not flag %s', (date) => {
    expect(isWeekend(date)).toBe(false)
  })
})

describe('isWorkingDay', () => {
  it('rejects a weekday that is a holiday', () => {
    expect(isHoliday('2026-07-21')).toBe(true)
    expect(isWeekend('2026-07-21')).toBe(false)
    expect(isWorkingDay('2026-07-21')).toBe(false)
  })

  it('rejects a weekend day', () => {
    expect(isWorkingDay('2026-06-06')).toBe(false)
  })

  it('accepts an ordinary weekday', () => {
    expect(isWorkingDay('2026-06-08')).toBe(true)
  })
})

describe('workingDaysBetween', () => {
  it('returns zero for the same day', () => {
    expect(workingDaysBetween('2026-06-01', '2026-06-01')).toBe(0)
  })

  it('counts a single step between two weekdays', () => {
    expect(workingDaysBetween('2026-06-01', '2026-06-02')).toBe(1)
  })

  it('skips the weekend between friday and monday', () => {
    expect(workingDaysBetween('2026-06-05', '2026-06-08')).toBe(1)
  })

  it('counts a full week as five days', () => {
    expect(workingDaysBetween('2026-06-01', '2026-06-08')).toBe(5)
  })

  it('counts two calendar weeks as ten working days', () => {
    expect(workingDaysBetween('2026-06-01', '2026-06-15')).toBe(10)
  })

  it('subtracts a holiday that falls on a weekday', () => {
    expect(workingDaysBetween('2026-07-17', '2026-07-24')).toBe(4)
  })

  it('does not subtract a holiday that falls on a weekend', () => {
    expect(isWeekend('2026-08-15')).toBe(true)
    expect(workingDaysBetween('2026-08-14', '2026-08-21')).toBe(5)
  })

  it('counts across a year boundary and its holidays', () => {
    expect(workingDaysBetween('2026-12-24', '2027-01-04')).toBe(5)
  })

  it('mirrors the sign when the dates are reversed', () => {
    expect(workingDaysBetween('2026-06-15', '2026-06-01')).toBe(-10)
  })

  it('never counts a weekend or a holiday, whatever the span', () => {
    const start = '2026-01-01'
    const end = '2026-12-31'
    const total = workingDaysBetween(start, end)

    expect(total).toBeGreaterThan(240)
    expect(total).toBeLessThan(256)
  })
})
