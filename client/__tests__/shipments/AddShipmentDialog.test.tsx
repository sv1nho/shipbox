import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../api/shipments.js', () => ({ searchStores: vi.fn() }))

import { AddShipmentDialog } from '../../shipments/AddShipmentDialog.js'
import { searchStores } from '../../api/shipments.js'
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
    await submit()

    expect(onSubmit).toHaveBeenCalledOnce()
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
    await submit()

    expect(onSubmit).toHaveBeenCalledWith({
      trackingNumber: '323200000000000000004050',
      carrier: 'bpost',
      recipientPostalCode: '2000',
      recipientCountry: 'BE',
      amountCents: 4999,
      store: 'Zalando',
      requestedDate: today(),
    })
  })

  it('leaves out the fields the user did not fill, rather than sending blanks', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await submit()

    const sent = vi.mocked(onSubmit).mock.calls[0][0]

    expect(sent).not.toHaveProperty('orderNumber')
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

  it('sends the customer service address given for the store', async () => {
    const { onSubmit } = renderDialog()

    await fillTheRequired()
    await userEvent.type(screen.getByLabelText(/customer service email/i), '  service@zalando.be ')
    await submit()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      storeSupportEmail: 'service@zalando.be',
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
    await userEvent.type(screen.getByLabelText(/order number/i), ' ORD-1 ')
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

describe('the store suggestions', () => {
  it('fills the address of a store that already has one', async () => {
    vi.mocked(searchStores).mockResolvedValue([
      { name: 'Zalando', supportEmail: 'service@zalando.be' },
    ])

    renderDialog()
    await userEvent.click(screen.getByLabelText('Store'))
    await userEvent.click(await screen.findByRole('option', { name: /zalando/i }))

    expect(screen.getByLabelText('Store')).toHaveValue('Zalando')
    expect(screen.getByLabelText(/customer service email/i)).toHaveValue('service@zalando.be')
  })

  it('leaves the address empty for a store that has none', async () => {
    vi.mocked(searchStores).mockResolvedValue([{ name: 'Snipes', supportEmail: null }])

    renderDialog()
    await userEvent.click(screen.getByLabelText('Store'))
    await userEvent.click(await screen.findByRole('option', { name: 'Snipes' }))

    expect(screen.getByLabelText(/customer service email/i)).toHaveValue('')
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
