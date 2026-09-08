import { describe, it, expect } from 'vitest'
import {
  TRANSITIONS,
  TRANSITION_ACTIONS,
  assertChronology,
  computeDerived,
  planRevert,
  planTransition,
} from '../../../services/shipments/status.js'
import type { ShipmentState, TransitionAction } from '../../../services/shipments/status.js'
import { AppError } from '../../../errors.js'
import { SHIPMENT_STATUSES } from '../../../../shared/shipment-status.js'
import type { ShipmentStatus } from '../../../../shared/shipment-status.js'

const TODAY = '2026-06-15'

const state = (overrides: Partial<ShipmentState> = {}): ShipmentState => ({
  status: 'pending',
  dropoffDate: null,
  receivedDate: null,
  decisionDate: null,
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

const targetsOf = (): ShipmentStatus[] => TRANSITION_ACTIONS.map((action) => TRANSITIONS[action].target)

describe('the transition table', () => {
  it('covers every status a shipment can be moved into', () => {
    expect(new Set(targetsOf())).toEqual(new Set(SHIPMENT_STATUSES.filter((s) => s !== 'pending')))
  })

  it('never lets a transition target the starting status', () => {
    expect(targetsOf()).not.toContain('pending')
  })
})

describe('planTransition', () => {
  describe('moving forward', () => {
    it('drops off a pending shipment', () => {
      const next = planTransition(state(), 'drop_off', '2026-06-10', TODAY)

      expect(next.status).toBe('dropped_off')
      expect(next.dropoffDate).toBe('2026-06-10')
    })

    it('receives a dropped off shipment', () => {
      const current = state({ status: 'dropped_off', dropoffDate: '2026-06-01' })
      const next = planTransition(current, 'receive', '2026-06-05', TODAY)

      expect(next.status).toBe('received')
      expect(next.receivedDate).toBe('2026-06-05')
      expect(next.dropoffDate).toBe('2026-06-01')
    })

    it.each(['refund', 'reject'] as const)('closes a received shipment with %s', (action) => {
      const current = state({ status: 'received', dropoffDate: '2026-06-01', receivedDate: '2026-06-05' })
      const next = planTransition(current, action, '2026-06-10', TODAY)

      expect(next.status).toBe(TRANSITIONS[action].target)
      expect(next.decisionDate).toBe('2026-06-10')
    })
  })

  describe('skipping steps, which the API allows', () => {
    it('refunds a pending shipment and leaves the skipped dates null', () => {
      const next = planTransition(state(), 'refund', '2026-06-10', TODAY)

      expect(next.status).toBe('refunded')
      expect(next.decisionDate).toBe('2026-06-10')
      expect(next.dropoffDate).toBeNull()
      expect(next.receivedDate).toBeNull()
    })

    it('receives a pending shipment without inventing a drop-off date', () => {
      const next = planTransition(state(), 'receive', '2026-06-10', TODAY)

      expect(next.status).toBe('received')
      expect(next.dropoffDate).toBeNull()
    })
  })

  describe('never going backwards', () => {
    it.each([
      ['dropped_off', 'drop_off'],
      ['received', 'drop_off'],
      ['received', 'receive'],
      ['refunded', 'drop_off'],
      ['refunded', 'receive'],
      ['refunded', 'refund'],
      ['refunded', 'reject'],
      ['rejected', 'refund'],
      ['rejected', 'reject'],
    ] as [ShipmentStatus, TransitionAction][])('refuses %s -> %s', (status, action) => {
      expect(codeOf(() => planTransition(state({ status }), action, '2026-06-10', TODAY)))
        .toBe('ILLEGAL_TRANSITION')
    })

    it('refuses to swap one decision for the other, a revert is needed first', () => {
      const current = state({ status: 'refunded', decisionDate: '2026-06-10' })

      expect(codeOf(() => planTransition(current, 'reject', '2026-06-11', TODAY)))
        .toBe('ILLEGAL_TRANSITION')
    })
  })

  describe('the date it requires', () => {
    it.each(['', '2026-13-01', '2026-06-31', 'yesterday', '2026-06-10T00:00:00Z'])(
      'refuses %s, which is not a calendar date',
      (date) => {
        expect(codeOf(() => planTransition(state(), 'drop_off', date, TODAY))).toBe('VALIDATION_ERROR')
      }
    )

    it('refuses a date in the future', () => {
      expect(codeOf(() => planTransition(state(), 'drop_off', '2026-06-16', TODAY)))
        .toBe('VALIDATION_ERROR')
    })

    it('accepts today', () => {
      expect(planTransition(state(), 'drop_off', TODAY, TODAY).dropoffDate).toBe(TODAY)
    })

    it('refuses a reception earlier than the drop-off', () => {
      const current = state({ status: 'dropped_off', dropoffDate: '2026-06-10' })

      expect(codeOf(() => planTransition(current, 'receive', '2026-06-01', TODAY)))
        .toBe('VALIDATION_ERROR')
    })

    it('accepts a reception on the day of the drop-off', () => {
      const current = state({ status: 'dropped_off', dropoffDate: '2026-06-10' })

      expect(planTransition(current, 'receive', '2026-06-10', TODAY).receivedDate).toBe('2026-06-10')
    })

    it('refuses a decision earlier than the drop-off when the reception was skipped', () => {
      const current = state({ status: 'dropped_off', dropoffDate: '2026-06-10' })

      expect(codeOf(() => planTransition(current, 'refund', '2026-06-01', TODAY)))
        .toBe('VALIDATION_ERROR')
    })
  })

  it('leaves the shipment it was given untouched', () => {
    const current = state()
    planTransition(current, 'drop_off', '2026-06-10', TODAY)

    expect(current).toEqual(state())
  })
})

describe('planRevert', () => {
  it('refuses to undo a pending shipment', () => {
    expect(codeOf(() => planRevert(state()))).toBe('ILLEGAL_TRANSITION')
  })

  it('returns a dropped off shipment to pending', () => {
    const next = planRevert(state({ status: 'dropped_off', dropoffDate: '2026-06-01' }))

    expect(next).toEqual(state())
  })

  it('returns a received shipment to dropped off', () => {
    const next = planRevert(state({
      status: 'received',
      dropoffDate: '2026-06-01',
      receivedDate: '2026-06-05',
    }))

    expect(next).toEqual(state({ status: 'dropped_off', dropoffDate: '2026-06-01' }))
  })

  it.each(['refunded', 'rejected'] as const)('returns a %s shipment to received', (status) => {
    const next = planRevert(state({
      status,
      dropoffDate: '2026-06-01',
      receivedDate: '2026-06-05',
      decisionDate: '2026-06-10',
    }))

    expect(next).toEqual(state({
      status: 'received',
      dropoffDate: '2026-06-01',
      receivedDate: '2026-06-05',
    }))
  })

  it('returns a shipment refunded straight from pending back to pending, not to received', () => {
    const next = planRevert(state({ status: 'refunded', decisionDate: '2026-06-10' }))

    expect(next).toEqual(state())
  })

  it('returns a shipment refunded from dropped off back to dropped off', () => {
    const next = planRevert(state({
      status: 'refunded',
      dropoffDate: '2026-06-01',
      decisionDate: '2026-06-10',
    }))

    expect(next).toEqual(state({ status: 'dropped_off', dropoffDate: '2026-06-01' }))
  })

  it('clears a decision date that a reception no longer supports', () => {
    const next = planRevert(state({
      status: 'received',
      dropoffDate: '2026-06-01',
      receivedDate: '2026-06-05',
      decisionDate: '2026-06-10',
    }))

    expect(next.decisionDate).toBeNull()
  })

  it('undoes exactly what the matching transition did', () => {
    const before = state({ status: 'dropped_off', dropoffDate: '2026-06-01' })
    const after = planTransition(before, 'receive', '2026-06-05', TODAY)

    expect(planRevert(after)).toEqual(before)
  })

  it('leaves the shipment it was given untouched', () => {
    const current = state({ status: 'dropped_off', dropoffDate: '2026-06-01' })
    planRevert(current)

    expect(current).toEqual(state({ status: 'dropped_off', dropoffDate: '2026-06-01' }))
  })
})

describe('assertChronology', () => {
  it('accepts dates in order', () => {
    expect(() => {
      assertChronology({ dropoffDate: '2026-06-01', receivedDate: '2026-06-05', decisionDate: '2026-06-10' })
    }).not.toThrow()
  })

  it('accepts a gap left by a skipped step', () => {
    expect(() => {
      assertChronology({ dropoffDate: '2026-06-01', receivedDate: null, decisionDate: '2026-06-10' })
    }).not.toThrow()
  })

  it('accepts an empty set', () => {
    expect(() => {
      assertChronology({ dropoffDate: null, receivedDate: null, decisionDate: null })
    }).not.toThrow()
  })

  it.each([
    ['a reception before the drop-off', { dropoffDate: '2026-06-05', receivedDate: '2026-06-01', decisionDate: null }],
    ['a decision before the reception', { dropoffDate: null, receivedDate: '2026-06-05', decisionDate: '2026-06-01' }],
    ['a decision before the drop-off with the reception skipped', { dropoffDate: '2026-06-05', receivedDate: null, decisionDate: '2026-06-01' }],
  ])('refuses %s', (_label, dates) => {
    expect(codeOf(() => { assertChronology(dates) })).toBe('VALIDATION_ERROR')
  })
})

describe('computeDerived', () => {
  const derived = (overrides: Partial<ShipmentState> & { createdDate?: string } = {}) =>
    computeDerived({ ...state(), createdDate: '2026-06-01', ...overrides }, TODAY)

  describe('delays', () => {
    it('measures the store decision delay from the reception', () => {
      expect(derived({ receivedDate: '2026-06-01', decisionDate: '2026-06-08' }).decisionDelayDays).toBe(7)
    })

    it('measures the total delay from the drop-off', () => {
      expect(derived({ dropoffDate: '2026-05-30', decisionDate: '2026-06-08' }).totalDelayDays).toBe(9)
    })

    it('counts the days since the reception', () => {
      expect(derived({ receivedDate: '2026-06-10' }).daysSinceReceived).toBe(5)
    })

    it('counts the days since the shipment was created', () => {
      expect(derived({ createdDate: '2026-06-10' }).daysSinceCreated).toBe(5)
    })
  })

  describe('missing sources produce null, never a substituted value', () => {
    it('has no decision delay without a reception date', () => {
      expect(derived({ decisionDate: '2026-06-08' }).decisionDelayDays).toBeNull()
    })

    it('has no decision delay without a decision date', () => {
      expect(derived({ receivedDate: '2026-06-01' }).decisionDelayDays).toBeNull()
    })

    it('has no total delay without a drop-off date', () => {
      expect(derived({ decisionDate: '2026-06-08' }).totalDelayDays).toBeNull()
    })

    it('has no total delay without a decision date', () => {
      expect(derived({ dropoffDate: '2026-06-01' }).totalDelayDays).toBeNull()
    })

    it('has no days since reception without a reception date', () => {
      expect(derived().daysSinceReceived).toBeNull()
    })
  })

  describe('needsAction, the parcel arrived and no decision came', () => {
    it.each([
      ['2026-06-02', 13, false],
      ['2026-06-01', 14, false],
      ['2026-05-31', 15, true],
    ])('at %s the parcel has waited %i days', (receivedDate, _days, expected) => {
      expect(derived({ status: 'received', receivedDate }).needsAction).toBe(expected)
    })

    it.each(SHIPMENT_STATUSES.filter((s) => s !== 'received'))(
      'stays false for a %s shipment however old',
      (status) => {
        expect(derived({ status, receivedDate: '2026-01-01' }).needsAction).toBe(false)
      }
    )
  })

  describe('shouldDropOff, the label was made and the parcel never left', () => {
    it.each([
      ['2026-06-09', 6, false],
      ['2026-06-08', 7, false],
      ['2026-06-07', 8, true],
    ])('created on %s, that is %i days ago', (createdDate, _days, expected) => {
      expect(derived({ status: 'pending', createdDate }).shouldDropOff).toBe(expected)
    })

    it.each(SHIPMENT_STATUSES.filter((s) => s !== 'pending'))(
      'stays false for a %s shipment however old',
      (status) => {
        expect(derived({ status, createdDate: '2026-01-01' }).shouldDropOff).toBe(false)
      }
    )
  })
})
