import type { ShipmentStatus } from '../../shared/shipment-status.js'
import { statusLabel } from './format.js'

export function StatusPill ({ status }: { status: ShipmentStatus }) {
  return <span className={`status-pill status-${status}`}>{statusLabel(status)}</span>
}
