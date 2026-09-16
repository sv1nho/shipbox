import { useState } from 'react'
import { TRANSITIONS } from '../../shared/transitions.js'
import type { TransitionAction } from '../../shared/transitions.js'
import { today } from '../../shared/time.js'

type DatePromptProps = {
  action: TransitionAction
  earliest: string | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (date: string, note?: string) => void
}

export function DatePrompt ({ action, earliest, busy, error, onCancel, onConfirm }: DatePromptProps) {
  const [date, setDate] = useState(() => today())
  const [note, setNote] = useState('')

  const { label } = TRANSITIONS[action]
  const tooEarly = earliest !== null && date < earliest

  return (
    <div
      className='modal-backdrop'
      role='dialog'
      aria-modal='true'
      aria-labelledby='date-prompt-title'
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className='modal-box'>
        <div className='modal-header'>
          <h2 className='modal-title' id='date-prompt-title'>{label}</h2>
        </div>

        <div className='modal-body space-y-3'>
          <label className='form-label' htmlFor='transition-date'>
            On which day?
          </label>
          <input
            id='transition-date'
            type='date'
            className='form-input'
            value={date}
            max={today()}
            min={earliest ?? undefined}
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
            disabled={busy || date === '' || tooEarly}
            onClick={() => { onConfirm(date, note.trim() === '' ? undefined : note.trim()) }}
          >
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
