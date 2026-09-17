import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FILTERS,
  filtersFromSearch,
  hasActiveFilters,
  searchFromFilters,
} from '../../shipments/filters.js'
import type { ListParams } from '../../../shared/shipment.js'

const from = (query: string): ListParams => filtersFromSearch(new URLSearchParams(query))

const to = (filters: ListParams): string => searchFromFilters(filters).toString()

describe('filtersFromSearch', () => {
  it('falls back to the default view on an empty url', () => {
    expect(from('')).toEqual(DEFAULT_FILTERS)
  })

  it('reads every filter the page offers', () => {
    expect(from('carrier=postnl&status=received&store=Zalando&search=zal&archived=only&attention=1&sort=receivedDate&direction=asc&page=3'))
      .toEqual({
        carrier: 'postnl',
        status: 'received',
        store: 'Zalando',
        search: 'zal',
        archived: 'only',
        attention: true,
        sort: 'receivedDate',
        direction: 'asc',
        page: 3,
      })
  })

  it.each(['attention=0', 'attention=true', 'attention='])(
    'treats %s as off, only the flag the page writes turning it on',
    (query) => {
      expect(from(query).attention).toBeUndefined()
    }
  )

  it.each([
    ['carrier=dhl', 'carrier'],
    ['status=lost', 'status'],
    ['sort=nonsense', 'sort'],
    ['direction=sideways', 'direction'],
    ['archived=maybe', 'archived'],
  ])('ignores %s rather than sending it to the api', (query, key) => {
    expect(from(query)[key as keyof ListParams]).toBe(DEFAULT_FILTERS[key as keyof ListParams])
  })

  it.each(['page=0', 'page=-2', 'page=abc', 'page=1.5'])('ignores %s', (query) => {
    expect(from(query).page).toBe(1)
  })

  it('ignores a store or search made only of spaces', () => {
    const filters = from('store=%20%20&search=%20')

    expect(filters.store).toBeUndefined()
    expect(filters.search).toBeUndefined()
  })

  it('trims what the user typed', () => {
    expect(from('search=%20zalando%20').search).toBe('zalando')
  })
})

describe('searchFromFilters', () => {
  it('writes nothing for the default view, so the url stays clean', () => {
    expect(to(DEFAULT_FILTERS)).toBe('')
  })

  it('writes only what differs from the default', () => {
    expect(to({ ...DEFAULT_FILTERS, status: 'received' })).toBe('status=received')
  })

  it('drops a value equal to its default even when given explicitly', () => {
    expect(to({ ...DEFAULT_FILTERS, archived: 'exclude', direction: 'desc', page: 1 })).toBe('')
  })

  it('escapes what would break the query string', () => {
    expect(to({ ...DEFAULT_FILTERS, store: 'Zalando & Co' })).toBe('store=Zalando+%26+Co')
  })

  it('omits an empty string', () => {
    expect(to({ ...DEFAULT_FILTERS, search: '' })).toBe('')
  })
})

describe('the two directions agree', () => {
  it.each([
    '',
    'status=received',
    'carrier=bpost&sort=amountCents&direction=asc',
    'archived=only&page=4',
    'store=Zalando+BE&search=zal',
    'attention=1',
    'status=open&attention=1',
  ])('round trips %s', (query) => {
    expect(to(from(query))).toBe(query)
  })

  it('normalises an url carrying redundant defaults', () => {
    expect(to(from('archived=exclude&sort=createdAt&direction=desc&page=1'))).toBe('')
  })

  it('normalises an url carrying refused values', () => {
    expect(to(from('carrier=dhl&status=lost&page=0'))).toBe('')
  })
})

describe('hasActiveFilters', () => {
  it('is false on the default view', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('is false when only the page changed, since paging is not filtering', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, page: 5 })).toBe(false)
  })

  it.each([
    { carrier: 'bpost' },
    { status: 'received' },
    { store: 'Zalando' },
    { search: 'zal' },
    { archived: 'only' },
    { attention: true },
    { sort: 'amountCents' },
  ] as Partial<ListParams>[])('is true for %o', (overrides) => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, ...overrides })).toBe(true)
  })
})
