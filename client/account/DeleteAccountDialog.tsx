import { useT } from '../i18n/context.js'
import { Modal } from '../shipments/Modal.js'

type DeleteAccountDialogProps = {
  email: string
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteAccountDialog (
  { email, busy, error, onCancel, onConfirm }: DeleteAccountDialogProps
) {
  const t = useT()

  return (
    <Modal titleId='delete-account-title' onClose={onCancel}>
      <div className='modal-header'>
        <h2 className='modal-title' id='delete-account-title'>
          {t('Delete the account of {email}?', { email })}
        </h2>
      </div>

      <div className='modal-body space-y-3'>
        <p className='card-text'>{t('This cannot be undone. You will lose:')}</p>

        <ul className='consequence-list'>
          <li>{t('every return you track, with all the dates you recorded')}</li>
          <li>{t('every store you added, and what each one owes you')}</li>
          <li>{t('every stored label, so no PDF can be downloaded again')}</li>
          <li>{t('the way back in, since signing in again creates an empty account')}</li>
        </ul>

        <p className='card-text'>
          {t('Export your returns from the shipments page first if you want to keep them.')}
        </p>

        {error !== null && <div className='alert-error'>{error}</div>}
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-ghost' onClick={onCancel} disabled={busy}>
          {t('Cancel')}
        </button>
        <button type='button' className='btn btn-danger' onClick={onConfirm} disabled={busy}>
          {busy ? t('Deleting…') : t('Delete my account')}
        </button>
      </div>
    </Modal>
  )
}
