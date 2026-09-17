import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

type ModalProps = {
  titleId: string
  onClose: () => void
  children: ReactNode
}

export function Modal ({ titleId, onClose, children }: ModalProps) {
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('keydown', dismiss) }
  }, [onClose])

  return createPortal(
    <div
      className='modal-backdrop'
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className='modal-box'>{children}</div>
    </div>,
    document.body
  )
}
