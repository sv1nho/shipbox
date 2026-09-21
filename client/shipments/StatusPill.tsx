import type { ShipmentStatus } from '../../shared/shipment-status.js'
import { useT } from '../i18n/context.js'
import { statusLabel } from './format.js'

export function StatusPill ({ status }: { status: ShipmentStatus }) {
  const t = useT()

  return <span className={`status-pill status-${status}`}>{t(statusLabel(status))}</span>
}
