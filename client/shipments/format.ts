import { toIsoDateInZone } from '../../shared/time.js'
import type { Translate } from '../i18n/context.js'
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

export function days (t: Translate, count: number): string {
  return count === 1 ? t('1 day') : t('{count} days', { count })
}

export function statusDate (shipment: ShipmentDto): { label: string; date: IsoDate } {
  const { label, field } = STATE_DATE[shipment.status]
  const date = field === null ? null : shipment[field]

  return date === null ? { label: 'Requested', date: shipment.requestedDate } : { label, date }
}

export function delayInfo (t: Translate, shipment: ShipmentDto): string | null {
  if (isDecisionStatus(shipment.status)) {
    const taken = shipment.decisionDelayDays

    return taken === null ? null : t('Took {span}', { span: days(t, taken) })
  }

  const left = shipment.daysLeft

  if (left === null) return null
  if (left > 0) return t('{span} left', { span: days(t, left) })
  if (left === 0) return t('Due today')

  return t('{span} over', { span: days(t, -left) })
}

function expiryMessage (t: Translate, daysLeft: number): string {
  if (daysLeft < 0) {
    return t('The label expired {span} ago and can no longer be used.', { span: days(t, -daysLeft) })
  }

  if (daysLeft === 0) return t('The label expires today. Drop the parcel off now.')

  return t('The label expires in {span}. Drop the parcel off now.', { span: days(t, daysLeft) })
}

export function alertMessage (t: Translate, shipment: ShipmentDto): string | null {
  if (shipment.needsAction && shipment.daysSinceReceived !== null) {
    return t('The store has had this parcel for {span} without deciding. Time to chase them.',
      { span: days(t, shipment.daysSinceReceived) })
  }

  if (shipment.shippingLate && shipment.daysSinceDropoff !== null) {
    return t('The parcel was dropped off {span} ago and the store has still not received it. ' +
      'Time to contact them.', { span: days(t, shipment.daysSinceDropoff) })
  }

  if (shipment.labelExpiring && shipment.daysLeft !== null) {
    return expiryMessage(t, shipment.daysLeft)
  }

  return null
}
