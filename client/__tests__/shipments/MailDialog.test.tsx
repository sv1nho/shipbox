import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../auth/client.js', () => ({ useSession: vi.fn() }))

import { MailDialog } from '../../shipments/MailDialog.js'
import { useSession } from '../../auth/client.js'
import { makeShipment } from '../fixtures.js'
import type { ShipmentDto } from '../../../shared/shipment.js'

const renderDialog = (overrides: Partial<ShipmentDto> = {}) => {
  const onClose = vi.fn()
  const shipment = makeShipment({
    status: 'received',
    store: 'Zalando',
    storeSupportEmail: 'service@zalando.be',
    needsAction: true,
    orderNumber: '402-118843',
    dropoffDate: '2026-08-12',
    receivedDate: '2026-08-18',
    daysLeft: -6,
    ...overrides,
  })

  render(<MailDialog shipment={shipment} onClose={onClose} />)

  return { onClose, shipment }
}

const body = () => screen.getByLabelText<HTMLTextAreaElement>('Message').value

const mailLink = () => screen.getByRole('link', { name: /open in my mail app/i })

const pick = async (language: string) => {
  await userEvent.click(screen.getByRole('button', { name: language }))
}

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: 'u1', name: 'Alex Dupont' } },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>)
})

describe('what it opens on', () => {
  it('names the store being chased', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: 'Chase Zalando' })).toBeInTheDocument()
  })

  it('starts in french, the language of the stores being written to', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: 'French' })).toHaveAttribute('aria-pressed', 'true')
    expect(body()).toContain('Bonjour,')
  })

  it('shows the address the mail will go to', () => {
    renderDialog()

    expect(screen.getByText('To service@zalando.be')).toBeInTheDocument()
  })

  it('signs with the name the session knows', () => {
    renderDialog()

    expect(body()).toContain('Alex Dupont')
  })
})

describe('the language choice', () => {
  it('rewrites the message without closing the dialog', async () => {
    renderDialog()

    await pick('English')

    expect(body()).toContain('Hello,')
    expect(screen.getByLabelText('Subject')).toHaveValue('About the return of order 402-118843')
  })

  it('goes back to french, nothing being lost either way', async () => {
    renderDialog()

    await pick('English')
    await pick('French')

    expect(body()).toContain('Bonjour,')
  })
})

describe('handing the message to the mail client', () => {
  it('addresses the store, with the message already written', () => {
    renderDialog()

    const href = mailLink().getAttribute('href') ?? ''

    expect(href.startsWith('mailto:service@zalando.be?')).toBe(true)
    expect(href).toContain('subject=Concernant')
  })

  it('says the store has no address rather than opening an empty draft silently', () => {
    renderDialog({ storeSupportEmail: null })

    expect(screen.getByText(/no address on file for Zalando/i)).toBeInTheDocument()
    expect(screen.queryByText(/^To /)).not.toBeInTheDocument()
  })

  it('still offers the message, which can be pasted anywhere', () => {
    renderDialog({ storeSupportEmail: null })

    expect(mailLink()).toBeInTheDocument()
  })
})

describe('leaving', () => {
  it('closes on the close button', async () => {
    const { onClose } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes once the mail app has been handed the message', async () => {
    const { onClose } = renderDialog()

    await userEvent.click(mailLink())

    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('when nobody is signed in', () => {
  it('writes the message unsigned rather than crashing', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof useSession>)

    renderDialog()

    expect(body()).toContain('Merci.\n\nNuméro de suivi')
  })
})
