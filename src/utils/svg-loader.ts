import type { Carrier } from '../types/index.js'

const VALID_CARRIERS: readonly Carrier[] = ['bpost', 'postnl']

export const loadSvgTemplate = async (carrier: Carrier): Promise<string> => {
  if (!VALID_CARRIERS.includes(carrier)) {
    throw new Error(`Unsupported carrier: ${String(carrier)}`)
  }

  const response = await globalThis.fetch(`/assets/models/${carrier}.svg`)
  if (!response.ok) {
    throw new Error(`Failed to load SVG template for ${carrier}`)
  }
  return response.text()
}
