import { useEffect } from 'react'
import { useT } from '../i18n/context.js'

const LINGER = 8000

type ToastProps = {
  message: string
  onUndo: () => void
  onDismiss: () => void
}

export function Toast ({ message, onUndo, onDismiss }: ToastProps) {
  const t = useT()

  useEffect(() => {
    const timer = setTimeout(onDismiss, LINGER)
    return () => { clearTimeout(timer) }
  }, [onDismiss])

  return (
    <div className='toast' role='status'>
      <span className='toast-message'>{message}</span>
      <button type='button' className='btn btn-ghost btn-compact' onClick={onUndo}>
        {t('Undo')}
      </button>
      <button
        type='button'
        className='icon-btn'
        aria-label={t('Close')}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}
