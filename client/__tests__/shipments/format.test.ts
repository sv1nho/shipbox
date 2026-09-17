import { describe, it, expect } from 'vitest'
import {
  alertMessage,
  days,
  delayInfo,
  formatAmount,
  formatDate,
  statusDate,
  statusLabel,
  zonedDate,
} from '../../shipments/format.js'
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
  it('writes the day first, the way a belgian date is read', () => {
    expect(formatDate('2026-06-15')).toBe('15/06/2026')
  })

  it('keeps the leading zeroes so every date is the same width', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
  })
})

describe('zonedDate', () => {
  it('reads a timestamp as the day it was in Brussels, not in utc', () => {
    expect(zonedDate('2026-06-01T23:30:00.000Z')).toBe('2026-06-02')
  })

  it('keeps the day when the two zones agree', () => {
    expect(zonedDate('2026-06-01T09:00:00.000Z')).toBe('2026-06-01')
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

describe('days', () => {
  it.each([
    [0, '0 days'],
    [1, '1 day'],
    [2, '2 days'],
    [14, '14 days'],
  ])('says %i as %s', (count, expected) => {
    expect(days(count)).toBe(expected)
  })
})

describe('statusDate, the day the pill is about', () => {
  it('shows the day the return was requested while nothing has happened', () => {
    expect(statusDate(shipment({ status: 'pending', requestedDate: '2026-06-01' })))
      .toEqual({ label: 'Requested', date: '2026-06-01' })
  })

  it.each([
    ['dropped_off', 'Dropped off', '2026-06-03'],
    ['received', 'Received', '2026-06-05'],
    ['refunded', 'Decided', '2026-06-09'],
    ['rejected', 'Decided', '2026-06-09'],
  ] as const)('shows the %s day', (status, label, date) => {
    const dated = shipment({
      status,
      dropoffDate: '2026-06-03',
      receivedDate: '2026-06-05',
      decisionDate: '2026-06-09',
    })

    expect(statusDate(dated)).toEqual({ label, date })
  })

  it('falls back to the request rather than showing nothing', () => {
    expect(statusDate(shipment({ status: 'received', receivedDate: null, requestedDate: '2026-06-01' })))
      .toEqual({ label: 'Requested', date: '2026-06-01' })
  })
})

describe('delayInfo, the figure next to the date', () => {
  it.each(['pending', 'dropped_off', 'received'] as const)(
    'tells a %s shipment how long it still has, not how long it has waited',
    (status) => {
      expect(delayInfo(shipment({ status, daysLeft: 9 }))).toBe('9 days left')
    }
  )

  it('names the last day rather than counting zero days left', () => {
    expect(delayInfo(shipment({ status: 'received', daysLeft: 0 }))).toBe('Due today')
  })

  it('counts up again once the day has passed, a negative countdown reading badly', () => {
    expect(delayInfo(shipment({ status: 'received', daysLeft: -3 }))).toBe('3 days over')
  })

  it('drops the plural on the single day that matters most', () => {
    expect(delayInfo(shipment({ status: 'dropped_off', daysLeft: 1 }))).toBe('1 day left')
  })

  it.each(['refunded', 'rejected'] as const)('reports how long the store took once %s', (status) => {
    expect(delayInfo(shipment({ status, daysLeft: null, decisionDelayDays: 6, totalDelayDays: 18 })))
      .toBe('Took 6 days')
  })

  it('still counts a decision taken the same day, which says something', () => {
    expect(delayInfo(shipment({ status: 'refunded', daysLeft: null, decisionDelayDays: 0 })))
      .toBe('Took 0 days')
  })

  it.each([
    ['received', { daysLeft: null }],
    ['refunded', { daysLeft: null, decisionDelayDays: null }],
  ] as const)('reports nothing rather than a dash when %s has no figure', (status, gap) => {
    expect(delayInfo(shipment({ status, ...gap }))).toBeNull()
  })
})

describe('alertMessage', () => {
  it('explains a parcel the store is sitting on', () => {
    const message = alertMessage(shipment({ status: 'received', needsAction: true, daysSinceReceived: 21 }))

    expect(message).toContain('21 days')
    expect(message).toContain('chase')
  })

  it('says nothing when there is nothing to say', () => {
    expect(alertMessage(shipment())).toBeNull()
  })

  it('warns that a dropped parcel never arrived', () => {
    const message = alertMessage(
      shipment({ status: 'dropped_off', shippingLate: true, daysSinceDropoff: 16 })
    )

    expect(message).toContain('16 days')
    expect(message).toContain('still not received it')
  })

  it('warns how long the label still has, the only figure that helps', () => {
    const message = alertMessage(shipment({ labelExpiring: true, daysLeft: 6 }))

    expect(message).toBe('The label expires in 6 days. Drop the parcel off now.')
  })

  it('calls the last day the last day', () => {
    expect(alertMessage(shipment({ labelExpiring: true, daysLeft: 0 })))
      .toBe('The label expires today. Drop the parcel off now.')
  })

  it('stops asking for a drop-off once the label is dead', () => {
    const message = alertMessage(shipment({ labelExpiring: true, daysLeft: -4 }))

    expect(message).toContain('expired 4 days ago')
    expect(message).not.toContain('Drop the parcel off')
  })

  it('prefers the reception alert, the one that needs a phone call', () => {
    const message = alertMessage(
      shipment({ status: 'received', needsAction: true, daysSinceReceived: 20, daysLeft: -6 })
    )

    expect(message).toContain('chase')
  })

  it('never invents a count the api did not send', () => {
    expect(alertMessage(shipment({ needsAction: true, daysSinceReceived: null, daysLeft: null })))
      .toBeNull()
  })

  it('leaves the expiry unsaid rather than guessing at the countdown', () => {
    expect(alertMessage(shipment({ labelExpiring: true, daysLeft: null }))).toBeNull()
  })
})
