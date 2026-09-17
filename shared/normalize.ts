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
