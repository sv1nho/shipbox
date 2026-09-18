import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { prisma } from '../../../prisma.js'
import * as shipments from '../../../services/shipments/index.js'
import * as storeService from '../../../services/shipments/stores.js'
import { today } from '../../../services/shipments/dates.js'
import { AppError } from '../../../errors.js'
import type { CreateShipmentInput } from '../../../services/shipments/types.js'
import { SORT_KEYS } from '../../../../shared/shipment.js'
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
  orderNumber: 'ZAL-2026-0001',
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
  await prisma.store.deleteMany({ where: { userId: { in: [OWNER, OTHER] } } })
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
    expect(created.daysLeft).toBe(30)
    expect(created.needsAction).toBe(false)
    expect(created.labelExpiring).toBe(false)
  })

  it('stores a return that was already decided, for a back-filled history', async () => {
    const created = await shipments.create(OWNER, input({
      requestedDate: '2026-01-05',
      status: 'rejected',
      dropoffDate: '2026-01-07',
      receivedDate: '2026-01-10',
      decisionDate: '2026-01-20',
      rejectionReason: 'Worn shoes',
    }))

    expect(created.status).toBe('rejected')
    expect(created.decisionDate).toBe('2026-01-20')
    expect(created.rejectionReason).toBe('Worn shoes')
    expect(created.decisionDelayDays).toBe(10)
  })

  it('refuses a decided status without the day it was decided', async () => {
    expect(await codeOf(() => shipments.create(OWNER, input({ status: 'refunded' }))))
      .toBe('VALIDATION_ERROR')
  })

  it('leaves the reason empty on a refusal that came without one', async () => {
    const created = await shipments.create(OWNER, input({
      status: 'rejected',
      decisionDate: today(),
    }))

    expect(created.rejectionReason).toBeNull()
  })

  it('keeps no refusal reason on a refund', async () => {
    const created = await shipments.create(OWNER, input({
      status: 'refunded',
      decisionDate: today(),
      rejectionReason: 'Should be dropped',
    }))

    expect(created.rejectionReason).toBeNull()
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

    expect(await storeService.searchStores(OWNER, 'Secret')).toEqual([])
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

  it('records a reason when refusing a return, without touching the note', async () => {
    const created = await shipments.create(OWNER, input({ note: 'Bought on sale' }))
    const rejected = await shipments.transition(OWNER, created.id, 'reject', today(), { rejectionReason: 'Worn item' })

    expect(rejected.status).toBe('rejected')
    expect(rejected.rejectionReason).toBe('Worn item')
    expect(rejected.note).toBe('Bought on sale')
  })

  it('drops the reason once the refusal is undone', async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, created.id, 'reject', today(), { rejectionReason: 'Worn item' })

    expect((await shipments.revert(OWNER, created.id)).rejectionReason).toBeNull()
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

describe('a parcel the store never received', () => {
  it('records the loss and measures the wait from the drop-off instead', async () => {
    const created = await shipments.create(OWNER, input({
      status: 'refunded',
      requestedDate: '2026-01-01',
      dropoffDate: '2026-01-03',
      decisionDate: '2026-01-19',
      neverReceived: true,
    }))

    expect(created.neverReceived).toBe(true)
    expect(created.receivedDate).toBeNull()
    expect(created.decisionDelayDays).toBe(16)
  })

  it('ignores the claim when a reception date was given all the same', async () => {
    const created = await shipments.create(OWNER, input({
      status: 'received',
      requestedDate: '2026-01-01',
      dropoffDate: '2026-01-03',
      receivedDate: '2026-01-06',
      neverReceived: true,
    }))

    expect(created.neverReceived).toBe(false)
  })

  it('carries the loss through a decision recorded on a parcel in transit', async () => {
    const dropped = await shipments.create(OWNER, input({
      status: 'dropped_off',
      requestedDate: '2026-01-01',
      dropoffDate: '2026-01-03',
    }))

    const decided = await shipments.transition(OWNER, dropped.id, 'refund', '2026-01-19', {
      neverReceived: true,
    })

    expect(decided.neverReceived).toBe(true)
    expect(decided.decisionDelayDays).toBe(16)
  })

  it('takes the claim back as soon as a reception is recorded, the two cannot both hold', async () => {
    const lost = await shipments.create(OWNER, input({
      status: 'refunded',
      requestedDate: '2026-01-01',
      dropoffDate: '2026-01-03',
      decisionDate: '2026-01-19',
      neverReceived: true,
    }))

    await shipments.revert(OWNER, lost.id)
    const received = await shipments.transition(OWNER, lost.id, 'receive', '2026-01-06')

    expect(received.neverReceived).toBe(false)
    expect(received.receivedDate).toBe('2026-01-06')
  })

  it('takes it back on an edit that fills the reception in, rather than failing', async () => {
    const lost = await shipments.create(OWNER, input({
      status: 'refunded',
      requestedDate: '2026-01-01',
      dropoffDate: '2026-01-03',
      decisionDate: '2026-01-19',
      neverReceived: true,
    }))

    const fixed = await shipments.update(OWNER, lost.id, { receivedDate: '2026-01-06' })

    expect(fixed.neverReceived).toBe(false)
    expect(fixed.decisionDelayDays).toBe(13)
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

  it('clears the note when given null, the one field allowed back to empty', async () => {
    const created = await shipments.create(OWNER, input({ note: 'Something' }))

    expect((await shipments.update(OWNER, created.id, { note: null })).note).toBeNull()
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

describe('an archived shipment is left alone', () => {
  const archived = async () => {
    const created = await shipments.create(OWNER, input())
    await shipments.archive(OWNER, created.id)
    return created
  }

  it.each([
    ['transition', (id: string) => shipments.transition(OWNER, id, 'drop_off', today())],
    ['revert', (id: string) => shipments.revert(OWNER, id)],
    ['update', (id: string) => shipments.update(OWNER, id, { store: 'Nike' })],
    ['correctIdentity', (id: string) =>
      shipments.correctIdentity(OWNER, id, { carrier: 'bpost', trackingNumber: uniqueTracking() })],
  ])('refuses %s until it is put back in the list', async (_name, run) => {
    const created = await archived()

    expect(await codeOf(() => run(created.id))).toBe('CONFLICT')
  })

  it('accepts the same change once it is back in the list', async () => {
    const created = await archived()
    await shipments.unarchive(OWNER, created.id)

    expect((await shipments.update(OWNER, created.id, { store: 'Nike' })).store).toBe('Nike')
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

  it('gathers every return still open under one filter, whatever state it sits in', async () => {
    const dropped = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, dropped.id, 'drop_off', '2026-06-01')

    const held = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, held.id, 'receive', '2026-06-02')

    const closed = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, closed.id, 'refund', '2026-06-03')

    await shipments.create(OWNER, input())

    const open = await shipments.list(OWNER, { status: 'open' })

    expect(open.total).toBe(3)
    expect(open.items.map((item) => item.status).sort())
      .toEqual(['dropped_off', 'pending', 'received'])
  })

  it('leaves a decided return out of the open filter, refused as much as refunded', async () => {
    const rejected = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, rejected.id, 'reject', '2026-06-03', { rejectionReason: 'Worn shoes' })

    expect((await shipments.list(OWNER, { status: 'open' })).total).toBe(0)
  })

  describe('the needs attention filter', () => {
    const daysAgo = (days: number): string => {
      const date = new Date(`${today()}T00:00:00.000Z`)
      date.setUTCDate(date.getUTCDate() - days)

      return date.toISOString().slice(0, 10)
    }

    const aSpreadOfEveryState = async () => {
      await shipments.create(OWNER, input({ requestedDate: daysAgo(25) }))
      await shipments.create(OWNER, input({ requestedDate: daysAgo(2) }))
      await shipments.create(OWNER, input({
        status: 'dropped_off', requestedDate: daysAgo(20), dropoffDate: daysAgo(18),
      }))
      await shipments.create(OWNER, input({
        status: 'dropped_off', requestedDate: daysAgo(5), dropoffDate: daysAgo(3),
      }))
      await shipments.create(OWNER, input({
        status: 'received', requestedDate: daysAgo(30), dropoffDate: daysAgo(28), receivedDate: daysAgo(20),
      }))
      await shipments.create(OWNER, input({
        status: 'received', requestedDate: daysAgo(8), dropoffDate: daysAgo(6), receivedDate: daysAgo(4),
      }))
      await shipments.create(OWNER, input({
        status: 'refunded',
        requestedDate: daysAgo(60),
        dropoffDate: daysAgo(58),
        receivedDate: daysAgo(50),
        decisionDate: daysAgo(45),
      }))
    }

    it('returns exactly the rows that flag themselves, so sql and the badge cannot drift', async () => {
      await aSpreadOfEveryState()

      const everything = await shipments.list(OWNER)
      const flagged = everything.items
        .filter((item) => item.needsAction || item.shippingLate || item.labelExpiring)
        .map((item) => item.id)
        .sort()

      const filtered = await shipments.list(OWNER, { attention: true })

      expect(flagged).toHaveLength(3)
      expect(filtered.items.map((item) => item.id).sort()).toEqual(flagged)
    })

    it('counts the same rows whatever the view is filtered to', async () => {
      await aSpreadOfEveryState()

      const narrowed = await shipments.list(OWNER, { status: 'refunded' })

      expect(narrowed.total).toBe(1)
      expect(narrowed.attentionTotal).toBe(3)
    })

    it('leaves an archived return out of the count, nobody having to chase it', async () => {
      const late = await shipments.create(OWNER, input({
        status: 'received', requestedDate: daysAgo(30), dropoffDate: daysAgo(28), receivedDate: daysAgo(20),
      }))

      expect((await shipments.list(OWNER)).attentionTotal).toBe(1)

      await shipments.archive(OWNER, late.id)

      expect((await shipments.list(OWNER)).attentionTotal).toBe(0)
    })

    it('still combines with a search, rather than one filter cancelling the other', async () => {
      await aSpreadOfEveryState()
      await shipments.create(OWNER, input({
        store: 'Decathlon', status: 'received', requestedDate: daysAgo(30), receivedDate: daysAgo(20),
      }))

      const both = await shipments.list(OWNER, { attention: true, search: 'decath' })

      expect(both.total).toBe(1)
      expect(both.items[0].store).toBe('Decathlon')
    })
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

  it('sorts by the day the return was asked for, not the day it was typed in', async () => {
    const recent = await shipments.create(OWNER, input({ requestedDate: today() }))
    const backFilled = await shipments.create(OWNER, input({ requestedDate: '2026-01-05' }))

    const newestFirst = await shipments.list(OWNER)

    expect(newestFirst.items.map((item) => item.id)).toEqual([recent.id, backFilled.id])
    expect(backFilled.createdAt > recent.createdAt).toBe(true)
  })

  it('sorts by amount', async () => {
    await shipments.create(OWNER, input({ amountCents: 100 }))
    await shipments.create(OWNER, input({ amountCents: 900 }))

    const cheapestFirst = await shipments.list(OWNER, { sort: 'amountCents', direction: 'asc' })

    expect(cheapestFirst.items.map((item) => item.amountCents)).toEqual([100, 900])
  })

  it('sorts by reception, which is how the longest wait for a decision is found', async () => {
    const waiting = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, waiting.id, 'receive', '2026-06-01')

    const recent = await shipments.create(OWNER, input())
    await shipments.transition(OWNER, recent.id, 'receive', today())

    await shipments.create(OWNER, input())

    const byReception = await shipments.list(OWNER, { sort: 'receivedDate', direction: 'asc' })

    expect(byReception.items[0].id).toBe(waiting.id)
    expect(byReception.items[1].id).toBe(recent.id)
    expect(byReception.items[2].receivedDate).toBeNull()
  })

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

describe('importMany', () => {
  let counter = 0

  const row = (overrides: Partial<CreateShipmentInput> = {}): { row: number; input: CreateShipmentInput } => {
    counter += 1

    return { row: counter, input: input(overrides) }
  }

  const importRows = (...rows: { row: number; input: CreateShipmentInput }[]) =>
    shipments.importMany(shipments.create, OWNER, rows)

  it('imports every row it is given', async () => {
    const outcome = await importRows(row(), row(), row())

    expect(outcome).toEqual({ imported: 3, failures: [] })
    expect((await shipments.list(OWNER, {})).total).toBe(3)
  })

  it('takes the good rows and reports the bad ones by their own number', async () => {
    const taken = uniqueTracking()
    await shipments.create(OWNER, input({ trackingNumber: taken }))

    const outcome = await importRows(row(), { row: 7, input: input({ trackingNumber: taken }) }, row())

    expect(outcome.imported).toBe(2)
    expect(outcome.failures).toHaveLength(1)
    expect(outcome.failures[0].row).toBe(7)
    expect(outcome.failures[0].message).toContain('already registered')
  })

  it('reports a row whose dates are out of order', async () => {
    const outcome = await importRows(
      row({ status: 'received', dropoffDate: '2026-02-10', receivedDate: '2026-02-01' })
    )

    expect(outcome.failures[0].message).toContain('earlier than')
  })

  it('creates each store once, however many rows name it', async () => {
    await importRows(row({ store: 'Snipes' }), row({ store: 'Snipes' }))

    expect(await prisma.store.count({ where: { userId: OWNER, name: 'Snipes' } })).toBe(1)
  })

  it('carries the customer service address a file gives', async () => {
    await importRows(row({ store: 'Snipes', storeSupportEmail: 'support@snipes.com' }))

    expect((await storeService.searchStores(OWNER, 'Snipes'))[0].supportEmail)
      .toBe('support@snipes.com')
  })

  it('imports a finished return, which is what a history is made of', async () => {
    const outcome = await importRows(row({
      status: 'refunded',
      dropoffDate: '2026-01-03',
      receivedDate: '2026-01-06',
      decisionDate: '2026-01-10',
    }))

    expect(outcome.imported).toBe(1)
    expect((await shipments.list(OWNER, {})).items[0].decisionDelayDays).toBe(4)
  })

  it('lets an unexpected failure through instead of filing it as a row problem', async () => {
    const boom = new Error('the database went away')

    await expect(
      shipments.importMany(() => Promise.reject(boom), OWNER, [row()])
    ).rejects.toThrow(boom)
  })
})

describe('searchStores', () => {
  const stores = ['Zalando', 'Zalando BE', 'Décathlon', 'Zara', 'Nike']

  const seedStores = async () => {
    for (const store of stores) {
      await shipments.create(OWNER, input({ store }))
    }
  }

  const namesOf = async (query: string, limit?: number): Promise<string[]> =>
    (await storeService.searchStores(OWNER, query, limit)).map((store) => store.name)

  it('finds a store despite a typo', async () => {
    await seedStores()

    expect(await namesOf('zalndo')).toContain('Zalando')
  })

  it('ignores case', async () => {
    await seedStores()

    expect(await namesOf('ZARA')).toContain('Zara')
  })

  it('ignores accents in both directions', async () => {
    await seedStores()

    expect(await namesOf('decathlon')).toContain('Décathlon')
    expect(await namesOf('Décathlon')).toContain('Décathlon')
  })

  it('matches a substring', async () => {
    await seedStores()

    expect(await namesOf('ala')).toContain('Zalando')
  })

  it('puts an exact match first, which is what prevents duplicates', async () => {
    await seedStores()

    expect((await namesOf('zalando'))[0]).toBe('Zalando')
  })

  it('never merges two stores that differ, it only lists them', async () => {
    await seedStores()

    const found = await namesOf('Zalando')

    expect(found).toContain('Zalando')
    expect(found).toContain('Zalando BE')
  })

  it('returns each store once however many shipments use it', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando' }))
    await shipments.create(OWNER, input({ store: 'Zalando' }))

    expect(await namesOf('Zalando')).toEqual(['Zalando'])
  })

  it('lists the most recent stores when asked nothing', async () => {
    await seedStores()

    const suggestions = await namesOf('')

    expect(suggestions).toHaveLength(stores.length)
    expect(new Set(suggestions)).toEqual(new Set(stores))
  })

  it('honours the limit', async () => {
    await seedStores()

    expect(await namesOf('', 2)).toHaveLength(2)
  })

  it('carries the customer service address of each store', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando', storeSupportEmail: 'service@zalando.be' }))

    expect(await storeService.searchStores(OWNER, 'Zalando'))
      .toEqual([{ name: 'Zalando', supportEmail: 'service@zalando.be' }])
  })
})

describe('stores as entities', () => {
  it('reuses one store for every shipment that names it', async () => {
    const first = await shipments.create(OWNER, input({ store: 'Zalando' }))
    const second = await shipments.create(OWNER, input({ store: 'Zalando' }))

    expect(second.store).toBe(first.store)
    expect(await prisma.store.count({ where: { userId: OWNER, name: 'Zalando' } })).toBe(1)
  })

  it('folds the spacing of a name into the store already there', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando' }))
    await shipments.create(OWNER, input({ store: '  Zalando   ' }))

    expect(await prisma.store.count({ where: { userId: OWNER, name: 'Zalando' } })).toBe(1)
  })

  it('keeps one user out of another user store list', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando' }))
    await shipments.create(OTHER, input({ store: 'Zalando' }))

    expect(await prisma.store.count({ where: { name: 'Zalando' } })).toBe(2)
    expect(await storeService.searchStores(OTHER, 'Zalando')).toHaveLength(1)
  })

  it('remembers the address given with a later shipment of the same store', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando' }))
    await shipments.create(OWNER, input({ store: 'Zalando', storeSupportEmail: 'service@zalando.be' }))

    expect((await storeService.searchStores(OWNER, 'Zalando'))[0].supportEmail)
      .toBe('service@zalando.be')
  })

  it('exposes the address on every shipment of the store', async () => {
    await shipments.create(OWNER, input({ store: 'Zalando', storeSupportEmail: 'service@zalando.be' }))
    const second = await shipments.create(OWNER, input({ store: 'Zalando' }))

    expect(second.storeSupportEmail).toBe('service@zalando.be')
  })

  it('moves a shipment to another store when the name is corrected', async () => {
    const created = await shipments.create(OWNER, input({ store: 'Zalndo' }))
    const fixed = await shipments.update(OWNER, created.id, { store: 'Zalando' })

    expect(fixed.store).toBe('Zalando')
    expect(await prisma.store.count({ where: { userId: OWNER } })).toBe(2)
  })
})
