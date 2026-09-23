import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'

export const svgToPdf = async (svgString: string): Promise<Blob> => {
  const cleanSvg = svgString.replace(/<\?xml[^>]*\?>/g, '').trim()

  if (!cleanSvg.includes('<svg')) {
    throw new Error('Invalid SVG: missing <svg tag>')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(cleanSvg, 'image/svg+xml')
  const svgElement = doc.documentElement

  if (svgElement.nodeName !== 'svg') {
    throw new Error('Invalid SVG element')
  }

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [100, 150],
    })

    await svg2pdf(svgElement, pdf, {
      x: 0,
      y: 0,
      width: 100,
      height: 150,
    })

    return pdf.output('blob')
  } catch (error) {
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { cause: error }
    )
  }
}

export const downloadPdf = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
