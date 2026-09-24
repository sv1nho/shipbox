import { useState } from 'react'
import { TRANSITIONS } from '../../shared/transitions.js'
import type { NextStep, TransitionAction } from '../../shared/transitions.js'
import type { IsoDate, ShipmentDto } from '../../shared/shipment.js'
import { today } from '../../shared/time.js'
import { useT } from '../i18n/context.js'
import { Modal } from './Modal.js'
import { ShipmentLine } from './ShipmentLine.js'

export type PromptResult = {
  action: TransitionAction
  date: IsoDate
  receivedDate?: IsoDate
  neverReceived?: boolean
  rejectionReason?: string
}

type DatePromptProps = {
  shipment: ShipmentDto
  actions: NextStep['actions']
  earliest: IsoDate
  reception: { earliest: IsoDate } | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (result: PromptResult) => void
}

export function DatePrompt (
  { shipment, actions, earliest, reception, busy, error, onCancel, onConfirm }: DatePromptProps
) {
  const [action, setAction] = useState<TransitionAction>(actions[0])
  const [received, setReceived] = useState(() => today())
  const [date, setDate] = useState(() => today())
  const [reason, setReason] = useState('')
  const [lost, setLost] = useState(false)
  const t = useT()

  const { label } = TRANSITIONS[action]

  const asking = reception !== null && !lost
  const receptionMissing = asking && received === ''
  const receptionTooEarly = asking && !receptionMissing && received < reception.earliest

  const floor = asking ? received : earliest
  const dateMissing = date === ''
  const tooEarly = !dateMissing && !receptionMissing && date < floor

  const incomplete = dateMissing || tooEarly || receptionMissing || receptionTooEarly

  return (
    <Modal titleId='date-prompt-title' onClose={onCancel}>
      <div className='modal-header'>
        <h2 className='modal-title' id='date-prompt-title'>{t(label)}</h2>
      </div>

      <div className='modal-body space-y-3'>
        <ShipmentLine shipment={shipment} />

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
                {t(TRANSITIONS[candidate].label)}
              </button>
            ))}
          </div>
        )}

        {reception !== null && (
          <>
            {asking && (
              <>
                <label className='form-label' htmlFor='reception-date'>
                  {t('When did the store receive it?')}
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
                  {t('Without it the waiting time of this store cannot be measured.')}
                </p>

                {receptionMissing && <p className='field-error'>{t('Pick the day it was received.')}</p>}

                {receptionTooEarly && (
                  <p className='field-error'>{t('This cannot be earlier than the drop-off.')}</p>
                )}
              </>
            )}

            <label className='form-check'>
              <input
                type='checkbox'
                checked={lost}
                onChange={(event) => { setLost(event.target.checked) }}
              />
              {t('The store never received it')}
            </label>

            {lost && (
              <p className='field-hint'>
                {t('The wait will be counted from the drop-off instead of the reception.')}
              </p>
            )}
          </>
        )}

        <label className='form-label' htmlFor='transition-date'>
          {t('On which day?')}
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

        {dateMissing && <p className='field-error'>{t('Pick a day.')}</p>}

        {tooEarly && (
          <p className='field-error'>{t('This cannot be earlier than the previous step.')}</p>
        )}

        {action === 'reject' && (
          <>
            <label className='form-label' htmlFor='transition-reason'>
              {t('Why was it refused? (optional)')}
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
          {t('Cancel')}
        </button>
        <button
          type='button'
          className='btn btn-primary'
          disabled={busy || incomplete}
          onClick={() => {
            onConfirm({
              action,
              date,
              ...(asking ? { receivedDate: received } : {}),
              ...(lost ? { neverReceived: true } : {}),
              ...(reason.trim() === '' ? {} : { rejectionReason: reason.trim() }),
            })
          }}
        >
          {busy ? t('Saving…') : t('Confirm')}
        </button>
      </div>
    </Modal>
  )
}
