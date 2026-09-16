import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

type ModalProps = {
  titleId: string
  onClose: () => void
  children: ReactNode
}

export function Modal ({ titleId, onClose, children }: ModalProps) {
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
