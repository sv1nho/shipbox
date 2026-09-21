import { useState } from 'react'
import { ApiError, refusalMessage } from '../api/client.js'
import { addStore } from '../api/shipments.js'
import type { StoreDto } from '../../shared/store.js'
import { useT } from '../i18n/context.js'
import { Modal } from './Modal.js'

type NewStoreDialogProps = {
  name: string
  onCancel: () => void
  onAdded: (store: StoreDto) => void
}

const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export function NewStoreDialog ({ name, onCancel, onAdded }: NewStoreDialogProps) {
  const [storeName, setStoreName] = useState(name)
  const [supportEmail, setSupportEmail] = useState('')
  const [attempted, setAttempted] = useState(false)
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<string | null>(null)

  const missingName = storeName.trim() === ''
  const badEmail = !looksLikeEmail(supportEmail)

  const submit = async () => {
    setAttempted(true)
    if (missingName || badEmail) return

    setBusy(true)
    setError(null)
    setDuplicate(null)

    try {
      onAdded(await addStore(storeName.trim(), supportEmail.trim()))
    } catch (cause) {
      if (cause instanceof ApiError && cause.isConflict) setDuplicate(cause.message)
      else setError(refusalMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId='new-store-title' onClose={onCancel}>
      <div className='modal-header'>
        <h2 className='modal-title' id='new-store-title'>{t('Add a store')}</h2>
      </div>

      <form
        className='modal-body space-y-3'
        noValidate
        onSubmit={(event) => { event.preventDefault(); void submit() }}
      >
        <label className='form-label' htmlFor='store-name'>{t('Name')}</label>
        <input
          id='store-name'
          className='form-input'
          autoComplete='off'
          value={storeName}
          onChange={(event) => { setStoreName(event.target.value); setDuplicate(null) }}
        />
        {attempted && missingName && <p className='field-error'>{t('A name is required.')}</p>}

        <label className='form-label' htmlFor='store-email'>{t('Customer service email')}</label>
        <input
          id='store-email'
          className='form-input'
          type='email'
          autoComplete='off'
          placeholder='service@store.com'
          value={supportEmail}
          onChange={(event) => { setSupportEmail(event.target.value) }}
        />
        <p className='field-hint'>
          {t('ShipBox writes to this address when a return sits too long. ' +
            'It is the whole point of keeping a store.')}
        </p>
        {attempted && badEmail && <p className='field-error'>{t('An email address is required.')}</p>}

        {duplicate !== null && <p className='field-error'>{duplicate}</p>}
        {error !== null && <div className='alert-error'>{error}</div>}

        <div className='modal-footer'>
          <button type='button' className='btn btn-ghost' onClick={onCancel} disabled={busy}>
            {t('Cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={busy}>
            {busy ? t('Adding…') : t('Add the store')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
