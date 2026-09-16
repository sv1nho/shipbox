import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteDialog } from '../../shipments/DeleteDialog.js'
import { makeShipment } from '../fixtures.js'
import type { ShipmentDto } from '../../../shared/shipment.js'

const renderDialog = (overrides: Partial<ShipmentDto> = {}, busy = false) => {
  const shipment = makeShipment(overrides)
  const onCancel = vi.fn()
  const onConfirm = vi.fn()

  render(<DeleteDialog shipment={shipment} busy={busy} onCancel={onCancel} onConfirm={onConfirm} />)

  return { shipment, onCancel, onConfirm }
}

describe('what the confirmation tells the user', () => {
  it('names the shipment being deleted, so it cannot be the wrong one', () => {
    renderDialog({ store: 'Decathlon', trackingNumber: '329900000000000000000005', amountCents: 12500 })

    expect(screen.getByText(/Decathlon/)).toBeInTheDocument()
    expect(screen.getByText(/329900000000000000000005/)).toBeInTheDocument()
    expect(screen.getByText(/€125\.00/)).toBeInTheDocument()
  })

  it('says plainly that it cannot be undone', () => {
    renderDialog()

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('lists what is lost, not just a vague warning', () => {
    renderDialog()

    expect(screen.getByText(/everything you recorded/i)).toBeInTheDocument()
    expect(screen.getByText(/drop-off, reception and decision dates/i)).toBeInTheDocument()
  })

  it('warns that the pdf becomes unrecoverable when a label is stored', () => {
    renderDialog({ hasLabel: true })

    expect(screen.getByText(/PDF can never be downloaded again/i)).toBeInTheDocument()
  })

  it('does not promise a lost pdf when there was never a label', () => {
    renderDialog({ hasLabel: false })

    expect(screen.queryByText(/PDF can never be downloaded again/i)).not.toBeInTheDocument()
  })

  it('points at archiving as the reversible way out', () => {
    renderDialog()

    expect(screen.getByText(/archive it instead/i)).toBeInTheDocument()
  })
})

describe('how it behaves', () => {
  it('is announced as a modal dialog with a title', () => {
    renderDialog()

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: /delete this shipment for good/i })).toBeInTheDocument()
  })

  it('does nothing until the destructive button is pressed', async () => {
    const { onConfirm } = renderDialog()

    expect(onConfirm).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /delete for good/i }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('backs out on cancel', async () => {
    const { onCancel, onConfirm } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('backs out when the backdrop is clicked', async () => {
    const { onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('dialog'))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cannot be fired twice while the first delete is running', () => {
    renderDialog({}, true)

    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })
})
