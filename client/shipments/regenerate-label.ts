import { loadSvgTemplate } from '../utils/svg-loader.js'
import { buildLabelSvg } from '../utils/label-generator.js'
import { svgToPdf, downloadPdf } from '../utils/pdf-generator.js'
import { labelFileName } from '../utils/label-file-name.js'
import type { LabelPayload } from '../../shared/label-payload.js'

export async function regenerateLabel (payload: LabelPayload): Promise<void> {
  const template = await loadSvgTemplate(payload.carrier)
  const { svg } = buildLabelSvg(payload, template)
  const blob = await svgToPdf(svg)

  downloadPdf(blob, labelFileName(payload.carrier))
}
