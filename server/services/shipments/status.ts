import { AppError } from '../../errors.js'
import {
  CHASE_GRACE_DAYS,
  LABEL_EXPIRY_WARNING_DAYS,
  LABEL_VALIDITY_DAYS,
  RECEPTION_ALERT_DAYS,
  SHIPPING_ALERT_DAYS,
} from '../../config/constants.js'
import { diffDays, isIsoDate, shiftDays } from './dates.js'
import type { IsoDate } from './dates.js'
import type { ShipmentStatus } from '../../../shared/shipment-status.js'
import {
  ORDERED_DATED_FIELDS,
  ORDERED_DATE_FIELDS,
  findOrderBreak,
  STATUS_RANK,
  TRANSITIONS,
  isTransitionAllowed,
} from '../../../shared/transitions.js'
import type { DatedField, DateField, TransitionAction } from '../../../shared/transitions.js'
import type { DerivedFields } from '../../../shared/shipment.js'

type ShipmentDates = Record<DateField, IsoDate | null>

export type DatedShipment = ShipmentDates & { requestedDate: IsoDate }

export type ShipmentState = DatedShipment & {
  status: ShipmentStatus
  rejectionReason: string | null
  lastChasedAt: IsoDate | null
}

const dateFieldRank = (field: DateField): number => ORDERED_DATE_FIELDS.indexOf(field) + 1

function assertDate (field: DatedField, value: string, today: IsoDate): void {
  if (!isIsoDate(value)) {
    throw new AppError('VALIDATION_ERROR', `${field} must be a YYYY-MM-DD date.`, { [field]: value })
  }

  if (diffDays(today, value) > 0) {
    throw new AppError('VALIDATION_ERROR', `${field} cannot be in the future.`, { [field]: value, today })
  }
}

export function assertDates (shipment: DatedShipment, today: IsoDate): void {
  for (const field of ORDERED_DATED_FIELDS) {
    const value = shipment[field]
    if (value !== null) assertDate(field, value, today)
  }
}

export function assertChronology (shipment: DatedShipment): void {
  const broken = findOrderBreak(shipment)

  if (broken === null) return

  throw new AppError(
    'VALIDATION_ERROR',
    `${broken.field} cannot be earlier than ${broken.previous}.`,
    { [broken.previous]: shipment[broken.previous], [broken.field]: shipment[broken.field] }
  )
}

const DEADLINE_DAYS: Record<ShipmentStatus, number | null> = {
  pending: LABEL_VALIDITY_DAYS,
  dropped_off: SHIPPING_ALERT_DAYS,
  received: RECEPTION_ALERT_DAYS,
  refunded: null,
  rejected: null,
}

type AttentionCutoff = { status: ShipmentStatus; field: DatedField; onOrBefore: IsoDate }

export const chasedRecentlyOnOrAfter = (today: IsoDate): IsoDate =>
  shiftDays(today, 1 - CHASE_GRACE_DAYS)

export function attentionCutoffs (today: IsoDate): AttentionCutoff[] {
  return [
    {
      status: 'pending',
      field: 'requestedDate',
      onOrBefore: shiftDays(today, LABEL_EXPIRY_WARNING_DAYS - LABEL_VALIDITY_DAYS),
    },
    { status: 'dropped_off', field: 'dropoffDate', onOrBefore: shiftDays(today, -SHIPPING_ALERT_DAYS) },
    { status: 'received', field: 'receivedDate', onOrBefore: shiftDays(today, -RECEPTION_ALERT_DAYS) },
  ]
}

const REQUIRED_DATE: Record<ShipmentStatus, DateField | null> = {
  pending: null,
  dropped_off: 'dropoffDate',
  received: 'receivedDate',
  refunded: 'decisionDate',
  rejected: 'decisionDate',
}

export function assertStatusHasItsDate (state: DatedShipment & { status: ShipmentStatus }): void {
  const field = REQUIRED_DATE[state.status]

  if (field !== null && state[field] === null) {
    throw new AppError(
      'VALIDATION_ERROR',
      `A shipment that is ${state.status} needs its ${field}.`,
      { status: state.status, missing: field }
    )
  }
}

export function planTransition (
  state: ShipmentState,
  action: TransitionAction,
  date: IsoDate,
  today: IsoDate,
  rejectionReason?: string
): ShipmentState {
  const { target, dateField } = TRANSITIONS[action]

  if (!isTransitionAllowed(state.status, action)) {
    throw new AppError(
      'ILLEGAL_TRANSITION',
      `A shipment that is ${state.status} cannot move to ${target}.`,
      { from: state.status, to: target }
    )
  }

  assertDate(dateField, date, today)

  const next: ShipmentState = {
    ...state,
    status: target,
    [dateField]: date,
    rejectionReason: action === 'reject' ? rejectionReason ?? null : null,
  }
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
    if (dateFieldRank(field) >= undone) {
      cleared[field] = null
    }
  }

  const status: ShipmentStatus =
    cleared.receivedDate !== null
      ? 'received'
      : cleared.dropoffDate !== null
        ? 'dropped_off'
        : 'pending'

  return {
    ...cleared,
    requestedDate: state.requestedDate,
    rejectionReason: null,
    lastChasedAt: state.lastChasedAt,
    status,
  }
}

export function computeDerived (shipment: ShipmentState, today: IsoDate): DerivedFields {
  const daysSinceRequested = diffDays(shipment.requestedDate, today)

  const daysSinceDropoff =
    shipment.dropoffDate === null
      ? null
      : diffDays(shipment.dropoffDate, today)

  const daysSinceReceived =
    shipment.receivedDate === null
      ? null
      : diffDays(shipment.receivedDate, today)

  const decisionStartedFrom = shipment.receivedDate ?? shipment.dropoffDate

  const decisionDelayDays =
    decisionStartedFrom === null || shipment.decisionDate === null
      ? null
      : diffDays(decisionStartedFrom, shipment.decisionDate)

  const totalDelayDays =
    shipment.dropoffDate === null || shipment.decisionDate === null
      ? null
      : diffDays(shipment.dropoffDate, shipment.decisionDate)

  const waited: Record<ShipmentStatus, number | null> = {
    pending: daysSinceRequested,
    dropped_off: daysSinceDropoff,
    received: daysSinceReceived,
    refunded: null,
    rejected: null,
  }

  const limit = DEADLINE_DAYS[shipment.status]
  const elapsed = waited[shipment.status]
  const daysLeft = limit === null || elapsed === null ? null : limit - elapsed

  const overdue = (status: ShipmentStatus): boolean =>
    shipment.status === status && daysLeft !== null && daysLeft <= 0

  const awaitingReply =
    shipment.lastChasedAt !== null && diffDays(shipment.lastChasedAt, today) < CHASE_GRACE_DAYS

  return {
    daysSinceRequested,
    daysSinceDropoff,
    daysSinceReceived,
    decisionDelayDays,
    totalDelayDays,
    daysLeft,
    awaitingReply,
    needsAction: overdue('received'),
    shippingLate: overdue('dropped_off'),
    labelExpiring:
      shipment.status === 'pending' &&
      daysLeft !== null &&
      daysLeft <= LABEL_EXPIRY_WARNING_DAYS,
  }
}
