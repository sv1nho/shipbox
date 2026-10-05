import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { escapeXml, obfuscateTracking, wrapText, zoneFromPostal } from '../utils/label-generator.js'
import { filtersFromSearch, searchFromFilters, activeFilterCount } from '../shipments/filters.js'
import { SORT_KEYS } from '../../shared/shipment.js'

const RUNS = { numRuns: 300, seed: 20261005 }

const hostile = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.string({ maxLength: 200, unit: 'binary' }),
  fc.constantFrom(
    '', ' ', '\u0000', '<script>alert(1)</script>', '&amp;', '"', "'", '<<<>>>',
    'a'.repeat(500), '𝕏𝕏𝕏', '../../etc/passwd', '\r\n', '\t'
  )
)

describe('a link someone else crafted', () => {
  it('never throws, whatever the query string says', () => {
    fc.assert(fc.property(fc.dictionary(hostile, hostile, { maxKeys: 8 }), (query) => {
      expect(() => filtersFromSearch(new URLSearchParams(query))).not.toThrow()
    }), RUNS)
  })

  it('never asks the api for a page that makes no sense', () => {
    fc.assert(fc.property(hostile, (page) => {
      const filters = filtersFromSearch(new URLSearchParams({ page }))

      expect(Number.isInteger(filters.page)).toBe(true)
      expect(filters.page ?? 1).toBeGreaterThan(0)
    }), RUNS)
  })

  it('only ever keeps a sort key the api knows', () => {
    fc.assert(fc.property(hostile, (sort) => {
      const filters = filtersFromSearch(new URLSearchParams({ sort }))

      expect(SORT_KEYS).toContain(filters.sort)
    }), RUNS)
  })

  it('writes back only what it read, so a round trip adds nothing', () => {
    fc.assert(fc.property(fc.dictionary(hostile, hostile, { maxKeys: 8 }), (query) => {
      const once = filtersFromSearch(new URLSearchParams(query))
      const twice = filtersFromSearch(searchFromFilters(once))

      expect(twice).toEqual(once)
    }), RUNS)
  })

  it('counts the narrowing filters it kept, never more', () => {
    fc.assert(fc.property(fc.dictionary(hostile, hostile, { maxKeys: 8 }), (query) => {
      const count = activeFilterCount(filtersFromSearch(new URLSearchParams(query)))

      expect(count).toBeGreaterThanOrEqual(0)
      expect(count).toBeLessThanOrEqual(4)
    }), RUNS)
  })
})

describe('text put on a label', () => {
  it('comes out of escaping with no angle bracket left loose', () => {
    fc.assert(fc.property(hostile, (text) => {
      const escaped = escapeXml(text)

      expect(escaped).not.toMatch(/[<>]/)
      expect(escaped.replaceAll('&amp;', '').replaceAll('&lt;', '')
        .replaceAll('&gt;', '').replaceAll('&quot;', '').replaceAll('&apos;', ''))
        .not.toMatch(/&/)
    }), RUNS)
  })

  it('stays readable as xml once wrapped and escaped', () => {
    fc.assert(fc.property(hostile, fc.integer({ min: 1, max: 60 }), (text, width) => {
      const parsed = new DOMParser().parseFromString(
        `<t>${wrapText(text, width).map(escapeXml).join('')}</t>`,
        'application/xml'
      )

      expect(parsed.querySelector('parsererror')).toBeNull()
    }), RUNS)
  })

  it('wraps without losing or inventing a single character', () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 200 }).filter((text) => !/\s/.test(text) || text.trim() !== ''),
      fc.integer({ min: 1, max: 60 }),
      (text, width) => {
        const joined = wrapText(text, width).join(' ')

        expect(joined.replace(/\s+/g, '')).toBe(text.replace(/\s+/g, ''))
      }
    ), RUNS)
  })

  it('never writes a line longer than asked, unless one word is', () => {
    fc.assert(fc.property(
      fc.array(fc.string({ minLength: 1, maxLength: 12 }).filter((word) => !/\s/.test(word)), { maxLength: 20 }),
      fc.integer({ min: 12, max: 60 }),
      (words, width) => {
        for (const line of wrapText(words.join(' '), width)) {
          expect(line.length).toBeLessThanOrEqual(width)
        }
      }
    ), RUNS)
  })
})

describe('the tracking number shown under the preview', () => {
  it('keeps its length and its shape, whatever is masked', () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 40 }),
      fc.integer({ min: 0, max: 20 }),
      (tracking, tail) => {
        const masked = obfuscateTracking(tracking, tail)

        expect(masked).toHaveLength(tracking.length)
        expect(masked.replace(/\d/g, '#')).toBe(tracking.replace(/\d/g, '#'))
      }
    ), RUNS)
  })
})

describe('the zone read off a postal code', () => {
  it('answers something printable for anything typed', () => {
    fc.assert(fc.property(hostile, (postal) => {
      expect(typeof zoneFromPostal(postal)).toBe('string')
    }), RUNS)
  })
})
