import { describe, it, expect } from 'vitest'
import {
  assertChronology,
  computeDerived,
  planRevert,
  planTransition,
} from '../../../services/shipments/status.js'
import type { ShipmentState } from '../../../services/shipments/status.js'
import { TRANSITIONS } from '../../../../shared/transitions.js'
import type { TransitionAction } from '../../../../shared/transitions.js'
import { AppError } from '../../../errors.js'
import { SHIPMENT_STATUSES } from '../../../../shared/shipment-status.js'
import type { ShipmentStatus } from '../../../../shared/shipment-status.js'

const TODAY = '2026-06-15'

const state = (overrides: Partial<ShipmentState> = {}): ShipmentState => ({
  status: 'pending',
  rejectionReason: null,
  requestedDate: '2026-06-01',
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
      ['rejected', 'reject'],
    ] as [ShipmentStatus, TransitionAction][])('refuses %s -> %s', (status, action) => {
      expect(codeOf(() => planTransition(state({ status }), action, '2026-06-10', TODAY)))
        .toBe('ILLEGAL_TRANSITION')
    })
  })

  describe('changing a decision', () => {
    const decided = (status: 'refunded' | 'rejected') =>
      state({
        status,
        dropoffDate: '2026-06-01',
        receivedDate: '2026-06-05',
        decisionDate: '2026-06-10',
      })

    it('turns a refund into a refusal, keeping the earlier dates', () => {
      const next = planTransition(decided('refunded'), 'reject', '2026-06-12', TODAY)

      expect(next.status).toBe('rejected')
      expect(next.decisionDate).toBe('2026-06-12')
      expect(next.receivedDate).toBe('2026-06-05')
      expect(next.dropoffDate).toBe('2026-06-01')
    })

    it('turns a refusal into a refund', () => {
      const next = planTransition(decided('rejected'), 'refund', '2026-06-12', TODAY)

      expect(next.status).toBe('refunded')
      expect(next.decisionDate).toBe('2026-06-12')
    })

    it('still refuses to repeat the same decision, that is what a date edit is for', () => {
      expect(codeOf(() => planTransition(decided('refunded'), 'refund', '2026-06-12', TODAY)))
        .toBe('ILLEGAL_TRANSITION')
    })

    it('still refuses a new decision date earlier than the reception', () => {
      expect(codeOf(() => planTransition(decided('refunded'), 'reject', '2026-06-02', TODAY)))
        .toBe('VALIDATION_ERROR')
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

describe('the refusal reason, which belongs to the decision', () => {
  it('is kept when the decision is a refusal', () => {
    const next = planTransition(state({ status: 'received', receivedDate: '2026-06-05' }),
      'reject', '2026-06-10', TODAY, 'Worn item')

    expect(next.rejectionReason).toBe('Worn item')
  })

  it('is dropped when the refusal becomes a refund', () => {
    const refused = planTransition(state({ status: 'received', receivedDate: '2026-06-05' }),
      'reject', '2026-06-10', TODAY, 'Worn item')

    expect(planTransition(refused, 'refund', '2026-06-11', TODAY).rejectionReason).toBeNull()
  })

  it('is dropped when the decision itself is undone', () => {
    const refused = planTransition(state({ status: 'received', receivedDate: '2026-06-05' }),
      'reject', '2026-06-10', TODAY, 'Worn item')

    expect(planRevert(refused).rejectionReason).toBeNull()
  })

  it('never appears on a step that is not a refusal', () => {
    expect(planTransition(state(), 'drop_off', '2026-06-02', TODAY).rejectionReason).toBeNull()
  })
})

describe('assertChronology', () => {
  const dated = (overrides: Partial<ShipmentState> = {}) => ({
    requestedDate: '2026-06-01',
    dropoffDate: null,
    receivedDate: null,
    decisionDate: null,
    ...overrides,
  })

  it('accepts dates in order', () => {
    expect(() => {
      assertChronology(dated({ dropoffDate: '2026-06-02', receivedDate: '2026-06-05', decisionDate: '2026-06-10' }))
    }).not.toThrow()
  })

  it('accepts a gap left by a skipped step', () => {
    expect(() => {
      assertChronology(dated({ dropoffDate: '2026-06-02', decisionDate: '2026-06-10' }))
    }).not.toThrow()
  })

  it('accepts a shipment where nothing has happened since the request', () => {
    expect(() => { assertChronology(dated()) }).not.toThrow()
  })

  it.each([
    ['a reception before the drop-off', { dropoffDate: '2026-06-05', receivedDate: '2026-06-02' }],
    ['a decision before the reception', { receivedDate: '2026-06-05', decisionDate: '2026-06-02' }],
    ['a decision before the drop-off with the reception skipped', { dropoffDate: '2026-06-05', decisionDate: '2026-06-02' }],
    ['a drop-off before the return was even requested', { dropoffDate: '2026-05-20' }],
    ['a reception before the request, with the drop-off skipped', { receivedDate: '2026-05-20' }],
  ])('refuses %s', (_label, overrides) => {
    expect(codeOf(() => { assertChronology(dated(overrides)) })).toBe('VALIDATION_ERROR')
  })
})

describe('computeDerived', () => {
  const derived = (overrides: Partial<ShipmentState> = {}) =>
    computeDerived({ ...state(), ...overrides }, TODAY)

  describe('delays, counted in calendar days', () => {
    it('measures the store decision delay from the reception', () => {
      expect(derived({ receivedDate: '2026-06-01', decisionDate: '2026-06-15' }).decisionDelayDays).toBe(14)
    })

    it('measures the total delay from the drop-off', () => {
      expect(derived({ dropoffDate: '2026-05-29', decisionDate: '2026-06-15' }).totalDelayDays).toBe(17)
    })

    it('counts the days since the drop-off', () => {
      expect(derived({ dropoffDate: '2026-06-10' }).daysSinceDropoff).toBe(5)
    })

    it('counts the days since the reception', () => {
      expect(derived({ receivedDate: '2026-06-10' }).daysSinceReceived).toBe(5)
    })

    it('counts the days since the shipment was created', () => {
      expect(derived({ requestedDate: '2026-06-10' }).daysSinceRequested).toBe(5)
    })

    it('counts the weekend too, a friday to monday delay is three days', () => {
      expect(derived({ receivedDate: '2026-06-05', decisionDate: '2026-06-08' }).decisionDelayDays).toBe(3)
    })

    it('counts a public holiday like any other day', () => {
      expect(derived({ receivedDate: '2026-07-17', decisionDate: '2026-07-24' }).decisionDelayDays).toBe(7)
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

    it('has no days since drop-off without a drop-off date', () => {
      expect(derived().daysSinceDropoff).toBeNull()
    })
  })

  describe('needsAction, the parcel arrived and no decision came', () => {
    it.each([
      ['2026-06-02', 13, false],
      ['2026-06-01', 14, true],
      ['2026-05-31', 15, true],
    ])('received on %s, that is %i days ago', (receivedDate, _days, expected) => {
      expect(derived({ status: 'received', receivedDate }).needsAction).toBe(expected)
    })

    it('fires exactly on the fourteenth day, the threshold is inclusive', () => {
      expect(derived({ status: 'received', receivedDate: '2026-06-01' }).daysSinceReceived).toBe(14)
      expect(derived({ status: 'received', receivedDate: '2026-06-01' }).needsAction).toBe(true)
    })

    it.each(SHIPMENT_STATUSES.filter((s) => s !== 'received'))(
      'stays false for a %s shipment however old',
      (status) => {
        expect(derived({ status, receivedDate: '2026-01-01' }).needsAction).toBe(false)
      }
    )
  })

  describe('daysLeft, the time still owed to the step in progress', () => {
    it('counts down from the thirty days a label is valid', () => {
      expect(derived({ status: 'pending', requestedDate: '2026-06-10' }).daysLeft).toBe(25)
    })

    it('counts down from the fourteen days a parcel may travel', () => {
      expect(derived({ status: 'dropped_off', dropoffDate: '2026-06-10' }).daysLeft).toBe(9)
    })

    it('counts down from the fourteen days a store may take to decide', () => {
      expect(derived({ status: 'received', receivedDate: '2026-06-10' }).daysLeft).toBe(9)
    })

    it('reaches zero on the day the wait becomes too long', () => {
      expect(derived({ status: 'received', receivedDate: '2026-06-01' }).daysLeft).toBe(0)
    })

    it('goes negative once the day has passed, rather than stopping at zero', () => {
      expect(derived({ status: 'received', receivedDate: '2026-05-30' }).daysLeft).toBe(-2)
    })

    it.each(['refunded', 'rejected'] as const)('stops counting once %s, the wait is over', (status) => {
      expect(derived({ status, receivedDate: '2026-06-01', decisionDate: '2026-06-10' }).daysLeft)
        .toBeNull()
    })

    it('counts nothing without the date its step starts from', () => {
      expect(derived({ status: 'received', receivedDate: null }).daysLeft).toBeNull()
    })
  })

  describe('shippingLate, the parcel left and never arrived', () => {
    it.each([
      ['2026-06-02', 13, false],
      ['2026-06-01', 14, true],
      ['2026-05-31', 15, true],
    ])('dropped off on %s, that is %i days ago', (dropoffDate, _days, expected) => {
      expect(derived({ status: 'dropped_off', dropoffDate }).shippingLate).toBe(expected)
    })

    it.each(SHIPMENT_STATUSES.filter((s) => s !== 'dropped_off'))(
      'stays false for a %s shipment however old',
      (status) => {
        expect(derived({ status, dropoffDate: '2026-01-01' }).shippingLate).toBe(false)
      }
    )
  })

  describe('labelExpiring, the label is about to be worthless', () => {
    it.each([
      ['2026-05-24', 22, false],
      ['2026-05-23', 23, true],
      ['2026-05-22', 24, true],
    ])('requested on %s, that is %i days ago', (requestedDate, _days, expected) => {
      expect(derived({ status: 'pending', requestedDate }).labelExpiring).toBe(expected)
    })

    it('warns with a week still on the clock, not once the label is dead', () => {
      expect(derived({ status: 'pending', requestedDate: '2026-05-23' }).daysLeft).toBe(7)
    })

    it.each(SHIPMENT_STATUSES.filter((s) => s !== 'pending'))(
      'stays false for a %s shipment however old',
      (status) => {
        expect(derived({ status, requestedDate: '2026-01-01' }).labelExpiring).toBe(false)
      }
    )
  })
})
