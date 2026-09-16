import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShipmentDetails } from '../../shipments/ShipmentDetails.js'
import { makeShipment } from '../fixtures.js'
import { today } from '../../../shared/time.js'
import type { ShipmentDto } from '../../../shared/shipment.js'

const renderDetails = (overrides: Partial<ShipmentDto> = {}, busy = false, error: string | null = null) => {
  const shipment = makeShipment(overrides)
  const onClose = vi.fn()
  const onSave = vi.fn()

  render(
    <ShipmentDetails
      shipment={shipment}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={onSave}
    />
  )

  return { shipment, onClose, onSave }
}

const startEditing = async () => {
  await userEvent.click(screen.getByRole('button', { name: /edit the dates/i }))
}

const valueOf = (label: string) =>
  screen.getByText(label).parentElement?.querySelector('.detail-value')?.textContent

describe('what the panel always shows', () => {
  it('identifies the shipment beyond doubt', () => {
    renderDetails({ store: 'Decathlon', orderNumber: 'CMD-99', amountCents: 12500 })

    expect(valueOf('Tracking number')).toBe('323200000000000000000001')
    expect(valueOf('Carrier')).toBe('bpost')
    expect(valueOf('Store')).toBe('Decathlon')
    expect(valueOf('Order number')).toBe('CMD-99')
    expect(valueOf('Amount')).toBe('€125.00')
  })

  it('names the status in the header, so the panel matches the row', () => {
    renderDetails({ status: 'refunded', decisionDate: '2026-06-09' })

    expect(screen.getByText('Refunded')).toBeInTheDocument()
  })

  it('keeps the tracking link usable from the panel', () => {
    renderDetails()

    expect(screen.getByRole('link', { name: '323200000000000000000001' }))
      .toHaveAttribute('target', '_blank')
  })

  it('always dates the shipment, even one that never moved', () => {
    renderDetails({ status: 'pending', createdAt: '2026-06-01T10:00:00.000Z' })

    expect(valueOf('Added')).toBe('01/06/2026')
  })

  it('says whether the pdf can still be rebuilt', () => {
    renderDetails({ hasLabel: true })

    expect(valueOf('Stored label')).toContain('Yes')
  })
})

describe('what it leaves out', () => {
  it('hides the steps that never happened rather than showing dashes', () => {
    renderDetails({ status: 'pending' })

    expect(screen.queryByText('Dropped off')).not.toBeInTheDocument()
    expect(screen.queryByText('Received')).not.toBeInTheDocument()
    expect(screen.queryByText('Decided')).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('hides the delays the api could not derive', () => {
    renderDetails({ decisionDelayDays: null, totalDelayDays: null, daysSinceReceived: null })

    expect(screen.queryByText('The store took')).not.toBeInTheDocument()
    expect(screen.queryByText('The whole return took')).not.toBeInTheDocument()
    expect(screen.queryByText('Since the store received it')).not.toBeInTheDocument()
  })

  it('hides an empty order number and an empty note', () => {
    renderDetails({ orderNumber: null, note: null })

    expect(screen.queryByText('Order number')).not.toBeInTheDocument()
    expect(screen.queryByText('Note')).not.toBeInTheDocument()
  })

  it('mentions the archive only once the shipment is archived', () => {
    renderDetails({ archivedAt: null })

    expect(screen.queryByText('Archived')).not.toBeInTheDocument()
  })
})

describe('the full history of a finished return', () => {
  it('lays out every step and every delay', () => {
    renderDetails({
      status: 'refunded',
      dropoffDate: '2026-06-03',
      receivedDate: '2026-06-05',
      decisionDate: '2026-06-09',
      daysSinceReceived: 4,
      decisionDelayDays: 2,
      totalDelayDays: 4,
      note: 'Refunded in full',
      archivedAt: '2026-06-10T08:00:00.000Z',
    })

    expect(valueOf('Dropped off')).toBe('03/06/2026')
    expect(valueOf('Received')).toBe('05/06/2026')
    expect(valueOf('Decided')).toBe('09/06/2026')
    expect(valueOf('The store took')).toBe('2 working days')
    expect(valueOf('The whole return took')).toBe('4 working days')
    expect(valueOf('Note')).toBe('Refunded in full')
    expect(valueOf('Archived')).toBe('10/06/2026')
  })
})

describe('the warning', () => {
  it('repeats the alert the row could only show as an icon', () => {
    renderDetails({ status: 'received', needsAction: true, daysSinceReceived: 21 })

    expect(screen.getByText(/has had this parcel for 21 working days/i)).toBeInTheDocument()
  })

  it('stays out of the way when nothing is late', () => {
    renderDetails()

    expect(screen.queryByText(/time to chase them/i)).not.toBeInTheDocument()
  })
})

describe('closing', () => {
  it('is announced as a modal dialog', () => {
    renderDetails()

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('closes on the button', async () => {
    const { onClose } = renderDetails()

    await userEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when the backdrop is clicked', async () => {
    const { onClose } = renderDetails()

    await userEvent.click(screen.getByRole('dialog'))

    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('correcting the dates', () => {
  it('shows every date as a field, including the steps that were skipped', async () => {
    renderDetails({ status: 'refunded', decisionDate: '2026-06-09' })
    await startEditing()

    expect(screen.getByLabelText('Dropped off')).toHaveValue('')
    expect(screen.getByLabelText('Received')).toHaveValue('')
    expect(screen.getByLabelText('Decided')).toHaveValue('2026-06-09')
  })

  it('never lets a date be set in the future', async () => {
    renderDetails()
    await startEditing()

    expect(screen.getByLabelText('Received')).toHaveAttribute('max', today())
  })

  it('fills a gap the direct recording left behind', async () => {
    const { onSave } = renderDetails({ status: 'refunded', decisionDate: '2026-06-09' })
    await startEditing()

    await userEvent.type(screen.getByLabelText('Received'), '2026-06-05')
    await userEvent.click(screen.getByRole('button', { name: /save the dates/i }))

    expect(onSave).toHaveBeenCalledWith({
      dropoffDate: null,
      receivedDate: '2026-06-05',
      decisionDate: '2026-06-09',
    })
  })

  it('clears a date that was recorded by mistake', async () => {
    const { onSave } = renderDetails({ status: 'dropped_off', dropoffDate: '2026-06-03' })
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Dropped off'))
    await userEvent.click(screen.getByRole('button', { name: /save the dates/i }))

    expect(onSave).toHaveBeenCalledWith({
      dropoffDate: null,
      receivedDate: null,
      decisionDate: null,
    })
  })

  it('refuses an order the api would reject, before asking it', async () => {
    const { onSave } = renderDetails({
      status: 'refunded',
      dropoffDate: '2026-06-03',
      decisionDate: '2026-06-09',
    })
    await startEditing()

    await userEvent.type(screen.getByLabelText('Received'), '2026-06-01')

    expect(screen.getByText(/drop-off, reception then decision order/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save the dates/i })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('backs out without saving', async () => {
    const { onSave } = renderDetails({ status: 'dropped_off', dropoffDate: '2026-06-03' })
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Dropped off'))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Dropped off')).not.toBeInTheDocument()
  })

  it('cannot be fired twice while the save is running', async () => {
    renderDetails({}, true)
    await startEditing()

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('shows what the api refused', () => {
    renderDetails({}, false, 'receivedDate cannot be earlier than dropoffDate.')

    expect(screen.getByText('receivedDate cannot be earlier than dropoffDate.')).toBeInTheDocument()
  })
})
