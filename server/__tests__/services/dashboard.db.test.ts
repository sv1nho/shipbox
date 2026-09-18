import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { prisma } from '../../prisma.js'
import * as shipments from '../../services/shipments/index.js'
import { summary } from '../../services/dashboard.js'
import { daysAgo } from '../days.js'
import type { CreateShipmentInput } from '../../services/shipments/types.js'

const OWNER = 'dashboard-tests-owner'
const OTHER = 'dashboard-tests-other'

let counter = 0

const input = (overrides: Partial<CreateShipmentInput> = {}): CreateShipmentInput => {
  counter += 1

  return {
    trackingNumber: `3232${String(counter).padStart(20, '0')}`,
    carrier: 'bpost',
    recipientPostalCode: '2000',
    recipientCountry: 'BE',
    amountCents: 1000,
    store: 'Zalando',
    orderNumber: 'ZAL-2026-0001',
    requestedDate: '2026-01-01',
    ...overrides,
  }
}

beforeAll(async () => {
  for (const [id, email] of [[OWNER, 'dash-owner@example.test'], [OTHER, 'dash-other@example.test']]) {
    await prisma.user.upsert({ where: { id }, create: { id, name: 'Dashboard tests', email }, update: {} })
  }
})

afterEach(async () => {
  await prisma.shipment.deleteMany({ where: { userId: { in: [OWNER, OTHER] } } })
  await prisma.store.deleteMany({ where: { userId: { in: [OWNER, OTHER] } } })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER] } } })
  await prisma.$disconnect()
})

describe('an account with nothing in it', () => {
  it('claims no rate rather than dividing by zero', async () => {
    const result = await summary(OWNER)

    expect(result.successRate).toBeNull()
    expect(result.decided).toBe(0)
    expect(result.byStore).toEqual([])
  })
})

describe('the success rate', () => {
  it('counts the refunds against every decided return, refusals included', async () => {
    await shipments.create(OWNER, input({ status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ status: 'rejected', decisionDate: '2026-02-01' }))

    const result = await summary(OWNER)

    expect(result.decided).toBe(4)
    expect(result.refunded).toBe(3)
    expect(result.successRate).toBe(0.75)
  })

  it('ignores the returns still waiting, which no store has judged', async () => {
    await shipments.create(OWNER, input({ status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input())

    const result = await summary(OWNER)

    expect(result.successRate).toBe(1)
    expect(result.open).toBe(1)
  })

  it('counts a parcel lost in transit and then refused as the failure it is', async () => {
    await shipments.create(OWNER, input({
      status: 'rejected',
      dropoffDate: '2026-01-03',
      decisionDate: '2026-01-19',
      neverReceived: true,
    }))

    const result = await summary(OWNER)

    expect(result.decided).toBe(1)
    expect(result.successRate).toBe(0)
  })
})

describe('the money', () => {
  it('splits it by what the store decided', async () => {
    await shipments.create(OWNER, input({ amountCents: 5000, status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ amountCents: 900, status: 'rejected', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ amountCents: 300 }))

    const result = await summary(OWNER)

    expect(result.recoveredCents).toBe(5000)
    expect(result.lostCents).toBe(900)
    expect(result.awaitingCents).toBe(300)
  })
})

describe('the average decision time per store', () => {
  it('measures from the reception, and from the drop-off when there was none', async () => {
    await shipments.create(OWNER, input({
      store: 'Zalando',
      status: 'refunded',
      dropoffDate: '2026-01-03',
      receivedDate: '2026-01-06',
      decisionDate: '2026-01-10',
    }))
    await shipments.create(OWNER, input({
      store: 'Bol.com',
      status: 'refunded',
      dropoffDate: '2026-01-03',
      decisionDate: '2026-01-19',
      neverReceived: true,
    }))

    const result = await summary(OWNER)

    expect(result.byStore).toEqual([
      { store: 'Bol.com', returns: 1, decided: 1, refunded: 1, measured: 1, averageDecisionDays: 16 },
      { store: 'Zalando', returns: 1, decided: 1, refunded: 1, measured: 1, averageDecisionDays: 4 },
    ])
  })

  it('reports the sample apart from the total, an open return not being timed', async () => {
    await shipments.create(OWNER, input({
      status: 'refunded',
      dropoffDate: '2026-01-03',
      receivedDate: '2026-01-06',
      decisionDate: '2026-01-10',
    }))
    await shipments.create(OWNER, input())

    const result = await summary(OWNER)

    expect(result.byStore[0]).toEqual({
      store: 'Zalando',
      returns: 2,
      decided: 1,
      refunded: 1,
      measured: 1,
      averageDecisionDays: 4,
    })
    expect(result.measuredDecisions).toBe(1)
  })

  it('leaves a store with nothing decided in the list, but without an average', async () => {
    await shipments.create(OWNER, input({ store: 'Nike' }))

    expect((await summary(OWNER)).byStore).toEqual([
      { store: 'Nike', returns: 1, decided: 0, refunded: 0, measured: 0, averageDecisionDays: null },
    ])
  })

  it('puts the slowest store first, which is the one worth looking at', async () => {
    for (const [store, decisionDate] of [['Fast', '2026-01-08'], ['Slow', '2026-01-30']]) {
      await shipments.create(OWNER, input({
        store,
        status: 'refunded',
        dropoffDate: '2026-01-03',
        receivedDate: '2026-01-06',
        decisionDate,
      }))
    }

    expect((await summary(OWNER)).byStore.map((row) => row.store)).toEqual(['Slow', 'Fast'])
  })
})

describe('how each store answers', () => {
  it('counts the refunds and the refusals it decided on, apart from the open ones', async () => {
    await shipments.create(OWNER, input({ status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ status: 'rejected', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input())

    const [zalando] = (await summary(OWNER)).byStore

    expect(zalando.returns).toBe(4)
    expect(zalando.decided).toBe(3)
    expect(zalando.refunded).toBe(2)
  })

  it('keeps each store to its own returns', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando', status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ store: 'Nike', status: 'rejected', decisionDate: '2026-02-01' }))

    const byName = new Map((await summary(OWNER)).byStore.map((row) => [row.store, row]))

    expect(byName.get('Zalando')?.refunded).toBe(1)
    expect(byName.get('Nike')?.refunded).toBe(0)
    expect(byName.get('Nike')?.decided).toBe(1)
  })

  it('adds each store up to the totals the hero figure shows', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando', status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ store: 'Nike', status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ store: 'Nike', status: 'rejected', decisionDate: '2026-02-01' }))

    const result = await summary(OWNER)

    expect(result.byStore.reduce((total, row) => total + row.decided, 0)).toBe(result.decided)
    expect(result.byStore.reduce((total, row) => total + row.refunded, 0)).toBe(result.refunded)
  })
})

describe('what needs attention', () => {
  it('counts the same returns the list filter would show', async () => {
    await shipments.create(OWNER, input({
      status: 'received',
      requestedDate: daysAgo(30),
      dropoffDate: daysAgo(28),
      receivedDate: daysAgo(20),
    }))
    await shipments.create(OWNER, input({ requestedDate: daysAgo(2) }))

    const result = await summary(OWNER)
    const filtered = await shipments.list(OWNER, { attention: true })

    expect(result.attention).toBe(1)
    expect(result.attention).toBe(filtered.total)
  })

  it('drops a return already chased, the work being done', async () => {
    const late = await shipments.create(OWNER, input({
      status: 'received',
      requestedDate: daysAgo(30),
      dropoffDate: daysAgo(28),
      receivedDate: daysAgo(20),
    }))

    await shipments.chase(OWNER, late.id)

    expect((await summary(OWNER)).attention).toBe(0)
  })
})

describe('every figure can be reproduced by the list the tile links to', () => {
  const aSpread = async () => {
    await shipments.create(OWNER, input({ amountCents: 5000, status: 'refunded', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ amountCents: 900, status: 'rejected', decisionDate: '2026-02-01' }))
    await shipments.create(OWNER, input({ amountCents: 300 }))

    const archived = await shipments.create(OWNER, input({
      amountCents: 700,
      status: 'refunded',
      decisionDate: '2026-02-01',
    }))
    await shipments.archive(OWNER, archived.id)
  }

  it.each([
    ['refunded', 'refunded'],
    ['rejected', 'rejected'],
    ['open', 'open'],
  ] as const)('counts %s as the list filtered on %s does', async (_label, status) => {
    await aSpread()

    const result = await summary(OWNER)
    const listed = await shipments.list(OWNER, { status, archived: 'include' })

    const expected =
      status === 'refunded'
        ? result.refunded
        : status === 'rejected'
          ? result.decided - result.refunded
          : result.open

    expect(listed.total).toBe(expected)
  })

  it('would miss the archived ones if the link forgot to ask for them', async () => {
    await aSpread()

    const result = await summary(OWNER)
    const withoutArchived = await shipments.list(OWNER, { status: 'refunded' })

    expect(result.refunded).toBe(2)
    expect(withoutArchived.total).toBe(1)
  })
})

describe('what belongs to whom', () => {
  it('counts nothing from another account', async () => {
    await shipments.create(OTHER, input({ status: 'refunded', decisionDate: '2026-02-01' }))

    const result = await summary(OWNER)

    expect(result.decided).toBe(0)
    expect(result.byStore).toEqual([])
  })

  it('still counts an archived return, which happened all the same', async () => {
    const refunded = await shipments.create(OWNER, input({
      amountCents: 5000,
      status: 'refunded',
      dropoffDate: '2026-01-03',
      receivedDate: '2026-01-06',
      decisionDate: '2026-01-10',
    }))

    await shipments.archive(OWNER, refunded.id)

    const result = await summary(OWNER)

    expect(result.decided).toBe(1)
    expect(result.recoveredCents).toBe(5000)
    expect(result.byStore[0].measured).toBe(1)
  })
})
