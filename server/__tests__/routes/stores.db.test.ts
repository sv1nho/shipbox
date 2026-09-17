import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import type { NextFunction, Request, Response } from 'express'
import { bodyOf } from './http.js'

const OWNER = 'store-route-owner'

vi.mock('../../auth/require-user.js', () => ({
  requireUser: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: OWNER, email: `${OWNER}@example.test`, name: 'Store routes', image: null }
    next()
  },
  currentUser: (req: Request) => req.user,
}))

const { prisma } = await import('../../prisma.js')
const { createApp } = await import('../../app.js')

const app = createApp()

type StoreBody = { name: string; supportEmail: string | null }

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: OWNER },
    create: { id: OWNER, name: 'Store routes', email: 'store-routes@example.test' },
    update: {},
  })
})

afterEach(async () => {
  await prisma.shipment.deleteMany({ where: { userId: OWNER } })
  await prisma.store.deleteMany({ where: { userId: OWNER } })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: OWNER } })
  await prisma.$disconnect()
})

const add = (name: string, supportEmail: string) =>
  request(app).post('/api/stores').send({ name, supportEmail })

describe('POST /api/stores', () => {
  it('adds a store with the address it will write to', async () => {
    const response = await add('Zalando', 'service@zalando.be').expect(201)

    expect(bodyOf<StoreBody>(response)).toEqual({
      name: 'Zalando',
      supportEmail: 'service@zalando.be',
    })
  })

  it('refuses a store with no address', async () => {
    await request(app).post('/api/stores').send({ name: 'Zalando' }).expect(422)
  })

  it('refuses something that is not an address', async () => {
    await add('Zalando', 'not-an-email').expect(422)
  })

  it('reuses a name that differs only by case, spacing or accents', async () => {
    await add('Décathlon', 'contact@decathlon.be').expect(201)

    const response = await add('  decathlon  ', 'other@decathlon.be').expect(201)

    expect(bodyOf<StoreBody>(response).name).toBe('Décathlon')
    expect(await prisma.store.count({ where: { userId: OWNER } })).toBe(1)
  })

  it('names the store to pick when the name is only close', async () => {
    await add('Zalando', 'service@zalando.be').expect(201)

    const response = await add('Zalndo', 'service@zalando.be').expect(409)

    expect(bodyOf<{ error: { message: string } }>(response).error.message)
      .toContain('You already track Zalando')
    expect(await prisma.store.count({ where: { userId: OWNER } })).toBe(1)
  })

  it('still lets a genuinely different store through', async () => {
    await add('Zalando', 'service@zalando.be').expect(201)

    await add('Nike', 'support@nike.com').expect(201)

    expect(await prisma.store.count({ where: { userId: OWNER } })).toBe(2)
  })

  it('fills the address of a store an import created without one', async () => {
    await prisma.store.create({ data: { userId: OWNER, name: 'Snipes' } })

    const response = await add('Snipes', 'support@snipes.com').expect(201)

    expect(bodyOf<StoreBody>(response).supportEmail).toBe('support@snipes.com')
  })

  it('corrects an address that was wrong, since this is the only way to set one', async () => {
    await add('Zalando', 'typo@zalando.be').expect(201)

    const response = await add('Zalando', 'service@zalando.be').expect(201)

    expect(bodyOf<StoreBody>(response).supportEmail).toBe('service@zalando.be')
    expect(await prisma.store.count({ where: { userId: OWNER } })).toBe(1)
  })
})

describe('GET /api/stores', () => {
  it('suggests the stores it holds', async () => {
    await add('Zalando', 'service@zalando.be').expect(201)

    const response = await request(app).get('/api/stores?q=zal').expect(200)

    expect(bodyOf<{ stores: StoreBody[] }>(response).stores)
      .toEqual([{ name: 'Zalando', supportEmail: 'service@zalando.be' }])
  })

  it('lists them all when nothing is asked', async () => {
    await add('Zalando', 'a@b.test').expect(201)
    await add('Nike', 'c@d.test').expect(201)

    const response = await request(app).get('/api/stores').expect(200)

    expect(bodyOf<{ stores: StoreBody[] }>(response).stores).toHaveLength(2)
  })
})
