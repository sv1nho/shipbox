import { useState } from 'react'
import { CARRIERS, CARRIER_IDS, isCarrierId } from '../../shared/carriers.js'
import { SHIPMENT_STATUSES, isShipmentStatus } from '../../shared/shipment-status.js'
import { SORT_KEYS } from '../../shared/shipment.js'
import type { ArchivedFilter, ListParams, SortKey } from '../../shared/shipment.js'
import { exportUrl } from '../api/shipments.js'
import { DEFAULT_FILTERS, hasActiveFilters } from './filters.js'
import { statusLabel } from './format.js'

const ARCHIVED_LABELS: Record<ArchivedFilter, string> = {
  exclude: 'Active only',
  only: 'Archived only',
  include: 'Active and archived',
}

const SORT_LABELS: Record<SortKey, string> = {
  createdAt: 'Date added',
  updatedAt: 'Last updated',
  dropoffDate: 'Drop-off date',
  receivedDate: 'Reception date',
  decisionDate: 'Decision date',
  amountCents: 'Amount',
  store: 'Store',
  waitingDays: 'Waiting time',
}

type FilterBarProps = {
  filters: ListParams
  onChange: (patch: ListParams) => void
}

export function FilterBar ({ filters, onChange }: FilterBarProps) {
  const [term, setTerm] = useState(filters.search ?? '')
  const [appliedSearch, setAppliedSearch] = useState(filters.search)

  if (filters.search !== appliedSearch) {
    setAppliedSearch(filters.search)
    setTerm(filters.search ?? '')
  }

  const direction = filters.direction ?? DEFAULT_FILTERS.direction

  return (
    <div className='filter-bar'>
      <form
        className='filter-search'
        role='search'
        onSubmit={(event) => {
          event.preventDefault()
          onChange({ search: term.trim() === '' ? undefined : term.trim() })
        }}
      >
        <label className='sr-only' htmlFor='filter-search'>Search</label>
        <input
          id='filter-search'
          className='form-input'
          type='search'
          placeholder='Tracking number, store, order number…'
          value={term}
          onChange={(event) => { setTerm(event.target.value) }}
        />
        <button type='submit' className='btn btn-ghost'>Search</button>
      </form>

      <div className='filter-selects'>
        <label className='sr-only' htmlFor='filter-carrier'>Carrier</label>
        <select
          id='filter-carrier'
          className='form-select'
          value={filters.carrier ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onChange({ carrier: isCarrierId(value) ? value : undefined })
          }}
        >
          <option value=''>All carriers</option>
          {CARRIER_IDS.map((id) => (
            <option key={id} value={id}>{CARRIERS[id].label}</option>
          ))}
        </select>

        <label className='sr-only' htmlFor='filter-status'>Status</label>
        <select
          id='filter-status'
          className='form-select'
          value={filters.status ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onChange({ status: isShipmentStatus(value) ? value : undefined })
          }}
        >
          <option value=''>All statuses</option>
          {SHIPMENT_STATUSES.map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </select>

        <label className='sr-only' htmlFor='filter-archived'>Archive</label>
        <select
          id='filter-archived'
          className='form-select'
          value={filters.archived ?? DEFAULT_FILTERS.archived}
          onChange={(event) => { onChange({ archived: event.target.value as ArchivedFilter }) }}
        >
          {Object.entries(ARCHIVED_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <label className='sr-only' htmlFor='filter-sort'>Sort by</label>
        <select
          id='filter-sort'
          className='form-select'
          value={filters.sort ?? DEFAULT_FILTERS.sort}
          onChange={(event) => { onChange({ sort: event.target.value as SortKey }) }}
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>{SORT_LABELS[key]}</option>
          ))}
        </select>

        <button
          type='button'
          className='btn btn-ghost'
          onClick={() => { onChange({ direction: direction === 'desc' ? 'asc' : 'desc' }) }}
        >
          {direction === 'desc' ? 'Descending' : 'Ascending'}
        </button>
      </div>

      <div className='filter-actions'>
        {hasActiveFilters(filters) && (
          <button
            type='button'
            className='btn btn-ghost'
            onClick={() => {
              onChange({
                carrier: undefined,
                status: undefined,
                store: undefined,
                search: undefined,
                ...DEFAULT_FILTERS,
              })
            }}
          >
            Clear filters
          </button>
        )}

        <a className='filter-export' href={exportUrl(filters, 'csv')}>Export CSV</a>
        <a className='filter-export' href={exportUrl(filters, 'json')}>Export JSON</a>
      </div>
    </div>
  )
}
