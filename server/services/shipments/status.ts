import { AppError } from '../../errors.js'
import {
  LABEL_EXPIRY_WARNING_DAYS,
  LABEL_VALIDITY_DAYS,
  PENDING_ALERT_DAYS,
  RECEPTION_ALERT_DAYS,
  SHIPPING_ALERT_DAYS,
} from '../../config/constants.js'
import { diffDays, isIsoDate } from './dates.js'
import type { IsoDate } from './dates.js'
import type { ShipmentStatus } from '../../../shared/shipment-status.js'
import {
  ORDERED_DATE_FIELDS,
  STATUS_RANK,
  TRANSITIONS,
  isTransitionAllowed,
} from '../../../shared/transitions.js'
import type { DateField, TransitionAction } from '../../../shared/transitions.js'
import type { DerivedFields } from '../../../shared/shipment.js'

export type ShipmentDates = Record<DateField, IsoDate | null>

export type ShipmentState = ShipmentDates & { status: ShipmentStatus }

const dateFieldRank = (field: DateField): number => ORDERED_DATE_FIELDS.indexOf(field) + 1

function assertDate (field: DateField, value: string, today: IsoDate): void {
  if (!isIsoDate(value)) {
    throw new AppError('VALIDATION_ERROR', `${field} must be a YYYY-MM-DD date.`, { [field]: value })
  }

  if (diffDays(today, value) > 0) {
    throw new AppError('VALIDATION_ERROR', `${field} cannot be in the future.`, { [field]: value, today })
  }
}

export function assertDates (dates: ShipmentDates, today: IsoDate): void {
  for (const field of ORDERED_DATE_FIELDS) {
    const value = dates[field]
    if (value !== null) assertDate(field, value, today)
  }
}

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

const REQUIRED_DATE: Record<ShipmentStatus, DateField | null> = {
  pending: null,
  dropped_off: 'dropoffDate',
  received: 'receivedDate',
  refunded: 'decisionDate',
  rejected: 'decisionDate',
}

export function assertStatusHasItsDate (state: ShipmentState): void {
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
  today: IsoDate
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

  return { ...cleared, status }
}

type DerivedInput = ShipmentState & { createdDate: IsoDate }

export function computeDerived (shipment: DerivedInput, today: IsoDate): DerivedFields {
  const daysSinceCreated = diffDays(shipment.createdDate, today)

  const daysSinceDropoff =
    shipment.dropoffDate === null
      ? null
      : diffDays(shipment.dropoffDate, today)

  const daysSinceReceived =
    shipment.receivedDate === null
      ? null
      : diffDays(shipment.receivedDate, today)

  const decisionDelayDays =
    shipment.receivedDate === null || shipment.decisionDate === null
      ? null
      : diffDays(shipment.receivedDate, shipment.decisionDate)

  const totalDelayDays =
    shipment.dropoffDate === null || shipment.decisionDate === null
      ? null
      : diffDays(shipment.dropoffDate, shipment.decisionDate)

  return {
    daysSinceCreated,
    daysSinceDropoff,
    daysSinceReceived,
    decisionDelayDays,
    totalDelayDays,
    needsAction:
      shipment.status === 'received' &&
      daysSinceReceived !== null &&
      daysSinceReceived >= RECEPTION_ALERT_DAYS,
    shippingLate:
      shipment.status === 'dropped_off' &&
      daysSinceDropoff !== null &&
      daysSinceDropoff >= SHIPPING_ALERT_DAYS,
    labelExpiring:
      shipment.status === 'pending' &&
      daysSinceCreated >= LABEL_VALIDITY_DAYS - LABEL_EXPIRY_WARNING_DAYS,
    shouldDropOff: shipment.status === 'pending' && daysSinceCreated >= PENDING_ALERT_DAYS,
  }
}
