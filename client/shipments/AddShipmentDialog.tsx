import { useState } from 'react'
import type { ReactNode } from 'react'
import { CARRIERS, CARRIER_IDS } from '../../shared/carriers.js'
import type { CarrierId } from '../../shared/carriers.js'
import { COUNTRIES } from '../../shared/label-payload.js'
import type { Country } from '../../shared/label-payload.js'
import { normalizeTrackingNumber } from '../../shared/normalize.js'
import { findOrderBreak } from '../../shared/transitions.js'
import { today } from '../../shared/time.js'
import type { CreateShipmentInput } from '../../shared/shipment.js'
import { SHIPMENT_STATUSES, isDecisionStatus } from '../../shared/shipment-status.js'
import type { ShipmentStatus } from '../../shared/shipment-status.js'
import { statusLabel } from './format.js'
import { Modal } from './Modal.js'
import { StoreCombobox } from './StoreCombobox.js'

type FieldProps = {
  label: string
  htmlFor: string
  problem: string | undefined
  children: ReactNode
}

function Field ({ label, htmlFor, problem, children }: FieldProps) {
  return (
    <div className='form-field'>
      <label className='form-label' htmlFor={htmlFor}>{label}</label>
      {children}
      {problem !== undefined && <p className='field-error'>{problem}</p>}
    </div>
  )
}

type AddShipmentDialogProps = {
  busy: boolean
  error: string | null
  fieldError: (path: string) => string | undefined
  onCancel: () => void
  onSubmit: (input: CreateShipmentInput) => void
}

type Draft = {
  carrier: CarrierId
  trackingNumber: string
  store: string
  storeSupportEmail: string
  amount: string
  recipientPostalCode: string
  recipientCountry: Country
  orderNumber: string
  requestedDate: string
  status: ShipmentStatus
  dropoffDate: string
  receivedDate: string
  decisionDate: string
  rejectionReason: string
  note: string
}

const emptyDraft = (): Draft => ({
  carrier: 'bpost',
  trackingNumber: '',
  store: '',
  storeSupportEmail: '',
  amount: '',
  recipientPostalCode: '',
  recipientCountry: 'BE',
  orderNumber: '',
  requestedDate: today(),
  status: 'pending',
  dropoffDate: '',
  receivedDate: '',
  decisionDate: '',
  rejectionReason: '',
  note: '',
})

const REQUIRES_RECEPTION: ShipmentStatus[] = ['received', 'refunded', 'rejected']

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
    decisionDate: draft.decisionDate === '' ? null : draft.decisionDate,
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
    ...(REQUIRES_RECEPTION.includes(draft.status) && draft.receivedDate === ''
      ? { receivedDate: 'Pick the day the store received it.' }
      : {}),
    ...(isDecisionStatus(draft.status) && draft.decisionDate === ''
      ? { decisionDate: 'Pick the day the store decided.' }
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
      ...(draft.decisionDate === '' ? {} : { decisionDate: draft.decisionDate }),
      ...(draft.status === 'rejected' && draft.rejectionReason.trim() !== ''
        ? { rejectionReason: draft.rejectionReason.trim() }
        : {}),
      ...(draft.storeSupportEmail.trim() === ''
        ? {}
        : { storeSupportEmail: draft.storeSupportEmail.trim() }),
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

        <Field
          label='Tracking number'
          htmlFor='shipment-tracking'
          problem={problem('trackingNumber') ?? fieldError('trackingNumber')}
        >
          <input
            id='shipment-tracking'
            className='form-input'
            autoComplete='off'
            placeholder={CARRIERS[draft.carrier].placeholder}
            value={draft.trackingNumber}
            onChange={(event) => { set('trackingNumber', event.target.value) }}
          />
        </Field>

        <div className='form-row'>
          <Field
            label='Store'
            htmlFor='shipment-store'
            problem={problem('store') ?? fieldError('store')}
          >
            <StoreCombobox
              value={draft.store}
              invalid={problem('store') !== undefined}
              onChange={(store) => { set('store', store) }}
              onPick={(store) => {
                setDraft({
                  ...draft,
                  store: store.name,
                  storeSupportEmail: store.supportEmail ?? '',
                })
              }}
            />
          </Field>

          <Field
            label='Customer service email (optional)'
            htmlFor='shipment-store-email'
            problem={fieldError('storeSupportEmail')}
          >
            <input
              id='shipment-store-email'
              className='form-input'
              type='email'
              autoComplete='off'
              value={draft.storeSupportEmail}
              onChange={(event) => { set('storeSupportEmail', event.target.value) }}
            />
          </Field>
        </div>

        <div className='form-row form-row-three'>
          <Field
            label='Amount'
            htmlFor='shipment-amount'
            problem={problem('amount') ?? fieldError('amountCents')}
          >
            <input
              id='shipment-amount'
              className='form-input'
              inputMode='decimal'
              placeholder='49.99'
              value={draft.amount}
              onChange={(event) => { set('amount', event.target.value) }}
            />
          </Field>

          <Field
            label='Postal code'
            htmlFor='shipment-postal'
            problem={problem('recipientPostalCode') ?? fieldError('recipientPostalCode')}
          >
            <input
              id='shipment-postal'
              className='form-input'
              autoComplete='off'
              value={draft.recipientPostalCode}
              onChange={(event) => { set('recipientPostalCode', event.target.value) }}
            />
          </Field>

          <Field label='Country' htmlFor='shipment-country' problem={undefined}>
            <select
              id='shipment-country'
              className='form-select'
              value={draft.recipientCountry}
              onChange={(event) => { set('recipientCountry', event.target.value as Country) }}
            >
              {COUNTRIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </Field>
        </div>

        <div className='form-row'>
          <Field
            label='Return requested on'
            htmlFor='shipment-requested'
            problem={problem('requestedDate') ?? fieldError('requestedDate')}
          >
            <input
              id='shipment-requested'
              type='date'
              className='form-input'
              value={draft.requestedDate}
              max={today()}
              onChange={(event) => { set('requestedDate', event.target.value) }}
            />
          </Field>

          <Field label='Where is it already?' htmlFor='shipment-status' problem={undefined}>
            <select
              id='shipment-status'
              className='form-select'
              value={draft.status}
              onChange={(event) => { set('status', event.target.value as ShipmentStatus) }}
            >
              {SHIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </Field>
        </div>

        {draft.status !== 'pending' && (
          <div className='form-row'>
            <Field
              label='Dropped off on'
              htmlFor='shipment-dropoff'
              problem={problem('dropoffDate') ?? fieldError('dropoffDate')}
            >
              <input
                id='shipment-dropoff'
                type='date'
                className='form-input'
                value={draft.dropoffDate}
                min={draft.requestedDate}
                max={today()}
                onChange={(event) => { set('dropoffDate', event.target.value) }}
              />
            </Field>

            {REQUIRES_RECEPTION.includes(draft.status) && (
              <Field
                label='Received on'
                htmlFor='shipment-received'
                problem={problem('receivedDate') ?? fieldError('receivedDate')}
              >
                <input
                  id='shipment-received'
                  type='date'
                  className='form-input'
                  value={draft.receivedDate}
                  min={draft.dropoffDate === '' ? draft.requestedDate : draft.dropoffDate}
                  max={today()}
                  onChange={(event) => { set('receivedDate', event.target.value) }}
                />
              </Field>
            )}
          </div>
        )}

        {isDecisionStatus(draft.status) && (
          <div className='form-row'>
            <Field
              label='Decided on'
              htmlFor='shipment-decision'
              problem={problem('decisionDate') ?? fieldError('decisionDate')}
            >
              <input
                id='shipment-decision'
                type='date'
                className='form-input'
                value={draft.decisionDate}
                min={draft.receivedDate === '' ? draft.requestedDate : draft.receivedDate}
                max={today()}
                onChange={(event) => { set('decisionDate', event.target.value) }}
              />
            </Field>

            {draft.status === 'rejected' && (
              <Field
                label='Refused because (optional)'
                htmlFor='shipment-reason'
                problem={fieldError('rejectionReason')}
              >
                <input
                  id='shipment-reason'
                  className='form-input'
                  value={draft.rejectionReason}
                  onChange={(event) => { set('rejectionReason', event.target.value) }}
                />
              </Field>
            )}
          </div>
        )}

        <div className='form-row'>
          <Field label='Order number (optional)' htmlFor='shipment-order' problem={undefined}>
            <input
              id='shipment-order'
              className='form-input'
              autoComplete='off'
              value={draft.orderNumber}
              onChange={(event) => { set('orderNumber', event.target.value) }}
            />
          </Field>

          <Field label='Note (optional)' htmlFor='shipment-note' problem={undefined}>
            <input
              id='shipment-note'
              className='form-input'
              value={draft.note}
              onChange={(event) => { set('note', event.target.value) }}
            />
          </Field>
        </div>

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
