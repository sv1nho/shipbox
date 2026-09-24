import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../../shipments/Modal.js'

const renderModal = (children = (
  <>
    <h2 id='probe-title'>Decide</h2>
    <button type='button'>First</button>
    <input aria-label='Middle' />
    <button type='button'>Last</button>
  </>
)) => {
  const onClose = vi.fn()

  render(<Modal titleId='probe-title' onClose={onClose}>{children}</Modal>)

  return { onClose }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('where the focus goes', () => {
  it('lands inside the dialog, so the next key press reaches it', () => {
    renderModal()

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('goes back to what opened it once it is gone', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const { unmount } = render(
      <Modal titleId='probe-title' onClose={vi.fn()}>
        <h2 id='probe-title'>Decide</h2>
        <button type='button'>First</button>
      </Modal>
    )

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()

    unmount()

    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('closes without a fuss when nothing had the focus', () => {
    vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null)

    const { unmount } = render(
      <Modal titleId='probe-title' onClose={vi.fn()}>
        <h2 id='probe-title'>Decide</h2>
      </Modal>
    )

    expect(() => { unmount() }).not.toThrow()
  })
})

describe('the tab key', () => {
  it('wraps from the last stop back to the first, instead of leaving the dialog', async () => {
    renderModal()

    screen.getByRole('button', { name: 'Last' }).focus()
    await userEvent.tab()

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('wraps backwards from the first stop to the last', async () => {
    renderModal()

    await userEvent.tab({ shift: true })

    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('moves on normally between two stops inside', async () => {
    renderModal()

    await userEvent.tab()

    expect(screen.getByLabelText('Middle')).toHaveFocus()
  })

  it('does nothing in a dialog with nowhere to go', async () => {
    renderModal(<h2 id='probe-title'>Nothing to do here</h2>)

    await expect(userEvent.tab()).resolves.toBeUndefined()
  })
})

describe('leaving', () => {
  it('closes on escape', async () => {
    const { onClose } = renderModal()

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })
})
