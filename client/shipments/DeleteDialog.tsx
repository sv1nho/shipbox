import type { ShipmentDto } from '../../shared/shipment.js'
import { useT } from '../i18n/context.js'
import { formatAmount } from './format.js'
import { Modal } from './Modal.js'

type DeleteDialogProps = {
  shipment: ShipmentDto
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteDialog ({ shipment, busy, onCancel, onConfirm }: DeleteDialogProps) {
  const t = useT()

  return (
    <Modal titleId='delete-dialog-title' onClose={onCancel}>
      <div className='modal-header'>
        <h2 className='modal-title' id='delete-dialog-title'>{t('Delete this shipment for good?')}</h2>
      </div>

      <div className='modal-body space-y-3'>
        <p className='card-text'>
          <strong>{shipment.store}</strong> — {shipment.trackingNumber} —{' '}
          {formatAmount(shipment.amountCents, shipment.currency)}
        </p>

        <p className='card-text'>{t('This cannot be undone. You will lose:')}</p>

        <ul className='consequence-list'>
          <li>{t('the shipment and everything you recorded about it')}</li>
          <li>{t('its drop-off, reception and decision dates')}</li>
          {shipment.hasLabel && (
            <li>{t('its stored label, so the PDF can never be downloaded again')}</li>
          )}
        </ul>

        <p className='card-text'>
          {t('To take it out of your list without losing any of that, archive it instead.')}
        </p>
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-ghost' onClick={onCancel} disabled={busy}>
          {t('Cancel')}
        </button>
        <button type='button' className='btn btn-danger' onClick={onConfirm} disabled={busy}>
          {busy ? t('Deleting…') : t('Delete for good')}
        </button>
      </div>
    </Modal>
  )
}
