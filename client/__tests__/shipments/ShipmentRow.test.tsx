import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShipmentRow } from '../../shipments/ShipmentRow.js'
import type { RowHandlers } from '../../shipments/ShipmentRow.js'
import { makeShipment } from '../fixtures.js'
import { SHIPMENT_STATUSES } from '../../../shared/shipment-status.js'
import { menuSteps, nextStep } from '../../../shared/transitions.js'
import type { ShipmentDto } from '../../../shared/shipment.js'

const handlers = (): RowHandlers => ({
  onTransition: vi.fn(),
  onRevert: vi.fn(),
  onArchive: vi.fn(),
  onUnarchive: vi.fn(),
  onDelete: vi.fn(),
  onDownloadLabel: vi.fn(),
  onShowDetails: vi.fn(),
  onToggleMenu: vi.fn(),
})

const renderRow = (overrides: Partial<ShipmentDto> = {}) => {
  const shipment = makeShipment(overrides)
  const spies = handlers()

  const Harness = () => {
    const [open, setOpen] = useState(false)

    return (
      <ShipmentRow
        shipment={shipment}
        menuOpen={open}
        handlers={{
          ...spies,
          onToggleMenu: (target) => { spies.onToggleMenu(target); setOpen(!open) },
        }}
      />
    )
  }

  render(<Harness />)

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

describe('the date the row shows', () => {
  it('dates a pending shipment by the day it was added, never leaving the column empty', () => {
    renderRow({ status: 'pending', createdAt: '2026-06-01T10:00:00.000Z' })

    expect(screen.getByText('Added 01/06/2026')).toBeInTheDocument()
  })

  it.each([
    ['dropped_off', 'Dropped off 03/06/2026'],
    ['received', 'Received 05/06/2026'],
    ['refunded', 'Decided 09/06/2026'],
  ] as const)('dates a %s shipment by the step it reached', (status, expected) => {
    renderRow({ status, dropoffDate: '2026-06-03', receivedDate: '2026-06-05', decisionDate: '2026-06-09' })

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it.each([
    ['pending', { daysSinceCreated: 4 }, 'Waiting 4 days'],
    ['dropped_off', { daysSinceDropoff: 5 }, 'Waiting 5 days'],
    ['received', { daysSinceReceived: 12 }, 'Waiting 12 days'],
    ['refunded', { decisionDelayDays: 6 }, 'Took 6 days'],
  ] as const)('counts what the %s status is waiting on', (status, fields, expected) => {
    renderRow({ status, decisionDate: '2026-06-09', ...fields })

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('shows no dash when the figure cannot be derived', () => {
    renderRow({ status: 'refunded', decisionDate: '2026-06-09', decisionDelayDays: null })

    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })
})

describe('the information button', () => {
  it('is offered on every row, whatever the status', () => {
    renderRow({ status: 'refunded', decisionDate: '2026-06-09', archivedAt: '2026-06-10T00:00:00.000Z' })

    expect(screen.getByRole('button', { name: /details for 323200000000000000000001/i })).toBeInTheDocument()
  })

  it('hands the shipment to the page rather than opening anything itself', async () => {
    const { shipment, spies } = renderRow()

    await userEvent.click(screen.getByRole('button', { name: /details for/i }))

    expect(spies.onShowDetails).toHaveBeenCalledWith(shipment)
  })

  it('stays apart from the warning, which describes and never acts', () => {
    renderRow({ status: 'received', needsAction: true, daysSinceReceived: 21 })

    expect(screen.getByRole('img', { name: /needs attention/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /details for/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /needs attention/i })).not.toBeInTheDocument()
  })
})

describe('the chained action button', () => {
  it.each(SHIPMENT_STATUSES)('offers one button, and only one, after %s', (status) => {
    renderRow({ status })

    const step = nextStep(status)
    const offered = SHIPMENT_STATUSES
      .map((candidate) => nextStep(candidate)?.label)
      .filter((label) => label !== undefined)
      .filter((label) => screen.queryByRole('button', { name: label }) !== null)

    expect(offered).toEqual(step === null ? [] : [step.label])
  })

  it('names the step to take, not the state it lands in', () => {
    renderRow({ status: 'pending' })

    expect(screen.getByRole('button', { name: 'Drop off' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dropped off' })).not.toBeInTheDocument()
  })

  it('hands over every outcome the step allows, so the prompt can ask', async () => {
    const { shipment, spies } = renderRow({ status: 'received', receivedDate: '2026-06-02' })

    await userEvent.click(screen.getByRole('button', { name: 'Decide' }))

    expect(spies.onTransition).toHaveBeenCalledWith(shipment, ['refund', 'reject'])
  })

  it('asks the page to run the transition when clicked', async () => {
    const { shipment, spies } = renderRow({ status: 'pending' })

    await userEvent.click(screen.getByRole('button', { name: 'Drop off' }))

    expect(spies.onTransition).toHaveBeenCalledWith(shipment, ['drop_off'])
  })

  it('hides the chained button on an archived shipment', () => {
    renderRow({ status: 'pending', archivedAt: '2026-06-05T00:00:00.000Z' })

    expect(screen.queryByRole('button', { name: 'Drop off' })).not.toBeInTheDocument()
  })
})

describe('the alert', () => {
  it.each([
    ['the store is sitting on the parcel', { status: 'received', needsAction: true, daysSinceReceived: 21 }],
    ['the parcel was never dropped off', { shouldDropOff: true, daysSinceCreated: 9 }],
  ] as [string, Partial<ShipmentDto>][])('flags the count when %s', (_case, overrides) => {
    renderRow(overrides)

    expect(screen.getByRole('img', { name: /needs attention/i })).toBeInTheDocument()
  })

  it('carries no tooltip, since the panel holds the explanation', () => {
    renderRow({ status: 'received', needsAction: true, daysSinceReceived: 21 })

    expect(screen.getByRole('img', { name: /needs attention/i })).not.toHaveAttribute('title')
  })

  it('shows nothing when there is nothing to flag', () => {
    renderRow()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('the extra menu', () => {
  it('leaves the page to decide which menu is open', async () => {
    const { shipment, spies } = renderRow()

    await openMenu()

    expect(spies.onToggleMenu).toHaveBeenCalledWith(shipment)
  })

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

  it('offers the skipped steps, never the one already on the row', async () => {
    renderRow({ status: 'pending' })
    await openMenu()

    expect(screen.queryByRole('menuitem', { name: /record drop off directly/i })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /record received directly/i })).toBeInTheDocument()
  })

  it('folds the two decisions into one entry, which opens the same choice', async () => {
    const { shipment, spies } = renderRow({ status: 'dropped_off', dropoffDate: '2026-06-01' })
    await openMenu()

    expect(screen.queryByRole('menuitem', { name: /record refunded directly/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /record rejected directly/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('menuitem', { name: /record decision directly/i }))

    expect(spies.onTransition).toHaveBeenCalledWith(shipment, ['refund', 'reject'])
  })

  it('keeps a lone decision named after itself', async () => {
    renderRow({ status: 'refunded', decisionDate: '2026-06-03' })
    await openMenu()

    expect(screen.getByRole('menuitem', { name: /record rejected directly/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /record decision directly/i })).not.toBeInTheDocument()
  })

  it.each(SHIPMENT_STATUSES)('offers from %s exactly what the api would accept', async (status) => {
    renderRow({ status, dropoffDate: '2026-06-01', receivedDate: '2026-06-02', decisionDate: '2026-06-03' })
    await openMenu()

    for (const entry of menuSteps(status)) {
      expect(screen.getByRole('menuitem', { name: new RegExp(`record ${entry.label} directly`, 'i') }))
        .toBeInTheDocument()
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
})
