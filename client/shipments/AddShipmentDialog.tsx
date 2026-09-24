import { useState } from 'react'
import { CARRIERS, CARRIER_IDS } from '../../shared/carriers.js'
import type { CarrierId } from '../../shared/carriers.js'
import { COUNTRIES } from '../../shared/label-payload.js'
import type { Country } from '../../shared/label-payload.js'
import { normalizeTrackingNumber, parseAmount } from '../../shared/normalize.js'
import { findOrderBreak } from '../../shared/transitions.js'
import { today } from '../../shared/time.js'
import { MAX_AMOUNT_CENTS } from '../../shared/shipment.js'
import type { CreateShipmentInput, LabelInput } from '../../shared/shipment.js'
import { SHIPMENT_STATUSES, isDecisionStatus } from '../../shared/shipment-status.js'
import type { ShipmentStatus } from '../../shared/shipment-status.js'
import { useT } from '../i18n/context.js'
import type { Translate } from '../i18n/context.js'
import { statusLabel } from './format.js'
import { Field } from '../components/Field.js'
import { Modal } from './Modal.js'
import { StoreCombobox } from './StoreCombobox.js'
import { NewStoreDialog } from './NewStoreDialog.js'

export type Prefill = {
  trackingNumber?: string
  carrier?: CarrierId
  recipientPostalCode?: string
  recipientCountry?: Country
  label?: LabelInput
}

type AddShipmentDialogProps = {
  busy: boolean
  error: string | null
  fieldError: (path: string) => string | undefined
  prefill?: Prefill
  onCancel: () => void
  onSubmit: (input: CreateShipmentInput) => void
}

type Draft = {
  carrier: CarrierId
  trackingNumber: string
  store: string
  amount: string
  recipientPostalCode: string
  recipientCountry: Country
  orderNumber: string
  requestedDate: string
  status: ShipmentStatus
  dropoffDate: string
  receivedDate: string
  neverReceived: boolean
  decisionDate: string
  rejectionReason: string
  note: string
}

const draftFrom = (prefill: Prefill): Draft => ({
  carrier: prefill.carrier ?? 'bpost',
  trackingNumber: prefill.trackingNumber ?? '',
  store: '',
  amount: '',
  recipientPostalCode: prefill.recipientPostalCode ?? '',
  recipientCountry: prefill.recipientCountry ?? 'BE',
  orderNumber: '',
  requestedDate: today(),
  status: 'pending',
  dropoffDate: '',
  receivedDate: '',
  neverReceived: false,
  decisionDate: '',
  rejectionReason: '',
  note: '',
})

export const FIELDS_WITH_A_PLACE = [
  'trackingNumber',
  'store',
  'amountCents',
  'recipientPostalCode',
  'orderNumber',
  'requestedDate',
  'dropoffDate',
  'receivedDate',
  'decisionDate',
  'rejectionReason',
]

const REQUIRES_RECEPTION: ShipmentStatus[] = ['received', 'refunded', 'rejected']

const asksReception = (draft: Draft): boolean =>
  REQUIRES_RECEPTION.includes(draft.status) &&
  !(isDecisionStatus(draft.status) && draft.neverReceived)

type Checked = {
  problems: Partial<Record<keyof Draft, string>>
  input: CreateShipmentInput | null
}

export function check (t: Translate, draft: Draft, label?: LabelInput): Checked {
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
    ...(tracking === '' ? { trackingNumber: t('A tracking number is required.') } : {}),
    ...(tracking !== '' && !pattern.test(tracking)
      ? {
          trackingNumber: t('This is not a {carrier} number: {hint}.', {
            carrier: CARRIERS[draft.carrier].label,
            hint: patternHint,
          }),
        }
      : {}),
    ...(draft.store.trim() === '' ? { store: t('Say which store the parcel goes back to.') } : {}),
    ...(draft.orderNumber.trim() === ''
      ? { orderNumber: t('The store searches by its own order number, not by the tracking number.') }
      : {}),
    ...(amountCents === null ? { amount: t('An amount like 49.99 is required.') } : {}),
    ...(amountCents !== null && amountCents > MAX_AMOUNT_CENTS
      ? { amount: t('An amount cannot be more than 1,000,000.') }
      : {}),
    ...(draft.recipientPostalCode.trim() === ''
      ? { recipientPostalCode: t('A postal code is required.') }
      : {}),
    ...(draft.requestedDate === '' ? { requestedDate: t('Pick the day you asked for the return.') } : {}),
    ...(draft.status !== 'pending' && draft.dropoffDate === ''
      ? { dropoffDate: t('Pick the day you dropped the parcel off.') }
      : {}),
    ...(asksReception(draft) && draft.receivedDate === ''
      ? { receivedDate: t('Pick the day the store received it.') }
      : {}),
    ...(isDecisionStatus(draft.status) && draft.decisionDate === ''
      ? { decisionDate: t('Pick the day the store decided.') }
      : {}),
    ...(broken === null ? {} : { [broken.field]: t('This cannot be earlier than the step before it.') }),
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
      orderNumber: draft.orderNumber.trim(),
      requestedDate: draft.requestedDate,
      ...(draft.status === 'pending' ? {} : { status: draft.status }),
      ...(draft.dropoffDate === '' ? {} : { dropoffDate: draft.dropoffDate }),
      ...(draft.receivedDate === '' || !asksReception(draft)
        ? {}
        : { receivedDate: draft.receivedDate }),
      ...(isDecisionStatus(draft.status) && draft.neverReceived ? { neverReceived: true } : {}),
      ...(draft.decisionDate === '' ? {} : { decisionDate: draft.decisionDate }),
      ...(draft.status === 'rejected' && draft.rejectionReason.trim() !== ''
        ? { rejectionReason: draft.rejectionReason.trim() }
        : {}),
      ...(draft.note.trim() === '' ? {} : { note: draft.note.trim() }),
      ...(label === undefined ? {} : { label }),
    },
  }
}

export function AddShipmentDialog (
  { busy, error, fieldError, prefill = {}, onCancel, onSubmit }: AddShipmentDialogProps
) {
  const [draft, setDraft] = useState(() => draftFrom(prefill))
  const [attempted, setAttempted] = useState(false)
  const [addingStore, setAddingStore] = useState(false)
  const t = useT()

  const { problems, input } = check(t, draft, prefill.label)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft({ ...draft, [key]: value })
  }

  const problem = (key: keyof Draft): string | undefined =>
    attempted ? problems[key] : undefined

  if (addingStore) {
    return (
      <NewStoreDialog
        name={draft.store}
        onCancel={() => { setAddingStore(false) }}
        onAdded={(store) => {
          setDraft({ ...draft, store: store.name })
          setAddingStore(false)
        }}
      />
    )
  }

  return (
    <Modal titleId='add-shipment-title' onClose={onCancel}>
      <div className='modal-header'>
        <h2 className='modal-title' id='add-shipment-title'>{t('Track a return')}</h2>
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
          label={t('Tracking number')}
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

        <Field
          label={t('Store')}
          htmlFor='shipment-store'
          problem={problem('store') ?? fieldError('store')}
        >
          <div className='combobox-row'>
            <StoreCombobox
              value={draft.store}
              invalid={problem('store') !== undefined}
              onChange={(store) => { set('store', store) }}
              onPick={(store) => { set('store', store.name) }}
            />
            <button
              type='button'
              className='icon-btn icon-btn-add'
              aria-label={t('Add a store')}
              title={t('Add a store')}
              onClick={() => { setAddingStore(true) }}
            >
              +
            </button>
          </div>
        </Field>

        <div className='form-row form-row-three'>
          <Field
            label={t('Amount')}
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
            label={t('Postal code')}
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

          <Field label={t('Country')} htmlFor='shipment-country' problem={undefined}>
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
            label={t('Return requested on')}
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

          <Field label={t('Where is it already?')} htmlFor='shipment-status' problem={undefined}>
            <select
              id='shipment-status'
              className='form-select'
              value={draft.status}
              onChange={(event) => { set('status', event.target.value as ShipmentStatus) }}
            >
              {SHIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{t(statusLabel(status))}</option>
              ))}
            </select>
          </Field>
        </div>

        {draft.status !== 'pending' && (
          <div className='form-row'>
            <Field
              label={t('Dropped off on')}
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

            {asksReception(draft) && (
              <Field
                label={t('Received on')}
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
          <label className='form-check'>
            <input
              type='checkbox'
              checked={draft.neverReceived}
              onChange={(event) => { set('neverReceived', event.target.checked) }}
            />
            {t('The store never received it')}
          </label>
        )}

        {isDecisionStatus(draft.status) && (
          <div className='form-row'>
            <Field
              label={t('Decided on')}
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
                label={t('Refused because (optional)')}
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
          <Field
            label={t('Order number')}
            htmlFor='shipment-order'
            problem={problem('orderNumber') ?? fieldError('orderNumber')}
          >
            <input
              id='shipment-order'
              className='form-input'
              autoComplete='off'
              value={draft.orderNumber}
              onChange={(event) => { set('orderNumber', event.target.value) }}
            />
          </Field>

          <Field label={t('Note (optional)')} htmlFor='shipment-note' problem={undefined}>
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
            {t('Cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={busy}>
            {busy ? t('Adding…') : t('Track it')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
