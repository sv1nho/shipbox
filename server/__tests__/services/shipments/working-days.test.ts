import { describe, it, expect } from 'vitest'
import {
  HOLIDAY_COUNTRIES,
  easterSunday,
  holidays,
  isHoliday,
  isWeekend,
  isWorkingDay,
  resolveCountry,
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

describe('resolveCountry', () => {
  it.each(HOLIDAY_COUNTRIES)('keeps %s, which has its own calendar', (country) => {
    expect(resolveCountry(country)).toBe(country)
  })

  it.each(['FR', 'be', '', 'LU'])('falls back to the home calendar for %s', (country) => {
    expect(resolveCountry(country)).toBe('BE')
  })
})

describe('the belgian calendar', () => {
  it('lists the ten legal holidays', () => {
    expect(holidays(2026, 'BE').size).toBe(10)
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
    expect(holidays(2026, 'BE').has(date)).toBe(true)
  })

  it('does not borrow dutch or german holidays', () => {
    expect(holidays(2026, 'BE').has('2026-04-27')).toBe(false)
    expect(holidays(2026, 'BE').has('2026-10-03')).toBe(false)
    expect(holidays(2026, 'BE').has('2026-12-26')).toBe(false)
  })
})

describe('the dutch calendar', () => {
  it.each([
    ['New Year', '2026-01-01'],
    ['Easter Monday', '2026-04-06'],
    ['Koningsdag', '2026-04-27'],
    ['Ascension', '2026-05-14'],
    ['Whit Monday', '2026-05-25'],
    ['Christmas Day', '2026-12-25'],
    ['Boxing Day', '2026-12-26'],
  ])('includes %s on %s', (_name, date) => {
    expect(holidays(2026, 'NL').has(date)).toBe(true)
  })

  it('does not observe the belgian national day nor the armistice', () => {
    expect(holidays(2026, 'NL').has('2026-07-21')).toBe(false)
    expect(holidays(2026, 'NL').has('2026-11-11')).toBe(false)
    expect(holidays(2026, 'NL').has('2026-11-01')).toBe(false)
  })

  it('does not observe Labour Day, which is an ordinary working day there', () => {
    expect(holidays(2026, 'NL').has('2026-05-01')).toBe(false)
  })
})

describe('the german calendar', () => {
  it.each([
    ['New Year', '2026-01-01'],
    ['Good Friday', '2026-04-03'],
    ['Easter Monday', '2026-04-06'],
    ['Labour Day', '2026-05-01'],
    ['Ascension', '2026-05-14'],
    ['Whit Monday', '2026-05-25'],
    ['Unity Day', '2026-10-03'],
    ['Christmas Day', '2026-12-25'],
    ['Boxing Day', '2026-12-26'],
  ])('includes %s on %s', (_name, date) => {
    expect(holidays(2026, 'DE').has(date)).toBe(true)
  })

  it('is the only calendar of the three that closes on Good Friday', () => {
    expect(holidays(2026, 'BE').has('2026-04-03')).toBe(false)
    expect(holidays(2026, 'NL').has('2026-04-03')).toBe(false)
  })
})

describe('holiday caching', () => {
  it('returns the same set on a second call', () => {
    expect(holidays(2026, 'BE')).toBe(holidays(2026, 'BE'))
  })

  it('keeps the countries apart', () => {
    expect(holidays(2026, 'BE')).not.toBe(holidays(2026, 'NL'))
  })

  it('moves the movable ones with the year', () => {
    expect(holidays(2027, 'BE').has('2027-03-29')).toBe(true)
    expect(holidays(2027, 'BE').has('2026-04-06')).toBe(false)
  })
})

describe('isWeekend', () => {
  it.each(['2026-06-06', '2026-06-07'])('flags %s', (date) => {
    expect(isWeekend(date)).toBe(true)
  })

  it.each(['2026-06-05', '2026-06-08'])('does not flag %s', (date) => {
    expect(isWeekend(date)).toBe(false)
  })
})

describe('isWorkingDay', () => {
  it('rejects a weekday that is a holiday there', () => {
    expect(isWeekend('2026-07-21')).toBe(false)
    expect(isWorkingDay('2026-07-21', 'BE')).toBe(false)
  })

  it('accepts the same weekday where it is not a holiday', () => {
    expect(isWorkingDay('2026-07-21', 'NL')).toBe(true)
  })

  it('rejects a weekend day everywhere', () => {
    for (const country of HOLIDAY_COUNTRIES) {
      expect(isWorkingDay('2026-06-06', country)).toBe(false)
    }
  })

  it('accepts an ordinary weekday everywhere', () => {
    for (const country of HOLIDAY_COUNTRIES) {
      expect(isWorkingDay('2026-06-08', country)).toBe(true)
    }
  })
})

describe('workingDaysBetween', () => {
  it('returns zero for the same day', () => {
    expect(workingDaysBetween('2026-06-01', '2026-06-01', 'BE')).toBe(0)
  })

  it('counts a single step between two weekdays', () => {
    expect(workingDaysBetween('2026-06-01', '2026-06-02', 'BE')).toBe(1)
  })

  it('skips the weekend between friday and monday', () => {
    expect(workingDaysBetween('2026-06-05', '2026-06-08', 'BE')).toBe(1)
  })

  it('counts a full week as five days', () => {
    expect(workingDaysBetween('2026-06-01', '2026-06-08', 'BE')).toBe(5)
  })

  it('counts two calendar weeks as ten working days', () => {
    expect(workingDaysBetween('2026-06-01', '2026-06-15', 'BE')).toBe(10)
  })

  it('subtracts a holiday that falls on a weekday', () => {
    expect(workingDaysBetween('2026-07-17', '2026-07-24', 'BE')).toBe(4)
  })

  it('counts that same week in full for a dutch handler', () => {
    expect(workingDaysBetween('2026-07-17', '2026-07-24', 'NL')).toBe(5)
  })

  it('subtracts Koningsdag for a dutch handler but not for a belgian one', () => {
    expect(isWeekend('2026-04-27')).toBe(false)
    expect(workingDaysBetween('2026-04-24', '2026-04-30', 'NL')).toBe(3)
    expect(workingDaysBetween('2026-04-24', '2026-04-30', 'BE')).toBe(4)
  })

  it('subtracts Labour Day in Belgium and Germany but not in the Netherlands', () => {
    expect(isWeekend('2026-05-01')).toBe(false)
    expect(workingDaysBetween('2026-04-30', '2026-05-04', 'BE')).toBe(1)
    expect(workingDaysBetween('2026-04-30', '2026-05-04', 'DE')).toBe(1)
    expect(workingDaysBetween('2026-04-30', '2026-05-04', 'NL')).toBe(2)
  })

  it('does not subtract a holiday that falls on a weekend', () => {
    expect(isWeekend('2026-08-15')).toBe(true)
    expect(workingDaysBetween('2026-08-14', '2026-08-21', 'BE')).toBe(5)
  })

  it('counts across a year boundary and its holidays', () => {
    expect(workingDaysBetween('2026-12-24', '2027-01-04', 'BE')).toBe(5)
  })

  it('counts one day less over the same period for a german handler, who takes Boxing Day', () => {
    expect(isHoliday('2026-12-26', 'DE')).toBe(true)
    expect(isWeekend('2026-12-26')).toBe(true)
    expect(workingDaysBetween('2026-12-24', '2027-01-04', 'DE')).toBe(5)
  })

  it('mirrors the sign when the dates are reversed', () => {
    expect(workingDaysBetween('2026-06-15', '2026-06-01', 'BE')).toBe(-10)
  })

  it.each(HOLIDAY_COUNTRIES)('yields a plausible yearly total for %s', (country) => {
    const total = workingDaysBetween('2026-01-01', '2026-12-31', country)

    expect(total).toBeGreaterThan(240)
    expect(total).toBeLessThan(256)
  })
})
