import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StoreSpeed } from '../../dashboard/StoreSpeed.js'
import type { StoreDecisionSpeed } from '../../../shared/dashboard.js'

const store = (overrides: Partial<StoreDecisionSpeed> = {}): StoreDecisionSpeed => ({
  store: 'Zalando',
  returns: 6,
  measured: 4,
  averageDecisionDays: 4,
  ...overrides,
})

const widthOf = (name: string): string => {
  const row = screen.getByText(name).closest('.dash-bar-row')

  return (row?.querySelector('.dash-bar-fill') as HTMLElement).style.width
}

describe('what the chart plots', () => {
  it('names every store it could time, with its average', () => {
    render(<StoreSpeed measured={7} stores={[
      store({ store: 'Bol.com', averageDecisionDays: 20.5, measured: 2, returns: 5 }),
      store({ store: 'Zalando', averageDecisionDays: 3.7, measured: 5, returns: 6 }),
    ]} />)

    expect(screen.getByText('Bol.com')).toBeInTheDocument()
    expect(screen.getByText('20.5')).toBeInTheDocument()
    expect(screen.getByText('3.7')).toBeInTheDocument()
  })

  it('scales the bars against the slowest store, which fills the track', () => {
    render(<StoreSpeed measured={7} stores={[
      store({ store: 'Bol.com', averageDecisionDays: 20 }),
      store({ store: 'Zalando', averageDecisionDays: 5 }),
    ]} />)

    expect(widthOf('Bol.com')).toBe('100%')
    expect(widthOf('Zalando')).toBe('25%')
  })

  it('drops a trailing zero, four days reading better than four point zero', () => {
    render(<StoreSpeed measured={4} stores={[store({ averageDecisionDays: 4 })]} />)

    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.queryByText('4.0')).not.toBeInTheDocument()
  })

  it('says how thin the evidence is, an average over two returns proving little', () => {
    render(<StoreSpeed measured={2} stores={[store({ measured: 2, returns: 5 })]} />)

    expect(screen.getByText('2 of 5 timed')).toBeInTheDocument()
  })

  it('says which day the count starts from, the two anchors differing', () => {
    render(<StoreSpeed measured={9} stores={[store()]} />)

    expect(screen.getByText(/from the day the store received the parcel/i)).toBeInTheDocument()
    expect(screen.getByText(/or from the drop-off when it never arrived/i)).toBeInTheDocument()
    expect(screen.getByText(/averaged over 9 decided returns/i)).toBeInTheDocument()
  })

  it('carries the figures in a tooltip as well as in the row', () => {
    render(<StoreSpeed measured={2} stores={[
      store({ store: 'Bol.com', averageDecisionDays: 20.5, measured: 2 }),
    ]} />)

    const row = screen.getByText('Bol.com').closest('.dash-bar-row')

    expect(row?.querySelector('.dash-bar-fill'))
      .toHaveAttribute('title', 'Bol.com: 20.5 days on average over 2 decided returns')
  })
})

describe('the stores it leaves out', () => {
  it('skips a store whose returns are all still open', () => {
    render(<StoreSpeed measured={4} stores={[
      store({ store: 'Zalando' }),
      store({ store: 'Nike', measured: 0, averageDecisionDays: null }),
    ]} />)

    expect(screen.getByText('Zalando')).toBeInTheDocument()
    expect(screen.queryByText('Nike')).not.toBeInTheDocument()
  })

  it('says so plainly when nothing has been timed at all', () => {
    render(<StoreSpeed measured={0} stores={[
      store({ measured: 0, averageDecisionDays: null }),
    ]} />)

    expect(screen.getByText(/no decision has been timed yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Zalando')).not.toBeInTheDocument()
  })
})
