import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LabelPreviewModal } from '../../components/LabelPreviewModal.js'

const renderModal = () => {
  const handlers = { onClose: vi.fn(), onDownload: vi.fn(), onTrack: vi.fn() }

  render(
    <LabelPreviewModal pdfUrl='about:blank#label' maskedTracking='3232 **** 4050' {...handlers} />
  )

  return handlers
}

describe('what it shows', () => {
  it('embeds the pdf it was handed', () => {
    renderModal()

    expect(document.body.querySelector('iframe')).toHaveAttribute('src', 'about:blank#label')
  })

  it('shows the tracking number masked, never in full', () => {
    renderModal()

    expect(screen.getByText('3232 **** 4050')).toBeInTheDocument()
  })
})

describe('what each button does', () => {
  it('downloads on the primary button', async () => {
    const { onDownload, onClose, onTrack } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: /download pdf/i }))

    expect(onDownload).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(onTrack).not.toHaveBeenCalled()
  })

  it('offers tracking without downloading', async () => {
    const { onTrack, onDownload } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: /add to tracking/i }))

    expect(onTrack).toHaveBeenCalledOnce()
    expect(onDownload).not.toHaveBeenCalled()
  })

  it.each([0, 1])('closes from either close button, number %i', async (index) => {
    const { onClose } = renderModal()

    await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[index])

    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('the backdrop', () => {
  it('closes on a click beside the window', async () => {
    const { onClose } = renderModal()

    await userEvent.click(document.body.querySelector('.modal-backdrop') as HTMLElement)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('stays open on a click inside the window', async () => {
    const { onClose } = renderModal()

    await userEvent.click(screen.getByRole('heading', { name: 'Label Preview' }))

    expect(onClose).not.toHaveBeenCalled()
  })
})
