import { describe, it, expect } from 'vitest'
import { SOCIAL_PROVIDER_IDS, isSocialProviderId } from '../auth-providers.js'

describe('isSocialProviderId', () => {
  it.each(SOCIAL_PROVIDER_IDS)('accepts the declared provider %s', (id) => {
    expect(isSocialProviderId(id)).toBe(true)
  })

  it.each([
    'facebook',
    'Google',
    'google ',
    '',
    null,
    42,
  ])('rejects %o', (value) => {
    expect(isSocialProviderId(value)).toBe(false)
  })
})
