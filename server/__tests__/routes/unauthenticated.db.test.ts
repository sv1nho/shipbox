import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../prisma.js'
import { bodyOf } from './http.js'
import type { ApiError } from './http.js'
import { REGISTERED } from '../registered-routes.js'

const app = createApp()

const SOME_ID = '11111111-1111-4111-8111-111111111111'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('every private route without a session', () => {
  const PRIVATE = REGISTERED.map(({ method, path }) => ({
    method,
    path: path.replace(/\{\w+\}/g, SOME_ID),
  }))

  it('reaches every router mounted, not only the shipments', () => {
    expect(PRIVATE.map(({ path }) => path)).toEqual(
      expect.arrayContaining(['/api/stores', '/api/dashboard', `/api/shipments/${SOME_ID}/chase`])
    )
  })

  it.each(PRIVATE)('answers 401 to $method $path', async ({ method, path }) => {
    const response = await request(app)[method as 'get'](path).send({})

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.', details: null },
    })
  })

  it('refuses before reading the body, so a malformed payload still gets 401', async () => {
    const response = await request(app)
      .post('/api/shipments')
      .send({ nothing: 'valid' })

    expect(response.status).toBe(401)
  })

  it('refuses before validating the id, so a bad uuid still gets 401 and not 422', async () => {
    const response = await request(app).get('/api/shipments/not-a-uuid')

    expect(response.status).toBe(401)
  })
})

describe('routes that stay public', () => {
  it('serves the health check', async () => {
    await request(app).get('/api/health').expect(200)
  })

  it('serves the provider list', async () => {
    await request(app).get('/api/config').expect(200)
  })

  it('serves the openapi document', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200)

    expect(bodyOf(response).openapi).toBe('3.1.0')
  })

  it('answers 401 on the identity route, which needs a session', async () => {
    await request(app).get('/api/me').expect(401)
  })
})

describe('unknown routes', () => {
  it('answers 404 in the normalised shape', async () => {
    const response = await request(app).get('/api/nowhere').expect(404)

    expect(bodyOf<ApiError>(response).error.code).toBe('NOT_FOUND')
    expect(bodyOf<ApiError>(response).error.message).toContain('GET /api/nowhere')
  })
})
