import { request } from './client.js'
import { TRANSITIONS } from '../../shared/transitions.js'
import type { TransitionAction } from '../../shared/transitions.js'
import type {
  CreateShipmentInput,
  ExistsResult,
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

const listQuery = (params: ListParams): Record<string, string | number | undefined> => ({
  carrier: params.carrier,
  status: params.status,
  store: params.store,
  search: params.search,
  archived: params.archived,
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

export const applyTransition = (
  id: string,
  action: TransitionAction,
  date: IsoDate,
  rejectionReason?: string
): Promise<ShipmentDto> => {
  const { dateField, path } = TRANSITIONS[action]

  return request<ShipmentDto>(`${BASE}/${id}/${path}`, {
    method: 'POST',
    body: rejectionReason === undefined
      ? { [dateField]: date }
      : { [dateField]: date, rejectionReason },
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

export const searchStores = (q: string, signal?: AbortSignal): Promise<StoreDto[]> =>
  request<{ stores: StoreDto[] }>(`${BASE}/stores`, { query: { q }, signal }).then(
    (result) => result.stores
  )

export const exportUrl = (params: ListParams, format: 'json' | 'csv'): string => {
  const query = new URLSearchParams({ format })

  for (const [key, value] of Object.entries(listQuery(params))) {
    if (value !== undefined && value !== '' && key !== 'page' && key !== 'pageSize') {
      query.set(key, String(value))
    }
  }

  return `${BASE}/export?${query.toString()}`
}
