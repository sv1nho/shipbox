export type ApiError = {
  error: {
    code: string
    message: string
    details: { path: string; message: string }[] | null
  }
}

export type ShipmentBody = {
  id: string
  trackingNumber: string
  carrier: string
  status: string
  amountCents: number
  store: string
  note: string | null
  hasLabel: boolean
  trackingUrl: string
  archivedAt: string | null
}

export type ListBody = {
  items: ShipmentBody[]
  total: number
  page: number
  pageSize: number
}

export const bodyOf = <T = Record<string, unknown>>(response: { body: unknown }): T =>
  response.body as T
