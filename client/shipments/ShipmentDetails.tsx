import { useState } from 'react'
import type { ReactNode } from 'react'
import type { IsoDate, ShipmentDto, UpdateShipmentInput } from '../../shared/shipment.js'
import { CARRIERS } from '../../shared/carriers.js'
import { ORDERED_DATE_FIELDS } from '../../shared/transitions.js'
import type { DateField } from '../../shared/transitions.js'
import { today } from '../../shared/time.js'
import { alertMessage, formatAmount, formatDate, workingDays, zonedDate } from './format.js'
import { StatusPill } from './StatusPill.js'
import { Modal } from './Modal.js'

type DetailsProps = {
  shipment: ShipmentDto
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (patch: UpdateShipmentInput) => void
}

const DATE_LABELS: Record<DateField, string> = {
  dropoffDate: 'Dropped off',
  receivedDate: 'Received',
  decisionDate: 'Decided',
}

type Draft = Record<DateField, string>

const draftOf = (shipment: ShipmentDto): Draft => ({
  dropoffDate: shipment.dropoffDate ?? '',
  receivedDate: shipment.receivedDate ?? '',
  decisionDate: shipment.decisionDate ?? '',
})

const outOfOrder = (draft: Draft): boolean => {
  const filled = ORDERED_DATE_FIELDS.map((field) => draft[field]).filter((value) => value !== '')

  return filled.some((value, index) => index > 0 && value < filled[index - 1])
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

  const alert = alertMessage(shipment)
  const broken = draft !== null && outOfOrder(draft)

  const asDate = (value: string): IsoDate | null => (value === '' ? null : value)

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

          <Field label='Added'>{formatDate(zonedDate(shipment.createdAt))}</Field>

          {draft === null
            ? ORDERED_DATE_FIELDS
              .map((field) => ({ field, value: shipment[field] }))
              .filter((step): step is { field: DateField; value: IsoDate } => step.value !== null)
              .map((step) => (
                <Field key={step.field} label={DATE_LABELS[step.field]}>
                  {formatDate(step.value)}
                </Field>
              ))
            : ORDERED_DATE_FIELDS.map((field) => (
              <Field key={field} label={DATE_LABELS[field]}>
                <input
                  type='date'
                  className='form-input'
                  aria-label={DATE_LABELS[field]}
                  value={draft[field]}
                  max={today()}
                  onChange={(event) => { setDraft({ ...draft, [field]: event.target.value }) }}
                />
              </Field>
            ))}

          <Field label='Since it was added'>{workingDays(shipment.daysSinceCreated)}</Field>
          {shipment.daysSinceReceived !== null && (
            <Field label='Since the store received it'>
              {workingDays(shipment.daysSinceReceived)}
            </Field>
          )}
          {shipment.decisionDelayDays !== null && (
            <Field label='The store took'>{workingDays(shipment.decisionDelayDays)}</Field>
          )}
          {shipment.totalDelayDays !== null && (
            <Field label='The whole return took'>{workingDays(shipment.totalDelayDays)}</Field>
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
            The dates must follow the drop-off, reception then decision order.
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
              onClick={() => { setDraft(draftOf(shipment)) }}
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
              disabled={busy || broken}
              onClick={() => {
                onSave({
                  dropoffDate: asDate(draft.dropoffDate),
                  receivedDate: asDate(draft.receivedDate),
                  decisionDate: asDate(draft.decisionDate),
                })
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
