// Crockford Base32 — excludes ambiguous characters 0/O, 1/I/L.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function base32Encode (bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return output
}

function toHex (bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Postgres bytea literal format PostgREST accepts over the wire.
export function toBytea (bytes: Uint8Array): string {
  return `\\x${toHex(bytes)}`
}

export interface GeneratedLicenseKey {
  raw: string
  hash: Uint8Array
  prefix: string
}

export async function generateLicenseKey (pepper: string): Promise<GeneratedLicenseKey> {
  const bytes = new Uint8Array(15)
  crypto.getRandomValues(bytes)

  // 15 bytes = 120 bits, divisible by 5 -> exactly 24 Base32 chars, no padding.
  const encoded = base32Encode(bytes)
  const groups = encoded.match(/.{1,6}/g) ?? [encoded]
  const raw = `LBLGEN-${groups.join('-')}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))

  return { raw, hash: new Uint8Array(signature), prefix: raw.slice(0, 13) }
}
