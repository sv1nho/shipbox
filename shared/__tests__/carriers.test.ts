import { describe, it, expect } from 'vitest'
import { CARRIERS, CARRIER_IDS, getTrackingUrl, isCarrierId } from '../carriers.js'
import type { CarrierId, TrackingTarget } from '../carriers.js'

const target = (carrier: CarrierId, overrides: Partial<TrackingTarget> = {}): TrackingTarget => ({
  carrier,
  trackingNumber: '3SDDRL000000409',
  recipientPostalCode: '5145RC',
  recipientCountry: 'NL',
  ...overrides,
})

describe('isCarrierId', () => {
  it.each(CARRIER_IDS)('accepts the declared carrier %s', (id) => {
    expect(isCarrierId(id)).toBe(true)
  })

  it.each(['dhl', 'BPOST', 'bpost ', '', null, 42])('rejects %o', (value) => {
    expect(isCarrierId(value)).toBe(false)
  })
})

describe('getTrackingUrl', () => {
  it.each(CARRIER_IDS)('builds an absolute https link for %s', (carrier) => {
    const url = new URL(getTrackingUrl(target(carrier), 'fr'))

    expect(url.protocol).toBe('https:')
    expect(url.hostname).not.toBe('')
  })

  it.each(CARRIER_IDS)('carries the tracking number for %s', (carrier) => {
    const url = getTrackingUrl(target(carrier, { trackingNumber: 'ABC123' }), 'fr')

    expect(url).toContain('ABC123')
  })

  it.each(CARRIER_IDS)('carries the postal code for %s', (carrier) => {
    const url = getTrackingUrl(target(carrier, { recipientPostalCode: '5145RC' }), 'fr')

    expect(url).toContain('5145RC')
  })

  it.each(CARRIER_IDS)('never returns null or an empty string for %s', (carrier) => {
    expect(getTrackingUrl(target(carrier), 'fr')).toBeTruthy()
  })

  it.each(CARRIER_IDS)('escapes every injected segment for %s', (carrier) => {
    const url = getTrackingUrl(
      target(carrier, {
        trackingNumber: 'a b&c=d#e',
        recipientPostalCode: '1000 AB',
        recipientCountry: 'B E',
      }),
      'fr'
    )

    expect(url).not.toContain('a b&c=d#e')
    expect(url).toContain('a%20b%26c%3Dd%23e')
    expect(url).toContain('1000%20AB')
  })

  it('sends the language to bpost, which accepts one', () => {
    expect(getTrackingUrl(target('bpost'), 'nl')).toContain('lang=nl')
  })

  it('ignores the language for postnl, whose portal is already local', () => {
    expect(getTrackingUrl(target('postnl'), 'nl')).toBe(getTrackingUrl(target('postnl'), 'fr'))
  })
})

describe('carrier configuration', () => {
  it.each(CARRIER_IDS)('%s declares everything a screen needs', (carrier) => {
    const config = CARRIERS[carrier]

    expect(config.label).not.toBe('')
    expect(config.patternHint).not.toBe('')
    expect(config.placeholder).not.toBe('')
    expect(config.pattern).toBeInstanceOf(RegExp)
  })

  it.each([
    ['bpost', '323200000000000000000001'],
    ['bpost', '329900000000000000000001'],
    ['postnl', '3SDDRL000000409'],
    ['postnl', '2SABC123456'],
  ] as const)('%s accepts the tracking number %s', (carrier, trackingNumber) => {
    expect(CARRIERS[carrier].pattern.test(trackingNumber)).toBe(true)
  })

  it.each([
    ['bpost', '123400000000000000000001'],
    ['bpost', '32320000000000000000001'],
    ['bpost', '3SDDRL000000409'],
    ['postnl', '4SDDRL278573409'],
    ['postnl', '3Sddrl000000409'],
    ['postnl', '323200000000000000000001'],
  ] as const)('%s rejects the tracking number %s', (carrier, trackingNumber) => {
    expect(CARRIERS[carrier].pattern.test(trackingNumber)).toBe(false)
  })

  it('never matches a tracking number under two carriers at once', () => {
    const samples = ['323200000000000000000001', '3SDDRL000000409', '2SABC123456']

    for (const sample of samples) {
      const matches = CARRIER_IDS.filter((id) => CARRIERS[id].pattern.test(sample))
      expect(matches).toHaveLength(1)
    }
  })
})
