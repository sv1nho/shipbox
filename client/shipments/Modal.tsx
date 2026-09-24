import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

type ModalProps = {
  titleId: string
  onClose: () => void
  children: ReactNode
}

const REACHABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].map((selector) => `.modal-box ${selector}`).join(', ')

const reachable = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(REACHABLE)]

export function Modal ({ titleId, onClose, children }: ModalProps) {
  useEffect(() => {
    const opener = document.activeElement

    reachable()[0]?.focus()

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const stops = reachable()
      if (stops.length === 0) return

      const first = stops[0]
      const last = stops[stops.length - 1]
      const leaving = event.shiftKey ? document.activeElement === first : document.activeElement === last

      if (leaving) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus()
      }
    }

    document.addEventListener('keydown', keydown)

    return () => {
      document.removeEventListener('keydown', keydown)
      if (opener instanceof HTMLElement) opener.focus()
    }
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
