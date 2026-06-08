import type { Carrier } from '../types/index.js'

export const loadSvgTemplate = async (carrier: Carrier): Promise<string> => {
  const response = await globalThis.fetch(`/assets/models/${carrier}.svg`)
  if (!response.ok) {
    throw new Error(`Failed to load SVG template for ${carrier}`)
  }
  return response.text()
}
