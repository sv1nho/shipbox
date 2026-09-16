import { isDecisionStatus } from './shipment-status.js'
import type { ShipmentStatus } from './shipment-status.js'

export type DateField = 'dropoffDate' | 'receivedDate' | 'decisionDate'

export const ORDERED_DATE_FIELDS: DateField[] = ['dropoffDate', 'receivedDate', 'decisionDate']

export const TRANSITIONS = {
  drop_off: { target: 'dropped_off', dateField: 'dropoffDate', label: 'Dropped off', path: 'drop-off' },
  receive: { target: 'received', dateField: 'receivedDate', label: 'Received', path: 'receive' },
  refund: { target: 'refunded', dateField: 'decisionDate', label: 'Refunded', path: 'refund' },
  reject: { target: 'rejected', dateField: 'decisionDate', label: 'Rejected', path: 'reject' },
} as const satisfies Record<
  string,
  { target: ShipmentStatus; dateField: DateField; label: string; path: string }
>

export type TransitionAction = keyof typeof TRANSITIONS

export const TRANSITION_ACTIONS = Object.keys(TRANSITIONS) as TransitionAction[]

export const STATUS_RANK: Record<ShipmentStatus, number> = {
  pending: 0,
  dropped_off: 1,
  received: 2,
  refunded: 3,
  rejected: 3,
}

export function isTransitionAllowed (from: ShipmentStatus, action: TransitionAction): boolean {
  const { target } = TRANSITIONS[action]

  if (isDecisionStatus(from) && isDecisionStatus(target)) return target !== from

  return STATUS_RANK[target] > STATUS_RANK[from]
}

export function allowedActions (from: ShipmentStatus): TransitionAction[] {
  return TRANSITION_ACTIONS.filter((action) => isTransitionAllowed(from, action))
}

const NEXT_ACTIONS: Record<ShipmentStatus, TransitionAction[]> = {
  pending: ['drop_off'],
  dropped_off: ['receive'],
  received: ['refund', 'reject'],
  refunded: [],
  rejected: [],
}

export function nextActions (from: ShipmentStatus): TransitionAction[] {
  return NEXT_ACTIONS[from]
}
