import { request } from './client.js'
import { TRANSITIONS } from '../../shared/transitions.js'
import type { TransitionAction } from '../../shared/transitions.js'
import type {
  CreateShipmentInput,
  ExistsResult,
  ImportOutcome,
  IsoDate,
  LabelResult,
  ListParams,
  ListResult,
  ShipmentDto,
  UpdateShipmentInput,
} from '../../shared/shipment.js'
import type { CarrierId } from '../../shared/carriers.js'
import type { StoreDto } from '../../shared/store.js'

const BASE = '/api/shipments'

const STORES = '/api/stores'

const listQuery = (params: ListParams): Record<string, string | number | undefined> => ({
  carrier: params.carrier,
  status: params.status,
  store: params.store,
  search: params.search,
  archived: params.archived,
  attention: params.attention === true ? '1' : undefined,
  sort: params.sort,
  direction: params.direction,
  page: params.page,
  pageSize: params.pageSize,
})

export const listShipments = (params: ListParams = {}, signal?: AbortSignal): Promise<ListResult> =>
  request<ListResult>(BASE, { query: listQuery(params), signal })

export const createShipment = (input: CreateShipmentInput): Promise<ShipmentDto> =>
  request<ShipmentDto>(BASE, { method: 'POST', body: input })

export const updateShipment = (id: string, patch: UpdateShipmentInput): Promise<ShipmentDto> =>
  request<ShipmentDto>(`${BASE}/${id}`, { method: 'PATCH', body: patch })

export const importShipments = (shipments: Record<string, unknown>[]): Promise<ImportOutcome> =>
  request<ImportOutcome>(`${BASE}/import`, { method: 'POST', body: { shipments } })

type TransitionExtras = {
  rejectionReason?: string
  neverReceived?: boolean
}

export const applyTransition = (
  id: string,
  action: TransitionAction,
  date: IsoDate,
  extras: TransitionExtras = {}
): Promise<ShipmentDto> => {
  const { dateField, path } = TRANSITIONS[action]

  return request<ShipmentDto>(`${BASE}/${id}/${path}`, {
    method: 'POST',
    body: {
      [dateField]: date,
      ...(extras.rejectionReason === undefined ? {} : { rejectionReason: extras.rejectionReason }),
      ...(extras.neverReceived === true ? { neverReceived: true } : {}),
    },
  })
}

export const revertShipment = (id: string): Promise<ShipmentDto> =>
  request<ShipmentDto>(`${BASE}/${id}/revert`, { method: 'POST' })

export const archiveShipment = (id: string): Promise<ShipmentDto> =>
  request<ShipmentDto>(`${BASE}/${id}/archive`, { method: 'POST' })

export const unarchiveShipment = (id: string): Promise<ShipmentDto> =>
  request<ShipmentDto>(`${BASE}/${id}/unarchive`, { method: 'POST' })

export const deleteShipment = async (id: string): Promise<void> => {
  await request<undefined>(`${BASE}/${id}`, { method: 'DELETE' })
}

export const shipmentExists = (
  carrier: CarrierId,
  trackingNumber: string,
  signal?: AbortSignal
): Promise<ExistsResult> =>
  request<ExistsResult>(`${BASE}/exists`, { query: { carrier, trackingNumber }, signal })

export const getLabelPayload = (id: string): Promise<LabelResult> =>
  request<LabelResult>(`${BASE}/${id}/label`)

export const searchStores = (
  q: string,
  signal?: AbortSignal,
  limit?: number
): Promise<StoreDto[]> =>
  request<{ stores: StoreDto[] }>(STORES, { query: { q, limit }, signal })
    .then((result) => result.stores)

export const addStore = (name: string, supportEmail: string): Promise<StoreDto> =>
  request<StoreDto>(STORES, { method: 'POST', body: { name, supportEmail } })

export const exportUrl = (params: ListParams, format: 'json' | 'csv'): string => {
  const query = new URLSearchParams({ format })

  for (const [key, value] of Object.entries(listQuery(params))) {
    if (value !== undefined && value !== '' && key !== 'page' && key !== 'pageSize') {
      query.set(key, String(value))
    }
  }

  return `${BASE}/export?${query.toString()}`
}
