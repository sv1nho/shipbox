import { describe, it, expect } from 'vitest'
import {
  parseAmount,
  normalizeCountry,
  normalizePostalCode,
  normalizeStore,
  normalizeTrackingNumber,
} from '../normalize.js'

describe('normalizePostalCode', () => {
  it('removes the space a dutch postal code is usually written with', () => {
    expect(normalizePostalCode('5145 RC')).toBe('5145RC')
  })

  it.each([
    ['5145rc', '5145RC'],
    ['  5145 RC  ', '5145RC'],
    ['5145\tRC', '5145RC'],
    ['5145  RC', '5145RC'],
    ['2000', '2000'],
  ])('turns %s into %s', (input, expected) => {
    expect(normalizePostalCode(input)).toBe(expected)
  })

  it('is idempotent, so writing twice never drifts', () => {
    expect(normalizePostalCode(normalizePostalCode('5145 RC'))).toBe('5145RC')
  })
})

describe('normalizeCountry', () => {
  it.each([
    ['be', 'BE'],
    [' nl ', 'NL'],
    ['Be', 'BE'],
  ])('turns %s into %s', (input, expected) => {
    expect(normalizeCountry(input)).toBe(expected)
  })
})

describe('normalizeTrackingNumber', () => {
  it('removes the spaces a carrier prints for readability', () => {
    expect(normalizeTrackingNumber('3232 0000 0000 0000 0000 4050')).toBe('323200000000000000004050')
  })

  it('uppercases the letters PostNL uses', () => {
    expect(normalizeTrackingNumber('3sddrl000000409')).toBe('3SDDRL000000409')
  })
})

describe('normalizeStore', () => {
  it('trims the stray whitespace of a copy and paste', () => {
    expect(normalizeStore('  Zalando  ')).toBe('Zalando')
  })

  it('collapses a doubled inner space, which nobody types on purpose', () => {
    expect(normalizeStore('Zalando  BE')).toBe('Zalando BE')
  })

  it('keeps the case the user chose, since it is their label', () => {
    expect(normalizeStore('zalando')).toBe('zalando')
  })

  it('keeps accents, since the store search folds them on its own', () => {
    expect(normalizeStore('Décathlon')).toBe('Décathlon')
  })

  it('never merges two stores that differ by more than whitespace', () => {
    expect(normalizeStore('Zalando BE')).not.toBe(normalizeStore('Zalando FR'))
    expect(normalizeStore('Zalando')).not.toBe(normalizeStore('Zalando BE'))
  })
})

describe('parseAmount', () => {
  it.each([
    ['49.99', 4999],
    ['49,99', 4999],
    ['  10 ', 1000],
    ['0', 0],
    ['1234.5', 123450],
  ])('reads %s as %i cents', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected)
  })

  it.each(['', 'free', '-5', '49.999', '1.2.3', '1e3'])('refuses %s', (raw) => {
    expect(parseAmount(raw)).toBeNull()
  })

  it('never loses a cent to floating point', () => {
    expect(parseAmount('29.99')).toBe(2999)
    expect(parseAmount('10.10')).toBe(1010)
  })
})
