import { describe, it, expect, vi, afterEach } from 'vitest'
import { labelFileName } from '../../utils/label-file-name.js'
import { CARRIER_IDS } from '../../../shared/carriers.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('what a downloaded label is called', () => {
  it.each(CARRIER_IDS)('names a %s label after the carrier and the day it was printed', (carrier) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T14:30:00Z'))

    expect(labelFileName(carrier)).toBe(`label-${carrier}-2026-09-23.pdf`)
  })

  it('reads the day in Brussels, not UTC, so a late evening print keeps its date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T23:30:00Z'))

    expect(labelFileName('bpost')).toBe('label-bpost-2026-09-24.pdf')
  })
})
