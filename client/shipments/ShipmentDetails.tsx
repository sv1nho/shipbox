import { useState } from 'react'
import type { ReactNode } from 'react'
import type { IsoDate, ShipmentDto, UpdateShipmentInput } from '../../shared/shipment.js'
import { CARRIERS } from '../../shared/carriers.js'
import { ORDERED_DATED_FIELDS, findOrderBreak } from '../../shared/transitions.js'
import type { DatedField } from '../../shared/transitions.js'
import { today } from '../../shared/time.js'
import { alertMessage, days, formatAmount, formatDate, zonedDate } from './format.js'
import { StatusPill } from './StatusPill.js'
import { Modal } from './Modal.js'

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

  const stored = draftOf(shipment)
  const alert = alertMessage(shipment)
  const broken = draft !== null && findOrderBreak(draft) !== null
  const erased = draft !== null && ORDERED_DATED_FIELDS.some((f) => draft[f] === '' && stored[f] !== '')
  const addedApart = zonedDate(shipment.createdAt) !== shipment.requestedDate

  return (
    <Modal titleId='details-title' onClose={onClose}>
      <div className='modal-header'>
        <h2 className='modal-title' id='details-title'>Shipment details</h2>
        <StatusPill status={shipment.status} />
      </div>

      <div className='modal-body space-y-3'>
        {alert !== null && <p className='alert-error detail-alert'>{alert}</p>}

        <dl className='detail-list'>
          <Field label='Tracking number'>
            <a href={shipment.trackingUrl} target='_blank' rel='noreferrer'>
              {shipment.trackingNumber}
            </a>
          </Field>
          <Field label='Carrier'>{CARRIERS[shipment.carrier].label}</Field>
          <Field label='Store'>{shipment.store}</Field>
          {shipment.orderNumber !== null && (
            <Field label='Order number'>{shipment.orderNumber}</Field>
          )}
          <Field label='Amount'>{formatAmount(shipment.amountCents, shipment.currency)}</Field>
          <Field label='Sent to'>
            {shipment.recipientPostalCode} {shipment.recipientCountry}
          </Field>

          {draft === null
            ? ORDERED_DATED_FIELDS
              .filter((field) => stored[field] !== '')
              .map((field) => (
                <Field key={field} label={DATE_LABELS[field]}>
                  {formatDate(stored[field])}
                </Field>
              ))
            : ORDERED_DATED_FIELDS.map((field) => (
              <Field key={field} label={DATE_LABELS[field]}>
                <input
                  type='date'
                  className='form-input'
                  aria-label={DATE_LABELS[field]}
                  value={draft[field]}
                  {...boundsOf(draft, field)}
                  onChange={(event) => { setDraft({ ...draft, [field]: event.target.value }) }}
                />
              </Field>
            ))}

          {addedApart && (
            <Field label='Added to ShipBox'>{formatDate(zonedDate(shipment.createdAt))}</Field>
          )}

          <Field label='Since the request'>{days(shipment.daysSinceRequested)}</Field>
          {shipment.daysSinceDropoff !== null && (
            <Field label='Since the drop-off'>{days(shipment.daysSinceDropoff)}</Field>
          )}
          {shipment.daysSinceReceived !== null && (
            <Field label='Since the store received it'>
              {days(shipment.daysSinceReceived)}
            </Field>
          )}
          {shipment.decisionDelayDays !== null && (
            <Field label='The store took'>{days(shipment.decisionDelayDays)}</Field>
          )}
          {shipment.totalDelayDays !== null && (
            <Field label='The whole return took'>{days(shipment.totalDelayDays)}</Field>
          )}

          {shipment.rejectionReason !== null && (
            <Field label='Refused because'>{shipment.rejectionReason}</Field>
          )}
          {shipment.note !== null && <Field label='Note'>{shipment.note}</Field>}
          <Field label='Stored label'>
            {shipment.hasLabel ? 'Yes, the PDF can be rebuilt' : 'No, added by hand'}
          </Field>
          {shipment.archivedAt !== null && (
            <Field label='Archived'>{formatDate(zonedDate(shipment.archivedAt))}</Field>
          )}
          <Field label='Last change'>{formatDate(zonedDate(shipment.updatedAt))}</Field>
        </dl>

        {broken && (
          <p className='field-error'>
            The dates must follow the request, drop-off, reception then decision order.
          </p>
        )}

        {erased && (
          <p className='field-error'>
            A date already recorded cannot be removed here. Undo the step instead.
          </p>
        )}

        {error !== null && <div className='alert-error'>{error}</div>}
      </div>

      <div className='modal-footer'>
        {draft === null ? (
          <>
            <button type='button' className='btn btn-ghost' onClick={onClose}>Close</button>
            <button
              type='button'
              className='btn btn-primary'
              onClick={() => { setDraft(stored) }}
            >
              Edit the dates
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
              Cancel
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
              {busy ? 'Saving…' : 'Save the dates'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
