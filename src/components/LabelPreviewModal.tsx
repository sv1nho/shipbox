interface LabelPreviewModalProps {
  pdfUrl: string;
  maskedTracking: string | null;
  onClose: () => void;
  onDownload: () => void;
}

export function LabelPreviewModal ({
  pdfUrl,
  maskedTracking,
  onClose,
  onDownload,
}: LabelPreviewModalProps) {
  return (
    <div
      className='modal-backdrop'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className='modal-box'>
        <div className='modal-header'>
          <h2 className='modal-title'>Label Preview</h2>
          <button
            onClick={onClose}
            className='btn btn-ghost'
            style={{ padding: '0.375rem' }}
            aria-label='Close'
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
          {maskedTracking && (
            <p className='mt-3 text-sm text-zinc-500'>
              <span className='font-medium text-zinc-700'>Tracking:</span>{' '}
              {maskedTracking}
            </p>
          )}
        </div>
        <div className='modal-footer'>
          <button onClick={onClose} className='btn btn-ghost'>
            Close
          </button>
          <button onClick={onDownload} className='btn btn-primary'>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
