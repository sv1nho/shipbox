import type { CarrierId } from './carriers.js'
import type { LabelPayload } from './label-payload.js'
import type { ShipmentStatus, StatusFilter } from './shipment-status.js'

export type IsoDate = string

export type DerivedFields = {
  daysSinceRequested: number
  daysSinceDropoff: number | null
  daysSinceReceived: number | null
  decisionDelayDays: number | null
  totalDelayDays: number | null
  daysLeft: number | null
  needsAction: boolean
  shippingLate: boolean
  labelExpiring: boolean
}

export type ShipmentDto = {
  id: string
  trackingNumber: string
  carrier: CarrierId
  recipientPostalCode: string
  recipientCountry: string
  status: ShipmentStatus
  amountCents: number
  currency: string
  store: string
  storeSupportEmail: string | null
  requestedDate: IsoDate
  dropoffDate: IsoDate | null
  receivedDate: IsoDate | null
  decisionDate: IsoDate | null
  orderNumber: string
  note: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  trackingUrl: string
  hasLabel: boolean
} & DerivedFields

export type LabelInput = {
  payload: LabelPayload
  payloadVersion: number
}

export type CreateShipmentInput = {
  trackingNumber: string
  carrier: CarrierId
  recipientPostalCode: string
  recipientCountry: string
  amountCents: number
  store: string
  orderNumber: string
  storeSupportEmail?: string | null
  status?: ShipmentStatus
  requestedDate?: IsoDate
  dropoffDate?: IsoDate | null
  receivedDate?: IsoDate | null
  decisionDate?: IsoDate | null
  note?: string | null
  rejectionReason?: string | null
  label?: LabelInput
}

export const REQUIRED_CREATE_FIELDS = [
  'trackingNumber',
  'carrier',
  'store',
  'amountCents',
  'recipientPostalCode',
  'recipientCountry',
  'orderNumber',
] as const satisfies readonly (keyof CreateShipmentInput)[]

export type UpdateShipmentInput = {
  recipientPostalCode?: string
  recipientCountry?: string
  amountCents?: number
  store?: string
  orderNumber?: string
  note?: string | null
  requestedDate?: IsoDate
  dropoffDate?: IsoDate
  receivedDate?: IsoDate
  decisionDate?: IsoDate
}

export type CorrectIdentityInput = {
  carrier: CarrierId
  trackingNumber: string
}

export type ArchivedFilter = 'exclude' | 'only' | 'include'

export const SORT_KEYS = [
  'requestedDate',
  'dropoffDate',
  'receivedDate',
  'decisionDate',
  'amountCents',
  'store',
] as const

export type SortKey = typeof SORT_KEYS[number]

export type ListParams = {
  carrier?: CarrierId
  status?: StatusFilter
  store?: string
  search?: string
  archived?: ArchivedFilter
  attention?: boolean
  sort?: SortKey
  direction?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type ListResult = {
  items: ShipmentDto[]
  total: number
  page: number
  pageSize: number
  attentionTotal: number
}

export type ImportOutcome = {
  imported: number
  failures: { row: number; message: string }[]
}

export type ExistsResult = {
  exists: boolean
  id?: string
  archived?: boolean
}

export type LabelResult = {
  payload: LabelPayload
  payloadVersion: number
}
