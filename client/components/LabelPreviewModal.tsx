import { useT } from '../i18n/context.js'

type LabelPreviewModalProps = {
  pdfUrl: string
  maskedTracking: string
  onClose: () => void
  onDownload: () => void
  onTrack: () => void
}

export function LabelPreviewModal ({
  pdfUrl,
  maskedTracking,
  onClose,
  onDownload,
  onTrack,
}: LabelPreviewModalProps) {
  const t = useT()

  return (
    <div
      className='modal-backdrop'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className='modal-box'>
        <div className='modal-header'>
          <h2 className='modal-title'>{t('Label Preview')}</h2>
          <button
            onClick={onClose}
            className='btn btn-ghost'
            style={{ padding: '0.375rem' }}
            aria-label={t('Close')}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='18'
              height='18'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M18 6L6 18M6 6l12 12' />
            </svg>
          </button>
        </div>
        <div className='modal-body'>
          <iframe
            src={pdfUrl}
            height='480'
          />
          <p className='mt-3 text-sm text-[var(--color-text-muted)]'>
            <span className='font-medium text-[var(--color-text)]'>{t('Tracking:')}</span>{' '}
            {maskedTracking}
          </p>
        </div>
        <div className='modal-footer'>
          <button onClick={onClose} className='btn btn-ghost'>
            {t('Close')}
          </button>
          <button onClick={onTrack} className='btn btn-ghost'>
            {t('Add to tracking')}
          </button>
          <button onClick={onDownload} className='btn btn-primary'>
            {t('Download PDF')}
          </button>
        </div>
      </div>
    </div>
  )
}
