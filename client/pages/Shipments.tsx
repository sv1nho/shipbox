import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ApiError, refusalMessage } from '../api/client.js'
import {
  applyTransition,
  archiveShipment,
  chaseShipment,
  createShipment,
  deleteShipment,
  getLabelPayload,
  importShipments,
  revertShipment,
  unarchiveShipment,
  updateShipment,
} from '../api/shipments.js'
import { Chevron } from '../components/Chevron.js'
import { Spinner } from '../components/Spinner.js'
import { AddShipmentDialog } from '../shipments/AddShipmentDialog.js'
import { DatePrompt } from '../shipments/DatePrompt.js'
import { DeleteDialog } from '../shipments/DeleteDialog.js'
import { FilterBar } from '../shipments/FilterBar.js'
import { ImportDialog } from '../shipments/ImportDialog.js'
import { MailDialog } from '../shipments/MailDialog.js'
import { ShipmentDetails } from '../shipments/ShipmentDetails.js'
import { ShipmentRow } from '../shipments/ShipmentRow.js'
import type { RowHandlers } from '../shipments/ShipmentRow.js'
import { filtersFromSearch, hasActiveFilters, searchFromFilters } from '../shipments/filters.js'
import { regenerateLabel } from '../shipments/regenerate-label.js'
import { useShipmentList } from '../shipments/useShipmentList.js'
import { earliestDateFor } from '../../shared/transitions.js'
import type { NextStep } from '../../shared/transitions.js'
import { isDecisionStatus } from '../../shared/shipment-status.js'
import { TRANSITIONS } from '../../shared/transitions.js'
import type { PromptResult } from '../shipments/DatePrompt.js'
import type {
  CreateShipmentInput,
  ImportOutcome,
  ListParams,
  ShipmentDto,
  UpdateShipmentInput,
} from '../../shared/shipment.js'

type Prompt = { shipment: ShipmentDto; actions: NextStep['actions'] }

export function Shipments () {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.toString()

  const filters = useMemo(() => filtersFromSearch(new URLSearchParams(search)), [search])
  const { result, loading, error, reload } = useShipmentList(search)

  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [deleting, setDeleting] = useState<ShipmentDto | null>(null)
  const [details, setDetails] = useState<ShipmentDto | null>(null)
  const [chasing, setChasing] = useState<ShipmentDto | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const [refused, setRefused] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (openMenu === null) return

    const dismiss = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element) || target.closest('.row-menu') === null) setOpenMenu(null)
    }

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }

    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismissOnEscape)

    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [openMenu])

  const apply = (patch: ListParams) => {
    setSearchParams(searchFromFilters({ ...filters, ...patch, page: patch.page ?? 1 }))
  }

  const run = async (operation: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true)
    setActionError(null)
    setRefused(null)
    setOpenMenu(null)

    try {
      await operation()
      reload()
      return true
    } catch (cause) {
      setActionError(refusalMessage(cause))
      setRefused(cause instanceof ApiError ? cause : null)
      return false
    } finally {
      setBusy(false)
    }
  }

  const openAddForm = () => {
    setActionError(null)
    setRefused(null)
    setAdding(true)
  }

  const confirmAdd = async (input: CreateShipmentInput) => {
    if (await run(() => createShipment(input))) setAdding(false)
  }

  const confirmImport = async (rows: Record<string, unknown>[]) => {
    let result: ImportOutcome | null = null

    await run(async () => { result = await importShipments(rows) })
    setOutcome(result)
  }

  const confirmTransition = async (active: Prompt, result: PromptResult) => {
    const done = await run(async () => {
      if (result.receivedDate !== undefined) {
        await applyTransition(active.shipment.id, 'receive', result.receivedDate)
      }

      await applyTransition(active.shipment.id, result.action, result.date, {
        rejectionReason: result.rejectionReason,
        neverReceived: result.neverReceived,
      })
    })

    if (done) setPrompt(null)
  }

  const recordChase = async (shipment: ShipmentDto) => {
    if (await run(() => chaseShipment(shipment.id))) setChasing(null)
  }

  const saveDates = async (shipment: ShipmentDto, patch: UpdateShipmentInput) => {
    let saved: ShipmentDto | null = null

    const done = await run(async () => { saved = await updateShipment(shipment.id, patch) })

    if (done && saved !== null) setDetails(saved)
  }

  const confirmDelete = async (shipment: ShipmentDto) => {
    await run(() => deleteShipment(shipment.id))
    setDeleting(null)
  }

  const handlers: RowHandlers = {
    onTransition: (shipment, actions) => {
      setOpenMenu(null)
      setActionError(null)
      setPrompt({ shipment, actions })
    },
    onRevert: (shipment) => { void run(() => revertShipment(shipment.id)) },
    onArchive: (shipment) => { void run(() => archiveShipment(shipment.id)) },
    onUnarchive: (shipment) => { void run(() => unarchiveShipment(shipment.id)) },
    onDelete: (shipment) => { setOpenMenu(null); setActionError(null); setDeleting(shipment) },
    onShowDetails: (shipment) => { setActionError(null); setDetails(shipment) },
    onWriteToStore: (shipment) => { setActionError(null); setChasing(shipment) },
    onToggleMenu: (shipment) => { setOpenMenu((open) => (open === shipment.id ? null : shipment.id)) },
    onDownloadLabel: (shipment) => {
      void run(async () => {
        const { payload } = await getLabelPayload(shipment.id)
        await regenerateLabel(payload)
      })
    },
  }

  const listBusy = busy || loading
  const items = result?.items ?? []
  const page = result?.page ?? 1
  const pageCount = result === null ? 1 : Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>Shipments</h3>
        <div className='card-actions'>
          {result !== null && (
            <span className='card-count'>
              {result.total === 1 ? '1 shipment' : `${String(result.total)} shipments`}
            </span>
          )}

          {loading && result !== null && (
            <span className='card-busy' role='status' aria-label='Updating the list'>
              <Spinner />
            </span>
          )}
          <button
            type='button'
            className='btn btn-ghost text-xs px-2.5 py-1'
            onClick={() => { setActionError(null); setOutcome(null); setImporting(true) }}
          >
            Import
          </button>
          <button
            type='button'
            className='icon-btn icon-btn-add'
            aria-label='Track a return'
            title='Track a return'
            onClick={openAddForm}
          >
            +
          </button>
        </div>
      </div>

      <div className='space-y-4'>
        <FilterBar filters={filters} attentionTotal={result?.attentionTotal ?? 0} onChange={apply} />

        {actionError !== null && prompt === null && details === null && !adding && !importing && (
          <div className='alert-error'>{actionError}</div>
        )}

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
            {!hasActiveFilters(filters) && (
              <button type='button' className='btn btn-primary' onClick={openAddForm}>
                Track a return
              </button>
            )}
          </div>
        )}

        {items.length > 0 && (
          <div
            className={listBusy ? 'shipment-list shipment-list-busy' : 'shipment-list'}
            aria-busy={listBusy}
          >
            {items.map((shipment) => (
              <ShipmentRow
                key={shipment.id}
                shipment={shipment}
                handlers={handlers}
                menuOpen={openMenu === shipment.id}
              />
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <nav className='pagination' aria-label='Pages'>
            <button
              type='button'
              className='btn btn-ghost pagination-step'
              aria-label='Previous page'
              title='Previous page'
              disabled={page <= 1 || loading}
              onClick={() => { apply({ page: page - 1 }) }}
            >
              <Chevron pointing='left' />
            </button>
            <span className='pagination-label'>Page {page} of {pageCount}</span>
            <button
              type='button'
              className='btn btn-ghost pagination-step'
              aria-label='Next page'
              title='Next page'
              disabled={page >= pageCount || loading}
              onClick={() => { apply({ page: page + 1 }) }}
            >
              <Chevron pointing='right' />
            </button>
          </nav>
        )}
      </div>

      {importing && (
        <ImportDialog
          busy={busy}
          error={actionError}
          outcome={outcome}
          onClose={() => { setImporting(false); setActionError(null); setOutcome(null) }}
          onImport={(rows) => { void confirmImport(rows) }}
        />
      )}

      {adding && (
        <AddShipmentDialog
          busy={busy}
          error={actionError}
          fieldError={(path) => refused?.messageFor(path)}
          onCancel={() => { setAdding(false); setActionError(null) }}
          onSubmit={(input) => { void confirmAdd(input) }}
        />
      )}

      {prompt !== null && (
        <DatePrompt
          key={`${prompt.shipment.id}-${prompt.actions.join('-')}`}
          actions={prompt.actions}
          earliest={earliestDateFor(prompt.shipment, prompt.actions[0])}
          busy={busy}
          error={actionError}
          onCancel={() => { setPrompt(null); setActionError(null) }}
          reception={
            isDecisionStatus(TRANSITIONS[prompt.actions[0]].target) &&
            prompt.shipment.receivedDate === null
              ? { earliest: earliestDateFor(prompt.shipment, 'receive') }
              : null
          }
          onConfirm={(result) => { void confirmTransition(prompt, result) }}
        />
      )}

      {chasing !== null && (
        <MailDialog
          shipment={chasing}
          busy={busy}
          onClose={() => { setChasing(null) }}
          onSent={() => { void recordChase(chasing) }}
        />
      )}

      {details !== null && (
        <ShipmentDetails
          shipment={details}
          busy={busy}
          error={actionError}
          onClose={() => { setDetails(null); setActionError(null) }}
          onSave={(patch) => { void saveDates(details, patch) }}
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
