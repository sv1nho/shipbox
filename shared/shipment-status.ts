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

export type DecisionStatus = typeof DECISION_STATUSES[number]

export const isDecisionStatus = (value: unknown): value is DecisionStatus =>
  typeof value === 'string' && (DECISION_STATUSES as readonly string[]).includes(value)
