import { describe, it, expect, vi, afterEach } from 'vitest'

vi.setConfig({ testTimeout: 20_000 })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const appWithEnv = async (hops: string) => {
  vi.resetModules()
  vi.stubEnv('TRUSTED_PROXY_HOPS', hops)

  const { createApp } = await import('../app.js')

  return createApp()
}

describe('what the api believes about the caller address', () => {
  it('trusts no proxy by default, so a forwarded header cannot fake an address', async () => {
    const app = await appWithEnv('0')

    expect(app.get('trust proxy')).toBe(false)
  })

  it('trusts as many hops as it was told, so the rate limit counts real callers', async () => {
    const app = await appWithEnv('1')

    expect(app.get('trust proxy')).toBe(1)
  })
})
