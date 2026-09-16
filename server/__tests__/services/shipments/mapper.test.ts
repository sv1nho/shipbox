import { describe, it, expect } from 'vitest'
import { toShipmentDto } from '../../../services/shipments/mapper.js'
import type { ShipmentRow } from '../../../services/shipments/mapper.js'
import { AppError } from '../../../errors.js'

const TODAY = '2026-06-15'

const row = (overrides: Partial<ShipmentRow> = {}): ShipmentRow => ({
  id: '11111111-1111-4111-8111-111111111111',
  trackingNumber: '323200000000000000000001',
  carrier: 'bpost',
  recipientPostalCode: '2000',
  recipientCountry: 'BE',
  status: 'pending',
  amountCents: 4999,
  currency: 'EUR',
  store: 'Zalando',
  requestedDate: new Date('2026-06-01T00:00:00.000Z'),
  dropoffDate: null,
  receivedDate: null,
  decisionDate: null,
  orderNumber: null,
  note: null,
  createdAt: new Date('2026-06-10T08:00:00.000Z'),
  updatedAt: new Date('2026-06-11T08:00:00.000Z'),
  archivedAt: null,
  label: null,
  ...overrides,
})

const codeOf = (run: () => unknown): string => {
  try {
    run()
  } catch (cause) {
    return cause instanceof AppError ? cause.code : 'NOT_AN_APP_ERROR'
  }
  return 'NO_ERROR'
}

describe('toShipmentDto', () => {
  it('reads a database DATE as a plain calendar date', () => {
    const dto = toShipmentDto(row({ dropoffDate: new Date('2026-06-01T00:00:00.000Z') }), TODAY)

    expect(dto.dropoffDate).toBe('2026-06-01')
  })

  it('keeps the technical timestamps as full instants', () => {
    const dto = toShipmentDto(row(), TODAY)

    expect(dto.createdAt).toBe('2026-06-10T08:00:00.000Z')
    expect(dto.updatedAt).toBe('2026-06-11T08:00:00.000Z')
    expect(dto.archivedAt).toBeNull()
  })

  it('exposes an archived timestamp when there is one', () => {
    const dto = toShipmentDto(row({ archivedAt: new Date('2026-06-12T08:00:00.000Z') }), TODAY)

    expect(dto.archivedAt).toBe('2026-06-12T08:00:00.000Z')
  })

  it('always builds a tracking url', () => {
    expect(toShipmentDto(row(), TODAY).trackingUrl).toContain('323200000000000000000001')
  })

  it.each([
    [null, false],
    [{ shipmentId: '11111111-1111-4111-8111-111111111111' }, true],
  ])('reports hasLabel as %s -> %s', (label, expected) => {
    expect(toShipmentDto(row({ label }), TODAY).hasLabel).toBe(expected)
  })

  it('treats a missing label relation as no label', () => {
    const bare = row()
    delete bare.label

    expect(toShipmentDto(bare, TODAY).hasLabel).toBe(false)
  })

  it('carries the derived fields', () => {
    const dto = toShipmentDto(
      row({
        status: 'received',
        dropoffDate: new Date('2026-05-01T00:00:00.000Z'),
        receivedDate: new Date('2026-05-04T00:00:00.000Z'),
      }),
      TODAY
    )

    expect(dto.daysSinceReceived).not.toBeNull()
    expect(dto.needsAction).toBe(true)
  })

  describe('refusing values the database should never hold', () => {
    it('refuses a carrier it cannot build a link for', () => {
      expect(codeOf(() => toShipmentDto(row({ carrier: 'dhl' }), TODAY))).toBe('INTERNAL_ERROR')
    })

    it('refuses a status the state machine does not know', () => {
      expect(codeOf(() => toShipmentDto(row({ status: 'lost' }), TODAY))).toBe('INTERNAL_ERROR')
    })
  })
})
