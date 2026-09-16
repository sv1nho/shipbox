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
  note?: string
}

type DatePromptProps = {
  actions: NextStep['actions']
  earliest: IsoDate | null
  reception: { earliest: IsoDate | null } | null
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
  const [note, setNote] = useState('')

  const { label } = TRANSITIONS[action]

  const receptionFloor = reception?.earliest ?? null
  const receptionTooEarly = receptionFloor !== null && received < receptionFloor
  const floor = reception === null ? earliest : received
  const tooEarly = floor !== null && date < floor

  const incomplete =
    date === '' || tooEarly || (reception !== null && (received === '' || receptionTooEarly))

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
              min={receptionFloor ?? undefined}
              onChange={(event) => { setReceived(event.target.value) }}
            />
            <p className='field-hint'>
              Without it the waiting time of this store cannot be measured.
            </p>

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
          min={floor ?? undefined}
          onChange={(event) => { setDate(event.target.value) }}
        />

        {tooEarly && (
          <p className='field-error'>This cannot be earlier than the previous step.</p>
        )}

        {action === 'reject' && (
          <>
            <label className='form-label' htmlFor='transition-note'>
              Why was it refused? (optional)
            </label>
            <input
              id='transition-note'
              className='form-input'
              value={note}
              onChange={(event) => { setNote(event.target.value) }}
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
              ...(note.trim() === '' ? {} : { note: note.trim() }),
            })
          }}
        >
          {busy ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  )
}
