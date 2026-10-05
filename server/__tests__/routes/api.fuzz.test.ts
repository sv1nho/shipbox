import { describe, it, expect, afterAll, vi } from 'vitest'
import fc from 'fast-check'
import request from 'supertest'
import type { NextFunction, Request, Response } from 'express'
import { bodyOf } from './http.js'
import type { ApiError } from './http.js'

const OWNER = 'fuzz-tests-owner'

vi.mock('../../auth/require-user.js', () => ({
  requireUser: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: OWNER, email: `${OWNER}@example.test`, name: 'Fuzz tests', image: null }
    next()
  },
  currentUser: (req: Request) => req.user,
}))

const { createApp } = await import('../../app.js')
const { prisma } = await import('../../prisma.js')

const app = createApp()

const RUNS = { numRuns: Number(process.env.FUZZ_RUNS ?? 150) }

const ACCEPTED = new Set([200, 201, 204, 400, 401, 403, 404, 409, 413, 415, 422, 429])

const hostileText = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.string({ maxLength: 5000 }),
  fc.constantFrom(
    '\u0000', 'a\u0000b', '�', '𝕏'.repeat(100), '../../etc/passwd',
    "'; DROP TABLE shipments; --", '<script>alert(1)</script>', '{{7*7}}',
    '\r\nSet-Cookie: stolen=1', 'javascript:alert(1)', '%00', '\\u0000'
  ),
  fc.string({ maxLength: 300, unit: 'binary' })
)

const hostileValue = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small' },
    hostileText,
    fc.constantFrom(null, true, false, 0, -1, 1e308, -1e308, Number.MAX_SAFE_INTEGER, 0.1 + 0.2),
    fc.array(tie('value'), { maxLength: 8 }),
    fc.dictionary(fc.oneof(hostileText, fc.constantFrom('__proto__', 'constructor', 'prototype')), tie('value'), { maxKeys: 8 })
  ),
})).value

const WRITES = [
  ['post', '/api/shipments'],
  ['post', '/api/shipments/import'],
  ['post', '/api/stores'],
  ['patch', '/api/shipments/11111111-1111-4111-8111-111111111111'],
  ['post', '/api/shipments/11111111-1111-4111-8111-111111111111/drop-off'],
  ['post', '/api/shipments/11111111-1111-4111-8111-111111111111/reject'],
] as const

const READS = [
  '/api/shipments',
  '/api/shipments/exists',
  '/api/shipments/export',
  '/api/stores',
] as const

afterAll(async () => {
  await prisma.shipment.deleteMany({ where: { userId: OWNER } })
  await prisma.store.deleteMany({ where: { userId: OWNER } })
  await prisma.$disconnect()
})

describe('a write fed anything at all', () => {
  for (const [method, path] of WRITES) {
    it(`answers ${method.toUpperCase()} ${path} without ever breaking`, async () => {
      await fc.assert(fc.asyncProperty(hostileValue, async (body) => {
        const response = await request(app)[method](path)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(body) ?? 'null')

        expect(ACCEPTED.has(response.status), `${String(response.status)} for ${JSON.stringify(body).slice(0, 120)}`)
          .toBe(true)

        if (response.status >= 400 && typeof response.body === 'object') {
          const { error } = bodyOf<ApiError>(response)

          expect(typeof error.code).toBe('string')
          expect(typeof error.message).toBe('string')
        }
      }), RUNS)
    }, 120_000)
  }
})

describe('a read fed any query string at all', () => {
  for (const path of READS) {
    it(`answers GET ${path} without ever breaking`, async () => {
      await fc.assert(fc.asyncProperty(
        fc.dictionary(hostileText, hostileText, { maxKeys: 6 }),
        async (query) => {
          const response = await request(app).get(path).query(query)

          expect(ACCEPTED.has(response.status), `${String(response.status)} for ${JSON.stringify(query).slice(0, 120)}`)
            .toBe(true)
        }
      ), RUNS)
    }, 120_000)
  }
})

describe('a body that is not what it claims', () => {
  it('refuses broken json instead of crashing', async () => {
    const response = await request(app)
      .post('/api/shipments')
      .set('Content-Type', 'application/json')
      .send('{"trackingNumber": ')

    expect(ACCEPTED.has(response.status)).toBe(true)
  })

  it('refuses a body larger than the limit', async () => {
    const response = await request(app)
      .post('/api/shipments')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ note: 'x'.repeat(300_000) }))

    expect([400, 413, 422]).toContain(response.status)
  })
})
