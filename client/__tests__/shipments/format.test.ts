import { describe, it, expect } from 'vitest'
import { alertMessage, formatAmount, formatDate, statusLabel, workingDays } from '../../shipments/format.js'
import { SHIPMENT_STATUSES } from '../../../shared/shipment-status.js'
import { makeShipment as shipment } from '../fixtures.js'

describe('formatAmount', () => {
  it.each([
    [4999, '€49.99'],
    [0, '€0.00'],
    [5, '€0.05'],
    [123456, '€1,234.56'],
  ])('turns %i cents into %s', (cents, expected) => {
    expect(formatAmount(cents, 'EUR')).toBe(expected)
  })

  it('never loses a cent to floating point', () => {
    expect(formatAmount(1010, 'EUR')).toBe('€10.10')
    expect(formatAmount(2999, 'EUR')).toBe('€29.99')
  })

  it('honours another currency should the column ever hold one', () => {
    expect(formatAmount(4999, 'USD')).toContain('49.99')
  })
})

describe('formatDate', () => {
  it('reads a stored date without shifting it by a timezone', () => {
    expect(formatDate('2026-06-15')).toBe('15 Jun 2026')
  })

  it('reads the first day of the year, the one a timezone shift would break', () => {
    expect(formatDate('2026-01-01')).toBe('01 Jan 2026')
  })

  it('shows a dash rather than an empty cell when there is no date', () => {
    expect(formatDate(null)).toBe('—')
  })
})

describe('statusLabel', () => {
  it.each(SHIPMENT_STATUSES)('gives %s a readable label', (status) => {
    expect(statusLabel(status)).not.toBe('')
    expect(statusLabel(status)).not.toContain('_')
  })

  it('spells the two word status out', () => {
    expect(statusLabel('dropped_off')).toBe('Dropped off')
  })
})

describe('workingDays', () => {
  it.each([
    [0, '0 working days'],
    [1, '1 working day'],
    [2, '2 working days'],
    [14, '14 working days'],
  ])('says %i as %s', (count, expected) => {
    expect(workingDays(count)).toBe(expected)
  })

  it('shows a dash when the count could not be derived', () => {
    expect(workingDays(null)).toBe('—')
  })
})

describe('alertMessage', () => {
  it('explains a parcel the store is sitting on', () => {
    const message = alertMessage(shipment({ status: 'received', needsAction: true, daysSinceReceived: 21 }))

    expect(message).toContain('21 working days')
    expect(message).toContain('chase')
  })

  it('explains a label that never became a parcel', () => {
    const message = alertMessage(shipment({ shouldDropOff: true, daysSinceCreated: 9 }))

    expect(message).toContain('9 working days')
    expect(message).toContain('dropped off')
  })

  it('says nothing when there is nothing to say', () => {
    expect(alertMessage(shipment())).toBeNull()
  })

  it('prefers the reception alert, the one that needs a phone call', () => {
    const message = alertMessage(
      shipment({ status: 'received', needsAction: true, shouldDropOff: true, daysSinceReceived: 20 })
    )

    expect(message).toContain('chase')
  })
})
