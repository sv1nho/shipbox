import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

vi.mock('../../api/shipments.js', () => ({
  listShipments: vi.fn(),
  applyTransition: vi.fn(),
  archiveShipment: vi.fn(),
  unarchiveShipment: vi.fn(),
  revertShipment: vi.fn(),
  deleteShipment: vi.fn(),
  getLabelPayload: vi.fn(),
  updateShipment: vi.fn(),
  exportUrl: vi.fn(() => '/api/shipments/export?format=csv'),
}))

vi.mock('../../shipments/regenerate-label.js', () => ({ regenerateLabel: vi.fn() }))

import { Shipments } from '../../pages/Shipments.js'
import {
  applyTransition,
  archiveShipment,
  deleteShipment,
  getLabelPayload,
  listShipments,
  revertShipment,
  unarchiveShipment,
  updateShipment,
} from '../../api/shipments.js'
import { regenerateLabel } from '../../shipments/regenerate-label.js'
import { ApiError } from '../../api/client.js'
import { makeLabelPayload, makeShipment } from '../fixtures.js'
import { today } from '../../../shared/time.js'
import type { ListResult, ShipmentDto } from '../../../shared/shipment.js'

const listed = (items: ShipmentDto[], extra: Partial<ListResult> = {}): ListResult => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  ...extra,
})

const renderPage = (entry = '/shipments') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Shipments />
    </MemoryRouter>
  )

const lastQuery = () => vi.mocked(listShipments).mock.calls.at(-1)?.[0]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listShipments).mockResolvedValue(listed([makeShipment()]))
})

describe('loading the list', () => {
  it('asks the api for what the url describes, so a shared link opens the same view', async () => {
    renderPage('/shipments?status=received&carrier=postnl&page=2')

    await waitFor(() => {
      expect(lastQuery()).toMatchObject({ status: 'received', carrier: 'postnl', page: 2 })
    })
  })

  it('ignores a filter the api would reject', async () => {
    renderPage('/shipments?status=eaten_by_a_dog')

    await waitFor(() => { expect(listShipments).toHaveBeenCalled() })
    expect(lastQuery()?.status).toBeUndefined()
  })

  it('shows each shipment it got back', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([
        makeShipment({ id: 'a', store: 'Zalando', trackingNumber: '323200000000000000000001' }),
        makeShipment({ id: 'b', store: 'Decathlon', trackingNumber: '323200000000000000000002' }),
      ])
    )

    renderPage()

    expect(await screen.findByText('Zalando')).toBeInTheDocument()
    expect(screen.getByText('Decathlon')).toBeInTheDocument()
    expect(screen.getByText('2 shipments')).toBeInTheDocument()
  })

  it('counts a single shipment without saying 1 shipments', async () => {
    renderPage()

    expect(await screen.findByText('1 shipment')).toBeInTheDocument()
  })
})

describe('when there is nothing to show', () => {
  beforeEach(() => {
    vi.mocked(listShipments).mockResolvedValue(listed([], { total: 0 }))
  })

  it('invites the user to start tracking rather than showing a blank card', async () => {
    renderPage()

    expect(await screen.findByText(/not tracking any shipment yet/i)).toBeInTheDocument()
  })

  it('blames the filters when filters are the reason, and points at the way out', async () => {
    renderPage('/shipments?status=refunded')

    expect(await screen.findByText(/no shipment matches these filters/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('reloads without the filters once they are cleared', async () => {
    renderPage('/shipments?status=refunded')

    await userEvent.click(await screen.findByRole('button', { name: /clear filters/i }))

    await waitFor(() => { expect(lastQuery()?.status).toBeUndefined() })
  })
})

describe('when the list cannot be loaded', () => {
  it('says what went wrong and lets the user try again', async () => {
    vi.mocked(listShipments).mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL_ERROR', 'Internal server error.', null)
    )

    renderPage()

    expect(await screen.findByText('Internal server error.')).toBeInTheDocument()

    vi.mocked(listShipments).mockResolvedValue(listed([makeShipment({ store: 'Zalando' })]))
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Zalando')).toBeInTheDocument()
  })

  it('falls back to a connection message when the request never reached the api', async () => {
    vi.mocked(listShipments).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    renderPage()

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument()
  })
})

describe('paging', () => {
  it('hides the pager when everything fits on one page', async () => {
    renderPage()

    await screen.findByText('Zalando')

    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
  })

  it('shows where the user is once there is more than one page', async () => {
    vi.mocked(listShipments).mockResolvedValue(listed([makeShipment()], { total: 45, pageSize: 20 }))

    renderPage()

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  })

  it('asks for the next page and keeps the filters', async () => {
    vi.mocked(listShipments).mockResolvedValue(listed([makeShipment()], { total: 45, pageSize: 20 }))

    renderPage('/shipments?status=received')
    await screen.findByText('Page 1 of 3')

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => { expect(lastQuery()).toMatchObject({ page: 2, status: 'received' }) })
  })

  it('walks back to the previous page', async () => {
    vi.mocked(listShipments).mockResolvedValue(listed([makeShipment()], { total: 45, pageSize: 20, page: 2 }))

    renderPage('/shipments?page=2')
    await screen.findByText('Page 2 of 3')

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))

    await waitFor(() => { expect(lastQuery()?.page).toBe(1) })
  })

  it('goes back to the first page when a filter changes', async () => {
    vi.mocked(listShipments).mockResolvedValue(listed([makeShipment()], { total: 45, pageSize: 20 }))

    renderPage('/shipments?page=3')
    await screen.findByText('Zalando')

    await userEvent.selectOptions(screen.getByLabelText('Carrier'), 'bpost')

    await waitFor(() => { expect(lastQuery()).toMatchObject({ page: 1, carrier: 'bpost' }) })
  })
})

describe('recording a step', () => {
  const openPrompt = async () => {
    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: 'Drop off' }))
  }

  it('asks for the day instead of assuming it', async () => {
    await openPrompt()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(applyTransition).not.toHaveBeenCalled()
  })

  it('records the day and refreshes the list', async () => {
    vi.mocked(applyTransition).mockResolvedValue(makeShipment({ status: 'dropped_off' }))

    await openPrompt()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(applyTransition).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        'drop_off',
        today(),
        undefined
      )
    })
    expect(listShipments).toHaveBeenCalledTimes(2)
  })

  it('closes the prompt once the step is saved', async () => {
    vi.mocked(applyTransition).mockResolvedValue(makeShipment({ status: 'dropped_off' }))

    await openPrompt()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
  })

  it('keeps the prompt open and explains why when the api refuses', async () => {
    vi.mocked(applyTransition).mockRejectedValue(
      new ApiError(422, 'INVALID_DATE', 'The drop-off date cannot be in the future.', null)
    )

    await openPrompt()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('The drop-off date cannot be in the future.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('leaves the shipment untouched when the prompt is dismissed', async () => {
    await openPrompt()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(applyTransition).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('never lets a step predate the day the return was requested', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([makeShipment({ status: 'pending', requestedDate: '2026-06-01' })])
    )

    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: 'Drop off' }))

    expect(screen.getByLabelText(/which day/i)).toHaveAttribute('min', '2026-06-01')
  })

  it('forbids a reception dated before the drop-off', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([makeShipment({ status: 'dropped_off', dropoffDate: '2026-06-10' })])
    )

    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: 'Receive' }))

    expect(screen.getByLabelText(/which day/i)).toHaveAttribute('min', '2026-06-10')
  })
})

describe('the other row actions', () => {
  const chooseFromMenu = async (name: RegExp) => {
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
    await userEvent.click(screen.getByRole('menuitem', { name }))
  }

  it('archives without asking, because archiving can be undone', async () => {
    vi.mocked(archiveShipment).mockResolvedValue(makeShipment())

    renderPage()
    await screen.findByText('Zalando')
    await chooseFromMenu(/^archive$/i)

    await waitFor(() => {
      expect(archiveShipment).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    })
    expect(listShipments).toHaveBeenCalledTimes(2)
  })

  it('puts an archived shipment back in the list', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([makeShipment({ archivedAt: '2026-06-05T00:00:00.000Z' })])
    )
    vi.mocked(unarchiveShipment).mockResolvedValue(makeShipment())

    renderPage('/shipments?archived=only')
    await screen.findByText('Zalando')
    await chooseFromMenu(/put back in the list/i)

    await waitFor(() => {
      expect(unarchiveShipment).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    })
  })

  it('records a skipped step straight from the menu', async () => {
    vi.mocked(applyTransition).mockResolvedValue(makeShipment({ status: 'refunded' }))

    renderPage()
    await screen.findByText('Zalando')
    await chooseFromMenu(/record the decision directly/i)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(applyTransition).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        'refund',
        today(),
        undefined
      )
    })
  })

  it('undoes the last step', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([makeShipment({ status: 'received', receivedDate: '2026-06-10' })])
    )
    vi.mocked(revertShipment).mockResolvedValue(makeShipment())

    renderPage()
    await screen.findByText('Zalando')
    await chooseFromMenu(/undo the last step/i)

    await waitFor(() => { expect(revertShipment).toHaveBeenCalled() })
  })

  it('reports a refused action in the page itself', async () => {
    vi.mocked(archiveShipment).mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'This shipment is already archived.', null)
    )

    renderPage()
    await screen.findByText('Zalando')
    await chooseFromMenu(/^archive$/i)

    expect(await screen.findByText('This shipment is already archived.')).toBeInTheDocument()
  })

  it('rebuilds the pdf from the stored payload', async () => {
    vi.mocked(listShipments).mockResolvedValue(listed([makeShipment({ hasLabel: true })]))
    const payload = makeLabelPayload()
    vi.mocked(getLabelPayload).mockResolvedValue({ payload, payloadVersion: 1 })

    renderPage()
    await screen.findByText('Zalando')
    await chooseFromMenu(/download the label again/i)

    await waitFor(() => { expect(regenerateLabel).toHaveBeenCalledWith(payload) })
  })
})

describe('the extra menu', () => {
  const rows = () => [
    makeShipment({ id: 'a', trackingNumber: '323200000000000000000001', hasLabel: true }),
    makeShipment({ id: 'b', trackingNumber: '323200000000000000000002' }),
  ]

  const openMenuOf = async (trackingNumber: string) => {
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`more actions for ${trackingNumber}`, 'i') }))
  }

  it('closes the menu already open when another row is opened', async () => {
    vi.mocked(listShipments).mockResolvedValue(listed(rows()))

    renderPage()
    await screen.findAllByText('Zalando')

    await openMenuOf('323200000000000000000001')
    await openMenuOf('323200000000000000000002')

    expect(screen.getAllByRole('menu')).toHaveLength(1)
  })

  it('closes on a second click of the same button', async () => {
    renderPage()
    await screen.findByText('Zalando')

    await openMenuOf('323200000000000000000001')
    await openMenuOf('323200000000000000000001')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes when the user clicks anywhere else', async () => {
    renderPage()
    await screen.findByText('Zalando')

    await openMenuOf('323200000000000000000001')
    await userEvent.click(screen.getByRole('searchbox'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes once an entry is chosen', async () => {
    vi.mocked(listShipments).mockResolvedValue(listed([makeShipment({ hasLabel: true })]))
    vi.mocked(getLabelPayload).mockResolvedValue({ payload: makeLabelPayload(), payloadVersion: 1 })

    renderPage()
    await screen.findByText('Zalando')

    await openMenuOf('323200000000000000000001')
    await userEvent.click(screen.getByRole('menuitem', { name: /download the label again/i }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('a decision that skips the reception', () => {
  it('records the reception first, so the store delay is never lost', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([makeShipment({ status: 'dropped_off', dropoffDate: '2026-06-03' })])
    )
    vi.mocked(applyTransition).mockResolvedValue(makeShipment({ status: 'refunded' }))

    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /record the decision directly/i }))

    const reception = screen.getByLabelText(/when did the store receive it/i)
    await userEvent.clear(reception)
    await userEvent.type(reception, '2026-06-05')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => { expect(applyTransition).toHaveBeenCalledTimes(2) })

    expect(vi.mocked(applyTransition).mock.calls[0]).toEqual([
      '11111111-1111-4111-8111-111111111111', 'receive', '2026-06-05',
    ])
    expect(vi.mocked(applyTransition).mock.calls[1]).toEqual([
      '11111111-1111-4111-8111-111111111111', 'refund', today(), undefined,
    ])
  })

  it('floors the reception at the request when there is no drop-off to floor it at', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([makeShipment({ status: 'pending', requestedDate: '2026-06-01' })])
    )

    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /record the decision directly/i }))

    expect(screen.getByLabelText(/when did the store receive it/i))
      .toHaveAttribute('min', '2026-06-01')
  })

  it('asks nothing extra when the reception is already recorded', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([makeShipment({ status: 'received', receivedDate: '2026-06-05' })])
    )

    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: 'Decide' }))

    expect(screen.queryByLabelText(/when did the store receive it/i)).not.toBeInTheDocument()
  })
})

describe('the details panel', () => {
  it('opens on the information button and shows what the row could not fit', async () => {
    vi.mocked(listShipments).mockResolvedValue(listed([makeShipment({ note: 'Bought on sale' })]))

    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: /details for/i }))

    expect(within(screen.getByRole('dialog')).getByText('Bought on sale')).toBeInTheDocument()
  })

  it('saves a corrected date and shows the shipment the api sent back', async () => {
    vi.mocked(listShipments).mockResolvedValue(
      listed([makeShipment({ status: 'refunded', requestedDate: '2026-06-01', decisionDate: '2026-06-09' })])
    )
    vi.mocked(updateShipment).mockResolvedValue(
      makeShipment({ status: 'refunded', decisionDate: '2026-06-09', receivedDate: '2026-06-05', decisionDelayDays: 2 })
    )

    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: /details for/i }))
    await userEvent.click(screen.getByRole('button', { name: /edit the dates/i }))
    await userEvent.type(screen.getByLabelText('Received'), '2026-06-05')
    await userEvent.click(screen.getByRole('button', { name: /save the dates/i }))

    await waitFor(() => {
      expect(updateShipment).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
        requestedDate: '2026-06-01',
        receivedDate: '2026-06-05',
        decisionDate: '2026-06-09',
      })
    })

    expect(await screen.findByText('2 days')).toBeInTheDocument()
    expect(listShipments).toHaveBeenCalledTimes(2)
  })

  it('keeps the panel open and explains when the api refuses the dates', async () => {
    vi.mocked(updateShipment).mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'receivedDate cannot be earlier than dropoffDate.', null)
    )

    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: /details for/i }))
    await userEvent.click(screen.getByRole('button', { name: /edit the dates/i }))
    await userEvent.click(screen.getByRole('button', { name: /save the dates/i }))

    expect(await screen.findByText('receivedDate cannot be earlier than dropoffDate.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('changes nothing, it only reads', async () => {
    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: /details for/i }))
    await userEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(listShipments).toHaveBeenCalledOnce()
  })
})

describe('deleting for good', () => {
  const openDialog = async () => {
    renderPage()
    await screen.findByText('Zalando')
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /delete for good/i }))
  }

  it('never deletes straight from the menu', async () => {
    await openDialog()

    expect(within(screen.getByRole('dialog')).getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(deleteShipment).not.toHaveBeenCalled()
  })

  it('deletes and refreshes once confirmed', async () => {
    vi.mocked(deleteShipment).mockResolvedValue(undefined)

    await openDialog()
    await userEvent.click(screen.getByRole('button', { name: /delete for good/i }))

    await waitFor(() => {
      expect(deleteShipment).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    })
    expect(listShipments).toHaveBeenCalledTimes(2)
  })

  it('leaves the shipment alone when the user backs out', async () => {
    await openDialog()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(deleteShipment).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
