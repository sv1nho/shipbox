import { useState } from 'react'
import { useSession } from '../auth/client.js'
import type { ShipmentDto } from '../../shared/shipment.js'
import { MAIL_LANGUAGES, mailDraft, mailLanguageLabel, mailtoLink } from './mail.js'
import type { MailLanguage } from './mail.js'
import { Modal } from './Modal.js'

type MailDialogProps = {
  shipment: ShipmentDto
  onClose: () => void
}

export function MailDialog ({ shipment, onClose }: MailDialogProps) {
  const { data: session } = useSession()
  const [language, setLanguage] = useState<MailLanguage>('fr')

  const draft = mailDraft(shipment, language, session?.user.name ?? '')

  return (
    <Modal titleId='mail-dialog-title' onClose={onClose}>
      <div className='modal-header'>
        <h2 className='modal-title' id='mail-dialog-title'>Chase {shipment.store}</h2>
      </div>

      <div className='modal-body space-y-3'>
        <div className='segmented' role='group' aria-label='Language'>
          {MAIL_LANGUAGES.map((candidate) => (
            <button
              key={candidate}
              type='button'
              className={
                candidate === language ? 'segmented-btn segmented-btn-active' : 'segmented-btn'
              }
              aria-pressed={candidate === language}
              onClick={() => { setLanguage(candidate) }}
            >
              {mailLanguageLabel(candidate)}
            </button>
          ))}
        </div>

        <p className='field-hint'>
          {shipment.storeSupportEmail === null
            ? `No address on file for ${shipment.store}. Add one when you add the store, or copy the message below.`
            : `To ${shipment.storeSupportEmail}`}
        </p>

        <label className='form-label' htmlFor='mail-subject'>Subject</label>
        <input id='mail-subject' className='form-input' readOnly value={draft.subject} />

        <label className='form-label' htmlFor='mail-body'>Message</label>
        <textarea
          id='mail-body'
          className='form-input mail-body'
          rows={12}
          readOnly
          value={draft.body}
        />
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-ghost' onClick={onClose}>Close</button>
        <a
          className='btn btn-primary'
          href={mailtoLink(shipment.storeSupportEmail, draft)}
          onClick={onClose}
        >
          Open in my mail app
        </a>
      </div>
    </Modal>
  )
}
