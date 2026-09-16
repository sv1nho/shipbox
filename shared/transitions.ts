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

export type NextStep = {
  label: string
  actions: [TransitionAction, ...TransitionAction[]]
}

const NEXT_STEP: Record<ShipmentStatus, NextStep | null> = {
  pending: { label: 'Drop off', actions: ['drop_off'] },
  dropped_off: { label: 'Receive', actions: ['receive'] },
  received: { label: 'Decide', actions: ['refund', 'reject'] },
  refunded: null,
  rejected: null,
}

export function nextStep (from: ShipmentStatus): NextStep | null {
  return NEXT_STEP[from]
}

export function nextActions (from: ShipmentStatus): TransitionAction[] {
  return NEXT_STEP[from]?.actions ?? []
}

const DECISION_ACTIONS: TransitionAction[] = ['refund', 'reject']

const singleStep = (action: TransitionAction): NextStep => ({
  label: TRANSITIONS[action].label,
  actions: [action],
})

export function menuSteps (from: ShipmentStatus): NextStep[] {
  const chained = nextActions(from)
  const rest = allowedActions(from).filter((action) => !chained.includes(action))
  const decisions = rest.filter((action) => DECISION_ACTIONS.includes(action))

  if (decisions.length < 2) return rest.map(singleStep)

  return [
    ...rest.filter((action) => !DECISION_ACTIONS.includes(action)).map(singleStep),
    { label: 'Decision', actions: ['refund', 'reject'] },
  ]
}

export function earliestDateFor (
  dates: Record<DateField, string | null>,
  action: TransitionAction
): string | null {
  const index = ORDERED_DATE_FIELDS.indexOf(TRANSITIONS[action].dateField)

  return ORDERED_DATE_FIELDS.slice(0, index).reduce<string | null>(
    (latest, field) => dates[field] ?? latest,
    null
  )
}
