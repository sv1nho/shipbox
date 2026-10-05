import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'

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

const productionApp = async () => {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('WEB_ORIGIN', 'https://shipbox.example')
  vi.stubEnv('BETTER_AUTH_URL', 'https://shipbox.example')
  vi.stubEnv('GOOGLE_CLIENT_ID', 'id-for-the-test')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret-for-the-test')

  const { createApp } = await import('../app.js')

  return createApp()
}

describe('what production does not serve', () => {
  it('keeps the api document to itself', async () => {
    await request(await productionApp()).get('/api/openapi.json').expect(404)
  })

  it('closes the browsable documentation', async () => {
    await request(await productionApp()).get('/api/docs/').expect(404)
  })
})
