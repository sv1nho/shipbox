import { isDecisionStatus } from './shipment-status.js'
import type { ShipmentStatus } from './shipment-status.js'

export type DateField = 'dropoffDate' | 'receivedDate' | 'decisionDate'

export const ORDERED_DATE_FIELDS: DateField[] = ['dropoffDate', 'receivedDate', 'decisionDate']

export type DatedField = 'requestedDate' | DateField

export const ORDERED_DATED_FIELDS: DatedField[] = ['requestedDate', ...ORDERED_DATE_FIELDS]

export type ShipmentTimeline = Record<DateField, string | null> & { requestedDate: string }

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

const UNDO_LABELS: Record<ShipmentStatus, string | null> = {
  pending: null,
  dropped_off: 'Undo the drop-off',
  received: 'Undo the reception',
  refunded: 'Undo the decision',
  rejected: 'Undo the decision',
}

export function undoLabel (from: ShipmentStatus): string | null {
  return UNDO_LABELS[from]
}

export function nextStep (from: ShipmentStatus): NextStep | null {
  return NEXT_STEP[from]
}

export function nextActions (from: ShipmentStatus): TransitionAction[] {
  return NEXT_STEP[from]?.actions ?? []
}

const DECISION_ACTIONS: TransitionAction[] = ['refund', 'reject']

const MENU_LABELS: Record<TransitionAction, string> = {
  drop_off: 'Record the drop-off directly',
  receive: 'Record the reception directly',
  refund: 'Change the decision to refunded',
  reject: 'Change the decision to rejected',
}

const singleStep = (action: TransitionAction): NextStep => ({
  label: MENU_LABELS[action],
  actions: [action],
})

export function menuSteps (from: ShipmentStatus): NextStep[] {
  const chained = nextActions(from)
  const rest = allowedActions(from).filter((action) => !chained.includes(action))
  const decisions = rest.filter((action) => DECISION_ACTIONS.includes(action))

  if (decisions.length < 2) return rest.map(singleStep)

  return [
    ...rest.filter((action) => !DECISION_ACTIONS.includes(action)).map(singleStep),
    { label: 'Record the decision directly', actions: ['refund', 'reject'] },
  ]
}

type OrderBreak = { field: DatedField; previous: DatedField }

export function findOrderBreak (
  timeline: Partial<Record<DatedField, string | null>>
): OrderBreak | null {
  const filled = ORDERED_DATED_FIELDS
    .map((field) => ({ field, value: timeline[field] }))
    .filter((entry): entry is { field: DatedField; value: string } =>
      entry.value !== null && entry.value !== undefined && entry.value !== '')

  for (let index = 1; index < filled.length; index += 1) {
    const previous = filled[index - 1]
    const current = filled[index]

    if (current.value < previous.value) {
      return { field: current.field, previous: previous.field }
    }
  }

  return null
}

export function earliestDateFor (timeline: ShipmentTimeline, action: TransitionAction): string {
  const index = ORDERED_DATE_FIELDS.indexOf(TRANSITIONS[action].dateField)

  return ORDERED_DATE_FIELDS.slice(0, index).reduce<string>(
    (latest, field) => timeline[field] ?? latest,
    timeline.requestedDate
  )
}
