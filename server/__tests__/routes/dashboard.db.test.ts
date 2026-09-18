import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import { bodyOf } from './http.js'
import type { DashboardSummary } from '../../../shared/dashboard.js'

const OWNER = 'dash-route-owner'
const OTHER = 'dash-route-other'

let signedInAs = OWNER

vi.mock('../../auth/require-user.js', () => ({
  requireUser: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: signedInAs, email: `${signedInAs}@example.test`, name: 'Dash', image: null }
    next()
  },
  currentUser: (req: { user: { id: string } }) => req.user,
}))

const { createApp } = await import('../../app.js')
const { prisma } = await import('../../prisma.js')

const app = createApp()

beforeAll(async () => {
  for (const [id, email] of [[OWNER, 'dr-owner@example.test'], [OTHER, 'dr-other@example.test']]) {
    await prisma.user.upsert({ where: { id }, create: { id, name: 'Dash', email }, update: {} })
  }
})

afterEach(async () => {
  signedInAs = OWNER
  await prisma.shipment.deleteMany({ where: { userId: { in: [OWNER, OTHER] } } })
  await prisma.store.deleteMany({ where: { userId: { in: [OWNER, OTHER] } } })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER] } } })
  await prisma.$disconnect()
})

describe('GET /api/dashboard', () => {
  it('answers with every figure the page needs, even on an empty account', async () => {
    const response = await request(app).get('/api/dashboard').expect(200)

    expect(bodyOf<DashboardSummary>(response)).toEqual({
      decided: 0,
      refunded: 0,
      successRate: null,
      open: 0,
      attention: 0,
      recoveredCents: 0,
      lostCents: 0,
      awaitingCents: 0,
      measuredDecisions: 0,
      byStore: [],
    })
  })

  it('answers with json numbers, never a bigint the serialiser would choke on', async () => {
    await request(app)
      .post('/api/shipments')
      .send({
        trackingNumber: '323200000000000000000777',
        carrier: 'bpost',
        recipientPostalCode: '2000',
        recipientCountry: 'BE',
        amountCents: 4999,
        store: 'Zalando',
        orderNumber: 'ZAL-1',
        requestedDate: '2026-01-01',
      })
      .expect(201)

    const body = bodyOf<DashboardSummary>(await request(app).get('/api/dashboard').expect(200))

    expect(body.byStore).toEqual([
      { store: 'Zalando', returns: 1, decided: 0, refunded: 0, measured: 0, averageDecisionDays: null },
    ])
    expect(typeof body.byStore[0].returns).toBe('number')
  })
})
