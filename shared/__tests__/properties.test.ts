import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  normalizePostalCode,
  normalizeStore,
  normalizeTrackingNumber,
  parseAmount,
} from '../normalize.js'
import { toCsv, parseCsv, CSV_COLUMNS } from '../csv.js'
import { findOrderBreak, allowedActions, isTransitionAllowed } from '../transitions.js'
import { SHIPMENT_STATUSES } from '../shipment-status.js'
import type { ShipmentDto } from '../shipment.js'

const RUNS = { numRuns: 300, seed: 20261005 }

const anyText = fc.string({ maxLength: 120 })

describe('whatever is typed into a tracking number', () => {
  it('comes out without a space and in capitals', () => {
    fc.assert(fc.property(anyText, (typed) => {
      const normalised = normalizeTrackingNumber(typed)

      expect(normalised).not.toMatch(/\s/)
      expect(normalised).toBe(normalised.toUpperCase())
    }), RUNS)
  })

  it('does not change again when normalised twice', () => {
    fc.assert(fc.property(anyText, (typed) => {
      const once = normalizeTrackingNumber(typed)

      expect(normalizeTrackingNumber(once)).toBe(once)
    }), RUNS)
  })
})

describe('whatever is typed into a store name', () => {
  it('keeps single spaces inside and none at the ends', () => {
    fc.assert(fc.property(anyText, (typed) => {
      const normalised = normalizeStore(typed)

      expect(normalised).toBe(normalised.trim())
      expect(normalised).not.toMatch(/\s{2}/)
    }), RUNS)
  })
})

describe('whatever is typed into a postal code', () => {
  it('never grows, since normalising only removes spaces', () => {
    fc.assert(fc.property(anyText, (typed) => {
      expect(normalizePostalCode(typed).length).toBeLessThanOrEqual(typed.length)
    }), RUNS)
  })
})

describe('whatever is typed into an amount', () => {
  it('is read as cents, or refused, but never as something else', () => {
    fc.assert(fc.property(anyText, (typed) => {
      const cents = parseAmount(typed)

      if (cents === null) return

      expect(Number.isInteger(cents)).toBe(true)
      expect(cents).toBeGreaterThanOrEqual(0)
    }), RUNS)
  })

  it('reads a well formed amount as the cents it says', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 9_999_999 }),
      fc.integer({ min: 0, max: 99 }),
      (units, cents) => {
        const written = `${String(units)}.${String(cents).padStart(2, '0')}`

        expect(parseAmount(written)).toBe(units * 100 + cents)
      }
    ), RUNS)
  })

  it('reads a comma the way a Belgian keyboard writes it', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 9_999_999 }),
      fc.integer({ min: 0, max: 99 }),
      (units, cents) => {
        const written = `${String(units)},${String(cents).padStart(2, '0')}`
        const dotted = written.replace(',', '.')

        expect(parseAmount(written)).toBe(parseAmount(dotted))
      }
    ), RUNS)
  })
})

const shipment = (store: string, note: string | null): ShipmentDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  trackingNumber: '323200000000000000000001',
  carrier: 'bpost',
  status: 'pending',
  store,
  storeSupportEmail: null,
  amountCents: 4999,
  currency: 'EUR',
  orderNumber: 'ZAL-1',
  requestedDate: '2026-06-01',
  dropoffDate: null,
  receivedDate: null,
  decisionDate: null,
  rejectionReason: null,
  note,
  neverReceived: false,
  lastChasedAt: null,
  hasLabel: false,
  recipientPostalCode: '2000',
  recipientCountry: 'BE',
  trackingUrl: 'https://example.test',
  needsAction: false,
  shippingLate: false,
  labelExpiring: false,
  daysLeft: null,
  awaitingReply: false,
  daysSinceRequested: 0,
  daysSinceDropoff: null,
  daysSinceReceived: null,
  decisionDelayDays: null,
  totalDelayDays: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  archivedAt: null,
})

describe('a shipment written to csv', () => {
  it('reads the store back as it was, whatever it contains', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 60 }).filter((value) => value.trim() !== ''),
      (store) => {
        const [read] = parseCsv(toCsv([shipment(store, null)]))

        expect(read.store).toBe(store.trim())
      }
    ), RUNS)
  })

  it('keeps one cell per column, however many quotes and commas are inside', () => {
    fc.assert(fc.property(fc.string({ maxLength: 40 }), (store) => {
      const [read] = parseCsv(toCsv([shipment(`${store}x`, null)]))

      expect(Object.keys(read)).toHaveLength(CSV_COLUMNS.length)
    }), RUNS)
  })
})

describe('the order the dates must follow', () => {
  const isoDate = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
    .map((date) => date.toISOString().slice(0, 10))

  it('is broken only when a later step happens before an earlier one', () => {
    fc.assert(fc.property(isoDate, isoDate, (requested, dropoff) => {
      const broken = findOrderBreak({ requestedDate: requested, dropoffDate: dropoff })

      expect(broken === null).toBe(dropoff >= requested)
    }), RUNS)
  })
})

describe('which step a shipment may take next', () => {
  it('only ever offers actions the rules allow from where it stands', () => {
    fc.assert(fc.property(fc.constantFrom(...SHIPMENT_STATUSES), (status) => {
      for (const action of allowedActions(status)) {
        expect(isTransitionAllowed(status, action)).toBe(true)
      }
    }), RUNS)
  })
})
