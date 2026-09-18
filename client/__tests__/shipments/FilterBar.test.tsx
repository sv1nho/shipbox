import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../api/shipments.js', () => ({
  searchStores: vi.fn(),
  exportUrl: vi.fn((_filters: unknown, format: string) => `/api/shipments/export?format=${format}`),
}))

import { FilterBar } from '../../shipments/FilterBar.js'
import { exportUrl, searchStores } from '../../api/shipments.js'
import { DEFAULT_FILTERS } from '../../shipments/filters.js'
import type { ListParams } from '../../../shared/shipment.js'

const renderBar = (filters: ListParams = DEFAULT_FILTERS, attentionTotal = 0) => {
  const onChange = vi.fn()
  render(<FilterBar filters={filters} attentionTotal={attentionTotal} onChange={onChange} />)
  return { onChange }
}

const storeOptions = async () => {
  await waitFor(() => { expect(searchStores).toHaveBeenCalled() })

  return screen.getByLabelText('Store')
}

beforeEach(() => {
  vi.mocked(searchStores).mockResolvedValue([
    { name: 'Zara', supportEmail: null },
    { name: 'Decathlon', supportEmail: 'contact@decathlon.be' },
  ])
})

describe('what the bar shows', () => {
  it('reflects the filters already in the url', () => {
    renderBar({ ...DEFAULT_FILTERS, carrier: 'postnl', status: 'received', search: 'Zalando' })

    expect(screen.getByLabelText('Carrier')).toHaveValue('postnl')
    expect(screen.getByLabelText('Status')).toHaveValue('received')
    expect(screen.getByRole('searchbox')).toHaveValue('Zalando')
  })

  it('falls back to the defaults when the url carries nothing', () => {
    renderBar({})

    expect(screen.getByLabelText('Carrier')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Sort by')).toHaveValue(DEFAULT_FILTERS.sort)
    expect(screen.getByRole('button', { name: 'Descending' })).toBeInTheDocument()
  })

  it('names the statuses in words, never with the raw database value', () => {
    renderBar()

    expect(screen.getByRole('option', { name: 'Dropped off' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'dropped_off' })).not.toBeInTheDocument()
  })
})

describe('changing a filter', () => {
  it('reports the carrier that was picked', async () => {
    const { onChange } = renderBar()

    await userEvent.selectOptions(screen.getByLabelText('Carrier'), 'bpost')

    expect(onChange).toHaveBeenCalledWith({ carrier: 'bpost' })
  })

  it('clears the carrier when all carriers is picked back', async () => {
    const { onChange } = renderBar({ ...DEFAULT_FILTERS, carrier: 'bpost' })

    await userEvent.selectOptions(screen.getByLabelText('Carrier'), '')

    expect(onChange).toHaveBeenCalledWith({ carrier: undefined })
  })

  it('reports the status that was picked', async () => {
    const { onChange } = renderBar()

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'refunded')

    expect(onChange).toHaveBeenCalledWith({ status: 'refunded' })
  })

  it('clears the status when all statuses is picked back', async () => {
    const { onChange } = renderBar({ ...DEFAULT_FILTERS, status: 'refunded' })

    await userEvent.selectOptions(screen.getByLabelText('Status'), '')

    expect(onChange).toHaveBeenCalledWith({ status: undefined })
  })

  it('offers the returns still open as one choice, above the five states', async () => {
    const { onChange } = renderBar()

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'open')

    expect(screen.getByRole('option', { name: 'Not decided yet' })).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith({ status: 'open' })
  })

  it('reports the sort key', async () => {
    const { onChange } = renderBar()

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'amountCents')

    expect(onChange).toHaveBeenCalledWith({ sort: 'amountCents' })
  })

  it.each([
    ['Archived', 'only'],
    ['All', 'include'],
  ] as const)('switches to the %s view in a single click', async (name, archived) => {
    const { onChange } = renderBar()

    await userEvent.click(screen.getByRole('button', { name }))

    expect(onChange).toHaveBeenCalledWith({ archived })
  })

  it('shows which archive view is on without opening anything', () => {
    renderBar({ ...DEFAULT_FILTERS, archived: 'only' })

    expect(screen.getByRole('button', { name: 'Archived' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('flips the direction on the toggle', async () => {
    const { onChange } = renderBar()

    await userEvent.click(screen.getByRole('button', { name: 'Descending' }))

    expect(onChange).toHaveBeenCalledWith({ direction: 'asc' })
  })

  it('flips it back, and says which way it is sorting', async () => {
    const { onChange } = renderBar({ ...DEFAULT_FILTERS, direction: 'asc' })

    await userEvent.click(screen.getByRole('button', { name: 'Ascending' }))

    expect(onChange).toHaveBeenCalledWith({ direction: 'desc' })
  })
})

describe('the search box', () => {
  it('waits for the submit rather than querying on every keystroke', async () => {
    const { onChange } = renderBar()

    await userEvent.type(screen.getByRole('searchbox'), 'Deca')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('sends the trimmed term on submit', async () => {
    const { onChange } = renderBar()

    await userEvent.type(screen.getByRole('searchbox'), '  Decathlon  ')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(onChange).toHaveBeenCalledWith({ search: 'Decathlon' })
  })

  it('follows the url when the term is changed elsewhere, such as the back button', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<FilterBar filters={DEFAULT_FILTERS} attentionTotal={0} onChange={onChange} />)

    await userEvent.type(screen.getByRole('searchbox'), 'half typed')
    rerender(<FilterBar filters={{ ...DEFAULT_FILTERS, search: 'Zalando' }} attentionTotal={0} onChange={onChange} />)

    expect(screen.getByRole('searchbox')).toHaveValue('Zalando')
  })

  it('empties the box when the url drops the term', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FilterBar filters={{ ...DEFAULT_FILTERS, search: 'Zalando' }} attentionTotal={0} onChange={onChange} />
    )

    rerender(<FilterBar filters={DEFAULT_FILTERS} attentionTotal={0} onChange={onChange} />)

    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('drops the term entirely when the box is emptied', async () => {
    const { onChange } = renderBar({ ...DEFAULT_FILTERS, search: 'Zalando' })

    await userEvent.clear(screen.getByRole('searchbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(onChange).toHaveBeenCalledWith({ search: undefined })
  })
})

describe('clearing', () => {
  it('offers nothing to clear when no filter is active', () => {
    renderBar()

    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()
  })

  it('appears as soon as one filter is active', () => {
    renderBar({ ...DEFAULT_FILTERS, status: 'received' })

    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('wipes every filter, not only the ones the defaults mention', async () => {
    const { onChange } = renderBar({
      carrier: 'bpost',
      status: 'received',
      search: 'x',
      store: 'y',
      archived: 'only',
      attention: true,
    })

    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(onChange).toHaveBeenCalledWith({
      carrier: undefined,
      status: undefined,
      store: undefined,
      search: undefined,
      attention: undefined,
      ...DEFAULT_FILTERS,
    })
  })
})

describe('the needs attention toggle', () => {
  it('badges the count, so the work shows without a click', () => {
    renderBar(DEFAULT_FILTERS, 8)

    expect(screen.getByRole('button', { name: 'Needs attention, 8 waiting' })).toBeInTheDocument()
    expect(screen.getByText('8')).toHaveClass('badge-count')
  })

  it('drops the badge when nothing waits, a red zero being a false alarm', () => {
    renderBar(DEFAULT_FILTERS, 0)

    expect(screen.getByRole('button', { name: 'Needs attention, nothing waiting' }))
      .toBeInTheDocument()
    expect(document.querySelector('.badge-count')).toBeNull()
  })

  it('sits with the archive views rather than on a line of its own', () => {
    renderBar(DEFAULT_FILTERS, 8)

    const views = screen.getByRole('group', { name: 'Archive' }).parentElement

    expect(views).toHaveClass('filter-views')
    expect(views).toContainElement(screen.getByRole('button', { name: /needs attention/i }))
  })

  it('turns the filter on', async () => {
    const { onChange } = renderBar(DEFAULT_FILTERS, 8)

    await userEvent.click(screen.getByRole('button', { name: /needs attention/i }))

    expect(onChange).toHaveBeenCalledWith({ attention: true })
  })

  it('turns it back off on a second click, rather than trapping the view', async () => {
    const { onChange } = renderBar({ ...DEFAULT_FILTERS, attention: true }, 8)

    await userEvent.click(screen.getByRole('button', { name: /needs attention/i }))

    expect(onChange).toHaveBeenCalledWith({ attention: undefined })
  })

  it('shows whether it is on without opening anything', () => {
    renderBar({ ...DEFAULT_FILTERS, attention: true }, 8)

    expect(screen.getByRole('button', { name: /needs attention/i }))
      .toHaveAttribute('aria-pressed', 'true')
  })
})

describe('the store filter', () => {
  it('lists the stores actually tracked, in alphabetical order', async () => {
    renderBar()

    await storeOptions()

    const names = screen.getAllByRole('option')
      .map((option) => option.textContent)
      .filter((text) => text === 'Decathlon' || text === 'Zara')

    expect(names).toEqual(['Decathlon', 'Zara'])
  })

  it('asks for more stores than a suggestion list would show', async () => {
    renderBar()

    await storeOptions()

    expect(searchStores).toHaveBeenCalledWith('', expect.anything(), 50)
  })

  it('reports the store that was picked', async () => {
    const { onChange } = renderBar()

    await userEvent.selectOptions(await storeOptions(), 'Zara')

    expect(onChange).toHaveBeenCalledWith({ store: 'Zara' })
  })

  it('clears the store when all stores is picked back', async () => {
    const { onChange } = renderBar({ ...DEFAULT_FILTERS, store: 'Zara' })

    await userEvent.selectOptions(await storeOptions(), '')

    expect(onChange).toHaveBeenCalledWith({ store: undefined })
  })

  it('shows a store the url names even when the list does not carry it', async () => {
    renderBar({ ...DEFAULT_FILTERS, store: 'Une boutique oubliée' })

    expect(await storeOptions()).toHaveValue('Une boutique oubliée')
  })

  it('still offers the url store when the stores cannot be loaded', async () => {
    vi.mocked(searchStores).mockRejectedValue(new TypeError('Failed to fetch'))

    renderBar({ ...DEFAULT_FILTERS, store: 'Zalando' })

    expect(await storeOptions()).toHaveValue('Zalando')
  })
})

describe('the export links', () => {
  it('hands the view on screen to both formats, filters and all', () => {
    renderBar({ ...DEFAULT_FILTERS, status: 'refunded' })

    expect(exportUrl).toHaveBeenCalledWith(expect.objectContaining({ status: 'refunded' }), 'csv')
    expect(exportUrl).toHaveBeenCalledWith(expect.objectContaining({ status: 'refunded' }), 'json')
  })

  it('offers one link per format', () => {
    renderBar()

    expect(screen.getByRole('link', { name: 'Export CSV' }))
      .toHaveAttribute('href', '/api/shipments/export?format=csv')
    expect(screen.getByRole('link', { name: 'Export JSON' }))
      .toHaveAttribute('href', '/api/shipments/export?format=json')
  })
})
