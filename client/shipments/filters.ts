import { isCarrierId } from '../../shared/carriers.js'
import { isStatusFilter } from '../../shared/shipment-status.js'
import { SORT_KEYS } from '../../shared/shipment.js'
import type { ListParams, SortKey } from '../../shared/shipment.js'

const ARCHIVED_VALUES = ['exclude', 'only', 'include'] as const

const DIRECTIONS = ['asc', 'desc'] as const

export const DEFAULT_FILTERS: ListParams = {
  archived: 'exclude',
  sort: 'requestedDate',
  direction: 'desc',
  page: 1,
}

const oneOf = <T extends string>(values: readonly T[], raw: string | null): T | undefined =>
  raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : undefined

const positiveInt = (raw: string | null): number | undefined => {
  if (raw === null) return undefined

  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const trimmed = (raw: string | null): string | undefined => {
  const value = raw?.trim()
  return value === undefined || value === '' ? undefined : value
}

export function filtersFromSearch (search: URLSearchParams): ListParams {
  const carrier = search.get('carrier')
  const status = search.get('status')
  const sort = oneOf<SortKey>(SORT_KEYS, search.get('sort'))

  return {
    ...DEFAULT_FILTERS,
    ...(carrier !== null && isCarrierId(carrier) ? { carrier } : {}),
    ...(status !== null && isStatusFilter(status) ? { status } : {}),
    ...(trimmed(search.get('store')) === undefined ? {} : { store: trimmed(search.get('store')) }),
    ...(trimmed(search.get('search')) === undefined ? {} : { search: trimmed(search.get('search')) }),
    ...(oneOf(ARCHIVED_VALUES, search.get('archived')) === undefined
      ? {}
      : { archived: oneOf(ARCHIVED_VALUES, search.get('archived')) }),
    ...(search.get('attention') === '1' ? { attention: true } : {}),
    ...(sort === undefined ? {} : { sort }),
    ...(oneOf(DIRECTIONS, search.get('direction')) === undefined
      ? {}
      : { direction: oneOf(DIRECTIONS, search.get('direction')) }),
    ...(positiveInt(search.get('page')) === undefined ? {} : { page: positiveInt(search.get('page')) }),
  }
}

export function searchFromFilters (filters: ListParams): URLSearchParams {
  const search = new URLSearchParams()

  const entries: [string, string | number | undefined][] = [
    ['carrier', filters.carrier],
    ['status', filters.status],
    ['store', filters.store],
    ['search', filters.search],
    ['archived', filters.archived],
    ['attention', filters.attention === true ? '1' : undefined],
    ['sort', filters.sort],
    ['direction', filters.direction],
    ['page', filters.page],
  ]

  for (const [key, value] of entries) {
    const fallback = DEFAULT_FILTERS[key as keyof ListParams]

    if (value !== undefined && value !== '' && value !== fallback) {
      search.set(key, String(value))
    }
  }

  return search
}

export function hasActiveFilters (filters: ListParams): boolean {
  return searchFromFilters({ ...filters, page: DEFAULT_FILTERS.page }).toString() !== ''
}
