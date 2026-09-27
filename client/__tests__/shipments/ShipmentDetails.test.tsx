import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
vi.mock('../../api/shipments.js', () => ({ searchStores: vi.fn().mockResolvedValue([]), addStore: vi.fn() }))

import { ShipmentDetails, draftOf, patchOf } from '../../shipments/ShipmentDetails.js'
import { makeShipment } from '../fixtures.js'
import { searchStores } from '../../api/shipments.js'
import { today } from '../../../shared/time.js'
import type { ShipmentDto, UpdateShipmentInput } from '../../../shared/shipment.js'

const renderDetails = (overrides: Partial<ShipmentDto> = {}, busy = false, error: string | null = null) => {
  const shipment = makeShipment(overrides)
  const onClose = vi.fn()
  const onSave = vi.fn<(patch: UpdateShipmentInput) => void>()

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
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
}

const valueOf = (label: string) =>
  screen.getByText(label).parentElement?.querySelector('.detail-value')?.textContent

const step = (label: string): HTMLElement => {
  const timeline = document.querySelector('.timeline') as HTMLElement
  return within(timeline).getByText(label).closest('.timeline-step') as HTMLElement
}

const stepValue = (label: string) => step(label).querySelector('.timeline-value')?.textContent

describe('what the panel always shows', () => {
  it('identifies the shipment beyond doubt', () => {
    renderDetails({ store: 'Decathlon', orderNumber: 'CMD-99', amountCents: 12500 })

    expect(valueOf('Tracking number')).toBe('323200000000000000000001')
    expect(valueOf('Carrier')).toBe('bpost')
    expect(valueOf('Store')).toBe('Decathlon')
    expect(valueOf('Order number')).toBe('CMD-99')
    expect(valueOf('Amount')).toBe('€125.00')
  })

  it('offers the customer service address as a link to write to', () => {
    renderDetails({ storeSupportEmail: 'service@zalando.be' })

    expect(screen.getByRole('link', { name: 'service@zalando.be' }))
      .toHaveAttribute('href', 'mailto:service@zalando.be')
  })

  it('says nothing about an address the store never gave', () => {
    renderDetails({ storeSupportEmail: null })

    expect(screen.queryByText('Customer service')).not.toBeInTheDocument()
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
    renderDetails({ status: 'pending', requestedDate: '2026-06-01' })

    expect(stepValue('Return requested')).toBe('01/06/2026')
  })

  it('stays quiet about the day it entered ShipBox when that is the request day', () => {
    renderDetails({ requestedDate: '2026-06-01', createdAt: '2026-06-01T10:00:00.000Z' })

    expect(screen.queryByText('Added to ShipBox')).not.toBeInTheDocument()
  })

  it('shows both days on a back-filled return, where they tell different things', () => {
    renderDetails({ requestedDate: '2025-11-20', createdAt: '2026-06-01T10:00:00.000Z' })

    expect(stepValue('Return requested')).toBe('20/11/2025')
    expect(valueOf('Added to ShipBox')).toBe('01/06/2026')
  })

  it('says whether the pdf can still be rebuilt', () => {
    renderDetails({ hasLabel: true })

    expect(valueOf('Stored label')).toContain('Yes')
  })
})

describe('copying the tracking number', () => {
  it('hands it to the clipboard, so it can be pasted on the carrier site', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    renderDetails({ trackingNumber: '323200000000000000004050' })
    await userEvent.click(screen.getByRole('button', { name: /copy the tracking number/i }))

    expect(writeText).toHaveBeenCalledWith('323200000000000000004050')
    expect(await screen.findByRole('button', { name: /tracking number copied/i })).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('keeps offering the copy when the browser refuses the clipboard', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    renderDetails()
    await userEvent.click(screen.getByRole('button', { name: /copy the tracking number/i }))

    expect(await screen.findByRole('button', { name: /copy the tracking number/i })).toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})

describe('what it leaves out', () => {
  it('shows the steps still ahead as waiting instead of hiding them', () => {
    renderDetails({ status: 'pending' })

    expect(step('Return requested').className).toContain('timeline-step-done')

    for (const ahead of ['Dropped off', 'Received', 'Decided']) {
      expect(stepValue(ahead)).toBe('Not yet')
      expect(step(ahead).className).not.toContain('timeline-step-done')
    }
  })

  it('hides the delays the api could not derive', () => {
    renderDetails({ decisionDelayDays: null, totalDelayDays: null, daysSinceReceived: null })

    expect(screen.queryByText('Waited for the decision')).not.toBeInTheDocument()
    expect(screen.queryByText('The whole return took')).not.toBeInTheDocument()
    expect(screen.queryByText('Since the store received it')).not.toBeInTheDocument()
    expect(screen.queryByText('Since the drop-off')).not.toBeInTheDocument()
  })

  it('hides an empty note', () => {
    renderDetails({ note: null })

    expect(screen.queryByText('Note')).not.toBeInTheDocument()
  })

  it('always shows the order number, the reference the store answers to', () => {
    renderDetails({ orderNumber: 'HM-55120' })

    expect(valueOf('Order number')).toBe('HM-55120')
  })

  it('tells the refusal reason apart from a free note', () => {
    renderDetails({ note: 'Bought on sale', rejectionReason: 'Worn shoes' })

    expect(valueOf('Refused because')).toBe('Worn shoes')
    expect(valueOf('Note')).toBe('Bought on sale')
  })

  it('says nothing about a refusal that never happened', () => {
    renderDetails({ rejectionReason: null })

    expect(screen.queryByText('Refused because')).not.toBeInTheDocument()
  })

  it('dates the last chase, so a reminder is never sent twice by mistake', () => {
    renderDetails({ status: 'received', receivedDate: '2026-06-05', lastChasedAt: '2026-06-20' })

    expect(valueOf('Store chased')).toBe('20/06/2026')
  })

  it('says nothing about a chase that never happened', () => {
    renderDetails({ lastChasedAt: null })

    expect(screen.queryByText('Store chased')).not.toBeInTheDocument()
  })

  it('says the parcel never reached the store, rather than leaving the gap unexplained', () => {
    renderDetails({ status: 'refunded', neverReceived: true, decisionDate: '2026-06-09' })

    expect(valueOf('Reception')).toBe('Never reached the store')
  })

  it('says nothing about a reception that simply has not happened yet', () => {
    renderDetails({ status: 'dropped_off', neverReceived: false, dropoffDate: '2026-06-03' })

    expect(screen.queryByText('Reception')).not.toBeInTheDocument()
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
      daysSinceDropoff: 6,
      daysSinceReceived: 4,
      decisionDelayDays: 2,
      totalDelayDays: 4,
      note: 'Refunded in full',
      archivedAt: '2026-06-10T08:00:00.000Z',
    })

    expect(stepValue('Dropped off')).toBe('03/06/2026')
    expect(stepValue('Received')).toBe('05/06/2026')
    expect(stepValue('Decided')).toBe('09/06/2026')
    expect(valueOf('Since the drop-off')).toBe('6 days')
    expect(valueOf('Waited for the decision')).toBe('2 days')
    expect(valueOf('The whole return took')).toBe('4 days')
    expect(valueOf('Note')).toBe('Refunded in full')
    expect(valueOf('Archived')).toBe('10/06/2026')
  })
})

describe('the warning', () => {
  it('repeats the alert the row could only show as an icon', () => {
    renderDetails({ status: 'received', needsAction: true, daysSinceReceived: 21 })

    expect(screen.getByText(/has had this parcel for 21 days/i)).toBeInTheDocument()
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
    renderDetails({ status: 'refunded', requestedDate: '2026-06-01', decisionDate: '2026-06-09' })
    await startEditing()

    expect(screen.getByLabelText('Return requested')).toHaveValue('2026-06-01')
    expect(screen.getByLabelText('Dropped off')).toHaveValue('')
    expect(screen.getByLabelText('Received')).toHaveValue('')
    expect(screen.getByLabelText('Decided')).toHaveValue('2026-06-09')
  })

  it('bounds each field by its neighbours, so no order can be typed in', async () => {
    renderDetails({ status: 'refunded', requestedDate: '2026-06-01', decisionDate: '2026-06-09' })
    await startEditing()

    expect(screen.getByLabelText('Return requested')).not.toHaveAttribute('min')
    expect(screen.getByLabelText('Return requested')).toHaveAttribute('max', '2026-06-09')
    expect(screen.getByLabelText('Received')).toHaveAttribute('min', '2026-06-01')
    expect(screen.getByLabelText('Received')).toHaveAttribute('max', '2026-06-09')
    expect(screen.getByLabelText('Decided')).toHaveAttribute('max', today())
  })

  it('fills a gap the direct recording left behind', async () => {
    const { onSave } = renderDetails({
      status: 'refunded',
      requestedDate: '2026-06-01',
      decisionDate: '2026-06-09',
    })
    await startEditing()

    await userEvent.type(screen.getByLabelText('Received'), '2026-06-05')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onSave).toHaveBeenCalledWith({
      requestedDate: '2026-06-01',
      receivedDate: '2026-06-05',
      decisionDate: '2026-06-09',
    })
  })

  it('sends nothing for a step that never happened, rather than a null', async () => {
    const { onSave } = renderDetails({ status: 'pending', requestedDate: '2026-06-01' })
    await startEditing()

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onSave).toHaveBeenCalledWith({ requestedDate: '2026-06-01' })
  })

  it('refuses to erase a date already recorded, pointing at the undo instead', async () => {
    const { onSave } = renderDetails({ status: 'dropped_off', dropoffDate: '2026-06-03' })
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Dropped off'))

    expect(screen.getByText(/cannot be removed here. Undo the step instead/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
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
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('backs out without saving', async () => {
    const { onSave } = renderDetails({ status: 'dropped_off', dropoffDate: '2026-06-03' })
    await startEditing()

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

describe('correcting what was typed', () => {
  it('shows the bookkeeping fields as inputs, filled with what is recorded', async () => {
    renderDetails({ store: 'Nike', orderNumber: 'CMD-99', amountCents: 12550, recipientPostalCode: '4000' })
    await startEditing()

    expect(screen.getByLabelText('Store')).toHaveValue('Nike')
    expect(screen.getByLabelText('Order number')).toHaveValue('CMD-99')
    expect(screen.getByLabelText('Amount')).toHaveValue('125.50')
    expect(screen.getByLabelText('Postal code')).toHaveValue('4000')
    expect(screen.getByLabelText('Country')).toHaveValue('BE')
  })

  it('sends only what changed, leaving the rest untouched', async () => {
    const { onSave } = renderDetails({ amountCents: 4999, store: 'Zalando' })
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Amount'))
    await userEvent.type(screen.getByLabelText('Amount'), '39.90')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(onSave).toHaveBeenCalledOnce()
    const patch = onSave.mock.calls[0][0]

    expect(patch.amountCents).toBe(3990)
    expect(patch.store).toBeUndefined()
    expect(patch.orderNumber).toBeUndefined()
  })

  it('writes a note where there was none, and clears one that is emptied', async () => {
    const added = renderDetails({ note: null })
    await startEditing()

    await userEvent.type(screen.getByLabelText('Note'), 'Bought on sale')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(added.onSave.mock.calls[0][0].note).toBe('Bought on sale')

    cleanup()

    const cleared = renderDetails({ note: 'Bought on sale' })
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Note'))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(cleared.onSave.mock.calls[0][0].note).toBeNull()
  })

  it('corrects where the parcel was sent, postal code and country', async () => {
    const { onSave } = renderDetails({ recipientPostalCode: '2000', recipientCountry: 'BE' })
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Postal code'))
    await userEvent.type(screen.getByLabelText('Postal code'), '4000')
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'NL')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    const patch = onSave.mock.calls[0][0]

    expect(patch.recipientPostalCode).toBe('4000')
    expect(patch.recipientCountry).toBe('NL')
  })

  it('refuses an amount that is not one, before asking the api', async () => {
    const { onSave } = renderDetails()
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Amount'))
    await userEvent.type(screen.getByLabelText('Amount'), 'free')

    expect(screen.getByText('An amount like 49.99 is required.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('refuses to empty the store or the order number', async () => {
    renderDetails()
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Store'))
    await userEvent.clear(screen.getByLabelText('Order number'))

    expect(screen.getByText('Say which store the parcel goes back to.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('keeps the label out of it, since the parcel is already on its way', async () => {
    renderDetails()
    await startEditing()

    expect(screen.queryByLabelText('Tracking number')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Carrier')).not.toBeInTheDocument()
  })
})

describe('what the patch carries', () => {
  it('leaves the amount out when what was typed is not one', () => {
    const shipment = makeShipment({ amountCents: 4999 })

    const patch = patchOf(shipment, { ...draftOf(shipment), amount: 'free' })

    expect(patch.amountCents).toBeUndefined()
  })

  it('suggests the stores already tracked, so a typo makes no second one', async () => {
    vi.mocked(searchStores).mockResolvedValue([{ name: 'Zalando', supportEmail: null }])

    renderDetails({ store: 'Zalando' })
    await startEditing()

    expect(screen.getByLabelText('Store')).toHaveAttribute('role', 'combobox')

    await userEvent.type(screen.getByLabelText('Store'), 'n')

    await userEvent.click(await screen.findByRole('option', { name: 'Zalando' }))

    expect(screen.getByLabelText('Store')).toHaveValue('Zalando')
  })

  it('carries a corrected store and order number, trimmed', () => {
    const shipment = makeShipment({ store: 'Zalando', orderNumber: 'ZAL-1' })

    const patch = patchOf(shipment, { ...draftOf(shipment), store: ' Nike ', orderNumber: ' CMD-9 ' })

    expect(patch.store).toBe('Nike')
    expect(patch.orderNumber).toBe('CMD-9')
  })

  it('refuses an amount larger than the api would take', async () => {
    renderDetails()
    await startEditing()

    await userEvent.clear(screen.getByLabelText('Amount'))
    await userEvent.type(screen.getByLabelText('Amount'), '2000000')

    expect(screen.getByText('An amount cannot be more than 1,000,000.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })
})

describe('the keyboard', () => {
  it('closes on escape, the key everyone reaches for', async () => {
    const { onClose } = renderDetails()

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })
})
