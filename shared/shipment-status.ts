export const SHIPMENT_STATUSES = [
  'pending',
  'dropped_off',
  'received',
  'refunded',
  'rejected',
] as const

export type ShipmentStatus = typeof SHIPMENT_STATUSES[number]

export const isShipmentStatus = (value: unknown): value is ShipmentStatus =>
  typeof value === 'string' && (SHIPMENT_STATUSES as readonly string[]).includes(value)

export const DECISION_STATUSES = ['refunded', 'rejected'] as const

type DecisionStatus = typeof DECISION_STATUSES[number]

export const isDecisionStatus = (value: unknown): value is DecisionStatus =>
  typeof value === 'string' && (DECISION_STATUSES as readonly string[]).includes(value)

export const OPEN_STATUSES = SHIPMENT_STATUSES.filter((status) => !isDecisionStatus(status))

export const STATUS_FILTERS = [...SHIPMENT_STATUSES, 'open'] as const

export type StatusFilter = typeof STATUS_FILTERS[number]

export const isStatusFilter = (value: unknown): value is StatusFilter =>
  typeof value === 'string' && (STATUS_FILTERS as readonly string[]).includes(value)
