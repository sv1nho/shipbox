import { describe, it, expect } from 'vitest'
import { envSchema } from '../env-schema.js'

const VALID = {
  DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5433/db?schema=public',
  WEB_ORIGIN: 'http://localhost:5173',
  BETTER_AUTH_URL: 'http://localhost:5173',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
}

const parse = (overrides: Record<string, string | undefined> = {}) =>
  envSchema.safeParse({ ...VALID, ...overrides })

const pathsOf = (result: ReturnType<typeof parse>): string[] =>
  result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))

describe('envSchema', () => {
  describe('defaults', () => {
    it('runs in development on 127.0.0.1:3000 when nothing is specified', () => {
      const result = parse()

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.NODE_ENV).toBe('development')
      expect(result.data.API_HOST).toBe('127.0.0.1')
      expect(result.data.API_PORT).toBe(3000)
    })
  })

  describe('DATABASE_URL', () => {
    it.each([
      'postgresql://user:pass@host:5432/db',
      'postgres://user:pass@host:5432/db',
    ])('accepts %s', (url) => {
      expect(parse({ DATABASE_URL: url }).success).toBe(true)
    })

    it.each([
      'mysql://user:pass@host:3306/db',
      'file:./dev.db',
      'user:pass@host:5432/db',
      '',
    ])('rejects %s', (url) => {
      expect(pathsOf(parse({ DATABASE_URL: url }))).toContain('DATABASE_URL')
    })
  })

  describe('API_PORT', () => {
    it('coerces the string coming from the environment into a number', () => {
      const result = parse({ API_PORT: '4000' })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.API_PORT).toBe(4000)
    })

    it.each(['80', '443', '1023'])('rejects the privileged port %s', (port) => {
      expect(pathsOf(parse({ API_PORT: port }))).toContain('API_PORT')
    })

    it('accepts the first unprivileged port', () => {
      expect(parse({ API_PORT: '1024' }).success).toBe(true)
    })

    it.each(['65536', '3000.5', 'abc'])('rejects %s', (port) => {
      expect(pathsOf(parse({ API_PORT: port }))).toContain('API_PORT')
    })
  })

  describe('BETTER_AUTH_SECRET', () => {
    it('rejects a secret one character short of the minimum', () => {
      expect(pathsOf(parse({ BETTER_AUTH_SECRET: 'a'.repeat(31) }))).toContain('BETTER_AUTH_SECRET')
    })
  })

  describe.each(['WEB_ORIGIN', 'BETTER_AUTH_URL'] as const)('%s', (key) => {
    it.each([
      'https://shipbox.example',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
    ])('accepts %s', (value) => {
      expect(parse({ [key]: value }).success).toBe(true)
    })

    it.each([
      'localhost:5173',
      '/api',
      'shipbox.example',
      'ftp://shipbox.example',
      '',
    ])('rejects %s, which would silently break the OAuth redirect', (value) => {
      expect(pathsOf(parse({ [key]: value }))).toContain(key)
    })
  })

  describe('OAuth provider pairs', () => {
    it('treats an empty string as an absent value', () => {
      const result = parse({
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '   ',
        GITHUB_CLIENT_ID: '',
        GITHUB_CLIENT_SECRET: '',
      })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.GOOGLE_CLIENT_ID).toBeUndefined()
      expect(result.data.GOOGLE_CLIENT_SECRET).toBeUndefined()
    })

    it('rejects an id without its secret', () => {
      expect(pathsOf(parse({ GOOGLE_CLIENT_ID: 'id' }))).toContain('GOOGLE_CLIENT_SECRET')
    })

    it('rejects a secret without its id', () => {
      expect(pathsOf(parse({ GITHUB_CLIENT_SECRET: 'secret' }))).toContain('GITHUB_CLIENT_ID')
    })

    it('accepts a complete pair', () => {
      expect(parse({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }).success).toBe(true)
    })

    it('reports each incomplete pair separately', () => {
      const paths = pathsOf(parse({ GOOGLE_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' }))

      expect(paths).toContain('GOOGLE_CLIENT_SECRET')
      expect(paths).toContain('GITHUB_CLIENT_ID')
    })
  })

  describe('production', () => {
    const inProduction = (overrides: Record<string, string> = {}) =>
      parse({
        NODE_ENV: 'production',
        WEB_ORIGIN: 'https://shipbox.example',
        BETTER_AUTH_URL: 'https://shipbox.example',
        ...overrides,
      })

    it('rejects a configuration with no provider at all', () => {
      expect(pathsOf(inProduction())).toContain('GOOGLE_CLIENT_ID')
    })

    it('does not count a half-configured pair as a provider', () => {
      const paths = pathsOf(inProduction({ GOOGLE_CLIENT_ID: 'id' }))

      expect(paths).toContain('GOOGLE_CLIENT_SECRET')
      expect(paths).toContain('GOOGLE_CLIENT_ID')
    })

    it('accepts a single complete provider', () => {
      expect(inProduction({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' }).success).toBe(true)
    })

    it('refuses the browser-test sign-in, which would open a password door', () => {
      const paths = pathsOf(inProduction({
        GITHUB_CLIENT_ID: 'id',
        GITHUB_CLIENT_SECRET: 'secret',
        E2E_AUTH: 'true',
      }))

      expect(paths).toContain('E2E_AUTH')
    })

    it('leaves that sign-in available to the browser tests outside production', () => {
      const result = parse({ E2E_AUTH: 'true' })

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.E2E_AUTH).toBe(true)
    })

    it('keeps it shut when nothing says otherwise', () => {
      const result = parse()

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.E2E_AUTH).toBe(false)
    })

    it('does not require a provider outside production', () => {
      expect(parse({ NODE_ENV: 'development' }).success).toBe(true)
      expect(parse({ NODE_ENV: 'test' }).success).toBe(true)
    })
  })

  describe('https in production', () => {
    const productionWith = (overrides: Record<string, string>) =>
      parse({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        WEB_ORIGIN: 'https://shipbox.example',
        BETTER_AUTH_URL: 'https://shipbox.example',
        ...overrides,
      })

    it('accepts https on both URLs', () => {
      expect(productionWith({}).success).toBe(true)
    })

    it.each(['WEB_ORIGIN', 'BETTER_AUTH_URL'] as const)('rejects plain http on %s', (key) => {
      expect(pathsOf(productionWith({ [key]: 'http://shipbox.example' }))).toContain(key)
    })

    it.each(['WEB_ORIGIN', 'BETTER_AUTH_URL'] as const)(
      'rejects http on %s even for localhost, since the Secure cookie would never be sent',
      (key) => {
        expect(pathsOf(productionWith({ [key]: 'http://localhost:5173' }))).toContain(key)
      }
    )

    it('still accepts plain http outside production', () => {
      expect(parse({ NODE_ENV: 'development', WEB_ORIGIN: 'http://localhost:5173' }).success).toBe(true)
      expect(parse({ NODE_ENV: 'test', BETTER_AUTH_URL: 'http://127.0.0.1:3000' }).success).toBe(true)
    })
  })
})
