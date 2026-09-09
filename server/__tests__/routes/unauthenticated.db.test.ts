import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { prisma } from '../../prisma.js'
import { bodyOf } from './http.js'
import type { ApiError } from './http.js'

const app = createApp()

const SOME_ID = '11111111-1111-4111-8111-111111111111'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('every shipment route without a session', () => {
  it.each([
    ['GET', '/api/shipments'],
    ['POST', '/api/shipments'],
    ['GET', '/api/shipments/exists?carrier=bpost&trackingNumber=323200000000000000000001'],
    ['GET', '/api/shipments/stores'],
    ['GET', '/api/shipments/export'],
    ['GET', `/api/shipments/${SOME_ID}`],
    ['GET', `/api/shipments/${SOME_ID}/label`],
    ['PATCH', `/api/shipments/${SOME_ID}`],
    ['POST', `/api/shipments/${SOME_ID}/correct-identity`],
    ['POST', `/api/shipments/${SOME_ID}/drop-off`],
    ['POST', `/api/shipments/${SOME_ID}/receive`],
    ['POST', `/api/shipments/${SOME_ID}/refund`],
    ['POST', `/api/shipments/${SOME_ID}/reject`],
    ['POST', `/api/shipments/${SOME_ID}/revert`],
    ['POST', `/api/shipments/${SOME_ID}/archive`],
    ['POST', `/api/shipments/${SOME_ID}/unarchive`],
    ['DELETE', `/api/shipments/${SOME_ID}`],
  ])('answers 401 to %s %s', async (method, path) => {
    const response = await request(app)[method.toLowerCase() as 'get'](path).send({})

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
