import { useState } from 'react'
import { useSession } from '../auth/client.js'
import type { ShipmentDto } from '../../shared/shipment.js'
import { MAIL_LANGUAGES, mailDraft, mailLanguageLabel, mailtoLink } from './mail.js'
import type { MailLanguage } from './mail.js'
import { useT } from '../i18n/context.js'
import { CopyIcon } from '../components/CopyIcon.js'
import { copyText } from '../utils/clipboard.js'
import { Modal } from './Modal.js'

type MailDialogProps = {
  shipment: ShipmentDto
  busy: boolean
  onClose: () => void
  onSent: () => void
}

type Part = 'subject' | 'body'

const LABELS: Record<Part, string> = { subject: 'Subject', body: 'Message' }

export function MailDialog ({ shipment, busy, onClose, onSent }: MailDialogProps) {
  const { data: session } = useSession()
  const [language, setLanguage] = useState<MailLanguage>('fr')
  const [edited, setEdited] = useState<Record<Part, string> | null>(null)
  const [copied, setCopied] = useState<Part | null>(null)
  const t = useT()
  const [failed, setFailed] = useState(false)
  const [handedOver, setHandedOver] = useState(false)

  const draft = edited ?? mailDraft(shipment, language, session?.user.name ?? '')

  const chooseLanguage = (next: MailLanguage) => {
    setLanguage(next)
    setEdited(null)
    setCopied(null)
    setFailed(false)
  }

  const change = (part: Part, value: string) => {
    setEdited({ ...draft, [part]: value })
    setCopied(null)
  }

  const copy = (part: Part) => {
    void copyText(draft[part]).then((done) => {
      if (done) {
        setCopied(part)
        setFailed(false)
        setHandedOver(true)
      } else {
        setCopied(null)
        setFailed(true)
      }
    })
  }

  const copyButton = (part: Part) => (
    <button
      type='button'
      className='icon-btn icon-btn-copy'
      aria-label={copied === part
        ? t('{part} copied', { part: t(LABELS[part]) })
        : t('Copy the {part}', { part: t(LABELS[part]).toLowerCase() })}
      onClick={() => { copy(part) }}
    >
      <CopyIcon copied={copied === part} />
    </button>
  )

  return (
    <Modal titleId='mail-dialog-title' onClose={onClose}>
      <div className='modal-header'>
        <h2 className='modal-title' id='mail-dialog-title'>{t('Chase {store}', { store: shipment.store })}</h2>
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
              onClick={() => { chooseLanguage(candidate) }}
            >
              {mailLanguageLabel(candidate)}
            </button>
          ))}
        </div>

        <p className='field-hint'>
          {shipment.storeSupportEmail === null
            ? t('No address on file for {store}. Copy the message into their contact form, ' +
              'or add the address when you add the store.', { store: shipment.store })
            : t('To {address}', { address: shipment.storeSupportEmail })}
        </p>

        <div className='mail-field-header'>
          <label className='form-label' htmlFor='mail-subject'>{t('Subject')}</label>
          {copyButton('subject')}
        </div>
        <input
          id='mail-subject'
          className='form-input'
          value={draft.subject}
          onChange={(event) => { change('subject', event.target.value) }}
        />

        <div className='mail-field-header'>
          <label className='form-label' htmlFor='mail-body'>{t('Message')}</label>
          {copyButton('body')}
        </div>
        <textarea
          id='mail-body'
          className='form-input mail-body'
          rows={12}
          value={draft.body}
          onChange={(event) => { change('body', event.target.value) }}
        />

        {failed && (
          <p className='field-error'>
            {t('The clipboard is not available here. Select the text and copy it yourself.')}
          </p>
        )}
      </div>

      {handedOver && (
        <p className='field-hint mail-sent-ask'>
          {t('ShipBox cannot tell whether the message went out. ' +
            'Say so and the row will show it.')}
        </p>
      )}

      <div className='modal-footer'>
        <button type='button' className='btn btn-ghost' onClick={onClose} disabled={busy}>
          {handedOver ? t('Not yet') : t('Close')}
        </button>

        {handedOver ? (
          <button type='button' className='btn btn-primary' disabled={busy} onClick={onSent}>
            {busy ? t('Saving…') : t('I sent it')}
          </button>
        ) : (
          <a
            className='btn btn-primary'
            href={mailtoLink(shipment.storeSupportEmail, draft)}
            target='_blank'
            rel='noreferrer'
            onClick={() => { setHandedOver(true) }}
          >
            {t('Open in my mail app')}
          </a>
        )}
      </div>
    </Modal>
  )
}
