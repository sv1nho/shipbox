import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('../../api/dashboard.js', () => ({ getDashboard: vi.fn() }))

import { Dashboard } from '../../pages/Dashboard.js'
import { getDashboard } from '../../api/dashboard.js'
import { ApiError } from '../../api/client.js'
import type { DashboardSummary } from '../../../shared/dashboard.js'

const summary = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  decided: 25,
  refunded: 20,
  successRate: 0.8,
  open: 29,
  attention: 11,
  recoveredCents: 210600,
  lostCents: 65650,
  awaitingCents: 303720,
  measuredDecisions: 25,
  byStore: [{ store: 'Bol.com', returns: 5, decided: 2, refunded: 1, measured: 2, averageDecisionDays: 20.5 }],
  ...overrides,
})

const renderPage = () => render(<MemoryRouter><Dashboard /></MemoryRouter>)

beforeEach(() => {
  vi.mocked(getDashboard).mockResolvedValue(summary())
})

describe('the figure it leads with', () => {
  it('shows the refund rate as a whole percentage', async () => {
    renderPage()

    expect(await screen.findByText('80%')).toBeInTheDocument()
    expect(screen.getByText('20 of 25 returns the stores decided on.')).toBeInTheDocument()
  })

  it('rounds rather than showing a long fraction', async () => {
    vi.mocked(getDashboard).mockResolvedValue(summary({ decided: 3, refunded: 2, successRate: 2 / 3 }))

    renderPage()

    expect(await screen.findByText('67%')).toBeInTheDocument()
  })

  it('claims no rate at all before the first decision', async () => {
    vi.mocked(getDashboard)
      .mockResolvedValue(summary({ decided: 0, refunded: 0, successRate: null }))

    renderPage()

    expect(await screen.findByText('—')).toBeInTheDocument()
    expect(screen.getByText('No decision recorded yet.')).toBeInTheDocument()
  })

  it('counts a single decided return without saying 1 returns', async () => {
    vi.mocked(getDashboard)
      .mockResolvedValue(summary({ decided: 1, refunded: 1, successRate: 1 }))

    renderPage()

    expect(await screen.findByText('1 of 1 return the stores decided on.')).toBeInTheDocument()
  })
})

describe('the money', () => {
  it('splits what came back from what did not, and what is still out there', async () => {
    renderPage()

    expect(await screen.findByText('€2,106.00')).toBeInTheDocument()
    expect(screen.getByText('€656.50')).toBeInTheDocument()
    expect(screen.getByText('€3,037.20')).toBeInTheDocument()
  })

  it('counts the refused returns as what is left of the decided ones', async () => {
    renderPage()

    expect(await screen.findByText('5 returns refused')).toBeInTheDocument()
  })
})

describe('every tile opens the returns it counted', () => {
  it.each([
    ['Recovered', '/shipments?status=refunded&archived=include'],
    ['Lost', '/shipments?status=rejected&archived=include'],
    ['Not decided yet', '/shipments?status=open&archived=include'],
    ['Needs attention', '/shipments?attention=1'],
  ])('sends %s to %s', async (label, href) => {
    renderPage()

    expect(await screen.findByRole('link', { name: new RegExp(label, 'i') }))
      .toHaveAttribute('href', href)
  })

  it('keeps the archived returns in the three historical tiles, which counted them', async () => {
    renderPage()

    for (const label of ['Recovered', 'Lost', 'Not decided yet']) {
      expect(await screen.findByRole('link', { name: new RegExp(label, 'i') }))
        .toHaveAttribute('href', expect.stringContaining('archived=include'))
    }
  })

  it('leaves them out of the attention tile, which never counted them', async () => {
    renderPage()

    expect(await screen.findByRole('link', { name: /needs attention/i }))
      .toHaveAttribute('href', expect.not.stringContaining('archived'))
  })
})

describe('what needs doing', () => {
  it('carries the count into the link, so the tile is not a bare label', async () => {
    renderPage()

    expect(await screen.findByRole('link', { name: /needs attention/i })).toHaveTextContent('11')
  })

  it('says there is nothing to do rather than inviting a pointless click', async () => {
    vi.mocked(getDashboard).mockResolvedValue(summary({ attention: 0 }))

    renderPage()

    expect(await screen.findByText('Nothing to chase today')).toBeInTheDocument()
  })
})

describe('while it loads, and when it cannot', () => {
  it('spins and says it is counting rather than showing empty figures', () => {
    const { container } = renderPage()

    expect(screen.getByText(/counting your returns/i)).toBeInTheDocument()
    expect(container.querySelector('.pending-note svg')).toBeInTheDocument()
  })

  it('treats an aborted request as nothing, not as a dashboard that failed', async () => {
    vi.mocked(getDashboard).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const { container } = renderPage()

    await waitFor(() => { expect(getDashboard).toHaveBeenCalled() })

    expect(screen.queryByText(/could not be reached/i)).not.toBeInTheDocument()
    expect(container.querySelector('.pending-note')).toBeInTheDocument()
  })

  it('reports what went wrong instead of an empty dashboard', async () => {
    vi.mocked(getDashboard)
      .mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'Internal server error.', null))

    renderPage()

    expect(await screen.findByText('Internal server error.')).toBeInTheDocument()
    expect(screen.queryByText(/counting your returns/i)).not.toBeInTheDocument()
  })
})
