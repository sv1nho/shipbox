import { useState } from 'react'
import type { ReactNode } from 'react'
import type { IsoDate, ShipmentDto, UpdateShipmentInput } from '../../shared/shipment.js'
import { CARRIERS } from '../../shared/carriers.js'
import { COUNTRIES } from '../../shared/label-payload.js'
import type { Country } from '../../shared/label-payload.js'
import { parseAmount } from '../../shared/normalize.js'
import { MAX_AMOUNT_CENTS } from '../../shared/shipment.js'
import { ORDERED_DATED_FIELDS, findOrderBreak } from '../../shared/transitions.js'
import type { DatedField } from '../../shared/transitions.js'
import { today } from '../../shared/time.js'
import { useT } from '../i18n/context.js'
import type { Translate } from '../i18n/context.js'
import { alertMessage, days, formatAmount, formatDate, zonedDate } from './format.js'
import { CopyIcon } from '../components/CopyIcon.js'
import { copyText } from '../utils/clipboard.js'
import { StatusPill } from './StatusPill.js'
import { Modal } from './Modal.js'
import { Timeline } from './Timeline.js'
import type { Step } from './Timeline.js'

type DetailsProps = {
  shipment: ShipmentDto
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (patch: UpdateShipmentInput) => void
}

const DATE_LABELS: Record<DatedField, string> = {
  requestedDate: 'Return requested',
  dropoffDate: 'Dropped off',
  receivedDate: 'Received',
  decisionDate: 'Decided',
}

export type Draft = Record<DatedField, string> & {
  store: string
  orderNumber: string
  amount: string
  recipientPostalCode: string
  recipientCountry: Country
  note: string
}

export const draftOf = (shipment: ShipmentDto): Draft => ({
  requestedDate: shipment.requestedDate,
  dropoffDate: shipment.dropoffDate ?? '',
  receivedDate: shipment.receivedDate ?? '',
  decisionDate: shipment.decisionDate ?? '',
  store: shipment.store,
  orderNumber: shipment.orderNumber,
  amount: (shipment.amountCents / 100).toFixed(2),
  recipientPostalCode: shipment.recipientPostalCode,
  recipientCountry: shipment.recipientCountry as Country,
  note: shipment.note ?? '',
})

const wrongIn = (t: Translate, draft: Draft): Partial<Record<keyof Draft, string>> => {
  const amountCents = parseAmount(draft.amount)

  return {
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
  }
}

const boundsOf = (draft: Draft, field: DatedField): { min?: IsoDate; max: IsoDate } => {
  const index = ORDERED_DATED_FIELDS.indexOf(field)
  const before = ORDERED_DATED_FIELDS.slice(0, index).map((name) => draft[name]).filter((value) => value !== '')
  const after = ORDERED_DATED_FIELDS.slice(index + 1).map((name) => draft[name]).filter((value) => value !== '')

  return {
    ...(before.length === 0 ? {} : { min: before[before.length - 1] }),
    max: after.length === 0 ? today() : after[0],
  }
}

function Field ({ label, problem, children }: {
  label: string
  problem?: string
  children: ReactNode
}) {
  return (
    <div className='detail-row'>
      <dt className='detail-label'>{label}</dt>
      <dd className='detail-value'>
        {children}
        {problem !== undefined && <p className='field-error'>{problem}</p>}
      </dd>
    </div>
  )
}

export const patchOf = (shipment: ShipmentDto, draft: Draft): UpdateShipmentInput => {
  const amountCents = parseAmount(draft.amount) ?? shipment.amountCents
  const note = draft.note.trim()

  return {
    ...Object.fromEntries(
      ORDERED_DATED_FIELDS
        .filter((field) => draft[field] !== '')
        .map((field) => [field, draft[field]])
    ),
    ...(draft.store === shipment.store ? {} : { store: draft.store.trim() }),
    ...(draft.orderNumber === shipment.orderNumber ? {} : { orderNumber: draft.orderNumber.trim() }),
    ...(amountCents === shipment.amountCents ? {} : { amountCents }),
    ...(draft.recipientPostalCode === shipment.recipientPostalCode
      ? {}
      : { recipientPostalCode: draft.recipientPostalCode.trim() }),
    ...(draft.recipientCountry === shipment.recipientCountry
      ? {}
      : { recipientCountry: draft.recipientCountry }),
    ...(note === (shipment.note ?? '') ? {} : { note: note === '' ? null : note }),
  }
}

export function ShipmentDetails ({ shipment, busy, error, onClose, onSave }: DetailsProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [copied, setCopied] = useState(false)
  const t = useT()

  const stored = draftOf(shipment)
  const alert = alertMessage(t, shipment)
  const wrong = draft === null ? {} : wrongIn(t, draft)
  const broken = draft !== null && findOrderBreak(draft) !== null
  const erased = draft !== null && ORDERED_DATED_FIELDS.some((f) => draft[f] === '' && stored[f] !== '')
  const incomplete = Object.keys(wrong).length > 0
  const addedApart = zonedDate(shipment.createdAt) !== shipment.requestedDate

  const steps: Step[] = ORDERED_DATED_FIELDS.map((field) => ({
    field,
    label: t(DATE_LABELS[field]),
    done: stored[field] !== '',
    value: draft === null
      ? (stored[field] === '' ? t('Not yet') : formatDate(stored[field]))
      : (
        <input
          type='date'
          className='form-input'
          aria-label={t(DATE_LABELS[field])}
          value={draft[field]}
          {...boundsOf(draft, field)}
          onChange={(event) => { setDraft({ ...draft, [field]: event.target.value }) }}
        />
        ),
  }))

  return (
    <Modal titleId='details-title' onClose={onClose}>
      <div className='modal-header'>
        <h2 className='modal-title' id='details-title'>{t('Shipment details')}</h2>
        <StatusPill status={shipment.status} />
      </div>

      <div className='modal-body space-y-3'>
        {alert !== null && <p className='alert-error detail-alert'>{alert}</p>}

        <Timeline steps={steps} />

        <dl className='detail-list'>
          <Field label={t('Tracking number')}>
            <span className='detail-copy'>
              <a className='link' href={shipment.trackingUrl} target='_blank' rel='noreferrer'>
                {shipment.trackingNumber}
              </a>
              <button
                type='button'
                className='icon-btn icon-btn-copy'
                aria-label={copied
                  ? t('{part} copied', { part: t('Tracking number') })
                  : t('Copy the {part}', { part: t('Tracking number').toLowerCase() })}
                onClick={() => {
                  void copyText(shipment.trackingNumber).then((done) => { setCopied(done) })
                }}
              >
                <CopyIcon copied={copied} />
              </button>
            </span>
          </Field>
          <Field label={t('Carrier')}>{CARRIERS[shipment.carrier].label}</Field>
          <Field label={t('Store')} problem={wrong.store}>
            {draft === null
              ? shipment.store
              : (
                <input
                  className='form-input'
                  aria-label={t('Store')}
                  value={draft.store}
                  onChange={(event) => { setDraft({ ...draft, store: event.target.value }) }}
                />
                )}
          </Field>
          {shipment.storeSupportEmail !== null && (
            <Field label={t('Customer service')}>
              <a className='link' href={`mailto:${shipment.storeSupportEmail}`}>
                {shipment.storeSupportEmail}
              </a>
            </Field>
          )}
          <Field label={t('Order number')} problem={wrong.orderNumber}>
            {draft === null
              ? shipment.orderNumber
              : (
                <input
                  className='form-input'
                  aria-label={t('Order number')}
                  value={draft.orderNumber}
                  onChange={(event) => { setDraft({ ...draft, orderNumber: event.target.value }) }}
                />
                )}
          </Field>
          <Field label={t('Amount')} problem={wrong.amount}>
            {draft === null
              ? formatAmount(shipment.amountCents, shipment.currency)
              : (
                <input
                  className='form-input'
                  inputMode='decimal'
                  aria-label={t('Amount')}
                  value={draft.amount}
                  onChange={(event) => { setDraft({ ...draft, amount: event.target.value }) }}
                />
                )}
          </Field>
          <Field label={t('Sent to')} problem={wrong.recipientPostalCode}>
            {draft === null
              ? `${shipment.recipientPostalCode} ${shipment.recipientCountry}`
              : (
                <div className='detail-pair'>
                  <input
                    className='form-input'
                    aria-label={t('Postal code')}
                    value={draft.recipientPostalCode}
                    onChange={(event) => {
                      setDraft({ ...draft, recipientPostalCode: event.target.value })
                    }}
                  />
                  <select
                    className='form-select'
                    aria-label={t('Country')}
                    value={draft.recipientCountry}
                    onChange={(event) => {
                      setDraft({ ...draft, recipientCountry: event.target.value as Country })
                    }}
                  >
                    {COUNTRIES.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </div>
                )}
          </Field>

          {shipment.lastChasedAt !== null && (
            <Field label={t('Store chased')}>{formatDate(shipment.lastChasedAt)}</Field>
          )}

          {shipment.neverReceived && (
            <Field label={t('Reception')}>{t('Never reached the store')}</Field>
          )}

          {addedApart && (
            <Field label={t('Added to ShipBox')}>{formatDate(zonedDate(shipment.createdAt))}</Field>
          )}

          <Field label={t('Since the request')}>{days(t, shipment.daysSinceRequested)}</Field>
          {shipment.daysSinceDropoff !== null && (
            <Field label={t('Since the drop-off')}>{days(t, shipment.daysSinceDropoff)}</Field>
          )}
          {shipment.daysSinceReceived !== null && (
            <Field label={t('Since the store received it')}>
              {days(t, shipment.daysSinceReceived)}
            </Field>
          )}
          {shipment.decisionDelayDays !== null && (
            <Field label={t('Waited for the decision')}>{days(t, shipment.decisionDelayDays)}</Field>
          )}
          {shipment.totalDelayDays !== null && (
            <Field label={t('The whole return took')}>{days(t, shipment.totalDelayDays)}</Field>
          )}

          {shipment.rejectionReason !== null && (
            <Field label={t('Refused because')}>{shipment.rejectionReason}</Field>
          )}
          {draft === null
            ? shipment.note !== null && <Field label={t('Note')}>{shipment.note}</Field>
            : (
              <Field label={t('Note')}>
                <input
                  className='form-input'
                  aria-label={t('Note')}
                  value={draft.note}
                  onChange={(event) => { setDraft({ ...draft, note: event.target.value }) }}
                />
              </Field>
              )}
          <Field label={t('Stored label')}>
            {shipment.hasLabel ? t('Yes, the PDF can be rebuilt') : t('No, added by hand')}
          </Field>
          {shipment.archivedAt !== null && (
            <Field label={t('Archived')}>{formatDate(zonedDate(shipment.archivedAt))}</Field>
          )}
          <Field label={t('Last change')}>{formatDate(zonedDate(shipment.updatedAt))}</Field>
        </dl>

        {broken && (
          <p className='field-error'>
            {t('The dates must follow the request, drop-off, reception then decision order.')}
          </p>
        )}

        {erased && (
          <p className='field-error'>
            {t('A date already recorded cannot be removed here. Undo the step instead.')}
          </p>
        )}

        {error !== null && <div className='alert-error'>{error}</div>}
      </div>

      <div className='modal-footer'>
        {draft === null ? (
          <>
            <button type='button' className='btn btn-ghost' onClick={onClose}>{t('Close')}</button>
            <button
              type='button'
              className='btn btn-primary'
              onClick={() => { setDraft(stored) }}
            >
              {t('Edit')}
            </button>
          </>
        ) : (
          <>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={busy}
              onClick={() => { setDraft(null) }}
            >
              {t('Cancel')}
            </button>
            <button
              type='button'
              className='btn btn-primary'
              disabled={busy || broken || erased || incomplete}
              onClick={() => { onSave(patchOf(shipment, draft)) }}
            >
              {busy ? t('Saving…') : t('Save')}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
