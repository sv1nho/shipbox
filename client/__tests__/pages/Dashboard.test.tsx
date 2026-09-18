import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  byStore: [{ store: 'Bol.com', returns: 5, measured: 2, averageDecisionDays: 20.5 }],
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

describe('what needs doing', () => {
  it('links straight into the filtered list rather than only counting', async () => {
    renderPage()

    const link = await screen.findByRole('link', { name: /needs attention/i })

    expect(link).toHaveAttribute('href', '/shipments?attention=1')
    expect(link).toHaveTextContent('11')
  })

  it('says there is nothing to do rather than inviting a pointless click', async () => {
    vi.mocked(getDashboard).mockResolvedValue(summary({ attention: 0 }))

    renderPage()

    expect(await screen.findByText('Nothing to chase today')).toBeInTheDocument()
  })
})

describe('while it loads, and when it cannot', () => {
  it('says it is counting rather than showing empty figures', () => {
    renderPage()

    expect(screen.getByText(/counting your returns/i)).toBeInTheDocument()
  })

  it('reports what went wrong instead of an empty dashboard', async () => {
    vi.mocked(getDashboard)
      .mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'Internal server error.', null))

    renderPage()

    expect(await screen.findByText('Internal server error.')).toBeInTheDocument()
    expect(screen.queryByText(/counting your returns/i)).not.toBeInTheDocument()
  })
})
