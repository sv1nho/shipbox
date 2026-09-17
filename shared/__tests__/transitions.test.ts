import { describe, it, expect } from 'vitest'
import {
  STATUS_RANK,
  TRANSITIONS,
  TRANSITION_ACTIONS,
  allowedActions,
  earliestDateFor,
  isTransitionAllowed,
  menuSteps,
  nextActions,
  nextStep,
} from '../transitions.js'
import type { DateField, ShipmentTimeline, TransitionAction } from '../transitions.js'
import { SHIPMENT_STATUSES } from '../shipment-status.js'
import type { ShipmentStatus } from '../shipment-status.js'

const targets = (): ShipmentStatus[] => TRANSITION_ACTIONS.map((action) => TRANSITIONS[action].target)

describe('the transition table', () => {
  it('can reach every status except the starting one', () => {
    expect(new Set(targets())).toEqual(new Set(SHIPMENT_STATUSES.filter((s) => s !== 'pending')))
  })

  it('never targets the starting status', () => {
    expect(targets()).not.toContain('pending')
  })

  it.each(TRANSITION_ACTIONS)('%s carries the label and url segment a screen needs', (action) => {
    expect(TRANSITIONS[action].label).not.toBe('')
    expect(TRANSITIONS[action].path).toMatch(/^[a-z-]+$/)
  })

  it.each(SHIPMENT_STATUSES)('%s has a rank', (status) => {
    expect(STATUS_RANK[status]).toBeTypeOf('number')
  })
})

describe('isTransitionAllowed', () => {
  it.each([
    ['pending', 'drop_off'],
    ['pending', 'receive'],
    ['pending', 'refund'],
    ['pending', 'reject'],
    ['dropped_off', 'receive'],
    ['dropped_off', 'refund'],
    ['received', 'refund'],
    ['received', 'reject'],
  ] as [ShipmentStatus, TransitionAction][])('allows %s -> %s', (from, action) => {
    expect(isTransitionAllowed(from, action)).toBe(true)
  })

  it.each([
    ['dropped_off', 'drop_off'],
    ['received', 'drop_off'],
    ['received', 'receive'],
    ['refunded', 'drop_off'],
    ['refunded', 'receive'],
    ['rejected', 'drop_off'],
  ] as [ShipmentStatus, TransitionAction][])('refuses %s -> %s', (from, action) => {
    expect(isTransitionAllowed(from, action)).toBe(false)
  })

  it('allows swapping one decision for the other', () => {
    expect(isTransitionAllowed('refunded', 'reject')).toBe(true)
    expect(isTransitionAllowed('rejected', 'refund')).toBe(true)
  })

  it('refuses repeating the same decision', () => {
    expect(isTransitionAllowed('refunded', 'refund')).toBe(false)
    expect(isTransitionAllowed('rejected', 'reject')).toBe(false)
  })
})

describe('allowedActions, what the extra menu may offer', () => {
  it.each([
    ['pending', ['drop_off', 'receive', 'refund', 'reject']],
    ['dropped_off', ['receive', 'refund', 'reject']],
    ['received', ['refund', 'reject']],
    ['refunded', ['reject']],
    ['rejected', ['refund']],
  ] as [ShipmentStatus, TransitionAction[]][])('offers %s -> %o', (from, expected) => {
    expect(allowedActions(from)).toEqual(expected)
  })

  it.each(SHIPMENT_STATUSES)('agrees with isTransitionAllowed for %s', (from) => {
    for (const action of TRANSITION_ACTIONS) {
      expect(allowedActions(from).includes(action)).toBe(isTransitionAllowed(from, action))
    }
  })
})

describe('nextActions, the single chained button', () => {
  it.each([
    ['pending', ['drop_off']],
    ['dropped_off', ['receive']],
    ['received', ['refund', 'reject']],
  ] as [ShipmentStatus, TransitionAction[]][])('shows %s -> %o', (from, expected) => {
    expect(nextActions(from)).toEqual(expected)
  })

  it.each(['refunded', 'rejected'] as ShipmentStatus[])('shows nothing once %s', (from) => {
    expect(nextActions(from)).toEqual([])
  })

  it.each(SHIPMENT_STATUSES)('never suggests an action the api would refuse, from %s', (from) => {
    for (const action of nextActions(from)) {
      expect(isTransitionAllowed(from, action)).toBe(true)
    }
  })

  it.each(SHIPMENT_STATUSES)('covers %s, so a new status cannot be forgotten', (from) => {
    expect(nextActions(from)).toBeInstanceOf(Array)
  })

  it('offers exactly one button except where a decision must be chosen', () => {
    for (const status of SHIPMENT_STATUSES) {
      expect(nextActions(status).length).toBeLessThanOrEqual(2)
    }

    expect(nextActions('received')).toHaveLength(2)
  })
})

describe('earliestDateFor, the floor the date picker imposes', () => {
  const dates = (overrides: Partial<Record<DateField, string>> = {}): ShipmentTimeline => ({
    requestedDate: '2026-05-01',
    dropoffDate: null,
    receivedDate: null,
    decisionDate: null,
    ...overrides,
  })

  it('floors the drop-off at the day the return was requested', () => {
    expect(earliestDateFor(dates({ dropoffDate: '2026-06-01' }), 'drop_off')).toBe('2026-05-01')
  })

  it('stops a reception from landing before the drop-off', () => {
    expect(earliestDateFor(dates({ dropoffDate: '2026-06-01' }), 'receive')).toBe('2026-06-01')
  })

  it.each(['refund', 'reject'] as TransitionAction[])(
    'stops a %s from landing before the reception',
    (action) => {
      expect(earliestDateFor(dates({ dropoffDate: '2026-06-01', receivedDate: '2026-06-04' }), action))
        .toBe('2026-06-04')
    }
  )

  it('falls back to the drop-off when a decision skips the reception', () => {
    expect(earliestDateFor(dates({ dropoffDate: '2026-06-01' }), 'refund')).toBe('2026-06-01')
  })

  it('falls back to the request when every earlier step was skipped', () => {
    expect(earliestDateFor(dates(), 'refund')).toBe('2026-05-01')
  })

  it('ignores a decision already recorded, which a new decision replaces', () => {
    expect(earliestDateFor(dates({ decisionDate: '2026-06-10' }), 'reject')).toBe('2026-05-01')
  })
})

describe('nextStep, the single button a row may offer', () => {
  it.each([
    ['pending', 'Drop off'],
    ['dropped_off', 'Receive'],
    ['received', 'Decide'],
  ] as [ShipmentStatus, string][])('labels %s with the step to take, not the state reached', (from, label) => {
    expect(nextStep(from)?.label).toBe(label)
  })

  it.each(['refunded', 'rejected'] as ShipmentStatus[])('offers no step once %s', (from) => {
    expect(nextStep(from)).toBeNull()
  })

  it('carries both decisions on a single step, so the row keeps one button', () => {
    expect(nextStep('received')?.actions).toEqual(['refund', 'reject'])
  })

  it.each(SHIPMENT_STATUSES)('never names a step the api would refuse, from %s', (from) => {
    for (const action of nextStep(from)?.actions ?? []) {
      expect(isTransitionAllowed(from, action)).toBe(true)
    }
  })

  it.each(SHIPMENT_STATUSES)('agrees with nextActions for %s', (from) => {
    expect(nextActions(from)).toEqual(nextStep(from)?.actions ?? [])
  })
})

describe('menuSteps, what the extra menu may offer', () => {
  const labels = (from: ShipmentStatus): string[] => menuSteps(from).map((entry) => entry.label)

  it('never repeats the step the row already shows as a button', () => {
    expect(labels('pending')).not.toContain('Record the drop-off directly')
    expect(labels('dropped_off')).not.toContain('Record the reception directly')
  })

  it('folds the two decisions into a single entry', () => {
    expect(labels('pending')).toEqual(['Record the reception directly', 'Record the decision directly'])
    expect(labels('dropped_off')).toEqual(['Record the decision directly'])
  })

  it('calls a decision that replaces another one a change, not a recording', () => {
    expect(labels('refunded')).toEqual(['Change the decision to rejected'])
    expect(labels('rejected')).toEqual(['Change the decision to refunded'])
  })

  it('carries both outcomes on that entry, so the prompt can ask', () => {
    expect(menuSteps('dropped_off')[0].actions).toEqual(['refund', 'reject'])
  })

  it('offers nothing extra once the decision is the only thing left', () => {
    expect(labels('received')).toEqual([])
  })

  it.each(SHIPMENT_STATUSES)('never offers from %s an action the api would refuse', (from) => {
    for (const entry of menuSteps(from)) {
      for (const action of entry.actions) {
        expect(isTransitionAllowed(from, action)).toBe(true)
      }
    }
  })

  it.each(SHIPMENT_STATUSES)('covers every allowed action from %s, chained or not', (from) => {
    const offered = [...nextActions(from), ...menuSteps(from).flatMap((entry) => entry.actions)]

    expect(new Set(offered)).toEqual(new Set(allowedActions(from)))
  })
})
