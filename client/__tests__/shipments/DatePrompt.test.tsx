import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatePrompt } from '../../shipments/DatePrompt.js'
import type { TransitionAction } from '../../../shared/transitions.js'
import { today } from '../../../shared/time.js'

type Options = {
  action?: TransitionAction
  earliest?: string | null
  busy?: boolean
  error?: string | null
}

const renderPrompt = ({ action = 'drop_off', earliest = null, busy = false, error = null }: Options = {}) => {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()

  render(
    <DatePrompt
      action={action}
      earliest={earliest}
      busy={busy}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )

  return { onCancel, onConfirm }
}

const dateInput = () => screen.getByLabelText(/which day/i)

describe('the day it proposes', () => {
  it('starts on today, the answer in almost every case', () => {
    renderPrompt()

    expect(dateInput()).toHaveValue(today())
  })

  it('refuses a day in the future, which cannot have happened yet', () => {
    renderPrompt()

    expect(dateInput()).toHaveAttribute('max', today())
  })

  it('refuses a day before the previous step', () => {
    renderPrompt({ action: 'receive', earliest: '2026-06-10' })

    expect(dateInput()).toHaveAttribute('min', '2026-06-10')
  })

  it('imposes no lower bound when no step came before', () => {
    renderPrompt()

    expect(dateInput()).not.toHaveAttribute('min')
  })
})

describe('picking another day', () => {
  it('keeps what the user typed', async () => {
    renderPrompt()

    await userEvent.clear(dateInput())
    await userEvent.type(dateInput(), '2026-06-12')

    expect(dateInput()).toHaveValue('2026-06-12')
  })

  it('explains and blocks a day that lands before the previous step', async () => {
    const { onConfirm } = renderPrompt({ action: 'receive', earliest: '2026-06-10' })

    await userEvent.clear(dateInput())
    await userEvent.type(dateInput(), '2026-06-01')

    expect(screen.getByText(/cannot be earlier than the previous step/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cannot confirm an empty day', async () => {
    renderPrompt()

    await userEvent.clear(dateInput())

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })
})

describe('the rejection reason', () => {
  it('is offered when a return is refused, since that is what the user will want to remember', async () => {
    const { onConfirm } = renderPrompt({ action: 'reject' })

    await userEvent.type(screen.getByLabelText(/why was it refused/i), '  Worn shoes  ')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith(today(), 'Worn shoes')
  })

  it('stays out of the way on every other step', () => {
    renderPrompt({ action: 'refund' })

    expect(screen.queryByLabelText(/why was it refused/i)).not.toBeInTheDocument()
  })

  it('sends no note at all when the box is left empty', async () => {
    const { onConfirm } = renderPrompt({ action: 'reject' })

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith(today(), undefined)
  })
})

describe('how it behaves', () => {
  it('names the step it is about', () => {
    renderPrompt({ action: 'receive' })

    expect(screen.getByRole('heading', { name: 'Received' })).toBeInTheDocument()
  })

  it('shows what the api refused', () => {
    renderPrompt({ error: 'The drop-off date cannot be in the future.' })

    expect(screen.getByText('The drop-off date cannot be in the future.')).toBeInTheDocument()
  })

  it('backs out on cancel', async () => {
    const { onCancel } = renderPrompt()

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('backs out when the backdrop is clicked', async () => {
    const { onCancel } = renderPrompt()

    await userEvent.click(screen.getByRole('dialog'))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cannot be fired twice while the first save is running', () => {
    renderPrompt({ busy: true })

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })
})
