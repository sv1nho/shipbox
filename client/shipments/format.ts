import { toIsoDateInZone } from '../../shared/time.js'
import { isDecisionStatus } from '../../shared/shipment-status.js'
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
  pending: { label: 'Requested', field: null },
  dropped_off: { label: 'Dropped off', field: 'dropoffDate' },
  received: { label: 'Received', field: 'receivedDate' },
  refunded: { label: 'Decided', field: 'decisionDate' },
  rejected: { label: 'Decided', field: 'decisionDate' },
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

  return date === null ? { label: 'Requested', date: shipment.requestedDate } : { label, date }
}

export function delayInfo (shipment: ShipmentDto): string | null {
  if (isDecisionStatus(shipment.status)) {
    const taken = shipment.decisionDelayDays

    return taken === null ? null : `Took ${days(taken)}`
  }

  const left = shipment.daysLeft

  if (left === null) return null
  if (left > 0) return `${days(left)} left`
  if (left === 0) return 'Due today'

  return `${days(-left)} over`
}

function expiryMessage (daysLeft: number): string {
  if (daysLeft < 0) return `The label expired ${days(-daysLeft)} ago and can no longer be used.`
  if (daysLeft === 0) return 'The label expires today. Drop the parcel off now.'

  return `The label expires in ${days(daysLeft)}. Drop the parcel off now.`
}

export function alertMessage (shipment: ShipmentDto): string | null {
  if (shipment.needsAction && shipment.daysSinceReceived !== null) {
    return `The store has had this parcel for ${days(shipment.daysSinceReceived)} without deciding. Time to chase them.`
  }

  if (shipment.shippingLate && shipment.daysSinceDropoff !== null) {
    return `The parcel was dropped off ${days(shipment.daysSinceDropoff)} ago and the store has still not received it. Time to contact them.`
  }

  if (shipment.labelExpiring && shipment.daysLeft !== null) {
    return expiryMessage(shipment.daysLeft)
  }

  return null
}
