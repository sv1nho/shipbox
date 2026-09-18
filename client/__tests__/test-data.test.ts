import { describe, it, expect } from 'vitest'
import { getTestData } from '../test-data.js'
import { CARRIERS, CARRIER_IDS } from '../../shared/carriers.js'

describe('getTestData', () => {
  it.each(CARRIER_IDS)('gives %s a tracking number the carrier would accept', (carrier) => {
    const data = getTestData(carrier)

    expect(data.carrier).toBe(carrier)
    expect(CARRIERS[carrier].pattern.test(data.tracking_number)).toBe(true)
  })

  it('changes nothing but the carrier and its number between the two', () => {
    const bpost = getTestData('bpost')
    const postnl = getTestData('postnl')

    expect({ ...postnl, carrier: bpost.carrier, tracking_number: bpost.tracking_number })
      .toEqual(bpost)
  })
})
