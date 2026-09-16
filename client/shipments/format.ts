import { toIsoDateInZone } from '../../shared/time.js'
import type { ShipmentStatus } from '../../shared/shipment-status.js'
import type { DateField } from '../../shared/transitions.js'
import type { IsoDate, ShipmentDto } from '../../shared/shipment.js'

const LOCALE = 'en-IE'

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' })

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  dropped_off: 'Dropped off',
  received: 'Received',
  refunded: 'Refunded',
  rejected: 'Rejected',
}

const STATE_DATE: Record<ShipmentStatus, { label: string; field: DateField | null }> = {
  pending: { label: 'Added', field: null },
  dropped_off: { label: 'Dropped off', field: 'dropoffDate' },
  received: { label: 'Received', field: 'receivedDate' },
  refunded: { label: 'Decided', field: 'decisionDate' },
  rejected: { label: 'Decided', field: 'decisionDate' },
}

type DelayField =
  | 'daysSinceCreated'
  | 'daysSinceDropoff'
  | 'daysSinceReceived'
  | 'decisionDelayDays'

const STATE_DELAY: Record<ShipmentStatus, { label: string; field: DelayField }> = {
  pending: { label: 'Waiting', field: 'daysSinceCreated' },
  dropped_off: { label: 'Waiting', field: 'daysSinceDropoff' },
  received: { label: 'Waiting', field: 'daysSinceReceived' },
  refunded: { label: 'Took', field: 'decisionDelayDays' },
  rejected: { label: 'Took', field: 'decisionDelayDays' },
}

export function formatAmount (amountCents: number, currency: string): string {
  if (currency !== 'EUR') {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amountCents / 100)
  }

  return money.format(amountCents / 100)
}

export function formatDate (value: IsoDate): string {
  const [year, month, day] = value.split('-')

  return `${day}/${month}/${year}`
}

export function zonedDate (timestamp: string): IsoDate {
  return toIsoDateInZone(new Date(timestamp))
}

export function statusLabel (status: ShipmentStatus): string {
  return STATUS_LABELS[status]
}

export function days (count: number): string {
  return count === 1 ? '1 day' : `${String(count)} days`
}

export function statusDate (shipment: ShipmentDto): { label: string; date: IsoDate } {
  const { label, field } = STATE_DATE[shipment.status]
  const date = field === null ? null : shipment[field]

  return date === null ? { label: 'Added', date: zonedDate(shipment.createdAt) } : { label, date }
}

export function delayInfo (shipment: ShipmentDto): { label: string; days: number } | null {
  const { label, field } = STATE_DELAY[shipment.status]
  const count = shipment[field]

  return count === null ? null : { label, days: count }
}

export function alertMessage (shipment: ShipmentDto): string | null {
  if (shipment.needsAction && shipment.daysSinceReceived !== null) {
    return `The store has had this parcel for ${days(shipment.daysSinceReceived)} without deciding. Time to chase them.`
  }

  if (shipment.shippingLate && shipment.daysSinceDropoff !== null) {
    return `The parcel was dropped off ${days(shipment.daysSinceDropoff)} ago and the store has still not received it. Time to contact them.`
  }

  if (shipment.labelExpiring) {
    return `The label was made ${days(shipment.daysSinceCreated)} ago and is about to expire. Drop the parcel off now.`
  }

  if (shipment.shouldDropOff) {
    return `The label was made ${days(shipment.daysSinceCreated)} ago and the parcel has not been dropped off.`
  }

  return null
}
