import { describe, it, expect } from 'vitest'
import { diffDays, isIsoDate, toIsoDate, toIsoDateInZone, today, toUtcDate } from '../../../services/shipments/dates.js'

describe('isIsoDate', () => {
  it.each(['2026-01-01', '2026-12-31', '2024-02-29'])('accepts %s', (value) => {
    expect(isIsoDate(value)).toBe(true)
  })

  it.each([
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-1-1',
    '26-01-01',
    '2026/01/01',
    '2026-01-01T00:00:00Z',
    '',
    null,
    42,
  ])('rejects %o', (value) => {
    expect(isIsoDate(value)).toBe(false)
  })
})

describe('diffDays', () => {
  it('counts whole days forward', () => {
    expect(diffDays('2026-05-01', '2026-05-11')).toBe(10)
  })

  it('returns zero for the same day', () => {
    expect(diffDays('2026-05-01', '2026-05-01')).toBe(0)
  })

  it('returns a negative count when the order is reversed', () => {
    expect(diffDays('2026-05-11', '2026-05-01')).toBe(-10)
  })

  it('crosses a month boundary', () => {
    expect(diffDays('2026-01-30', '2026-02-02')).toBe(3)
  })

  it('crosses a leap day', () => {
    expect(diffDays('2024-02-28', '2024-03-01')).toBe(2)
  })

  it('is unaffected by the spring daylight saving jump', () => {
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('is unaffected by the autumn daylight saving jump', () => {
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2)
  })
})

describe('toIsoDate', () => {
  it('reads the date part of a database DATE, which Prisma returns at UTC midnight', () => {
    expect(toIsoDate(new Date('2026-05-01T00:00:00.000Z'))).toBe('2026-05-01')
  })
})

describe('toIsoDateInZone', () => {
  it('uses the Brussels day, not the UTC one, late in the evening', () => {
    expect(toIsoDateInZone(new Date('2026-06-30T23:30:00.000Z'))).toBe('2026-07-01')
  })

  it('keeps the same day when both zones agree', () => {
    expect(toIsoDateInZone(new Date('2026-06-30T12:00:00.000Z'))).toBe('2026-06-30')
  })

  it('applies winter time as well', () => {
    expect(toIsoDateInZone(new Date('2026-12-31T23:30:00.000Z'))).toBe('2027-01-01')
  })
})

describe('today', () => {
  it('is the Brussels day of the instant it is given', () => {
    expect(today(new Date('2026-06-30T23:30:00.000Z'))).toBe('2026-07-01')
  })

  it('produces a value isIsoDate accepts', () => {
    expect(isIsoDate(today())).toBe(true)
  })
})

describe('toUtcDate', () => {
  it('anchors an ISO date at UTC midnight', () => {
    expect(toUtcDate('2026-05-01').toISOString()).toBe('2026-05-01T00:00:00.000Z')
  })
})
