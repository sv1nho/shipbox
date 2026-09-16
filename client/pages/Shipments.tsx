import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { errorMessage } from '../api/client.js'
import {
  applyTransition,
  archiveShipment,
  deleteShipment,
  getLabelPayload,
  revertShipment,
  unarchiveShipment,
} from '../api/shipments.js'
import { DatePrompt } from '../shipments/DatePrompt.js'
import { DeleteDialog } from '../shipments/DeleteDialog.js'
import { FilterBar } from '../shipments/FilterBar.js'
import { ShipmentRow } from '../shipments/ShipmentRow.js'
import type { RowHandlers } from '../shipments/ShipmentRow.js'
import { filtersFromSearch, hasActiveFilters, searchFromFilters } from '../shipments/filters.js'
import { regenerateLabel } from '../shipments/regenerate-label.js'
import { useShipmentList } from '../shipments/useShipmentList.js'
import { earliestDateFor } from '../../shared/transitions.js'
import type { TransitionAction } from '../../shared/transitions.js'
import type { ListParams, ShipmentDto } from '../../shared/shipment.js'

type Prompt = { shipment: ShipmentDto; action: TransitionAction }

export function Shipments () {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.toString()

  const filters = useMemo(() => filtersFromSearch(new URLSearchParams(search)), [search])
  const { result, loading, error, reload } = useShipmentList(search)

  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [deleting, setDeleting] = useState<ShipmentDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const apply = (patch: ListParams) => {
    setSearchParams(searchFromFilters({ ...filters, ...patch, page: patch.page ?? 1 }))
  }

  const run = async (operation: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true)
    setActionError(null)

    try {
      await operation()
      reload()
      return true
    } catch (cause) {
      setActionError(errorMessage(cause))
      return false
    } finally {
      setBusy(false)
    }
  }

  const confirmTransition = async (active: Prompt, date: string, note?: string) => {
    const done = await run(() => applyTransition(active.shipment.id, active.action, date, note))
    if (done) setPrompt(null)
  }

  const confirmDelete = async (shipment: ShipmentDto) => {
    await run(() => deleteShipment(shipment.id))
    setDeleting(null)
  }

  const handlers: RowHandlers = {
    onTransition: (shipment, action) => { setActionError(null); setPrompt({ shipment, action }) },
    onRevert: (shipment) => { void run(() => revertShipment(shipment.id)) },
    onArchive: (shipment) => { void run(() => archiveShipment(shipment.id)) },
    onUnarchive: (shipment) => { void run(() => unarchiveShipment(shipment.id)) },
    onDelete: (shipment) => { setActionError(null); setDeleting(shipment) },
    onDownloadLabel: (shipment) => {
      void run(async () => {
        const { payload } = await getLabelPayload(shipment.id)
        await regenerateLabel(payload)
      })
    },
  }

  const items = result?.items ?? []
  const page = result?.page ?? 1
  const pageCount = result === null ? 1 : Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>Shipments</h3>
        {result !== null && (
          <span className='card-count'>
            {result.total === 1 ? '1 shipment' : `${String(result.total)} shipments`}
          </span>
        )}
      </div>

      <div className='space-y-4'>
        <FilterBar filters={filters} onChange={apply} />

        {actionError !== null && prompt === null && <div className='alert-error'>{actionError}</div>}

        {error !== null && (
          <div className='alert-error'>
            {error}{' '}
            <button type='button' className='link-button' onClick={reload}>Try again</button>
          </div>
        )}

        {loading && result === null && <p className='card-text'>Loading your shipments…</p>}

        {!loading && error === null && items.length === 0 && (
          <div className='empty-state'>
            <p className='card-text'>
              {hasActiveFilters(filters)
                ? 'No shipment matches these filters. Clear them to see the whole list again.'
                : 'You are not tracking any shipment yet.'}
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className={busy ? 'shipment-list shipment-list-busy' : 'shipment-list'}>
            {items.map((shipment) => (
              <ShipmentRow key={shipment.id} shipment={shipment} handlers={handlers} />
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <nav className='pagination' aria-label='Pages'>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={page <= 1}
              onClick={() => { apply({ page: page - 1 }) }}
            >
              Previous
            </button>
            <span className='pagination-label'>Page {page} of {pageCount}</span>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={page >= pageCount}
              onClick={() => { apply({ page: page + 1 }) }}
            >
              Next
            </button>
          </nav>
        )}
      </div>

      {prompt !== null && (
        <DatePrompt
          key={`${prompt.shipment.id}-${prompt.action}`}
          action={prompt.action}
          earliest={earliestDateFor(prompt.shipment, prompt.action)}
          busy={busy}
          error={actionError}
          onCancel={() => { setPrompt(null); setActionError(null) }}
          onConfirm={(date, note) => { void confirmTransition(prompt, date, note) }}
        />
      )}

      {deleting !== null && (
        <DeleteDialog
          shipment={deleting}
          busy={busy}
          onCancel={() => { setDeleting(null) }}
          onConfirm={() => { void confirmDelete(deleting) }}
        />
      )}
    </div>
  )
}
