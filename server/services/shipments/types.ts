import type { CarrierId } from '../../../shared/carriers.js'
import type { LabelPayload } from '../../../shared/label-payload.js'
import type { ShipmentStatus } from '../../../shared/shipment-status.js'
import type { IsoDate } from './dates.js'
import type { DerivedFields, TransitionAction } from './status.js'

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
  dropoffDate: IsoDate | null
  receivedDate: IsoDate | null
  decisionDate: IsoDate | null
  orderNumber: string | null
  note: string | null
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
  status?: Extract<ShipmentStatus, 'pending' | 'dropped_off' | 'received'>
  dropoffDate?: IsoDate | null
  receivedDate?: IsoDate | null
  orderNumber?: string | null
  note?: string | null
  label?: LabelInput
}

export type UpdateShipmentInput = {
  recipientPostalCode?: string
  recipientCountry?: string
  amountCents?: number
  store?: string
  orderNumber?: string | null
  note?: string | null
  dropoffDate?: IsoDate | null
  receivedDate?: IsoDate | null
  decisionDate?: IsoDate | null
}

export type CorrectIdentityInput = {
  carrier: CarrierId
  trackingNumber: string
}

export type ArchivedFilter = 'exclude' | 'only' | 'include'

export type SortKey =
  | 'createdAt'
  | 'updatedAt'
  | 'dropoffDate'
  | 'receivedDate'
  | 'decisionDate'
  | 'amountCents'
  | 'store'
  | 'waitingDays'

export type ListParams = {
  carrier?: CarrierId
  status?: ShipmentStatus
  store?: string
  search?: string
  archived?: ArchivedFilter
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
}

export type ExistsResult = {
  exists: boolean
  id?: string
  archived?: boolean
}

export type { TransitionAction }
