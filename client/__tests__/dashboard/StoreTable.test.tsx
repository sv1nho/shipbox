import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StoreTable } from '../../dashboard/StoreTable.js'
import type { StoreStats } from '../../../shared/dashboard.js'

const store = (overrides: Partial<StoreStats> = {}): StoreStats => ({
  store: 'Zalando',
  returns: 6,
  decided: 4,
  refunded: 3,
  measured: 4,
  averageDecisionDays: 4,
  ...overrides,
})

const rowOf = (name: string) => screen.getByText(name).closest('.dash-row')

const widthOf = (name: string): string =>
  (rowOf(name)?.querySelector('.dash-bar-fill') as HTMLElement).style.width

describe('what each row says', () => {
  it('puts both measures on the same line, so a store is read once', () => {
    render(<StoreTable measured={6} stores={[
      store({ store: 'Bol.com', decided: 5, refunded: 2, averageDecisionDays: 20.5 }),
    ]} />)

    const row = rowOf('Bol.com')

    expect(row).toHaveTextContent('20.5')
    expect(row).toHaveTextContent('40%')
  })

  it('scales the bar against the slowest store, which fills the track', () => {
    render(<StoreTable measured={8} stores={[
      store({ store: 'Bol.com', averageDecisionDays: 20 }),
      store({ store: 'Zalando', averageDecisionDays: 5 }),
    ]} />)

    expect(widthOf('Bol.com')).toBe('100%')
    expect(widthOf('Zalando')).toBe('25%')
  })

  it('drops a trailing zero, four days reading better than four point zero', () => {
    render(<StoreTable measured={4} stores={[store({ averageDecisionDays: 4 })]} />)

    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.queryByText('4.0')).not.toBeInTheDocument()
  })

  it('rounds the rate to a whole percentage', () => {
    render(<StoreTable measured={3} stores={[store({ decided: 3, refunded: 2 })]} />)

    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('says how much was decided, a rate over two returns proving little', () => {
    render(<StoreTable measured={2} stores={[store({ decided: 2, returns: 5 })]} />)

    expect(screen.getByText('2 of 5 decided')).toBeInTheDocument()
  })

  it('carries both figures in tooltips as well as in the row', () => {
    render(<StoreTable measured={2} stores={[
      store({ store: 'Bol.com', decided: 5, refunded: 2, measured: 2, averageDecisionDays: 20.5 }),
    ]} />)

    expect(rowOf('Bol.com')?.querySelector('.dash-bar-fill')).toHaveAttribute(
      'title',
      'Bol.com takes 20.5 days on average, over 2 timed returns'
    )
    expect(screen.getByText('40%'))
      .toHaveAttribute('title', 'Bol.com refunded 2 of 5 decided returns')
  })
})

describe('a store whose returns could not be timed', () => {
  it('still reports the rate, which does not need a date', () => {
    render(<StoreTable measured={0} stores={[
      store({ store: 'Nike', decided: 2, refunded: 1, measured: 0, averageDecisionDays: null }),
    ]} />)

    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(rowOf('Nike')?.querySelector('.dash-bar-fill')).toBeNull()
  })
})

describe('the stores it leaves out', () => {
  it('skips a store whose returns are all still open', () => {
    render(<StoreTable measured={4} stores={[
      store({ store: 'Zalando' }),
      store({ store: 'Nike', decided: 0, refunded: 0, measured: 0, averageDecisionDays: null }),
    ]} />)

    expect(screen.getByText('Zalando')).toBeInTheDocument()
    expect(screen.queryByText('Nike')).not.toBeInTheDocument()
  })

  it('says so plainly when no store has decided anything', () => {
    render(<StoreTable measured={0} stores={[
      store({ decided: 0, refunded: 0, measured: 0, averageDecisionDays: null }),
    ]} />)

    expect(screen.getByText(/no store has decided on a return yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Zalando')).not.toBeInTheDocument()
  })
})

describe('the caption', () => {
  it('names both anchors and the sample it averaged over', () => {
    render(<StoreTable measured={9} stores={[store()]} />)

    expect(screen.getByText(/from the day the store received the parcel/i)).toBeInTheDocument()
    expect(screen.getByText(/or from the drop-off when it never arrived/i)).toBeInTheDocument()
    expect(screen.getByText(/averaged over 9 decided returns/i)).toBeInTheDocument()
  })
})
