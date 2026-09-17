import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../api/shipments.js', () => ({ searchStores: vi.fn() }))

import { StoreCombobox } from '../../shipments/StoreCombobox.js'
import { searchStores } from '../../api/shipments.js'

const renderCombobox = (value = '') => {
  const onChange = vi.fn()

  render(<StoreCombobox value={value} invalid={false} onChange={onChange} />)

  return { onChange }
}

const box = () => screen.getByRole('combobox')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(searchStores).mockResolvedValue(['Zalando', 'Zara'])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('asking the api', () => {
  it('waits before asking, so a burst of keystrokes is one request', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    renderCombobox()
    await user.type(box(), 'Zal')

    expect(searchStores).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(250)

    expect(searchStores).toHaveBeenCalledOnce()
  })

  it('asks with an empty term too, which the api answers with the recent stores', async () => {
    renderCombobox()

    await waitFor(() => { expect(searchStores).toHaveBeenCalledWith('', expect.anything()) })
  })

  it('drops an answer that lands after the term moved on', async () => {
    let settle: (stores: string[]) => void = () => undefined
    vi.mocked(searchStores).mockImplementationOnce(() => new Promise((resolve) => { settle = resolve }))

    const { rerender } = render(<StoreCombobox value='Z' invalid={false} onChange={vi.fn()} />)

    await waitFor(() => { expect(searchStores).toHaveBeenCalledOnce() })

    vi.mocked(searchStores).mockResolvedValue(['Snipes'])
    rerender(<StoreCombobox value='Sni' invalid={false} onChange={vi.fn()} />)

    settle(['Zalando', 'Zara'])
    await userEvent.click(box())

    expect(await screen.findByRole('option', { name: 'Snipes' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Zalando' })).not.toBeInTheDocument()
  })

  it('stays quiet about a failure that belongs to a term already replaced', async () => {
    let fail: (cause: Error) => void = () => undefined
    vi.mocked(searchStores).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))

    const { rerender } = render(<StoreCombobox value='Z' invalid={false} onChange={vi.fn()} />)

    await waitFor(() => { expect(searchStores).toHaveBeenCalledOnce() })

    vi.mocked(searchStores).mockResolvedValue(['Snipes'])
    rerender(<StoreCombobox value='Sni' invalid={false} onChange={vi.fn()} />)

    fail(new Error('offline'))
    await userEvent.click(box())

    expect(await screen.findByRole('option', { name: 'Snipes' })).toBeInTheDocument()
  })

  it('keeps the field usable when the suggestions cannot be fetched', async () => {
    vi.mocked(searchStores).mockRejectedValue(new Error('offline'))

    renderCombobox()
    await userEvent.click(box())

    await waitFor(() => { expect(searchStores).toHaveBeenCalled() })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(box()).toBeEnabled()
  })
})

describe('the suggestion list', () => {
  it('stays shut until the field is used', () => {
    renderCombobox()

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens on focus and announces itself', async () => {
    renderCombobox()
    await userEvent.click(box())

    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-expanded', 'true')
  })

  it('never replaces what the user typed on its own', async () => {
    const { onChange } = renderCombobox('Zal')
    await userEvent.click(box())
    await screen.findByRole('listbox')

    await userEvent.tab()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('reports the store the user picks', async () => {
    const { onChange } = renderCombobox('Za')
    await userEvent.click(box())

    await userEvent.click(await screen.findByRole('option', { name: 'Zara' }))

    expect(onChange).toHaveBeenCalledWith('Zara')
  })

  it('shows the api order, which puts an exact match first', async () => {
    vi.mocked(searchStores).mockResolvedValue(['Zara', 'Zara Home'])

    renderCombobox('Zara')
    await userEvent.click(box())

    const options = await screen.findAllByRole('option')

    expect(options.map((option) => option.textContent)).toEqual(['Zara', 'Zara Home'])
  })
})

describe('the keyboard', () => {
  it('walks the list with the arrows and picks with enter', async () => {
    const { onChange } = renderCombobox('Za')
    await userEvent.click(box())
    await screen.findByRole('listbox')

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith('Zara')
  })

  it('does nothing on the arrows when the store is new and nothing matches', async () => {
    vi.mocked(searchStores).mockResolvedValue([])

    const { onChange } = renderCombobox('Brand new shop')
    await userEvent.click(box())
    await waitFor(() => { expect(searchStores).toHaveBeenCalled() })

    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('wraps to the last suggestion when walking up from nothing', async () => {
    const { onChange } = renderCombobox('Za')
    await userEvent.click(box())
    await screen.findByRole('listbox')

    await userEvent.keyboard('{ArrowUp}{Enter}')

    expect(onChange).toHaveBeenCalledWith('Zara')
  })

  it('leaves enter alone when nothing is highlighted, so the form can submit', async () => {
    const { onChange } = renderCombobox('Snipes')
    await userEvent.click(box())
    await screen.findByRole('listbox')

    await userEvent.keyboard('{Enter}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('leaves escape to the dialog when the list is already shut', async () => {
    const { onChange } = renderCombobox('Za')

    await userEvent.click(box())
    await screen.findByRole('listbox')
    await userEvent.keyboard('{Escape}{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes the list on escape without clearing the field', async () => {
    const { onChange } = renderCombobox('Za')
    await userEvent.click(box())
    await screen.findByRole('listbox')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
