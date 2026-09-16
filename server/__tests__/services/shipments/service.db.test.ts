import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { prisma } from '../../../prisma.js'
import * as shipments from '../../../services/shipments/index.js'
import { today } from '../../../services/shipments/dates.js'
import { AppError } from '../../../errors.js'
import type { CreateShipmentInput, SortKey } from '../../../services/shipments/types.js'
import type { LabelPayload } from '../../../../shared/label-payload.js'
import type { CarrierId } from '../../../../shared/carriers.js'

const OWNER = 'service-tests-owner'
const OTHER = 'service-tests-other'

let counter = 0

const uniqueTracking = (): string => {
  counter += 1
  return `3232${String(counter).padStart(20, '0')}`
}

const input = (overrides: Partial<CreateShipmentInput> = {}): CreateShipmentInput => ({
  trackingNumber: uniqueTracking(),
  carrier: 'bpost',
  recipientPostalCode: '2000',
  recipientCountry: 'BE',
  amountCents: 4999,
  store: 'Zalando',
  requestedDate: '2026-01-01',
  ...overrides,
})

const payload = (trackingNumber: string): LabelPayload => ({
  sender_firstname: 'Alex',
  sender_lastname: 'Nintunze',
  sender_company: '',
  sender_address: 'Rue de la Loi 16',
  sender_postal: '1000',
  sender_city: 'Bruxelles',
  sender_country: 'BE',
  sender_isCompany: false,
  recipient_firstname: '',
  recipient_lastname: '',
  recipient_company: 'Returns Handling BV',
  recipient_address: 'Logistiekweg 4',
  recipient_postal: '5145RC',
  recipient_city: 'Rotterdam',
  recipient_country: 'NL',
  recipient_isCompany: true,
  label_language: 'fr',
  carrier: 'bpost',
  tracking_number: trackingNumber,
})

const codeOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run()
  } catch (cause) {
    return cause instanceof AppError ? cause.code : 'NOT_AN_APP_ERROR'
  }
  return 'NO_ERROR'
}

beforeAll(async () => {
  for (const [id, email] of [[OWNER, 'service-owner@example.test'], [OTHER, 'service-other@example.test']]) {
    await prisma.user.upsert({
      where: { id },
      create: { id, name: 'Service tests', email },
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

describe('create', () => {
  it('stores a pending shipment with its derived fields', async () => {
    const created = await shipments.create(OWNER, input({ requestedDate: today() }))

    expect(created.status).toBe('pending')
    expect(created.hasLabel).toBe(false)
    expect(created.archivedAt).toBeNull()
    expect(created.currency).toBe('EUR')
    expect(created.trackingUrl).toContain('https://')
    expect(created.daysSinceRequested).toBe(0)
    expect(created.needsAction).toBe(false)
    expect(created.shouldDropOff).toBe(false)
    expect(created.labelExpiring).toBe(false)
  })

  it('dates the request today when the caller does not say', async () => {
    const created = await shipments.create(OWNER, input({ requestedDate: undefined }))

    expect(created.requestedDate).toBe(today())
  })

  it('normalises what it is given', async () => {
    const created = await shipments.create(
      OWNER,
      input({
        trackingNumber: '3232 0000 0000 0000 0009 9999',
        recipientPostalCode: '5145 rc',
        recipientCountry: ' nl ',
        store: '  Zalando  BE  ',
      })
    )

    expect(created.trackingNumber).toBe('323200000000000000099999')
    expect(created.recipientPostalCode).toBe('5145RC')
    expect(created.recipientCountry).toBe('NL')
    expect(created.store).toBe('Zalando BE')
  })

  it('accepts a shipment already dropped off', async () => {
    const created = await shipments.create(
      OWNER,
      input({ status: 'dropped_off', dropoffDate: today() })
    )

    expect(created.status).toBe('dropped_off')
    expect(created.dropoffDate).toBe(today())
  })

  it('refuses a starting status without its date', async () => {
    expect(await codeOf(() => shipments.create(OWNER, input({ status: 'received' }))))
      .toBe('VALIDATION_ERROR')
  })

  it('refuses a date in the future', async () => {
    expect(await codeOf(() => shipments.create(OWNER, input({ dropoffDate: '2099-01-01' }))))
      .toBe('VALIDATION_ERROR')
  })

  it('refuses a tracking number that is already registered', async () => {
    const taken = uniqueTracking()
    await shipments.create(OWNER, input({ trackingNumber: taken }))

    expect(await codeOf(() => shipments.create(OWNER, input({ trackingNumber: taken }))))
      .toBe('CONFLICT')
  })

  it('says nothing about the other account when the number belongs to one', async () => {
    const taken = uniqueTracking()
    await shipments.create(OTHER, input({ trackingNumber: taken }))

    const failure = await shipments
      .create(OWNER, input({ trackingNumber: taken }))
      .catch((cause: unknown) => cause)

    expect((failure as AppError).code).toBe('CONFLICT')
    expect((failure as AppError).message).not.toContain(OTHER)
    expect(JSON.stringify((failure as AppError).details ?? {})).not.toContain(OTHER)
  })
})

describe('create with a label, in a single transaction', () => {
  it('stores the shipment and its label together', async () => {
    const tracking = uniqueTracking()
    const created = await shipments.create(
      OWNER,
      input({ trackingNumber: tracking, label: { payload: payload(tracking), payloadVersion: 1 } })
    )

    expect(created.hasLabel).toBe(true)
    expect(await prisma.label.findUnique({ where: { shipmentId: created.id } })).not.toBeNull()
  })

  it('leaves no shipment behind when the label fails', async () => {
    const tracking = uniqueTracking()

    const failed = await shipments
      .create(
        OWNER,
        input({
          trackingNumber: tracking,
          label: { payload: payload(tracking), payloadVersion: Number.NaN },
        })
      )
      .catch(() => 'failed')

    expect(failed).toBe('failed')
    expect(await prisma.shipment.findFirst({ where: { trackingNumber: tracking } })).toBeNull()

    const withoutLabel = await shipments.create(OWNER, input({ trackingNumber: tracking }))
    expect(withoutLabel.trackingNumber).toBe(tracking)
  })

  it('copies no sender field and no recipient company into the shipment row', async () => {
    const tracking = uniqueTracking()
    const created = await shipments.create(
      OWNER,
      input({ trackingNumber: tracking, label: { payload: payload(tracking), payloadVersion: 1 } })
    )

    const row = await prisma.shipment.findUniqueOrThrow({ where: { id: created.id } })
    const stored = JSON.stringify(row)

    expect(stored).not.toContain('Nintunze')
    expect(stored).not.toContain('Rue de la Loi')
    expect(stored).not.toContain('Returns Handling BV')
    expect(stored).not.toContain('Logistiekweg')
    expect(stored).not.toContain('Rotterdam')
  })

  it('stores the real tracking number, never a masked one', async () => {
    const tracking = uniqueTracking()
    const created = await shipments.create(
      OWNER,
      input({ trackingNumber: tracking, label: { payload: payload(tracking), payloadVersion: 1 } })
    )

    expect(created.trackingNumber).toBe(tracking)
    expect(created.trackingNumber).not.toContain('*')
  })
})

describe('user isolation', () => {
  it('lists only the shipments of the asking user', async () => {
    await shipments.create(OWNER, input({ store: 'Mine' }))
    await shipments.create(OTHER, input({ store: 'Theirs' }))

    const mine = await shipments.list(OWNER)

    expect(mine.total).toBe(1)
    expect(mine.items[0].store).toBe('Mine')
  })

  it.each([
    ['getById', (id: string) => shipments.getById(OTHER, id)],
    ['update', (id: string) => shipments.update(OTHER, id, { amountCents: 1 })],
    ['correctIdentity', (id: string) => shipments.correctIdentity(OTHER, id, { carrier: 'bpost', trackingNumber: '323200000000000000000777' })],
    ['transition', (id: string) => shipments.transition(OTHER, id, 'drop_off', today())],
    ['revert', (id: string) => shipments.revert(OTHER, id)],
    ['archive', (id: string) => shipments.archive(OTHER, id)],
    ['unarchive', (id: string) => shipments.unarchive(OTHER, id)],
    ['remove', (id: string) => shipments.remove(OTHER, id)],
    ['getLabelPayload', (id: string) => shipments.getLabelPayload(OTHER, id)],
  ])('hides another user shipment from %s', async (_name, run) => {
    const mine = await shipments.create(OWNER, input())

    expect(await codeOf(() => run(mine.id))).toBe('NOT_FOUND')
  })

  it('leaves the other user shipment untouched after a refused write', async () => {
    const mine = await shipments.create(OWNER, input({ amountCents: 4999 }))

    await codeOf(() => shipments.update(OTHER, mine.id, { amountCents: 1 }))

    expect((await shipments.getById(OWNER, mine.id)).amountCents).toBe(4999)
  })

  it('does not report another user tracking number as existing', async () => {
    const taken = uniqueTracking()
    await shipments.create(OTHER, input({ trackingNumber: taken }))

    expect(await shipments.exists(OWNER, 'bpost', taken)).toEqual({ exists: false })
  })

  it('never returns another user store in the suggestions', async () => {
    await shipments.create(OTHER, input({ store: 'SecretShop' }))

    expect(await shipments.searchStores(OWNER, 'Secret')).toEqual([])
  })
})

describe('getById', () => {
  it('returns a shipment the user owns', async () => {
    const created = await shipments.create(OWNER, input())

    expect((await shipments.getById(OWNER, created.id)).id).toBe(created.id)
  })

  it.each(['not-a-uuid', '', '00000000-0000-4000-8000-000000000000'])(
    'answers not found for %s',
    async (id) => {
      expect(await codeOf(() => shipments.getById(OWNER, id))).toBe('NOT_FOUND')
    }
  )
})

describe('transition and revert', () => {
  it('walks the whole chain', async () => {
    const created = await shipments.create(OWNER, input())

    const dropped = await shipments.transition(OWNER, created.id, 'drop_off', today())
    expect(dropped.status).toBe('dropped_off')

    const received = await shipments.transition(OWNER, created.id, 'receive', today())
    expect(received.status).toBe('received')

    const refunded = await shipments.transition(OWNER, created.id, 'refund', today())
    expect(refunded.status).toBe('refunded')
    expect(refunded.decisionDate).toBe(today())
  })

  it('refuses a step backwards', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, created.id, 'receive', today())

    expect(await codeOf(() => shipments.transition(OWNER, created.id, 'drop_off', today())))
      .toBe('ILLEGAL_TRANSITION')
  })

  it('records a note when refusing a return', async () => {
    const created = await shipments.create(OWNER, input())
    const rejected = await shipments.transition(OWNER, created.id, 'reject', today(), 'Worn item')

    expect(rejected.status).toBe('rejected')
    expect(rejected.note).toBe('Worn item')
  })

  it('undoes the last step and derives the status from the dates left', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, created.id, 'refund', today())

    const reverted = await shipments.revert(OWNER, created.id)

    expect(reverted.status).toBe('pending')
    expect(reverted.decisionDate).toBeNull()
  })

  it('refuses to undo a pending shipment', async () => {
    const created = await shipments.create(OWNER, input())

    expect(await codeOf(() => shipments.revert(OWNER, created.id))).toBe('ILLEGAL_TRANSITION')
  })
})

describe('update', () => {
  it('changes the fields it is given and leaves the rest alone', async () => {
    const created = await shipments.create(OWNER, input({ store: 'Zalando', amountCents: 4999 }))

    const updated = await shipments.update(OWNER, created.id, { amountCents: 1234, note: 'Refund pending' })

    expect(updated.amountCents).toBe(1234)
    expect(updated.note).toBe('Refund pending')
    expect(updated.store).toBe('Zalando')
  })

  it('changes every field it accepts in a single call', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, created.id, 'refund', '2026-06-10')

    const updated = await shipments.update(OWNER, created.id, {
      recipientPostalCode: '1101 cm',
      recipientCountry: 'nl',
      amountCents: 777,
      store: '  Zara  ',
      orderNumber: 'ORD-1',
      note: 'Everything changed',
      dropoffDate: '2026-06-01',
      receivedDate: '2026-06-05',
      decisionDate: '2026-06-08',
    })

    expect(updated).toMatchObject({
      recipientPostalCode: '1101CM',
      recipientCountry: 'NL',
      amountCents: 777,
      store: 'Zara',
      orderNumber: 'ORD-1',
      note: 'Everything changed',
      dropoffDate: '2026-06-01',
      receivedDate: '2026-06-05',
      decisionDate: '2026-06-08',
    })
  })

  it('clears the optional fields when given null', async () => {
    const created = await shipments.create(OWNER, input({ orderNumber: 'ORD-1', note: 'Something' }))

    const cleared = await shipments.update(OWNER, created.id, { orderNumber: null, note: null })

    expect(cleared.orderNumber).toBeNull()
    expect(cleared.note).toBeNull()
  })

  it('normalises a corrected postal code', async () => {
    const created = await shipments.create(OWNER, input())

    expect((await shipments.update(OWNER, created.id, { recipientPostalCode: '1101 cm' })).recipientPostalCode)
      .toBe('1101CM')
  })

  it('refuses a request date later than a step already recorded', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, created.id, 'drop_off', today())

    expect(await codeOf(() => shipments.update(OWNER, created.id, { requestedDate: '2099-01-01' })))
      .toBe('VALIDATION_ERROR')
  })

  it('refuses dates that fall out of order', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, created.id, 'drop_off', '2026-06-10')

    expect(await codeOf(() => shipments.update(OWNER, created.id, { receivedDate: '2026-06-01' })))
      .toBe('VALIDATION_ERROR')
  })
})

describe('correctIdentity', () => {
  it('fixes a typo in the tracking number', async () => {
    const created = await shipments.create(OWNER, input())
    const fixed = uniqueTracking()

    expect((await shipments.correctIdentity(OWNER, created.id, { carrier: 'bpost', trackingNumber: fixed })).trackingNumber)
      .toBe(fixed)
  })

  it('refuses to take a number that is already registered', async () => {
    const taken = uniqueTracking()
    await shipments.create(OWNER, input({ trackingNumber: taken }))
    const other = await shipments.create(OWNER, input())

    expect(await codeOf(() => shipments.correctIdentity(OWNER, other.id, { carrier: 'bpost', trackingNumber: taken })))
      .toBe('CONFLICT')
  })

  it('does not disguise an unrelated database refusal as a conflict', async () => {
    const created = await shipments.create(OWNER, input())

    const code = await codeOf(() =>
      shipments.correctIdentity(OWNER, created.id, {
        carrier: 'dhl' as CarrierId,
        trackingNumber: uniqueTracking(),
      })
    )

    expect(code).not.toBe('CONFLICT')
    expect(code).toBe('NOT_AN_APP_ERROR')
  })
})

describe('archive, unarchive and remove', () => {
  it('archives and keeps the row', async () => {
    const created = await shipments.create(OWNER, input())
    const archived = await shipments.archive(OWNER, created.id)

    expect(archived.archivedAt).not.toBeNull()
    expect(await prisma.shipment.findUnique({ where: { id: created.id } })).not.toBeNull()
  })

  it('hides an archived shipment from the default list', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.archive(OWNER, created.id)

    expect((await shipments.list(OWNER)).total).toBe(0)
    expect((await shipments.list(OWNER, { archived: 'only' })).total).toBe(1)
    expect((await shipments.list(OWNER, { archived: 'include' })).total).toBe(1)
  })

  it('refuses to archive twice', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.archive(OWNER, created.id)

    expect(await codeOf(() => shipments.archive(OWNER, created.id))).toBe('CONFLICT')
  })

  it('unarchives without ever conflicting, since the number was never freed', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.archive(OWNER, created.id)

    expect((await shipments.unarchive(OWNER, created.id)).archivedAt).toBeNull()
  })

  it('refuses to unarchive a shipment that is not archived', async () => {
    const created = await shipments.create(OWNER, input())

    expect(await codeOf(() => shipments.unarchive(OWNER, created.id))).toBe('CONFLICT')
  })

  it('deletes for good, taking the label with it', async () => {
    const tracking = uniqueTracking()
    const created = await shipments.create(
      OWNER,
      input({ trackingNumber: tracking, label: { payload: payload(tracking), payloadVersion: 1 } })
    )

    await shipments.remove(OWNER, created.id)

    expect(await prisma.shipment.findUnique({ where: { id: created.id } })).toBeNull()
    expect(await prisma.label.findUnique({ where: { shipmentId: created.id } })).toBeNull()
  })

  it('frees the tracking number once deleted for good', async () => {
    const tracking = uniqueTracking()
    const created = await shipments.create(OWNER, input({ trackingNumber: tracking }))
    await shipments.remove(OWNER, created.id)

    await expect(shipments.create(OWNER, input({ trackingNumber: tracking }))).resolves.toBeDefined()
  })
})

describe('exists', () => {
  it('reports a shipment the user owns', async () => {
    const tracking = uniqueTracking()
    const created = await shipments.create(OWNER, input({ trackingNumber: tracking }))

    expect(await shipments.exists(OWNER, 'bpost', tracking))
      .toEqual({ exists: true, id: created.id, archived: false })
  })

  it('still reports an archived shipment, since archiving does not free the number', async () => {
    const tracking = uniqueTracking()
    const created = await shipments.create(OWNER, input({ trackingNumber: tracking }))
    await shipments.archive(OWNER, created.id)

    expect(await shipments.exists(OWNER, 'bpost', tracking))
      .toEqual({ exists: true, id: created.id, archived: true })
  })

  it('normalises the number it is asked about', async () => {
    const tracking = uniqueTracking()
    await shipments.create(OWNER, input({ trackingNumber: tracking }))

    const spaced = `${tracking.slice(0, 4)} ${tracking.slice(4)}`
    expect((await shipments.exists(OWNER, 'bpost', spaced)).exists).toBe(true)
  })

  it('reports nothing for an unknown number', async () => {
    expect(await shipments.exists(OWNER, 'bpost', '323200000000000000000000')).toEqual({ exists: false })
  })
})

describe('getLabelPayload', () => {
  it('returns the payload the label was created with', async () => {
    const tracking = uniqueTracking()
    const created = await shipments.create(
      OWNER,
      input({ trackingNumber: tracking, label: { payload: payload(tracking), payloadVersion: 1 } })
    )

    const stored = await shipments.getLabelPayload(OWNER, created.id)

    expect(stored.payloadVersion).toBe(1)
    expect(stored.payload.tracking_number).toBe(tracking)
    expect(stored.payload.sender_lastname).toBe('Nintunze')
  })

  it('answers not found when the shipment has no label', async () => {
    const created = await shipments.create(OWNER, input())

    expect(await codeOf(() => shipments.getLabelPayload(OWNER, created.id))).toBe('NOT_FOUND')
  })
})

describe('list', () => {
  it('filters by carrier, status and store', async () => {
    await shipments.create(OWNER, input({ carrier: 'bpost', store: 'Zalando' }))
    await shipments.create(OWNER, input({ carrier: 'postnl', trackingNumber: '3SDDRL000000401', store: 'Zara' }))

    expect((await shipments.list(OWNER, { carrier: 'postnl' })).total).toBe(1)
    expect((await shipments.list(OWNER, { store: 'Zalando' })).total).toBe(1)
    expect((await shipments.list(OWNER, { status: 'pending' })).total).toBe(2)
    expect((await shipments.list(OWNER, { status: 'received' })).total).toBe(0)
  })

  it('searches the tracking number, the store and the order number', async () => {
    await shipments.create(OWNER, input({ store: 'Decathlon', orderNumber: 'ORD-4242' }))

    expect((await shipments.list(OWNER, { search: 'decath' })).total).toBe(1)
    expect((await shipments.list(OWNER, { search: 'ORD-42' })).total).toBe(1)
    expect((await shipments.list(OWNER, { search: 'nothing' })).total).toBe(0)
  })

  it('paginates and reports the total', async () => {
    for (let index = 0; index < 5; index += 1) {
      await shipments.create(OWNER, input())
    }

    const firstPage = await shipments.list(OWNER, { pageSize: 2, page: 1 })

    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.total).toBe(5)
    expect((await shipments.list(OWNER, { pageSize: 2, page: 3 })).items).toHaveLength(1)
  })

  it('sorts by amount', async () => {
    await shipments.create(OWNER, input({ amountCents: 100 }))
    await shipments.create(OWNER, input({ amountCents: 900 }))

    const cheapestFirst = await shipments.list(OWNER, { sort: 'amountCents', direction: 'asc' })

    expect(cheapestFirst.items.map((item) => item.amountCents)).toEqual([100, 900])
  })

  it('sorts the longest wait first and pushes shipments never received to the end', async () => {
    const waiting = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, waiting.id, 'receive', '2026-06-01')

    const recent = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, recent.id, 'receive', today())

    await shipments.create(OWNER, input())

    const byWait = await shipments.list(OWNER, { sort: 'waitingDays', direction: 'desc' })

    expect(byWait.items[0].id).toBe(waiting.id)
    expect(byWait.items[1].id).toBe(recent.id)
    expect(byWait.items[2].receivedDate).toBeNull()
  })

  const SORT_KEYS: SortKey[] = [
    'createdAt',
    'updatedAt',
    'dropoffDate',
    'receivedDate',
    'decisionDate',
    'amountCents',
    'store',
    'waitingDays',
  ]

  it.each(SORT_KEYS)('accepts %s as a sort key in both directions', async (sort) => {
    const first = await shipments.create(OWNER, input({ store: 'Aaa', amountCents: 100 }))
    await shipments.transition(OWNER, first.id, 'refund', '2026-06-01')
    await shipments.create(OWNER, input({ store: 'Zzz', amountCents: 900 }))

    for (const direction of ['asc', 'desc'] as const) {
      const page = await shipments.list(OWNER, { sort, direction })
      expect(page.items).toHaveLength(2)
    }
  })

  it('reverses the order when the direction flips', async () => {
    await shipments.create(OWNER, input({ store: 'Aaa' }))
    await shipments.create(OWNER, input({ store: 'Zzz' }))

    const ascending = await shipments.list(OWNER, { sort: 'store', direction: 'asc' })
    const descending = await shipments.list(OWNER, { sort: 'store', direction: 'desc' })

    expect(ascending.items.map((item) => item.store)).toEqual(['Aaa', 'Zzz'])
    expect(descending.items.map((item) => item.store)).toEqual(['Zzz', 'Aaa'])
  })

  it('clamps a page size that is out of range', async () => {
    await shipments.create(OWNER, input())

    expect((await shipments.list(OWNER, { pageSize: 0 })).pageSize).toBe(1)
    expect((await shipments.list(OWNER, { pageSize: 5000 })).pageSize).toBe(100)
    expect((await shipments.list(OWNER, { page: 0 })).page).toBe(1)
  })
})

describe('searchStores', () => {
  const stores = ['Zalando', 'Zalando BE', 'Décathlon', 'Zara', 'Nike']

  const seedStores = async () => {
    for (const store of stores) {
      await shipments.create(OWNER, input({ store }))
    }
  }

  it('finds a store despite a typo', async () => {
    await seedStores()

    expect(await shipments.searchStores(OWNER, 'zalndo')).toContain('Zalando')
  })

  it('ignores case', async () => {
    await seedStores()

    expect(await shipments.searchStores(OWNER, 'ZARA')).toContain('Zara')
  })

  it('ignores accents in both directions', async () => {
    await seedStores()

    expect(await shipments.searchStores(OWNER, 'decathlon')).toContain('Décathlon')
    expect(await shipments.searchStores(OWNER, 'Décathlon')).toContain('Décathlon')
  })

  it('matches a substring', async () => {
    await seedStores()

    expect(await shipments.searchStores(OWNER, 'ala')).toContain('Zalando')
  })

  it('puts an exact match first, which is what prevents duplicates', async () => {
    await seedStores()

    expect((await shipments.searchStores(OWNER, 'zalando'))[0]).toBe('Zalando')
  })

  it('never merges two stores that differ, it only lists them', async () => {
    await seedStores()

    const found = await shipments.searchStores(OWNER, 'Zalando')

    expect(found).toContain('Zalando')
    expect(found).toContain('Zalando BE')
  })

  it('returns each store once however many shipments use it', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando' }))
    await shipments.create(OWNER, input({ store: 'Zalando' }))

    expect(await shipments.searchStores(OWNER, 'Zalando')).toEqual(['Zalando'])
  })

  it('lists the most recent stores when asked nothing', async () => {
    await seedStores()

    const suggestions = await shipments.searchStores(OWNER, '')

    expect(suggestions).toHaveLength(stores.length)
    expect(new Set(suggestions)).toEqual(new Set(stores))
  })

  it('honours the limit', async () => {
    await seedStores()

    expect(await shipments.searchStores(OWNER, '', 2)).toHaveLength(2)
  })
})
