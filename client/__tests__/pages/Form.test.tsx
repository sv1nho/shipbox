import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

vi.mock('../../utils/svg-loader.js', () => ({ loadSvgTemplate: vi.fn() }))
vi.mock('../../utils/label-generator.js', () => ({ buildLabelSvg: vi.fn() }))
vi.mock('../../utils/pdf-generator.js', () => ({ svgToPdf: vi.fn(), downloadPdf: vi.fn() }))
vi.mock('../../auth/client.js', () => ({
  useSession: vi.fn(() => ({ data: null, isPending: false })),
}))

import { Form } from '../../pages/Form.js'
import { loadSvgTemplate } from '../../utils/svg-loader.js'
import { buildLabelSvg } from '../../utils/label-generator.js'
import { downloadPdf, svgToPdf } from '../../utils/pdf-generator.js'

const PDF = new Blob(['%PDF'], { type: 'application/pdf' })
const createObjectURL = vi.fn(() => 'about:blank#label')
const revokeObjectURL = vi.fn()

const renderForm = () => render(<MemoryRouter><Form /></MemoryRouter>)

const section = (title: string) =>
  within(screen.getByRole('heading', { name: title }).closest('.card') as HTMLElement)

const fillParty = async (title: string) => {
  const party = section(title)

  await userEvent.type(party.getByPlaceholderText('First name'), 'Marie')
  await userEvent.type(party.getByPlaceholderText('Last name'), 'Martin')
  await userEvent.type(party.getByPlaceholderText('Address'), 'Avenue Centrale 45')
  await userEvent.type(party.getByPlaceholderText('Postal code'), '4000')
  await userEvent.type(party.getByPlaceholderText('City'), 'Liège')
}

const fillEverything = async () => {
  await fillParty('Sender')
  await fillParty('Recipient')
  await userEvent.type(
    section('Tracking Number').getByRole('textbox'),
    '323200000000000000004050'
  )
}

const generate = async () => {
  await userEvent.click(screen.getByRole('button', { name: /generate label/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadSvgTemplate).mockResolvedValue('<svg/>')
  vi.mocked(buildLabelSvg).mockReturnValue({ svg: '<svg/>', maskedTracking: '3232 **** 4050' })
  vi.mocked(svgToPdf).mockResolvedValue(PDF)
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})

describe('what it asks for', () => {
  it('asks for a sender, a recipient and the label settings', () => {
    renderForm()

    for (const title of ['Sender', 'Recipient', 'Language', 'Carrier', 'Tracking Number']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('hints at the tracking format of the carrier chosen', async () => {
    renderForm()

    const tracking = section('Tracking Number').getByRole('textbox')

    expect(tracking).toHaveAttribute('placeholder', '24 digits for bpost')

    await userEvent.selectOptions(section('Carrier').getByRole('combobox'), 'postnl')

    expect(tracking).toHaveAttribute('placeholder', 'e.g. 3SDDRL000000409')
  })
})

describe('a company instead of a person', () => {
  it('swaps the two names for a company name', async () => {
    renderForm()
    const sender = section('Sender')

    await userEvent.click(sender.getByRole('button', { name: 'Company' }))

    expect(sender.getByPlaceholderText('Company name')).toBeInTheDocument()
    expect(sender.queryByPlaceholderText('First name')).not.toBeInTheDocument()
  })

  it('goes back to the two names', async () => {
    renderForm()
    const sender = section('Sender')

    await userEvent.click(sender.getByRole('button', { name: 'Company' }))
    await userEvent.click(sender.getByRole('button', { name: 'Individual' }))

    expect(sender.getByPlaceholderText('First name')).toBeInTheDocument()
  })

  it('switches one party without touching the other', async () => {
    renderForm()

    await userEvent.click(section('Sender').getByRole('button', { name: 'Company' }))

    expect(section('Recipient').getByPlaceholderText('First name')).toBeInTheDocument()
  })
})

describe('filling with random data', () => {
  it('explains the dice on hover, since it carries no wording', () => {
    renderForm()

    expect(section('Recipient').getByRole('button', { name: /random data/i }))
      .toHaveAttribute('title', 'Fill recipient with random data')
  })

  it('invents a first and a last name for a person', async () => {
    renderForm()
    const sender = section('Sender')

    await userEvent.click(sender.getByRole('button', { name: /random data/i }))

    expect(sender.getByPlaceholderText('First name')).not.toHaveValue('')
    expect(sender.getByPlaceholderText('Last name')).not.toHaveValue('')
  })

  it('invents a company name for a company', async () => {
    renderForm()
    const recipient = section('Recipient')

    await userEvent.click(recipient.getByRole('button', { name: 'Company' }))
    await userEvent.click(recipient.getByRole('button', { name: /random data/i }))

    expect(recipient.getByPlaceholderText('Company name')).not.toHaveValue('')
  })
})

describe('what it refuses', () => {
  it('names every missing field instead of generating a blank label', async () => {
    renderForm()

    await generate()

    expect(await screen.findAllByText('First name is required')).toHaveLength(2)
    expect(screen.getAllByText('Last name is required')).toHaveLength(2)
    expect(screen.getAllByText('Address is required')).toHaveLength(2)
    expect(loadSvgTemplate).not.toHaveBeenCalled()
  })

  it('refuses a number the carrier could never have issued', async () => {
    renderForm()

    await fillParty('Sender')
    await fillParty('Recipient')
    await userEvent.type(section('Tracking Number').getByRole('textbox'), '3SDDRL000000409')
    await generate()

    expect(await screen.findByText(/must match: 24 digits/i)).toBeInTheDocument()
    expect(loadSvgTemplate).not.toHaveBeenCalled()
  })
})

describe('generating the label', () => {
  it('builds the label for the chosen carrier and shows it before any download', async () => {
    renderForm()

    await fillEverything()
    await generate()

    expect(await screen.findByRole('heading', { name: 'Label Preview' })).toBeInTheDocument()
    expect(loadSvgTemplate).toHaveBeenCalledWith('bpost')
    expect(buildLabelSvg).toHaveBeenCalledWith(
      expect.objectContaining({ sender_firstname: 'Marie', tracking_number: '323200000000000000004050' }),
      '<svg/>'
    )
    expect(downloadPdf).not.toHaveBeenCalled()
  })

  it('shows the pdf and the masked tracking number in the preview', async () => {
    const { container } = renderForm()

    await fillEverything()
    await generate()

    await screen.findByRole('heading', { name: 'Label Preview' })

    expect(container.ownerDocument.querySelector('iframe')).toHaveAttribute('src', 'about:blank#label')
    expect(screen.getByText('3232 **** 4050')).toBeInTheDocument()
  })

  it('says it is working while the pdf is being drawn', async () => {
    let finish: (template: string) => void = () => {}
    vi.mocked(loadSvgTemplate).mockReturnValue(new Promise((resolve) => { finish = resolve }))

    renderForm()
    await fillEverything()
    await generate()

    expect(await screen.findByRole('button', { name: /generating/i })).toBeDisabled()

    finish('<svg/>')

    expect(await screen.findByRole('heading', { name: 'Label Preview' })).toBeInTheDocument()
  })

  it('reports what went wrong, keeping what was typed', async () => {
    vi.mocked(svgToPdf).mockRejectedValue(new Error('The template could not be read.'))

    renderForm()
    await fillEverything()
    await generate()

    expect(await screen.findByText('The template could not be read.')).toBeInTheDocument()
    expect(section('Sender').getByPlaceholderText('First name')).toHaveValue('Marie')
  })

  it('still says something when the failure carries no message', async () => {
    vi.mocked(loadSvgTemplate).mockRejectedValue('offline')

    renderForm()
    await fillEverything()
    await generate()

    expect(await screen.findByText('Unknown error')).toBeInTheDocument()
  })
})

describe('leaving the preview', () => {
  const openPreview = async () => {
    renderForm()
    await fillEverything()
    await generate()
    await screen.findByRole('heading', { name: 'Label Preview' })
  }

  it('frees the pdf once the preview is closed', async () => {
    await openPreview()

    await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])

    expect(screen.queryByRole('heading', { name: 'Label Preview' })).not.toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('about:blank#label')
  })

  it('downloads the pdf, then offers to track the parcel', async () => {
    await openPreview()

    await userEvent.click(screen.getByRole('button', { name: /download pdf/i }))

    expect(downloadPdf).toHaveBeenCalledWith(PDF, 'label.pdf')
    expect(revokeObjectURL).toHaveBeenCalledWith('about:blank#label')
    expect(await screen.findByRole('heading', { name: /keep an eye on this return/i }))
      .toBeInTheDocument()
  })

  it('goes straight to tracking without downloading anything', async () => {
    await openPreview()

    await userEvent.click(screen.getByRole('button', { name: /add to tracking/i }))

    expect(downloadPdf).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: /keep an eye on this return/i }))
      .toBeInTheDocument()
  })

  it('lets the tracking offer be turned down', async () => {
    await openPreview()
    await userEvent.click(screen.getByRole('button', { name: /add to tracking/i }))

    await userEvent.click(await screen.findByRole('button', { name: /not now/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /keep an eye on this return/i }))
        .not.toBeInTheDocument()
    })
  })
})
