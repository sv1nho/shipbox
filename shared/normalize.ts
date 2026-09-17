export function normalizePostalCode (value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function normalizeCountry (value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function normalizeStore (value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeTrackingNumber (value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function parseAmount (raw: string): number | null {
  const normalised = raw.replace(',', '.').trim()

  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null

  return Math.round(Number(normalised) * 100)
}
