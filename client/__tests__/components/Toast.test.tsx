import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Toast } from '../../components/Toast.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('the notice after an action', () => {
  it('takes itself away once it has been read', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()

    render(<Toast message='Shipment archived.' onUndo={vi.fn()} onDismiss={onDismiss} />)

    expect(onDismiss).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(8000) })

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('speaks up without stealing the focus', () => {
    render(<Toast message='Shipment archived.' onUndo={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Shipment archived.')
  })
})
