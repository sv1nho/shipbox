import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JsBarcode from 'jsbarcode'

// Must be hoisted before the module import
vi.mock('jsbarcode', () => ({ default: vi.fn() }))

import {
  wrapText,
  escapeXml,
  zoneFromPostal,
  obfuscateTracking,
  buildLabelSvg,
} from '../utils/label-generator.js'
import type { LabelPayload } from '../types/index.js'

afterEach(() => {
  vi.restoreAllMocks()
})

const makePayload = (overrides: Partial<LabelPayload> = {}): LabelPayload => ({
  sender_firstname: 'Jean',
  sender_lastname: 'Dupont',
  sender_company: '',
  sender_isCompany: false,
  sender_address: 'Rue de la Paix 1',
  sender_postal: '1000',
  sender_city: 'Bruxelles',
  sender_country: 'BE',
  recipient_firstname: 'Marie',
  recipient_lastname: 'Martin',
  recipient_company: '',
  recipient_isCompany: false,
  recipient_address: 'Avenue Centrale 45',
  recipient_postal: '4000',
  recipient_city: 'Liège',
  recipient_country: 'BE',
  carrier: 'bpost',
  tracking_number: '323200000000000000004050',
  label_language: 'fr',
  ...overrides,
})

const SVG_TEMPLATE = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'

// ── wrapText ─────────────────────────────────────────────────────────────────

describe('wrapText', () => {
  it('returns a single element when text fits within maxLength', () => {
    expect(wrapText('hello world', 20)).toEqual(['hello world'])
  })

  it('returns a single element when text equals maxLength exactly', () => {
    expect(wrapText('hello', 5)).toEqual(['hello'])
  })

  it('wraps greedily: next word starts on a new line and continues filling it', () => {
    expect(wrapText('hello world foo', 10)).toEqual(['hello', 'world foo'])
  })

  it('packs as many words as possible on each line', () => {
    expect(wrapText('a b c d e f g', 5)).toEqual(['a b c', 'd e f', 'g'])
  })

  it('places a word longer than maxLength on its own line', () => {
    expect(wrapText('short averylongwordthatexceeds', 10)).toEqual([
      'short',
      'averylongwordthatexceeds',
    ])
  })
})

// ── escapeXml ─────────────────────────────────────────────────────────────────

describe('escapeXml', () => {
  it('escapes &', () => expect(escapeXml('a & b')).toBe('a &amp; b'))
  it('escapes <', () => expect(escapeXml('<tag>')).toBe('&lt;tag&gt;'))
  it('escapes >', () => expect(escapeXml('a > b')).toBe('a &gt; b'))
  it('escapes double quotes', () =>
    expect(escapeXml('"hi"')).toBe('&quot;hi&quot;'))
  it('escapes single quotes', () =>
    expect(escapeXml("it's")).toBe('it&apos;s'))
  it('leaves plain text unchanged', () =>
    expect(escapeXml('plain text')).toBe('plain text'))
  it('handles multiple special characters in one string', () => {
    expect(escapeXml('<a href="foo">bar & baz</a>')).toBe(
      '&lt;a href=&quot;foo&quot;&gt;bar &amp; baz&lt;/a&gt;'
    )
  })
})

// ── zoneFromPostal ────────────────────────────────────────────────────────────

describe('zoneFromPostal', () => {
  it.each([
    ['1000', 'B10B'],
    ['2000', 'A20A'],
    ['9000', 'A90G'],
    ['4000', 'C40L'],
    ['8000', 'A80G'],
  ])('postal %s → zone %s', (postal, zone) => {
    expect(zoneFromPostal(postal)).toBe(zone)
  })

  it('uses only the first 4 digits when input is longer', () => {
    expect(zoneFromPostal('10000')).toBe('B10B')
    expect(zoneFromPostal('10009')).toBe('B10B')
  })

  it('strips non-digit characters before matching', () => {
    expect(zoneFromPostal('1 000')).toBe('B10B')
    expect(zoneFromPostal('BE-1000')).toBe('B10B')
  })

  it('returns empty string when no zone matches the postal code', () => {
    // 0001-0999 and 0000 are not covered by any zone
    expect(zoneFromPostal('0000')).toBe('')
    expect(zoneFromPostal('0500')).toBe('')
  })

  it('returns empty string for inputs shorter than 4 digits', () => {
    expect(zoneFromPostal('100')).toBe('')
    expect(zoneFromPostal('abc')).toBe('')
    expect(zoneFromPostal('')).toBe('')
  })
})

// ── obfuscateTracking ─────────────────────────────────────────────────────────

describe('obfuscateTracking', () => {
  it('preserves the original string length', () => {
    const tracking = '323200000000000000004050'
    expect(obfuscateTracking(tracking, 8)).toHaveLength(tracking.length)
  })

  it('preserves non-digit characters at their original positions', () => {
    const tracking = '3SDDRL000000409'
    const result = obfuscateTracking(tracking, 9)
    expect(result[1]).toBe('S')
    expect(result[2]).toBe('D')
    expect(result[3]).toBe('D')
    expect(result[4]).toBe('R')
    expect(result[5]).toBe('L')
  })

  it('never modifies digits outside the tail segment', () => {
    // tailDigitCount=4 → only the last 4 digit positions may change
    const tracking = '12345678'
    const result = obfuscateTracking(tracking, 4)
    expect(result.slice(0, 4)).toBe('1234')
  })

  it('always changes at least one digit in the tail (getRandomDigit avoids the original value)', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)   // pool index for change 1 → picks chars[4] = '5'
      .mockReturnValueOnce(0.5) // do: digit = '5' === except '5' → loop retries
      .mockReturnValueOnce(0.6) // retry: digit = '6' ≠ '5' → accepted
      .mockReturnValueOnce(0)   // pool index for change 2 → picks chars[5] = '6'
      .mockReturnValueOnce(0.3) // do: digit = '3' ≠ '6' → accepted

    expect(obfuscateTracking('12345678', 4)).toBe('12346378')
  })

  it('returns the original string unchanged when it contains no digits', () => {
    expect(obfuscateTracking('ABCDEF', 6)).toBe('ABCDEF')
  })

  it('does not throw when Math.random produces an out-of-bounds index (floating-point guard)', () => {
    // Math.floor(1.0 * length) = length → splice returns [] → charIndex = undefined → continue
    // The loop still completes its iterations; no mutations happen
    vi.spyOn(Math, 'random').mockReturnValue(1)
    expect(() => obfuscateTracking('12345678', 4)).not.toThrow()
  })
})

// ── buildLabelSvg ─────────────────────────────────────────────────────────────

describe('buildLabelSvg', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,MOCKBARCODE=='
    )
  })

  it('appends the overlay group before the closing </svg>', () => {
    const { svg } = buildLabelSvg(makePayload(), SVG_TEMPLATE)
    expect(svg).toContain('dynamic-label-overlay')
    expect(svg).toMatch(/<\/svg>$/)
  })

  it('includes sender name and address in the SVG', () => {
    const { svg } = buildLabelSvg(makePayload(), SVG_TEMPLATE)
    expect(svg).toContain('Jean Dupont')
    expect(svg).toContain('Rue de la Paix 1')
  })

  it('includes recipient name and address in the SVG', () => {
    const { svg } = buildLabelSvg(makePayload(), SVG_TEMPLATE)
    expect(svg).toContain('Marie Martin')
    expect(svg).toContain('Avenue Centrale 45')
  })

  it('embeds the barcode as a base64 data URL', () => {
    const { svg } = buildLabelSvg(makePayload(), SVG_TEMPLATE)
    expect(svg).toContain('data:image/png;base64,MOCKBARCODE==')
  })

  it('returns maskedTracking with the same length as tracking_number', () => {
    const payload = makePayload()
    const { maskedTracking } = buildLabelSvg(payload, SVG_TEMPLATE)
    expect(maskedTracking).toHaveLength(payload.tracking_number.length)
  })

  it('returns maskedTracking that differs from the original tracking number', () => {
    const payload = makePayload()
    const { maskedTracking } = buildLabelSvg(payload, SVG_TEMPLATE)
    expect(maskedTracking).not.toBe(payload.tracking_number)
  })

  it('includes the postal zone code for bpost', () => {
    const { svg } = buildLabelSvg(
      makePayload({ carrier: 'bpost', recipient_postal: '4000' }),
      SVG_TEMPLATE
    )
    expect(svg).toContain('C40L')
  })

  it('includes the AD marker for postnl', () => {
    const { svg } = buildLabelSvg(
      makePayload({ carrier: 'postnl', tracking_number: '3SDDRL000000409' }),
      SVG_TEMPLATE
    )
    expect(svg).toContain('>AD<')
  })

  it('uses company name for sender when sender_isCompany is true', () => {
    const { svg } = buildLabelSvg(
      makePayload({ sender_isCompany: true, sender_company: 'Acme Corp' }),
      SVG_TEMPLATE
    )
    expect(svg).toContain('Acme Corp')
    expect(svg).not.toContain('Jean Dupont')
  })

  it('uses company name for recipient when recipient_isCompany is true', () => {
    const { svg } = buildLabelSvg(
      makePayload({ recipient_isCompany: true, recipient_company: 'Global SA' }),
      SVG_TEMPLATE
    )
    expect(svg).toContain('Global SA')
    expect(svg).not.toContain('Marie Martin')
  })

  it('XML-escapes special characters in sender and recipient names', () => {
    const { svg } = buildLabelSvg(
      makePayload({ sender_firstname: 'Jean-Paul', sender_lastname: "D'Arcy" }),
      SVG_TEMPLATE
    )
    expect(svg).toContain('D&apos;Arcy')
  })

  it("throws 'Failed to generate barcode' when JsBarcode fails", () => {
    vi.mocked(JsBarcode).mockImplementationOnce(() => {
      throw new Error('barcode error')
    })
    expect(() => buildLabelSvg(makePayload(), SVG_TEMPLATE)).toThrow(
      'Failed to generate barcode, barcode error'
    )
  })
})
