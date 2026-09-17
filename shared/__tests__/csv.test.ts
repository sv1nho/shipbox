import { describe, it, expect } from 'vitest'
import { CSV_COLUMNS, parseCsv, toCsv } from '../csv.js'
import type { ShipmentDto } from '../shipment.js'

const shipment = (overrides: Partial<ShipmentDto> = {}): ShipmentDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  trackingNumber: '323200000000000000000001',
  carrier: 'bpost',
  recipientPostalCode: '2000',
  recipientCountry: 'BE',
  status: 'pending',
  amountCents: 4999,
  currency: 'EUR',
  store: 'Zalando',
  storeSupportEmail: null,
  requestedDate: '2026-06-01',
  dropoffDate: null,
  receivedDate: null,
  decisionDate: null,
  orderNumber: null,
  note: null,
  rejectionReason: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  archivedAt: null,
  trackingUrl: 'https://track.bpost.cloud/',
  hasLabel: false,
  daysSinceRequested: 0,
  daysSinceDropoff: null,
  daysSinceReceived: null,
  decisionDelayDays: null,
  totalDelayDays: null,
  needsAction: false,
  shippingLate: false,
  labelExpiring: false,
  shouldDropOff: false,
  ...overrides,
})

describe('toCsv', () => {
  it('names every column in the header', () => {
    expect(toCsv([]).split('\r\n')[0]).toBe(CSV_COLUMNS.join(','))
  })

  it('writes an empty cell for an absent value, never the word null', () => {
    const [, row] = toCsv([shipment()]).split('\r\n')

    expect(row).toContain(',,')
    expect(row).not.toContain('null')
  })

  it('quotes a value that would otherwise break the row', () => {
    const [, row] = toCsv([shipment({ store: 'Zalando, Belgium' })]).split('\r\n')

    expect(row).toContain('"Zalando, Belgium"')
  })

  it('doubles a quote inside a value, the csv way of escaping it', () => {
    const [, row] = toCsv([shipment({ store: 'The "Shop"' })]).split('\r\n')

    expect(row).toContain('"The ""Shop"""')
  })
})

describe('parseCsv', () => {
  it('reads nothing out of an empty file', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('reads a header without rows as no rows', () => {
    expect(parseCsv('trackingNumber,store')).toEqual([])
  })

  it('keys each row by the header names', () => {
    expect(parseCsv('trackingNumber,store\r\n3232,Zalando'))
      .toEqual([{ trackingNumber: '3232', store: 'Zalando' }])
  })

  it('trims the header and the cells, so a spreadsheet export still reads', () => {
    expect(parseCsv(' trackingNumber , store \r\n 3232 , Zalando '))
      .toEqual([{ trackingNumber: '3232', store: 'Zalando' }])
  })

  it('reads a quoted comma as part of the value', () => {
    expect(parseCsv('store\r\n"Zalando, Belgium"')).toEqual([{ store: 'Zalando, Belgium' }])
  })

  it('reads a doubled quote as one quote', () => {
    expect(parseCsv('store\r\n"The ""Shop"""')).toEqual([{ store: 'The "Shop"' }])
  })

  it('reads a newline inside a quoted value', () => {
    expect(parseCsv('note\r\n"first\r\nsecond"')).toEqual([{ note: 'first\r\nsecond' }])
  })

  it('accepts a file that uses bare newlines', () => {
    expect(parseCsv('store\nZalando\nZara')).toEqual([{ store: 'Zalando' }, { store: 'Zara' }])
  })

  it('skips a blank line rather than reading an empty shipment', () => {
    expect(parseCsv('store\r\nZalando\r\n\r\nZara')).toHaveLength(2)
  })

  it('leaves a missing trailing cell empty instead of undefined', () => {
    expect(parseCsv('store,note\r\nZalando')).toEqual([{ store: 'Zalando', note: '' }])
  })
})

describe('the round trip, which is what makes an export editable', () => {
  it('reads back every column it wrote', () => {
    const rows = parseCsv(toCsv([shipment({
      store: 'Zalando, Belgium',
      orderNumber: 'ZAL-1',
      dropoffDate: '2026-06-03',
      rejectionReason: 'Worn "shoes"',
    })]))

    expect(rows).toHaveLength(1)
    expect(rows[0].store).toBe('Zalando, Belgium')
    expect(rows[0].orderNumber).toBe('ZAL-1')
    expect(rows[0].dropoffDate).toBe('2026-06-03')
    expect(rows[0].rejectionReason).toBe('Worn "shoes"')
  })
})
