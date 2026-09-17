import { describe, it, expect } from 'vitest'
import {
  SHIPMENT_STATUSES,
  DECISION_STATUSES,
  OPEN_STATUSES,
  STATUS_FILTERS,
  isShipmentStatus,
  isDecisionStatus,
  isStatusFilter,
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

describe('OPEN_STATUSES, the returns still waiting on something', () => {
  it('holds every status that is not a decision, and nothing else', () => {
    expect([...OPEN_STATUSES]).toEqual(['pending', 'dropped_off', 'received'])
  })

  it('splits the statuses in two with nothing left over', () => {
    expect(OPEN_STATUSES.length + DECISION_STATUSES.length).toBe(SHIPMENT_STATUSES.length)
  })
})

describe('isStatusFilter', () => {
  it.each(SHIPMENT_STATUSES)('accepts %s, a filter on one state', (status) => {
    expect(isStatusFilter(status)).toBe(true)
  })

  it('accepts open, which is a filter but never a stored status', () => {
    expect(isStatusFilter('open')).toBe(true)
    expect(isShipmentStatus('open')).toBe(false)
  })

  it.each(['closed', 'Open', '', null])('rejects %o', (value) => {
    expect(isStatusFilter(value)).toBe(false)
  })

  it('offers exactly one choice more than the database has states', () => {
    expect(STATUS_FILTERS.length).toBe(SHIPMENT_STATUSES.length + 1)
  })
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
