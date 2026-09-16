import type { ShipmentStatus } from '../../shared/shipment-status.js'
import type { ShipmentDto } from '../../shared/shipment.js'

const LOCALE = 'en-IE'

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' })

const day = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  dropped_off: 'Dropped off',
  received: 'Received',
  refunded: 'Refunded',
  rejected: 'Rejected',
}

export function formatAmount (amountCents: number, currency: string): string {
  if (currency !== 'EUR') {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amountCents / 100)
  }

  return money.format(amountCents / 100)
}

export function formatDate (value: string | null): string {
  if (value === null) return '—'

  return day.format(new Date(`${value}T00:00:00Z`))
}

export function statusLabel (status: ShipmentStatus): string {
  return STATUS_LABELS[status]
}

export function workingDays (count: number | null): string {
  if (count === null) return '—'

  return count === 1 ? '1 working day' : `${String(count)} working days`
}

export function alertMessage (shipment: ShipmentDto): string | null {
  if (shipment.needsAction) {
    return `The store has had this parcel for ${workingDays(shipment.daysSinceReceived)} without deciding. Time to chase them.`
  }

  if (shipment.shouldDropOff) {
    return `The label was made ${workingDays(shipment.daysSinceCreated)} ago and the parcel has not been dropped off.`
  }

  return null
}
