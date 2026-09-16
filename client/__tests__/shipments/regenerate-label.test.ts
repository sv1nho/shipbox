import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../utils/svg-loader.js', () => ({ loadSvgTemplate: vi.fn() }))
vi.mock('../../utils/label-generator.js', () => ({ buildLabelSvg: vi.fn() }))
vi.mock('../../utils/pdf-generator.js', () => ({ svgToPdf: vi.fn(), downloadPdf: vi.fn() }))

import { regenerateLabel } from '../../shipments/regenerate-label.js'
import { loadSvgTemplate } from '../../utils/svg-loader.js'
import { buildLabelSvg } from '../../utils/label-generator.js'
import { svgToPdf, downloadPdf } from '../../utils/pdf-generator.js'
import { makeLabelPayload } from '../fixtures.js'

const blob = new Blob(['%PDF'], { type: 'application/pdf' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadSvgTemplate).mockResolvedValue('<svg></svg>')
  vi.mocked(buildLabelSvg).mockReturnValue({ svg: '<svg>label</svg>', maskedTracking: '****4050' })
  vi.mocked(svgToPdf).mockResolvedValue(blob)
  vi.mocked(downloadPdf).mockReturnValue(undefined)
})

describe('regenerateLabel', () => {
  it('rebuilds the pdf from the stored payload rather than from a cached file', async () => {
    const payload = makeLabelPayload({ carrier: 'postnl', tracking_number: '3SDDRL000000409' })

    await regenerateLabel(payload)

    expect(loadSvgTemplate).toHaveBeenCalledWith('postnl')
    expect(buildLabelSvg).toHaveBeenCalledWith(payload, '<svg></svg>')
    expect(svgToPdf).toHaveBeenCalledWith('<svg>label</svg>')
  })

  it('names the file after the tracking number, so two labels never collide', async () => {
    await regenerateLabel(makeLabelPayload({ tracking_number: '323200000000000000004050' }))

    expect(downloadPdf).toHaveBeenCalledWith(blob, 'label-323200000000000000004050.pdf')
  })

  it('lets a rendering failure surface instead of downloading a broken file', async () => {
    vi.mocked(svgToPdf).mockRejectedValue(new Error('canvas unavailable'))

    await expect(regenerateLabel(makeLabelPayload())).rejects.toThrow('canvas unavailable')
    expect(downloadPdf).not.toHaveBeenCalled()
  })
})
