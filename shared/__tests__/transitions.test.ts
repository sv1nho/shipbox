import { describe, it, expect } from 'vitest'
import {
  STATUS_RANK,
  TRANSITIONS,
  TRANSITION_ACTIONS,
  allowedActions,
  isTransitionAllowed,
  nextActions,
} from '../transitions.js'
import type { TransitionAction } from '../transitions.js'
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
