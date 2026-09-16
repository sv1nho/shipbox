import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '../../shipments/FilterBar.js'
import { DEFAULT_FILTERS } from '../../shipments/filters.js'
import type { ListParams } from '../../../shared/shipment.js'

const renderBar = (filters: ListParams = DEFAULT_FILTERS) => {
  const onChange = vi.fn()
  render(<FilterBar filters={filters} onChange={onChange} />)
  return { onChange }
}

describe('what the bar shows', () => {
  it('reflects the filters already in the url', () => {
    renderBar({ ...DEFAULT_FILTERS, carrier: 'postnl', status: 'received', search: 'Zalando' })

    expect(screen.getByLabelText('Carrier')).toHaveValue('postnl')
    expect(screen.getByLabelText('Status')).toHaveValue('received')
    expect(screen.getByRole('searchbox')).toHaveValue('Zalando')
  })

  it('falls back to the defaults when the url carries nothing', () => {
    renderBar()

    expect(screen.getByLabelText('Carrier')).toHaveValue('')
    expect(screen.getByLabelText('Archive')).toHaveValue('exclude')
    expect(screen.getByLabelText('Sort by')).toHaveValue('createdAt')
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

  it('reports the sort key', async () => {
    const { onChange } = renderBar()

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'amountCents')

    expect(onChange).toHaveBeenCalledWith({ sort: 'amountCents' })
  })

  it('reports the archive view', async () => {
    const { onChange } = renderBar()

    await userEvent.selectOptions(screen.getByLabelText('Archive'), 'only')

    expect(onChange).toHaveBeenCalledWith({ archived: 'only' })
  })

  it('flips the direction on the toggle', async () => {
    const { onChange } = renderBar()

    await userEvent.click(screen.getByRole('button', { name: 'Descending' }))

    expect(onChange).toHaveBeenCalledWith({ direction: 'asc' })
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
    const { rerender } = render(<FilterBar filters={DEFAULT_FILTERS} onChange={onChange} />)

    await userEvent.type(screen.getByRole('searchbox'), 'half typed')
    rerender(<FilterBar filters={{ ...DEFAULT_FILTERS, search: 'Zalando' }} onChange={onChange} />)

    expect(screen.getByRole('searchbox')).toHaveValue('Zalando')
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
    const { onChange } = renderBar({ carrier: 'bpost', status: 'received', search: 'x', store: 'y', archived: 'only' })

    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(onChange).toHaveBeenCalledWith({
      carrier: undefined,
      status: undefined,
      store: undefined,
      search: undefined,
      ...DEFAULT_FILTERS,
    })
  })
})

describe('the export links', () => {
  it('exports what is on screen, in both formats', () => {
    renderBar({ ...DEFAULT_FILTERS, status: 'refunded' })

    expect(screen.getByRole('link', { name: 'Export CSV' }))
      .toHaveAttribute('href', expect.stringContaining('status=refunded'))
    expect(screen.getByRole('link', { name: 'Export JSON' }))
      .toHaveAttribute('href', expect.stringContaining('format=json'))
  })

  it('exports every page, not just the one being read', () => {
    renderBar({ ...DEFAULT_FILTERS, page: 3 })

    expect(screen.getByRole('link', { name: 'Export CSV' }))
      .toHaveAttribute('href', expect.not.stringContaining('page='))
  })
})
