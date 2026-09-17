import { useState } from 'react'
import { TRANSITIONS } from '../../shared/transitions.js'
import type { NextStep, TransitionAction } from '../../shared/transitions.js'
import type { IsoDate } from '../../shared/shipment.js'
import { today } from '../../shared/time.js'
import { Modal } from './Modal.js'

export type PromptResult = {
  action: TransitionAction
  date: IsoDate
  receivedDate?: IsoDate
  rejectionReason?: string
}

type DatePromptProps = {
  actions: NextStep['actions']
  earliest: IsoDate
  reception: { earliest: IsoDate } | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (result: PromptResult) => void
}

export function DatePrompt (
  { actions, earliest, reception, busy, error, onCancel, onConfirm }: DatePromptProps
) {
  const [action, setAction] = useState<TransitionAction>(actions[0])
  const [received, setReceived] = useState(() => today())
  const [date, setDate] = useState(() => today())
  const [reason, setReason] = useState('')

  const { label } = TRANSITIONS[action]

  const receptionMissing = reception !== null && received === ''
  const receptionTooEarly = reception !== null && !receptionMissing && received < reception.earliest

  const floor = reception === null ? earliest : received
  const dateMissing = date === ''
  const tooEarly = !dateMissing && !receptionMissing && date < floor

  const incomplete = dateMissing || tooEarly || receptionMissing || receptionTooEarly

  return (
    <Modal titleId='date-prompt-title' onClose={onCancel}>
      <div className='modal-header'>
        <h2 className='modal-title' id='date-prompt-title'>{label}</h2>
      </div>

      <div className='modal-body space-y-3'>
        {actions.length > 1 && (
          <div className='segmented' role='group' aria-label='Outcome'>
            {actions.map((candidate) => (
              <button
                key={candidate}
                type='button'
                className={[
                  'segmented-btn',
                  `segmented-btn-${TRANSITIONS[candidate].target}`,
                  candidate === action ? 'segmented-btn-active' : '',
                ].filter((name) => name !== '').join(' ')}
                aria-pressed={candidate === action}
                onClick={() => { setAction(candidate) }}
              >
                {TRANSITIONS[candidate].label}
              </button>
            ))}
          </div>
        )}

        {reception !== null && (
          <>
            <label className='form-label' htmlFor='reception-date'>
              When did the store receive it?
            </label>
            <input
              id='reception-date'
              type='date'
              className='form-input'
              value={received}
              max={today()}
              min={reception.earliest}
              onChange={(event) => { setReceived(event.target.value) }}
            />
            <p className='field-hint'>
              Without it the waiting time of this store cannot be measured.
            </p>

            {receptionMissing && <p className='field-error'>Pick the day it was received.</p>}

            {receptionTooEarly && (
              <p className='field-error'>This cannot be earlier than the drop-off.</p>
            )}
          </>
        )}

        <label className='form-label' htmlFor='transition-date'>
          On which day?
        </label>
        <input
          id='transition-date'
          type='date'
          className='form-input'
          value={date}
          max={today()}
          min={floor}
          onChange={(event) => { setDate(event.target.value) }}
        />

        {dateMissing && <p className='field-error'>Pick a day.</p>}

        {tooEarly && (
          <p className='field-error'>This cannot be earlier than the previous step.</p>
        )}

        {action === 'reject' && (
          <>
            <label className='form-label' htmlFor='transition-reason'>
              Why was it refused? (optional)
            </label>
            <input
              id='transition-reason'
              className='form-input'
              value={reason}
              onChange={(event) => { setReason(event.target.value) }}
            />
          </>
        )}

        {error !== null && <div className='alert-error'>{error}</div>}
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-ghost' onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type='button'
          className='btn btn-primary'
          disabled={busy || incomplete}
          onClick={() => {
            onConfirm({
              action,
              date,
              ...(reception === null ? {} : { receivedDate: received }),
              ...(reason.trim() === '' ? {} : { rejectionReason: reason.trim() }),
            })
          }}
        >
          {busy ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  )
}
