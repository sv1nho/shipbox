import { useState } from 'react'
import type { ReactNode } from 'react'
import type { IsoDate, ShipmentDto, UpdateShipmentInput } from '../../shared/shipment.js'
import { CARRIERS } from '../../shared/carriers.js'
import { ORDERED_DATED_FIELDS, findOrderBreak } from '../../shared/transitions.js'
import type { DatedField } from '../../shared/transitions.js'
import { today } from '../../shared/time.js'
import { useT } from '../i18n/context.js'
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

type Draft = Record<DatedField, string>

const draftOf = (shipment: ShipmentDto): Draft => ({
  requestedDate: shipment.requestedDate,
  dropoffDate: shipment.dropoffDate ?? '',
  receivedDate: shipment.receivedDate ?? '',
  decisionDate: shipment.decisionDate ?? '',
})

const boundsOf = (draft: Draft, field: DatedField): { min?: IsoDate; max: IsoDate } => {
  const index = ORDERED_DATED_FIELDS.indexOf(field)
  const before = ORDERED_DATED_FIELDS.slice(0, index).map((name) => draft[name]).filter((value) => value !== '')
  const after = ORDERED_DATED_FIELDS.slice(index + 1).map((name) => draft[name]).filter((value) => value !== '')

  return {
    ...(before.length === 0 ? {} : { min: before[before.length - 1] }),
    max: after.length === 0 ? today() : after[0],
  }
}

function Field ({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='detail-row'>
      <dt className='detail-label'>{label}</dt>
      <dd className='detail-value'>{children}</dd>
    </div>
  )
}

export function ShipmentDetails ({ shipment, busy, error, onClose, onSave }: DetailsProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [copied, setCopied] = useState(false)
  const t = useT()

  const stored = draftOf(shipment)
  const alert = alertMessage(t, shipment)
  const broken = draft !== null && findOrderBreak(draft) !== null
  const erased = draft !== null && ORDERED_DATED_FIELDS.some((f) => draft[f] === '' && stored[f] !== '')
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
          <Field label={t('Store')}>{shipment.store}</Field>
          {shipment.storeSupportEmail !== null && (
            <Field label={t('Customer service')}>
              <a className='link' href={`mailto:${shipment.storeSupportEmail}`}>
                {shipment.storeSupportEmail}
              </a>
            </Field>
          )}
          <Field label={t('Order number')}>{shipment.orderNumber}</Field>
          <Field label={t('Amount')}>{formatAmount(shipment.amountCents, shipment.currency)}</Field>
          <Field label={t('Sent to')}>
            {shipment.recipientPostalCode} {shipment.recipientCountry}
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
          {shipment.note !== null && <Field label={t('Note')}>{shipment.note}</Field>}
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
              {t('Edit the dates')}
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
              disabled={busy || broken || erased}
              onClick={() => {
                onSave(
                  Object.fromEntries(
                    ORDERED_DATED_FIELDS
                      .filter((field) => draft[field] !== '')
                      .map((field) => [field, draft[field]])
                  )
                )
              }}
            >
              {busy ? t('Saving…') : t('Save the dates')}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
