import { useEffect, useState } from 'react'
import { CARRIERS, CARRIER_IDS, isCarrierId } from '../../shared/carriers.js'
import { SHIPMENT_STATUSES, isStatusFilter } from '../../shared/shipment-status.js'
import { SORT_KEYS } from '../../shared/shipment.js'
import type { ArchivedFilter, ListParams, SortKey } from '../../shared/shipment.js'
import type { StoreDto } from '../../shared/store.js'
import { exportUrl, searchStores } from '../api/shipments.js'
import { Chevron } from '../components/Chevron.js'
import { useT } from '../i18n/context.js'
import { DEFAULT_FILTERS, activeFilterCount, hasActiveFilters } from './filters.js'
import { statusLabel } from './format.js'

const ARCHIVED_LABELS: Record<ArchivedFilter, string> = {
  exclude: 'Active',
  only: 'Archived',
  include: 'All',
}

const SORT_LABELS: Record<SortKey, string> = {
  requestedDate: 'Return date',
  dropoffDate: 'Drop-off date',
  receivedDate: 'Reception date',
  decisionDate: 'Decision date',
  amountCents: 'Amount',
  store: 'Store',
}

function SearchIcon () {
  return (
    <svg
      viewBox='0 0 16 16'
      width='13'
      height='13'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      aria-hidden='true'
    >
      <circle cx='6.8' cy='6.8' r='4.4' />
      <path d='M10.2 10.2 14 14' />
    </svg>
  )
}

type FilterBarProps = {
  filters: ListParams
  attentionTotal: number
  onChange: (patch: ListParams) => void
}

const STORE_LIMIT = 50

export function FilterBar ({ filters, attentionTotal, onChange }: FilterBarProps) {
  const [term, setTerm] = useState(filters.search ?? '')
  const [appliedSearch, setAppliedSearch] = useState(filters.search)
  const [stores, setStores] = useState<StoreDto[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const t = useT()

  useEffect(() => {
    const controller = new AbortController()

    searchStores('', controller.signal, STORE_LIMIT)
      .then(setStores)
      .catch(() => { setStores([]) })

    return () => { controller.abort() }
  }, [])

  if (filters.search !== appliedSearch) {
    setAppliedSearch(filters.search)
    setTerm(filters.search ?? '')
  }

  const direction = filters.direction ?? DEFAULT_FILTERS.direction
  const tracked = stores.map((store) => store.name).sort((a, b) => a.localeCompare(b))

  const narrowed = activeFilterCount(filters)

  const storeNames =
    filters.store !== undefined && !tracked.includes(filters.store)
      ? [filters.store, ...tracked]
      : tracked

  return (
    <div className='filter-bar'>
      <div className='filter-views'>
        <div className='segmented' role='group' aria-label={t('Archive')}>
          {Object.entries(ARCHIVED_LABELS).map(([value, label]) => (
            <button
              key={value}
              type='button'
              className={
                value === (filters.archived ?? DEFAULT_FILTERS.archived)
                  ? 'segmented-btn segmented-btn-active'
                  : 'segmented-btn'
              }
              aria-pressed={value === (filters.archived ?? DEFAULT_FILTERS.archived)}
              onClick={() => { onChange({ archived: value as ArchivedFilter }) }}
            >
              {t(label)}
            </button>
          ))}
        </div>

        <button
          type='button'
          className={
            filters.attention === true
              ? 'segmented-btn segmented-btn-active'
              : 'segmented-btn'
          }
          aria-pressed={filters.attention === true}
          aria-label={
            attentionTotal > 0
              ? t('Needs attention, {count} waiting', { count: attentionTotal })
              : t('Needs attention, nothing waiting')
          }
          onClick={() => {
            onChange({ attention: filters.attention === true ? undefined : true })
          }}
        >
          {t('Needs attention')}
          {attentionTotal > 0 && <span className='badge-count'>{attentionTotal}</span>}
        </button>

        <button
          type='button'
          className='btn btn-ghost btn-compact filter-toggle'
          aria-expanded={panelOpen}
          aria-controls='filter-panel'
          onClick={() => { setPanelOpen((open) => !open) }}
        >
          {t('Filters')}
          {narrowed > 0 && <span className='badge-count'>{narrowed}</span>}
          <Chevron pointing={panelOpen ? 'up' : 'down'} />
        </button>
      </div>

      <div
        id='filter-panel'
        className={panelOpen ? 'filter-panel' : 'filter-panel filter-panel-closed'}
      >
        <form
          className='filter-search'
          role='search'
          onSubmit={(event) => {
            event.preventDefault()
            onChange({ search: term.trim() === '' ? undefined : term.trim() })
          }}
        >
          <label className='sr-only' htmlFor='filter-search'>{t('Search')}</label>
          <input
            id='filter-search'
            className='form-input'
            type='search'
            placeholder={t('Tracking number, store, order number…')}
            value={term}
            onChange={(event) => { setTerm(event.target.value) }}
          />
          <button type='submit' className='btn btn-ghost btn-compact' aria-label={t('Search')}>
            <SearchIcon />
          </button>
        </form>

        <div className='filter-row'>
          <label className='sr-only' htmlFor='filter-store'>{t('Store')}</label>
          <select
            id='filter-store'
            className='form-select'
            value={filters.store ?? ''}
            onChange={(event) => {
              const value = event.target.value
              onChange({ store: value === '' ? undefined : value })
            }}
          >
            <option value=''>{t('All stores')}</option>
            {storeNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <label className='sr-only' htmlFor='filter-carrier'>{t('Carrier')}</label>
          <select
            id='filter-carrier'
            className='form-select'
            value={filters.carrier ?? ''}
            onChange={(event) => {
              const value = event.target.value
              onChange({ carrier: isCarrierId(value) ? value : undefined })
            }}
          >
            <option value=''>{t('All carriers')}</option>
            {CARRIER_IDS.map((id) => (
              <option key={id} value={id}>{CARRIERS[id].label}</option>
            ))}
          </select>

          <label className='sr-only' htmlFor='filter-status'>{t('Status')}</label>
          <select
            id='filter-status'
            className='form-select'
            value={filters.status ?? ''}
            onChange={(event) => {
              const value = event.target.value
              onChange({ status: isStatusFilter(value) ? value : undefined })
            }}
          >
            <option value=''>{t('All statuses')}</option>
            <option value='open'>{t('Not decided yet')}</option>
            {SHIPMENT_STATUSES.map((status) => (
              <option key={status} value={status}>{t(statusLabel(status))}</option>
            ))}
          </select>

          <div className='filter-sort'>
            <label className='sr-only' htmlFor='filter-sort'>{t('Sort by')}</label>
            <select
              id='filter-sort'
              className='form-select'
              value={filters.sort ?? DEFAULT_FILTERS.sort}
              onChange={(event) => { onChange({ sort: event.target.value as SortKey }) }}
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>{t(SORT_LABELS[key])}</option>
              ))}
            </select>

            <button
              type='button'
              className='btn btn-ghost btn-compact'
              aria-label={direction === 'desc' ? t('Descending') : t('Ascending')}
              onClick={() => { onChange({ direction: direction === 'desc' ? 'asc' : 'desc' }) }}
            >
              {direction === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          <div className='filter-actions'>
            {hasActiveFilters(filters) && (
              <button
                type='button'
                className='btn btn-ghost btn-compact'
                onClick={() => {
                  onChange({
                    carrier: undefined,
                    status: undefined,
                    store: undefined,
                    search: undefined,
                    attention: undefined,
                    ...DEFAULT_FILTERS,
                    sort: filters.sort ?? DEFAULT_FILTERS.sort,
                    direction: filters.direction ?? DEFAULT_FILTERS.direction,
                  })
                }}
              >
                {t('Clear filters')}
              </button>
            )}

            <a className='btn btn-ghost btn-compact' href={exportUrl(filters, 'csv')}>
              {t('Export CSV')}
            </a>
            <a className='btn btn-ghost btn-compact' href={exportUrl(filters, 'json')}>
              {t('Export JSON')}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
