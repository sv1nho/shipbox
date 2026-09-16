import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { prisma } from '../../server/prisma.js'

const OWNER = 'constraint-tests-owner'
const OTHER = 'constraint-tests-other'

const insertRaw = (values: Record<string, unknown>): Promise<number> => {
  const columns = Object.keys(values)
  const placeholders = columns.map((_, index) => `$${String(index + 1)}`)

  return prisma.$executeRawUnsafe(
    `INSERT INTO shipments (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
    ...Object.values(values)
  )
}

const valid = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  user_id: OWNER,
  tracking_number: `TRK-${String(Math.random()).slice(2)}`,
  carrier: 'bpost',
  recipient_postal_code: '2000',
  recipient_country: 'BE',
  status: 'pending',
  amount_cents: 1000,
  store: 'Zalando',
  requested_date: '2026-04-01',
  ...overrides,
})

type ShipmentOverrides = {
  userId?: string
  trackingNumber?: string
  carrier?: string
  store?: string
}

const createShipment = (overrides: ShipmentOverrides = {}) =>
  prisma.shipment.create({
    data: {
      userId: OWNER,
      trackingNumber: `TRK-${String(Math.random()).slice(2)}`,
      carrier: 'bpost',
      recipientPostalCode: '2000',
      recipientCountry: 'BE',
      amountCents: 1000,
      store: 'Zalando',
      requestedDate: new Date('2026-06-01T00:00:00.000Z'),
      ...overrides,
    },
  })

beforeAll(async () => {
  for (const [id, email] of [[OWNER, 'owner@example.test'], [OTHER, 'other@example.test']]) {
    await prisma.user.upsert({
      where: { id },
      create: { id, name: 'Constraint tests', email },
      update: {},
    })
  }
})

afterEach(async () => {
  await prisma.shipment.deleteMany({ where: { userId: { in: [OWNER, OTHER] } } })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER] } } })
  await prisma.$disconnect()
})

describe('shipments constraints', () => {
  it('accepts a valid row', async () => {
    await expect(insertRaw(valid())).resolves.toBe(1)
  })

  describe('allowed values', () => {
    it.each(['bpost', 'postnl'])('accepts the carrier %s', async (carrier) => {
      await expect(insertRaw(valid({ carrier }))).resolves.toBe(1)
    })

    it.each(['dhl', 'BPOST', 'ups', ''])('rejects the carrier %s', async (carrier) => {
      await expect(insertRaw(valid({ carrier }))).rejects.toThrow()
    })

    it.each(['pending', 'dropped_off', 'received', 'refunded', 'rejected'])(
      'accepts the status %s with its date',
      async (status) => {
        const dates =
          status === 'dropped_off'
            ? { dropoff_date: '2026-05-01' }
            : status === 'received'
              ? { received_date: '2026-05-01' }
              : status === 'refunded' || status === 'rejected'
                ? { decision_date: '2026-05-01' }
                : {}

        await expect(insertRaw(valid({ status, ...dates }))).resolves.toBe(1)
      }
    )

    it.each(['lost', 'PENDING', 'delivered'])('rejects the status %s', async (status) => {
      await expect(insertRaw(valid({ status }))).rejects.toThrow()
    })

    it('accepts a zero amount', async () => {
      await expect(insertRaw(valid({ amount_cents: 0 }))).resolves.toBe(1)
    })

    it('rejects a negative amount', async () => {
      await expect(insertRaw(valid({ amount_cents: -1 }))).rejects.toThrow()
    })
  })

  describe('required values', () => {
    it.each(['store', 'amount_cents', 'recipient_postal_code', 'recipient_country', 'tracking_number'])(
      'rejects a null %s',
      async (column) => {
        await expect(insertRaw(valid({ [column]: null }))).rejects.toThrow()
      }
    )
  })

  describe('chronological order', () => {
    it.each([
      ['a drop-off before the return was requested', { dropoff_date: '2026-03-01' }],
      ['a reception before the return was requested', { received_date: '2026-03-01', status: 'received' }],
      ['a decision before the return was requested', { decision_date: '2026-03-01', status: 'refunded' }],
      ['dropoff after received', { dropoff_date: '2026-05-10', received_date: '2026-05-01', status: 'received' }],
      ['received after decision', { received_date: '2026-05-10', decision_date: '2026-05-01', status: 'refunded' }],
      ['dropoff after decision with the reception skipped', { dropoff_date: '2026-05-10', decision_date: '2026-05-01', status: 'refunded' }],
    ])('rejects %s', async (_label, dates) => {
      await expect(insertRaw(valid(dates))).rejects.toThrow()
    })

    it('accepts dates in order', async () => {
      await expect(
        insertRaw(valid({
          status: 'refunded',
          dropoff_date: '2026-05-01',
          received_date: '2026-05-05',
          decision_date: '2026-05-10',
        }))
      ).resolves.toBe(1)
    })

    it('accepts equal dates, a same day drop-off and reception is possible', async () => {
      await expect(
        insertRaw(valid({
          status: 'received',
          dropoff_date: '2026-05-01',
          received_date: '2026-05-01',
        }))
      ).resolves.toBe(1)
    })
  })

  describe('a status requires its own date', () => {
    it.each([
      ['dropped_off', 'dropoff_date'],
      ['received', 'received_date'],
      ['refunded', 'decision_date'],
      ['rejected', 'decision_date'],
    ])('rejects %s without %s', async (status) => {
      await expect(insertRaw(valid({ status }))).rejects.toThrow()
    })

    it('accepts a refund whose reception date was never known', async () => {
      await expect(
        insertRaw(valid({ status: 'refunded', dropoff_date: '2026-05-01', decision_date: '2026-05-10' }))
      ).resolves.toBe(1)
    })

    it('accepts a refund entered with no date but the decision one', async () => {
      await expect(
        insertRaw(valid({ status: 'refunded', decision_date: '2026-05-10' }))
      ).resolves.toBe(1)
    })
  })
})

describe('tracking number uniqueness', () => {
  it('rejects the same number twice, with the Prisma code the service will map to a 409', async () => {
    await createShipment({ trackingNumber: 'UNIQUE-1' })

    const failure = await createShipment({ trackingNumber: 'UNIQUE-1' })
      .catch((cause: unknown) => cause)

    expect((failure as { code?: string }).code).toBe('P2002')
  })

  it('rejects the same number under another carrier', async () => {
    await createShipment({ trackingNumber: 'UNIQUE-2', carrier: 'bpost' })

    await expect(createShipment({ trackingNumber: 'UNIQUE-2', carrier: 'postnl' })).rejects.toThrow()
  })

  it('rejects the same number for a different user, uniqueness is global', async () => {
    await createShipment({ trackingNumber: 'UNIQUE-3' })

    await expect(createShipment({ userId: OTHER, trackingNumber: 'UNIQUE-3' })).rejects.toThrow()
  })

  it('does not free the number when the shipment is archived', async () => {
    const created = await createShipment({ trackingNumber: 'UNIQUE-4' })
    await prisma.shipment.update({ where: { id: created.id }, data: { archivedAt: new Date() } })

    await expect(createShipment({ trackingNumber: 'UNIQUE-4' })).rejects.toThrow()
  })

  it('frees the number once the shipment is deleted for good', async () => {
    const created = await createShipment({ trackingNumber: 'UNIQUE-5' })
    await prisma.shipment.delete({ where: { id: created.id } })

    await expect(createShipment({ trackingNumber: 'UNIQUE-5' })).resolves.toBeDefined()
  })

  it('unarchives without ever conflicting', async () => {
    const created = await createShipment({ trackingNumber: 'UNIQUE-6' })
    await prisma.shipment.update({ where: { id: created.id }, data: { archivedAt: new Date() } })

    const restored = await prisma.shipment.update({
      where: { id: created.id },
      data: { archivedAt: null },
    })

    expect(restored.archivedAt).toBeNull()
  })
})

describe('labels', () => {
  const payload = { tracking_number: 'LABEL-1' }

  it('refuses a label pointing at no shipment', async () => {
    await expect(
      prisma.label.create({
        data: { shipmentId: '99999999-9999-4999-8999-999999999999', payload },
      })
    ).rejects.toThrow()
  })

  it('allows at most one label per shipment', async () => {
    const created = await createShipment({ trackingNumber: 'LABEL-ONE' })
    await prisma.label.create({ data: { shipmentId: created.id, payload } })

    await expect(prisma.label.create({ data: { shipmentId: created.id, payload } })).rejects.toThrow()
  })

  it('deletes the label along with its shipment', async () => {
    const created = await createShipment({ trackingNumber: 'LABEL-CASCADE' })
    await prisma.label.create({ data: { shipmentId: created.id, payload } })

    await prisma.shipment.delete({ where: { id: created.id } })

    expect(await prisma.label.findUnique({ where: { shipmentId: created.id } })).toBeNull()
  })

  it('keeps the label when the shipment is only archived', async () => {
    const created = await createShipment({ trackingNumber: 'LABEL-ARCHIVED' })
    await prisma.label.create({ data: { shipmentId: created.id, payload } })

    await prisma.shipment.update({ where: { id: created.id }, data: { archivedAt: new Date() } })

    expect(await prisma.label.findUnique({ where: { shipmentId: created.id } })).not.toBeNull()
  })

  it('stores the payload as queryable jsonb', async () => {
    const created = await createShipment({ trackingNumber: 'LABEL-JSONB' })
    await prisma.label.create({
      data: { shipmentId: created.id, payload: { store: 'Zalando', nested: { amount: 42 } } },
    })

    const rows = await prisma.$queryRaw<{ store: string }[]>`
      SELECT payload -> 'nested' ->> 'amount' AS store FROM labels WHERE shipment_id = ${created.id}::uuid
    `
    expect(rows[0].store).toBe('42')
  })
})

describe('updated_at', () => {
  it('is filled by the database default on a raw insert that omits it', async () => {
    await insertRaw(valid({ tracking_number: 'UPDATED-DEFAULT' }))

    const rows = await prisma.$queryRaw<{ updated_at: Date | null }[]>`
      SELECT updated_at FROM shipments WHERE tracking_number = 'UPDATED-DEFAULT'
    `
    expect(rows[0].updated_at).not.toBeNull()
  })

  it('keeps an explicit value on insert, so restoring a dump does not rewrite history', async () => {
    const historical = new Date('2020-01-01T00:00:00.000Z')
    await insertRaw(valid({ tracking_number: 'UPDATED-HISTORY', updated_at: historical }))

    const rows = await prisma.$queryRaw<{ updated_at: Date }[]>`
      SELECT updated_at FROM shipments WHERE tracking_number = 'UPDATED-HISTORY'
    `
    expect(rows[0].updated_at.toISOString()).toBe(historical.toISOString())
  })

  it('is refreshed by the trigger on a raw update, which Prisma never sees', async () => {
    const historical = new Date('2020-01-01T00:00:00.000Z')
    await insertRaw(valid({ tracking_number: 'UPDATED-TRIGGER', updated_at: historical }))

    await prisma.$executeRaw`UPDATE shipments SET store = 'Zara' WHERE tracking_number = 'UPDATED-TRIGGER'`

    const rows = await prisma.$queryRaw<{ updated_at: Date }[]>`
      SELECT updated_at FROM shipments WHERE tracking_number = 'UPDATED-TRIGGER'
    `
    expect(rows[0].updated_at.getTime()).toBeGreaterThan(historical.getTime())
  })
})

describe('store search', () => {
  it('ranks a typo closer to the store it meant than to any other', async () => {
    await createShipment({ trackingNumber: 'SEARCH-1', store: 'Zalando' })
    await createShipment({ trackingNumber: 'SEARCH-2', store: 'Decathlon' })

    const rows = await prisma.$queryRaw<{ store: string }[]>`
      SELECT store FROM shipments
      WHERE user_id = ${OWNER}
      ORDER BY similarity(lower(immutable_unaccent(store)), 'zalndo') DESC
      LIMIT 1
    `
    expect(rows[0].store).toBe('Zalando')
  })

  it('ignores case and accents', async () => {
    await createShipment({ trackingNumber: 'SEARCH-3', store: 'Décathlon' })

    const rows = await prisma.$queryRaw<{ store: string }[]>`
      SELECT store FROM shipments
      WHERE user_id = ${OWNER}
        AND lower(immutable_unaccent(store)) LIKE '%' || lower(immutable_unaccent('DECATHLON')) || '%'
    `
    expect(rows).toHaveLength(1)
  })
})
