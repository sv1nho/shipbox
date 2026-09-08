import { AppError } from '../../errors.js'
import { RECEPTION_ALERT_DAYS, PENDING_ALERT_DAYS } from '../../config/constants.js'
import { diffDays, isIsoDate } from './dates.js'
import type { IsoDate } from './dates.js'
import { workingDaysBetween } from './working-days.js'
import { isDecisionStatus } from '../../../shared/shipment-status.js'
import type { ShipmentStatus } from '../../../shared/shipment-status.js'

export type DateField = 'dropoffDate' | 'receivedDate' | 'decisionDate'

export type ShipmentDates = Record<DateField, IsoDate | null>

export type ShipmentState = ShipmentDates & { status: ShipmentStatus }

export const TRANSITIONS = {
  drop_off: { target: 'dropped_off', dateField: 'dropoffDate' },
  receive: { target: 'received', dateField: 'receivedDate' },
  refund: { target: 'refunded', dateField: 'decisionDate' },
  reject: { target: 'rejected', dateField: 'decisionDate' },
} as const satisfies Record<string, { target: ShipmentStatus; dateField: DateField }>

export type TransitionAction = keyof typeof TRANSITIONS

export const TRANSITION_ACTIONS = Object.keys(TRANSITIONS) as TransitionAction[]

const STATUS_RANK: Record<ShipmentStatus, number> = {
  pending: 0,
  dropped_off: 1,
  received: 2,
  refunded: 3,
  rejected: 3,
}

const DATE_FIELD_RANK: Record<DateField, number> = {
  dropoffDate: 1,
  receivedDate: 2,
  decisionDate: 3,
}

const ORDERED_DATE_FIELDS: DateField[] = ['dropoffDate', 'receivedDate', 'decisionDate']

export function assertChronology (dates: ShipmentDates): void {
  const filled = ORDERED_DATE_FIELDS
    .map((field) => ({ field, value: dates[field] }))
    .filter((entry): entry is { field: DateField; value: IsoDate } => entry.value !== null)

  for (let index = 1; index < filled.length; index += 1) {
    const previous = filled[index - 1]
    const current = filled[index]

    if (diffDays(previous.value, current.value) < 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        `${current.field} cannot be earlier than ${previous.field}.`,
        { [previous.field]: previous.value, [current.field]: current.value }
      )
    }
  }
}

export function planTransition (
  state: ShipmentState,
  action: TransitionAction,
  date: IsoDate,
  today: IsoDate
): ShipmentState {
  const { target, dateField } = TRANSITIONS[action]

  const changesDecision =
    isDecisionStatus(state.status) && isDecisionStatus(target) && target !== state.status

  if (!changesDecision && STATUS_RANK[target] <= STATUS_RANK[state.status]) {
    throw new AppError(
      'ILLEGAL_TRANSITION',
      `A shipment that is ${state.status} cannot move to ${target}.`,
      { from: state.status, to: target }
    )
  }

  if (!isIsoDate(date)) {
    throw new AppError('VALIDATION_ERROR', `${dateField} must be a YYYY-MM-DD date.`, { [dateField]: date })
  }

  if (diffDays(today, date) > 0) {
    throw new AppError('VALIDATION_ERROR', `${dateField} cannot be in the future.`, { [dateField]: date, today })
  }

  const next: ShipmentState = { ...state, status: target, [dateField]: date }
  assertChronology(next)

  return next
}

export function planRevert (state: ShipmentState): ShipmentState {
  if (state.status === 'pending') {
    throw new AppError('ILLEGAL_TRANSITION', 'A pending shipment has no step to undo.', {
      from: state.status,
    })
  }

  const undone = STATUS_RANK[state.status]

  const cleared: ShipmentDates = {
    dropoffDate: state.dropoffDate,
    receivedDate: state.receivedDate,
    decisionDate: state.decisionDate,
  }

  for (const field of ORDERED_DATE_FIELDS) {
    if (DATE_FIELD_RANK[field] >= undone) {
      cleared[field] = null
    }
  }

  const status: ShipmentStatus =
    cleared.receivedDate !== null
      ? 'received'
      : cleared.dropoffDate !== null
        ? 'dropped_off'
        : 'pending'

  return { ...cleared, status }
}

export type DerivedFields = {
  daysSinceCreated: number | null
  daysSinceReceived: number | null
  decisionDelayDays: number | null
  totalDelayDays: number | null
  needsAction: boolean
  shouldDropOff: boolean
}

export type DerivedInput = ShipmentState & { createdDate: IsoDate }

export function computeDerived (shipment: DerivedInput, today: IsoDate): DerivedFields {
  const daysSinceCreated = workingDaysBetween(shipment.createdDate, today)

  const daysSinceReceived =
    shipment.receivedDate === null ? null : workingDaysBetween(shipment.receivedDate, today)

  const decisionDelayDays =
    shipment.receivedDate === null || shipment.decisionDate === null
      ? null
      : workingDaysBetween(shipment.receivedDate, shipment.decisionDate)

  const totalDelayDays =
    shipment.dropoffDate === null || shipment.decisionDate === null
      ? null
      : workingDaysBetween(shipment.dropoffDate, shipment.decisionDate)

  return {
    daysSinceCreated,
    daysSinceReceived,
    decisionDelayDays,
    totalDelayDays,
    needsAction:
      shipment.status === 'received' &&
      daysSinceReceived !== null &&
      daysSinceReceived >= RECEPTION_ALERT_DAYS,
    shouldDropOff: shipment.status === 'pending' && daysSinceCreated >= PENDING_ALERT_DAYS,
  }
}
