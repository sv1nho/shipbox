import type { ShipmentDto } from '../../shared/shipment.js'
import { formatAmount } from './format.js'

export function ShipmentLine ({ shipment }: { shipment: ShipmentDto }) {
  return (
    <p className='card-text'>
      <strong>{shipment.store}</strong> — {shipment.trackingNumber} —{' '}
      {formatAmount(shipment.amountCents, shipment.currency)}
    </p>
  )
}
