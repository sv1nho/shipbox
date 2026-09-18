import { AppError } from '../../errors.js'
import { TRACKING_LANG } from '../../config/constants.js'
import { getTrackingUrl, isCarrierId } from '../../../shared/carriers.js'
import { isShipmentStatus } from '../../../shared/shipment-status.js'
import type { ShipmentStatus } from '../../../shared/shipment-status.js'
import type { CarrierId } from '../../../shared/carriers.js'
import { toIsoDate } from './dates.js'
import type { IsoDate } from './dates.js'
import { computeDerived } from './status.js'
import type { ShipmentState } from './status.js'
import type { ShipmentDto } from './types.js'

export type ShipmentRow = {
  id: string
  trackingNumber: string
  carrier: string
  recipientPostalCode: string
  recipientCountry: string
  status: string
  amountCents: number
  currency: string
  store: { name: string; supportEmail: string | null }
  requestedDate: Date
  dropoffDate: Date | null
  receivedDate: Date | null
  neverReceived: boolean
  decisionDate: Date | null
  lastChasedAt: Date | null
  orderNumber: string
  note: string | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  label?: { shipmentId: string } | null
}

const asIsoDate = (value: Date | null): IsoDate | null =>
  value === null ? null : toIsoDate(value)

const asCarrier = (value: string): CarrierId => {
  if (!isCarrierId(value)) {
    throw new AppError('INTERNAL_ERROR', `Stored carrier is not supported: ${value}`)
  }
  return value
}

const asStatus = (value: string): ShipmentStatus => {
  if (!isShipmentStatus(value)) {
    throw new AppError('INTERNAL_ERROR', `Stored status is not supported: ${value}`)
  }
  return value
}

export function toShipmentState (row: ShipmentRow): ShipmentState {
  return {
    status: asStatus(row.status),
    requestedDate: toIsoDate(row.requestedDate),
    dropoffDate: asIsoDate(row.dropoffDate),
    receivedDate: asIsoDate(row.receivedDate),
    decisionDate: asIsoDate(row.decisionDate),
    rejectionReason: row.rejectionReason,
    lastChasedAt: asIsoDate(row.lastChasedAt),
  }
}

export function toShipmentDto (row: ShipmentRow, today: IsoDate): ShipmentDto {
  const carrier = asCarrier(row.carrier)
  const state = toShipmentState(row)
  const { status, requestedDate, dropoffDate, receivedDate, decisionDate } = state

  const derived = computeDerived(state, today)

  return {
    id: row.id,
    trackingNumber: row.trackingNumber,
    carrier,
    recipientPostalCode: row.recipientPostalCode,
    recipientCountry: row.recipientCountry,
    status,
    amountCents: row.amountCents,
    currency: row.currency,
    store: row.store.name,
    storeSupportEmail: row.store.supportEmail,
    requestedDate,
    dropoffDate,
    receivedDate,
    neverReceived: row.neverReceived,
    decisionDate,
    lastChasedAt: asIsoDate(row.lastChasedAt),
    orderNumber: row.orderNumber,
    note: row.note,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt === null ? null : row.archivedAt.toISOString(),
    trackingUrl: getTrackingUrl(
      {
        carrier,
        trackingNumber: row.trackingNumber,
        recipientPostalCode: row.recipientPostalCode,
        recipientCountry: row.recipientCountry,
      },
      TRACKING_LANG
    ),
    hasLabel: row.label !== null && row.label !== undefined,
    ...derived,
  }
}
