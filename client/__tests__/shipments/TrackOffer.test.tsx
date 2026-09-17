import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

vi.mock('../../api/shipments.js', () => ({
  shipmentExists: vi.fn(),
  createShipment: vi.fn(),
  searchStores: vi.fn(),
}))

vi.mock('../../auth/client.js', () => ({ useSession: vi.fn() }))

import { TrackOffer } from '../../shipments/TrackOffer.js'
import { createShipment, searchStores, shipmentExists } from '../../api/shipments.js'
import { useSession } from '../../auth/client.js'
import { ApiError } from '../../api/client.js'
import { makeLabelPayload, makeShipment } from '../fixtures.js'

const signedIn = (yes: boolean) => {
  vi.mocked(useSession).mockReturnValue({
    data: yes ? { user: { id: 'u1' } } : null,
    isPending: false,
  } as unknown as ReturnType<typeof useSession>)
}

const renderOffer = (tracking = '323200000000000000004050') => {
  const onClose = vi.fn()
  const payload = makeLabelPayload({ tracking_number: tracking })

  render(
    <MemoryRouter>
      <TrackOffer payload={payload} onClose={onClose} />
    </MemoryRouter>
  )

  return { onClose, payload }
}

const addButton = () => screen.getByRole('button', { name: /add to tracking/i })

const openForm = async () => {
  await waitFor(() => { expect(addButton()).toBeEnabled() })
  await userEvent.click(addButton())
}

const fillAndSubmit = async () => {
  await userEvent.type(screen.getByLabelText('Store'), 'Zalando')
  await userEvent.type(screen.getByLabelText('Amount'), '49.99')
  await userEvent.type(screen.getByLabelText('Order number'), 'ZAL-2026-0001')
  await userEvent.click(screen.getByRole('button', { name: /track it/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  signedIn(true)
  vi.mocked(searchStores).mockResolvedValue([])
  vi.mocked(shipmentExists).mockResolvedValue({ exists: false })
})

describe('when nobody is signed in', () => {
  it('never asks the api, which would answer 401', async () => {
    signedIn(false)

    renderOffer()

    await waitFor(() => { expect(screen.getByRole('dialog')).toBeInTheDocument() })
    expect(shipmentExists).not.toHaveBeenCalled()
  })

  it('points at the sign in rather than showing an error', () => {
    signedIn(false)

    renderOffer()

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('button', { name: /add to tracking/i })).not.toBeInTheDocument()
  })
})

describe('when the parcel is not tracked yet', () => {
  it('asks the api with the real number, never the masked one', async () => {
    renderOffer('323200000000000000004050')

    await waitFor(() => {
      expect(shipmentExists).toHaveBeenCalledWith(
        'bpost',
        '323200000000000000004050',
        expect.anything()
      )
    })
  })

  it('waits for the answer before offering anything', () => {
    renderOffer()

    expect(addButton()).toBeDisabled()
  })

  it('opens the form already knowing what the label says', async () => {
    renderOffer()
    await openForm()

    expect(screen.getByLabelText('Tracking number')).toHaveValue('323200000000000000004050')
    expect(screen.getByLabelText('Postal code')).toHaveValue('4000')
    expect(screen.getByLabelText('Country')).toHaveValue('BE')
  })

  it('keeps the label with the shipment, so the pdf can be rebuilt', async () => {
    vi.mocked(createShipment).mockResolvedValue(makeShipment({ hasLabel: true }))

    const { payload } = renderOffer()
    await openForm()
    await fillAndSubmit()

    await waitFor(() => {
      expect(createShipment).toHaveBeenCalledWith(expect.objectContaining({
        label: { payload, payloadVersion: 1 },
      }))
    })
  })

  it('says it landed and points at the list', async () => {
    vi.mocked(createShipment).mockResolvedValue(makeShipment())

    renderOffer()
    await openForm()
    await fillAndSubmit()

    expect(await screen.findByRole('link', { name: /open the list/i }))
      .toHaveAttribute('href', '/shipments')
  })

  it('keeps the form open and names the field the api refused', async () => {
    vi.mocked(createShipment).mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'This tracking number is already registered.', [
        { path: 'trackingNumber', message: 'already used' },
      ])
    )

    renderOffer()
    await openForm()
    await fillAndSubmit()

    expect(await screen.findByText('already used')).toBeInTheDocument()
    expect(screen.getByLabelText('Store')).toBeInTheDocument()
  })

  it('reports a connection failure without blaming a field', async () => {
    vi.mocked(createShipment).mockRejectedValue(new TypeError('Failed to fetch'))

    renderOffer()
    await openForm()
    await fillAndSubmit()

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument()
  })

  it('backs out of the form without losing the offer', async () => {
    renderOffer()
    await openForm()

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(addButton()).toBeInTheDocument()
    expect(createShipment).not.toHaveBeenCalled()
  })
})

describe('when the window closes mid-check', () => {
  it.each(['an answer', 'a failure'])('drops %s that lands after it is gone', async (kind) => {
    let settle: (result: { exists: boolean }) => void = () => undefined
    let fail: (cause: Error) => void = () => undefined

    vi.mocked(shipmentExists).mockImplementation(
      () => new Promise((resolve, reject) => { settle = resolve; fail = reject })
    )

    const { unmount } = render(
      <MemoryRouter>
        <TrackOffer payload={makeLabelPayload()} onClose={vi.fn()} />
      </MemoryRouter>
    )

    await waitFor(() => { expect(shipmentExists).toHaveBeenCalledOnce() })
    unmount()

    if (kind === 'an answer') settle({ exists: true })
    else fail(new Error('gone'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('when the parcel is already tracked', () => {
  it('says so and links to it, rather than offering a duplicate', async () => {
    vi.mocked(shipmentExists).mockResolvedValue({ exists: true, id: 'abc', archived: false })

    renderOffer('323200000000000000004050')

    expect(await screen.findByText(/already track this parcel/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open it/i }))
      .toHaveAttribute('href', '/shipments?search=323200000000000000004050')
    expect(screen.queryByRole('button', { name: /add to tracking/i })).not.toBeInTheDocument()
  })
})

describe('when the check itself fails', () => {
  it('still offers to add it, rather than showing the failure', async () => {
    vi.mocked(shipmentExists).mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Not signed in.', null)
    )

    renderOffer()

    await waitFor(() => { expect(addButton()).toBeEnabled() })
    expect(screen.queryByText(/Not signed in/)).not.toBeInTheDocument()
  })
})

describe('backing out', () => {
  it('closes without tracking anything', async () => {
    const { onClose } = renderOffer()

    await userEvent.click(screen.getByRole('button', { name: /not now/i }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(createShipment).not.toHaveBeenCalled()
  })
})
