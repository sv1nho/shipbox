import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatePrompt } from '../../shipments/DatePrompt.js'
import type { NextStep } from '../../../shared/transitions.js'
import { today } from '../../../shared/time.js'

type Options = {
  actions?: NextStep['actions']
  earliest?: string | null
  reception?: { earliest: string | null } | null
  busy?: boolean
  error?: string | null
}

const renderPrompt = (
  { actions = ['drop_off'], earliest = null, reception = null, busy = false, error = null }: Options = {}
) => {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()

  render(
    <DatePrompt
      actions={actions}
      earliest={earliest}
      reception={reception}
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
    renderPrompt({ actions: ['receive'], earliest: '2026-06-10' })

    expect(dateInput()).toHaveAttribute('min', '2026-06-10')
  })

  it('imposes no lower bound when no step came before', () => {
    renderPrompt()

    expect(dateInput()).not.toHaveAttribute('min')
  })
})

describe('picking another day', () => {
  it('confirms the day the user picked, not the one it proposed', async () => {
    const { onConfirm } = renderPrompt()

    await userEvent.clear(dateInput())
    await userEvent.type(dateInput(), '2026-06-12')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith({ action: 'drop_off', date: '2026-06-12' })
  })

  it('explains and blocks a day that lands before the previous step', async () => {
    const { onConfirm } = renderPrompt({ actions: ['receive'], earliest: '2026-06-10' })

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
    const { onConfirm } = renderPrompt({ actions: ['reject'] })

    await userEvent.type(screen.getByLabelText(/why was it refused/i), '  Worn shoes  ')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith({ action: 'reject', date: today(), note: 'Worn shoes' })
  })

  it('stays out of the way on every other step', () => {
    renderPrompt({ actions: ['refund'] })

    expect(screen.queryByLabelText(/why was it refused/i)).not.toBeInTheDocument()
  })

  it('sends no note at all when the box is left empty', async () => {
    const { onConfirm } = renderPrompt({ actions: ['reject'] })

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith({ action: 'reject', date: today() })
  })
})

describe('how it behaves', () => {
  it('names the step it is about', () => {
    renderPrompt({ actions: ['receive'] })

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

describe('choosing the outcome', () => {
  it('asks nothing extra when the step has a single outcome', () => {
    renderPrompt()

    expect(screen.queryByRole('group', { name: /outcome/i })).not.toBeInTheDocument()
  })

  it('offers both decisions in one window rather than two buttons in the row', () => {
    renderPrompt({ actions: ['refund', 'reject'] })

    expect(screen.getByRole('button', { name: 'Refunded' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejected' })).toBeInTheDocument()
  })

  it('starts on the first outcome and titles the window with it', () => {
    renderPrompt({ actions: ['refund', 'reject'] })

    expect(screen.getByRole('heading', { name: 'Refunded' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refunded' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('follows the outcome the user picks', async () => {
    const { onConfirm } = renderPrompt({ actions: ['refund', 'reject'] })

    await userEvent.click(screen.getByRole('button', { name: 'Rejected' }))

    expect(screen.getByRole('heading', { name: 'Rejected' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith({ action: 'reject', date: today() })
  })

  it('asks for a reason only once the refusal is chosen', async () => {
    renderPrompt({ actions: ['refund', 'reject'] })

    expect(screen.queryByLabelText(/why was it refused/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Rejected' }))

    expect(screen.getByLabelText(/why was it refused/i)).toBeInTheDocument()
  })
})

describe('a decision that skips the reception', () => {
  const decide = (earliest: string | null = null) =>
    renderPrompt({ actions: ['refund', 'reject'], reception: { earliest } })

  const receptionInput = () => screen.getByLabelText(/when did the store receive it/i)

  it('asks nothing extra when the reception is already recorded', () => {
    renderPrompt({ actions: ['refund', 'reject'] })

    expect(screen.queryByLabelText(/when did the store receive it/i)).not.toBeInTheDocument()
  })

  it('says why the reception date is being asked for', () => {
    decide()

    expect(screen.getByText(/waiting time of this store cannot be measured/i)).toBeInTheDocument()
  })

  it('sends both dates, so the store delay can be measured', async () => {
    const { onConfirm } = decide()

    await userEvent.clear(receptionInput())
    await userEvent.type(receptionInput(), '2026-06-05')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith({
      action: 'refund',
      date: today(),
      receivedDate: '2026-06-05',
    })
  })

  it('refuses to save without a reception date', async () => {
    decide()

    await userEvent.clear(receptionInput())

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })

  it('refuses a reception earlier than the drop-off', async () => {
    decide('2026-06-10')

    await userEvent.clear(receptionInput())
    await userEvent.type(receptionInput(), '2026-06-01')

    expect(screen.getByText(/cannot be earlier than the drop-off/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })

  it('refuses a decision earlier than the reception it was just given', async () => {
    const { onConfirm } = decide()

    await userEvent.clear(receptionInput())
    await userEvent.type(receptionInput(), today())
    await userEvent.clear(dateInput())
    await userEvent.type(dateInput(), '2026-06-01')

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
