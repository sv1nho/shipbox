import { useState } from 'react'
import { CARRIERS, CARRIER_IDS } from '../../shared/carriers.js'
import type { CarrierId } from '../../shared/carriers.js'
import { COUNTRIES } from '../../shared/label-payload.js'
import type { Country } from '../../shared/label-payload.js'
import { normalizeTrackingNumber } from '../../shared/normalize.js'
import { findOrderBreak } from '../../shared/transitions.js'
import { today } from '../../shared/time.js'
import type { CreateShipmentInput, StartingStatus } from '../../shared/shipment.js'
import { statusLabel } from './format.js'
import { Modal } from './Modal.js'
import { StoreCombobox } from './StoreCombobox.js'

function FieldProblem ({ message }: { message: string | undefined }) {
  if (message === undefined) return null

  return <p className='field-error'>{message}</p>
}

type AddShipmentDialogProps = {
  busy: boolean
  error: string | null
  fieldError: (path: string) => string | undefined
  onCancel: () => void
  onSubmit: (input: CreateShipmentInput) => void
}

const STARTING_STATUSES: StartingStatus[] = ['pending', 'dropped_off', 'received']

type Draft = {
  carrier: CarrierId
  trackingNumber: string
  store: string
  amount: string
  recipientPostalCode: string
  recipientCountry: Country
  orderNumber: string
  requestedDate: string
  status: StartingStatus
  dropoffDate: string
  receivedDate: string
  note: string
}

const emptyDraft = (): Draft => ({
  carrier: 'bpost',
  trackingNumber: '',
  store: '',
  amount: '',
  recipientPostalCode: '',
  recipientCountry: 'BE',
  orderNumber: '',
  requestedDate: today(),
  status: 'pending',
  dropoffDate: '',
  receivedDate: '',
  note: '',
})

export const parseAmount = (raw: string): number | null => {
  const normalised = raw.replace(',', '.').trim()

  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null

  return Math.round(Number(normalised) * 100)
}

type Checked = {
  problems: Partial<Record<keyof Draft, string>>
  input: CreateShipmentInput | null
}

export function check (draft: Draft): Checked {
  const tracking = normalizeTrackingNumber(draft.trackingNumber)
  const amountCents = parseAmount(draft.amount)
  const { patternHint, pattern } = CARRIERS[draft.carrier]

  const dates = {
    requestedDate: draft.requestedDate,
    dropoffDate: draft.dropoffDate === '' ? null : draft.dropoffDate,
    receivedDate: draft.receivedDate === '' ? null : draft.receivedDate,
    decisionDate: null,
  }

  const broken = draft.requestedDate === '' ? null : findOrderBreak(dates)

  const problems = {
    ...(tracking === '' ? { trackingNumber: 'A tracking number is required.' } : {}),
    ...(tracking !== '' && !pattern.test(tracking)
      ? { trackingNumber: `This is not a ${CARRIERS[draft.carrier].label} number: ${patternHint}.` }
      : {}),
    ...(draft.store.trim() === '' ? { store: 'Say which store the parcel goes back to.' } : {}),
    ...(amountCents === null ? { amount: 'An amount like 49.99 is required.' } : {}),
    ...(draft.recipientPostalCode.trim() === ''
      ? { recipientPostalCode: 'A postal code is required.' }
      : {}),
    ...(draft.requestedDate === '' ? { requestedDate: 'Pick the day you asked for the return.' } : {}),
    ...(draft.status !== 'pending' && draft.dropoffDate === ''
      ? { dropoffDate: 'Pick the day you dropped the parcel off.' }
      : {}),
    ...(draft.status === 'received' && draft.receivedDate === ''
      ? { receivedDate: 'Pick the day the store received it.' }
      : {}),
    ...(broken === null ? {} : { [broken.field]: 'This cannot be earlier than the step before it.' }),
  }

  if (Object.keys(problems).length > 0 || amountCents === null) return { problems, input: null }

  return {
    problems,
    input: {
      trackingNumber: tracking,
      carrier: draft.carrier,
      recipientPostalCode: draft.recipientPostalCode,
      recipientCountry: draft.recipientCountry,
      amountCents,
      store: draft.store,
      requestedDate: draft.requestedDate,
      ...(draft.status === 'pending' ? {} : { status: draft.status }),
      ...(draft.dropoffDate === '' ? {} : { dropoffDate: draft.dropoffDate }),
      ...(draft.receivedDate === '' ? {} : { receivedDate: draft.receivedDate }),
      ...(draft.orderNumber.trim() === '' ? {} : { orderNumber: draft.orderNumber.trim() }),
      ...(draft.note.trim() === '' ? {} : { note: draft.note.trim() }),
    },
  }
}

export function AddShipmentDialog (
  { busy, error, fieldError, onCancel, onSubmit }: AddShipmentDialogProps
) {
  const [draft, setDraft] = useState(emptyDraft)
  const [attempted, setAttempted] = useState(false)

  const { problems, input } = check(draft)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft({ ...draft, [key]: value })
  }

  const problem = (key: keyof Draft): string | undefined =>
    attempted ? problems[key] : undefined

  return (
    <Modal titleId='add-shipment-title' onClose={onCancel}>
      <div className='modal-header'>
        <h2 className='modal-title' id='add-shipment-title'>Track a return</h2>
      </div>

      <form
        className='modal-body space-y-3'
        onSubmit={(event) => {
          event.preventDefault()
          setAttempted(true)
          if (input !== null) onSubmit(input)
        }}
      >
        <div className='segmented' role='group' aria-label='Carrier'>
          {CARRIER_IDS.map((id) => (
            <button
              key={id}
              type='button'
              className={id === draft.carrier ? 'segmented-btn segmented-btn-active' : 'segmented-btn'}
              aria-pressed={id === draft.carrier}
              onClick={() => { set('carrier', id) }}
            >
              {CARRIERS[id].label}
            </button>
          ))}
        </div>

        <label className='form-label' htmlFor='shipment-tracking'>Tracking number</label>
        <input
          id='shipment-tracking'
          className='form-input'
          autoComplete='off'
          placeholder={CARRIERS[draft.carrier].placeholder}
          value={draft.trackingNumber}
          onChange={(event) => { set('trackingNumber', event.target.value) }}
        />
        <FieldProblem message={problem('trackingNumber') ?? fieldError('trackingNumber')} />

        <label className='form-label' htmlFor='shipment-store'>Store</label>
        <StoreCombobox
          value={draft.store}
          invalid={problem('store') !== undefined}
          onChange={(store) => { set('store', store) }}
        />
        <FieldProblem message={problem('store') ?? fieldError('store')} />

        <div className='form-row'>
          <div>
            <label className='form-label' htmlFor='shipment-amount'>Amount</label>
            <input
              id='shipment-amount'
              className='form-input'
              inputMode='decimal'
              placeholder='49.99'
              value={draft.amount}
              onChange={(event) => { set('amount', event.target.value) }}
            />
          </div>
          <div>
            <label className='form-label' htmlFor='shipment-postal'>Postal code</label>
            <input
              id='shipment-postal'
              className='form-input'
              autoComplete='off'
              value={draft.recipientPostalCode}
              onChange={(event) => { set('recipientPostalCode', event.target.value) }}
            />
          </div>
          <div>
            <label className='form-label' htmlFor='shipment-country'>Country</label>
            <select
              id='shipment-country'
              className='form-select'
              value={draft.recipientCountry}
              onChange={(event) => { set('recipientCountry', event.target.value as Country) }}
            >
              {COUNTRIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </div>
        </div>
        <FieldProblem message={problem('amount') ?? fieldError('amountCents')} />
        <FieldProblem message={problem('recipientPostalCode') ?? fieldError('recipientPostalCode')} />

        <label className='form-label' htmlFor='shipment-requested'>Return requested on</label>
        <input
          id='shipment-requested'
          type='date'
          className='form-input'
          value={draft.requestedDate}
          max={today()}
          onChange={(event) => { set('requestedDate', event.target.value) }}
        />
        <FieldProblem message={problem('requestedDate') ?? fieldError('requestedDate')} />

        <label className='form-label' htmlFor='shipment-status'>Where is it already?</label>
        <select
          id='shipment-status'
          className='form-select'
          value={draft.status}
          onChange={(event) => { set('status', event.target.value as StartingStatus) }}
        >
          {STARTING_STATUSES.map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </select>

        {draft.status !== 'pending' && (
          <>
            <label className='form-label' htmlFor='shipment-dropoff'>Dropped off on</label>
            <input
              id='shipment-dropoff'
              type='date'
              className='form-input'
              value={draft.dropoffDate}
              min={draft.requestedDate}
              max={today()}
              onChange={(event) => { set('dropoffDate', event.target.value) }}
            />
            <FieldProblem message={problem('dropoffDate') ?? fieldError('dropoffDate')} />
          </>
        )}

        {draft.status === 'received' && (
          <>
            <label className='form-label' htmlFor='shipment-received'>Received on</label>
            <input
              id='shipment-received'
              type='date'
              className='form-input'
              value={draft.receivedDate}
              min={draft.dropoffDate === '' ? draft.requestedDate : draft.dropoffDate}
              max={today()}
              onChange={(event) => { set('receivedDate', event.target.value) }}
            />
            <FieldProblem message={problem('receivedDate') ?? fieldError('receivedDate')} />
          </>
        )}

        <label className='form-label' htmlFor='shipment-order'>Order number (optional)</label>
        <input
          id='shipment-order'
          className='form-input'
          autoComplete='off'
          value={draft.orderNumber}
          onChange={(event) => { set('orderNumber', event.target.value) }}
        />

        <label className='form-label' htmlFor='shipment-note'>Note (optional)</label>
        <input
          id='shipment-note'
          className='form-input'
          value={draft.note}
          onChange={(event) => { set('note', event.target.value) }}
        />

        {error !== null && <div className='alert-error'>{error}</div>}

        <div className='modal-footer'>
          <button type='button' className='btn btn-ghost' onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type='submit' className='btn btn-primary' disabled={busy}>
            {busy ? 'Adding…' : 'Track it'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
