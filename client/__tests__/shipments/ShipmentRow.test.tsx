import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShipmentRow } from '../../shipments/ShipmentRow.js'
import type { RowHandlers } from '../../shipments/ShipmentRow.js'
import { makeShipment } from '../fixtures.js'
import { SHIPMENT_STATUSES } from '../../../shared/shipment-status.js'
import { TRANSITIONS, allowedActions, nextActions } from '../../../shared/transitions.js'
import type { ShipmentDto } from '../../../shared/shipment.js'

const handlers = (): RowHandlers => ({
  onTransition: vi.fn(),
  onRevert: vi.fn(),
  onArchive: vi.fn(),
  onUnarchive: vi.fn(),
  onDelete: vi.fn(),
  onDownloadLabel: vi.fn(),
})

const renderRow = (overrides: Partial<ShipmentDto> = {}) => {
  const shipment = makeShipment(overrides)
  const spies = handlers()
  render(<ShipmentRow shipment={shipment} handlers={spies} />)
  return { shipment, spies }
}

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: /more actions/i }))
}

describe('what the row shows', () => {
  it('shows the store, the amount and the tracking number', () => {
    renderRow({ store: 'Decathlon', amountCents: 12500 })

    expect(screen.getByText('Decathlon')).toBeInTheDocument()
    expect(screen.getByText('€125.00')).toBeInTheDocument()
    expect(screen.getByText('323200000000000000000001')).toBeInTheDocument()
  })

  it('links the tracking number to the carrier, in a new tab', () => {
    renderRow()
    const link = screen.getByRole('link', { name: '323200000000000000000001' })

    expect(link).toHaveAttribute('href', expect.stringContaining('track.bpost.cloud'))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it.each(SHIPMENT_STATUSES)('names the %s status in words', (status) => {
    renderRow({ status, dropoffDate: '2026-06-01', receivedDate: '2026-06-02', decisionDate: '2026-06-03' })

    expect(screen.queryByText(status)).not.toBeInTheDocument()
  })
})

describe('the chained action button', () => {
  it.each(SHIPMENT_STATUSES)('offers exactly what comes next after %s', (status) => {
    renderRow({ status })

    for (const action of nextActions(status)) {
      expect(screen.getByRole('button', { name: TRANSITIONS[action].label })).toBeInTheDocument()
    }
  })

  it.each(['refunded', 'rejected'] as const)('offers nothing once %s', (status) => {
    renderRow({ status, decisionDate: '2026-06-03' })

    for (const action of Object.values(TRANSITIONS)) {
      expect(screen.queryByRole('button', { name: action.label })).not.toBeInTheDocument()
    }
  })

  it('asks the page to run the transition when clicked', async () => {
    const { shipment, spies } = renderRow({ status: 'pending' })

    await userEvent.click(screen.getByRole('button', { name: 'Dropped off' }))

    expect(spies.onTransition).toHaveBeenCalledWith(shipment, 'drop_off')
  })

  it('offers both decisions when the parcel has arrived', () => {
    renderRow({ status: 'received', receivedDate: '2026-06-02' })

    expect(screen.getByRole('button', { name: 'Refunded' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejected' })).toBeInTheDocument()
  })

  it('hides the chained buttons on an archived shipment', () => {
    renderRow({ status: 'pending', archivedAt: '2026-06-05T00:00:00.000Z' })

    expect(screen.queryByRole('button', { name: 'Dropped off' })).not.toBeInTheDocument()
  })
})

describe('the alert', () => {
  it('shows a described icon when the store is sitting on the parcel', () => {
    renderRow({ status: 'received', needsAction: true, daysSinceReceived: 21 })

    expect(screen.getByRole('img', { name: /21 working days/ })).toBeInTheDocument()
  })

  it('shows a described icon when the parcel was never dropped off', () => {
    renderRow({ shouldDropOff: true, daysSinceCreated: 9 })

    expect(screen.getByRole('img', { name: /dropped off/ })).toBeInTheDocument()
  })

  it('shows nothing when there is nothing to flag', () => {
    renderRow()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('the extra menu', () => {
  it('stays closed until asked', () => {
    renderRow()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens and announces that it is open', async () => {
    renderRow()
    await openMenu()

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more actions/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('offers the skipped transitions, never the one already on the row', async () => {
    renderRow({ status: 'pending' })
    await openMenu()

    expect(screen.queryByRole('menuitem', { name: /record dropped off directly/i })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /record refunded directly/i })).toBeInTheDocument()
  })

  it.each(SHIPMENT_STATUSES)('never offers from %s an action the api would refuse', async (status) => {
    renderRow({ status, dropoffDate: '2026-06-01', receivedDate: '2026-06-02', decisionDate: '2026-06-03' })
    await openMenu()

    const refused = Object.entries(TRANSITIONS)
      .filter(([action]) => !allowedActions(status).includes(action as keyof typeof TRANSITIONS))
      .map(([, config]) => config.label.toLowerCase())

    for (const label of refused) {
      expect(screen.queryByRole('menuitem', { name: new RegExp(`record ${label} directly`, 'i') }))
        .not.toBeInTheDocument()
    }
  })

  it('offers to undo except on a pending shipment', async () => {
    renderRow({ status: 'dropped_off', dropoffDate: '2026-06-01' })
    await openMenu()

    expect(screen.getByRole('menuitem', { name: /undo the last step/i })).toBeInTheDocument()
  })

  it('does not offer to undo a pending shipment, which has no step to undo', async () => {
    renderRow({ status: 'pending' })
    await openMenu()

    expect(screen.queryByRole('menuitem', { name: /undo the last step/i })).not.toBeInTheDocument()
  })

  it('offers the label only when there is one to regenerate', async () => {
    renderRow({ hasLabel: true })
    await openMenu()

    expect(screen.getByRole('menuitem', { name: /download the label again/i })).toBeInTheDocument()
  })

  it('hides the label entry when the shipment was added by hand', async () => {
    renderRow({ hasLabel: false })
    await openMenu()

    expect(screen.queryByRole('menuitem', { name: /download the label again/i })).not.toBeInTheDocument()
  })

  it.each([
    [null, /^archive$/i, 'onArchive'],
    ['2026-06-05T00:00:00.000Z', /put back in the list/i, 'onUnarchive'],
  ] as const)('offers the right archive action when archivedAt is %s', async (archivedAt, name, handler) => {
    const { shipment, spies } = renderRow({ archivedAt })
    await openMenu()

    await userEvent.click(screen.getByRole('menuitem', { name }))

    expect(spies[handler]).toHaveBeenCalledWith(shipment)
  })

  it('always offers the permanent delete', async () => {
    const { shipment, spies } = renderRow()
    await openMenu()

    await userEvent.click(screen.getByRole('menuitem', { name: /delete for good/i }))

    expect(spies.onDelete).toHaveBeenCalledWith(shipment)
  })

  it('closes once an entry is chosen', async () => {
    renderRow({ hasLabel: true })
    await openMenu()

    await userEvent.click(screen.getByRole('menuitem', { name: /download the label again/i }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
