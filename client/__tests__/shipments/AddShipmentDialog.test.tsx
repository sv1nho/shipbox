import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../api/shipments.js', () => ({ searchStores: vi.fn(), addStore: vi.fn() }))

import { AddShipmentDialog } from '../../shipments/AddShipmentDialog.js'
import { addStore, searchStores } from '../../api/shipments.js'
import { today } from '../../../shared/time.js'
import type { CreateShipmentInput } from '../../../shared/shipment.js'

const renderDialog = (busy = false, error: string | null = null, field?: Record<string, string>) => {
  const onCancel = vi.fn()
  const onSubmit = vi.fn<(input: CreateShipmentInput) => void>()

  render(
    <AddShipmentDialog
      busy={busy}
      error={error}
      fieldError={(path) => field?.[path]}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  )

  return { onCancel, onSubmit }
}

const fillTheRequired = async () => {
  await userEvent.type(screen.getByLabelText('Tracking number'), '323200000000000000004050')
  await userEvent.type(screen.getByLabelText('Store'), 'Zalando')
  await userEvent.type(screen.getByLabelText('Amount'), '49.99')
  await userEvent.type(screen.getByLabelText('Postal code'), '2000')
  await userEvent.type(screen.getByLabelText('Order number'), 'ZAL-2026-0001')
}

const submit = async () => {
  await userEvent.click(screen.getByRole('button', { name: /track it/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(searchStores).mockResolvedValue([])
})

describe('what it asks for', () => {
  it('starts on today, the usual day a return is asked for', () => {
    renderDialog()

    expect(screen.getByLabelText('Return requested on')).toHaveValue(today())
    expect(screen.getByLabelText('Return requested on')).toHaveAttribute('max', today())
  })

  it('assumes nothing has happened yet', () => {
    renderDialog()

    expect(screen.getByLabelText(/where is it already/i)).toHaveValue('pending')
    expect(screen.queryByLabelText('Dropped off on')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Received on')).not.toBeInTheDocument()
  })

  it('asks for the drop-off day only once the parcel has left', async () => {
    renderDialog()

    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'dropped_off')

    expect(screen.getByLabelText('Dropped off on')).toBeInTheDocument()
    expect(screen.queryByLabelText('Received on')).not.toBeInTheDocument()
  })

  it('asks for both days on a return the store already has', async () => {
    renderDialog()

    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'received')

    expect(screen.getByLabelText('Dropped off on')).toBeInTheDocument()
    expect(screen.getByLabelText('Received on')).toBeInTheDocument()
  })

  it('hints at the format the chosen carrier expects', async () => {
    renderDialog()

    expect(screen.getByLabelText('Tracking number')).toHaveAttribute('placeholder', '24 digits for bpost')

    await userEvent.click(screen.getByRole('button', { name: 'PostNL' }))

    expect(screen.getByLabelText('Tracking number'))
      .toHaveAttribute('placeholder', expect.stringContaining('3SDDRL'))
  })
})

describe('what it refuses', () => {
  it('says nothing before the first attempt, so it does not nag', () => {
    renderDialog()

    expect(screen.queryByText(/is required/i)).not.toBeInTheDocument()
  })

  it('names every missing field at once', async () => {
    const { onSubmit } = renderDialog()

    await submit()

    expect(screen.getByText('A tracking number is required.')).toBeInTheDocument()
    expect(screen.getByText(/which store/i)).toBeInTheDocument()
    expect(screen.getByText(/an amount like/i)).toBeInTheDocument()
    expect(screen.getByText('A postal code is required.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('refuses an amount no return could carry, rather than let the server do it', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.clear(screen.getByLabelText('Amount'))
    await userEvent.type(screen.getByLabelText('Amount'), '1000000.01')
    await submit()

    expect(screen.getByText('An amount cannot be more than 1,000,000.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('accepts the largest amount the server would still take', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.clear(screen.getByLabelText('Amount'))
    await userEvent.type(screen.getByLabelText('Amount'), '1000000')
    await submit()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 100000000 }))
  })

  it('refuses a number the carrier could never have issued', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.clear(screen.getByLabelText('Tracking number'))
    await userEvent.type(screen.getByLabelText('Tracking number'), '3SDDRL000000409')
    await submit()

    expect(screen.getByText(/not a bpost number/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('accepts the same number once the carrier matches it', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'PostNL' }))
    await userEvent.type(screen.getByLabelText('Tracking number'), '3SDDRL000000409')
    await userEvent.type(screen.getByLabelText('Store'), 'Zara')
    await userEvent.type(screen.getByLabelText('Amount'), '20')
    await userEvent.type(screen.getByLabelText('Postal code'), '1101CM')
    await userEvent.type(screen.getByLabelText('Order number'), '41028866102')
    await submit()

    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('refuses a return with no order number, the store searching by nothing else', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.type(screen.getByLabelText('Tracking number'), '323200000000000000004050')
    await userEvent.type(screen.getByLabelText('Store'), 'Zalando')
    await userEvent.type(screen.getByLabelText('Amount'), '49.99')
    await userEvent.type(screen.getByLabelText('Postal code'), '2000')
    await submit()

    expect(screen.getByText(/searches by its own order number/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('asks for the decision day once a decided status is chosen', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'refunded')
    await userEvent.type(screen.getByLabelText('Dropped off on'), '2026-06-03')
    await userEvent.type(screen.getByLabelText('Received on'), '2026-06-05')
    await submit()

    expect(screen.getByText('Pick the day the store decided.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('asks for a refusal reason only on a refusal', async () => {
    renderDialog()

    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'refunded')

    expect(screen.queryByLabelText(/refused because/i)).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'rejected')

    expect(screen.getByLabelText(/refused because/i)).toBeInTheDocument()
  })

  it('refuses a reception that happened before the drop-off', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'received')
    await userEvent.type(screen.getByLabelText('Dropped off on'), '2026-06-10')
    await userEvent.type(screen.getByLabelText('Received on'), '2026-06-01')
    await submit()

    expect(screen.getByText(/cannot be earlier than the step before it/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows what the api refused, field by field', () => {
    renderDialog(false, 'This tracking number is already registered.', {
      trackingNumber: 'must be unique',
    })

    expect(screen.getByText('must be unique')).toBeInTheDocument()
    expect(screen.getByText('This tracking number is already registered.')).toBeInTheDocument()
  })
})

describe('what it sends', () => {
  it('sends the normalised number and the amount in cents', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.type(screen.getByLabelText('Tracking number'), '3232 0000 0000 0000 0000 4050')
    await userEvent.type(screen.getByLabelText('Store'), 'Zalando')
    await userEvent.type(screen.getByLabelText('Amount'), '49,99')
    await userEvent.type(screen.getByLabelText('Postal code'), '2000')
    await userEvent.type(screen.getByLabelText('Order number'), 'ZAL-2026-0001')
    await submit()

    expect(onSubmit).toHaveBeenCalledWith({
      trackingNumber: '323200000000000000004050',
      carrier: 'bpost',
      recipientPostalCode: '2000',
      recipientCountry: 'BE',
      amountCents: 4999,
      store: 'Zalando',
      orderNumber: 'ZAL-2026-0001',
      requestedDate: today(),
    })
  })

  it('leaves out the fields the user did not fill, rather than sending blanks', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await submit()

    const sent = vi.mocked(onSubmit).mock.calls[0][0]

    expect(sent).not.toHaveProperty('note')
    expect(sent).not.toHaveProperty('status')
  })

  it('records a return that was already decided long ago', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.clear(screen.getByLabelText('Return requested on'))
    await userEvent.type(screen.getByLabelText('Return requested on'), '2026-01-05')
    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'rejected')
    await userEvent.type(screen.getByLabelText('Dropped off on'), '2026-01-07')
    await userEvent.type(screen.getByLabelText('Received on'), '2026-01-10')
    await userEvent.type(screen.getByLabelText('Decided on'), '2026-01-20')
    await userEvent.type(screen.getByLabelText(/refused because/i), 'Worn shoes')
    await submit()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      status: 'rejected',
      decisionDate: '2026-01-20',
      rejectionReason: 'Worn shoes',
    }))
  })

  it('carries the country and the note when they are given', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.type(screen.getByLabelText('Tracking number'), '3SDDRL000000409')
    await userEvent.click(screen.getByRole('button', { name: 'PostNL' }))
    await userEvent.type(screen.getByLabelText('Store'), 'Zara')
    await userEvent.type(screen.getByLabelText('Amount'), '20')
    await userEvent.type(screen.getByLabelText('Postal code'), '1101CM')
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'NL')
    await userEvent.type(screen.getByLabelText('Order number'), '41028866102')
    await userEvent.type(screen.getByLabelText(/note/i), '  Gift receipt  ')
    await submit()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      recipientCountry: 'NL',
      note: 'Gift receipt',
    }))
  })

  it('carries the starting status and its dates for an old return', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.clear(screen.getByLabelText('Return requested on'))
    await userEvent.type(screen.getByLabelText('Return requested on'), '2026-05-01')
    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'received')
    await userEvent.type(screen.getByLabelText('Dropped off on'), '2026-05-03')
    await userEvent.type(screen.getByLabelText('Received on'), '2026-05-06')
    await userEvent.clear(screen.getByLabelText('Order number'))
    await userEvent.type(screen.getByLabelText('Order number'), ' ORD-1 ')
    await submit()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      status: 'received',
      requestedDate: '2026-05-01',
      dropoffDate: '2026-05-03',
      receivedDate: '2026-05-06',
      orderNumber: 'ORD-1',
    }))
  })
})

describe('a parcel the store never received', () => {
  const asksLoss = () => screen.queryByLabelText(/never received it/i)

  it.each(['pending', 'dropped_off', 'received'] as const)(
    'offers nothing to declare while the return is still %s',
    async (status) => {
      renderDialog()

      await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), status)

      expect(asksLoss()).not.toBeInTheDocument()
    }
  )

  it('stops asking for a reception once the loss is declared', async () => {
    renderDialog()

    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'refunded')

    expect(screen.getByLabelText('Received on')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText(/never received it/i))

    expect(screen.queryByLabelText('Received on')).not.toBeInTheDocument()
  })

  it('sends the loss and no reception date at all', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.clear(screen.getByLabelText('Return requested on'))
    await userEvent.type(screen.getByLabelText('Return requested on'), '2026-06-01')
    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'refunded')
    await userEvent.type(screen.getByLabelText('Dropped off on'), '2026-06-03')
    await userEvent.click(screen.getByLabelText(/never received it/i))
    await userEvent.type(screen.getByLabelText('Decided on'), '2026-06-19')
    await submit()

    const sent = vi.mocked(onSubmit).mock.calls[0][0]

    expect(sent.neverReceived).toBe(true)
    expect(sent).not.toHaveProperty('receivedDate')
  })

  it('drops a reception typed before the loss was declared', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.clear(screen.getByLabelText('Return requested on'))
    await userEvent.type(screen.getByLabelText('Return requested on'), '2026-06-01')
    await userEvent.selectOptions(screen.getByLabelText(/where is it already/i), 'refunded')
    await userEvent.type(screen.getByLabelText('Dropped off on'), '2026-06-03')
    await userEvent.type(screen.getByLabelText('Received on'), '2026-06-05')
    await userEvent.click(screen.getByLabelText(/never received it/i))
    await userEvent.type(screen.getByLabelText('Decided on'), '2026-06-19')
    await submit()

    expect(vi.mocked(onSubmit).mock.calls[0][0]).not.toHaveProperty('receivedDate')
  })
})

describe('the store suggestions', () => {
  it('fills the name of the store that was picked', async () => {
    vi.mocked(searchStores).mockResolvedValue([
      { name: 'Zalando', supportEmail: 'service@zalando.be' },
    ])

    renderDialog()
    await userEvent.click(screen.getByLabelText('Store'))
    await userEvent.click(await screen.findByRole('option', { name: 'Zalando' }))

    expect(screen.getByLabelText('Store')).toHaveValue('Zalando')
  })

  it('never asks for the address here, since the store already owns it', () => {
    renderDialog()

    expect(screen.queryByLabelText(/customer service email/i)).not.toBeInTheDocument()
  })

  it('offers to add a store that does not exist yet', async () => {
    renderDialog()

    await userEvent.type(screen.getByLabelText('Store'), 'Brand new shop')
    await userEvent.click(screen.getByRole('button', { name: /add a store/i }))

    expect(screen.getByRole('heading', { name: /add a store/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Brand new shop')
  })

  it('picks the store it just added, so the form carries on', async () => {
    vi.mocked(addStore).mockResolvedValue({ name: 'Brand new shop', supportEmail: 'a@b.test' })

    renderDialog()
    await userEvent.type(screen.getByLabelText('Store'), 'Brand new shop')
    await userEvent.click(screen.getByRole('button', { name: /add a store/i }))
    await userEvent.type(screen.getByLabelText(/customer service email/i), 'a@b.test')
    await userEvent.click(screen.getByRole('button', { name: /add the store/i }))

    expect(await screen.findByLabelText('Store')).toHaveValue('Brand new shop')
  })

  it('comes back to the form when the store is not added after all', async () => {
    renderDialog()
    await userEvent.type(screen.getByLabelText('Store'), 'Brand new shop')
    await userEvent.click(screen.getByRole('button', { name: /add a store/i }))

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.getByRole('heading', { name: /track a return/i })).toBeInTheDocument()
  })
})

describe('while it saves', () => {
  it('cannot be submitted twice', () => {
    renderDialog(true)

    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('backs out on cancel', async () => {
    const { onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledOnce()
  })
})
