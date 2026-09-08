import { describe, it, expect } from 'vitest'
import {
  SHIPMENT_STATUSES,
  DECISION_STATUSES,
  isShipmentStatus,
  isDecisionStatus,
} from '../shipment-status.js'

describe('isShipmentStatus', () => {
  it.each(SHIPMENT_STATUSES)('accepts the declared status %s', (status) => {
    expect(isShipmentStatus(status)).toBe(true)
  })

  it.each(['delivered', 'Pending', 'pending ', '', null, 42])('rejects %o', (value) => {
    expect(isShipmentStatus(value)).toBe(false)
  })
})

describe('isDecisionStatus', () => {
  it.each(DECISION_STATUSES)('accepts %s, a status that closes the return', (status) => {
    expect(isDecisionStatus(status)).toBe(true)
  })

  it.each(['pending', 'dropped_off', 'received'])(
    'rejects %s, which still expects a decision',
    (status) => {
      expect(isDecisionStatus(status)).toBe(false)
    }
  )
})

describe('the two lists agree', () => {
  it('lists every decision status as a shipment status', () => {
    for (const status of DECISION_STATUSES) {
      expect(SHIPMENT_STATUSES).toContain(status)
    }
  })

  it('matches the order the database CHECK constraint declares', () => {
    expect([...SHIPMENT_STATUSES]).toEqual([
      'pending',
      'dropped_off',
      'received',
      'refunded',
      'rejected',
    ])
  })
})
