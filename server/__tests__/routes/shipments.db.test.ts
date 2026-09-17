import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import type { NextFunction, Request, Response } from 'express'
import { bodyOf } from './http.js'
import type { ApiError, ListBody, ShipmentBody } from './http.js'

const OWNER = 'route-tests-owner'
const OTHER = 'route-tests-other'

let signedInAs = OWNER

vi.mock('../../auth/require-user.js', () => ({
  requireUser: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: signedInAs, email: `${signedInAs}@example.test`, name: 'Route tests', image: null }
    next()
  },
  currentUser: (req: Request) => req.user,
}))

const { createApp } = await import('../../app.js')
const { prisma } = await import('../../prisma.js')

const app = createApp()

let counter = 0

const uniqueTracking = (): string => {
  counter += 1
  return `3232${String(counter).padStart(20, '0')}`
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const validBody = (overrides: Record<string, unknown> = {}) => ({
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

const createShipment = async (overrides: Record<string, unknown> = {}) => {
  const response = await request(app).post('/api/shipments').send(validBody(overrides)).expect(201)
  return response.body as { id: string; trackingNumber: string; status: string }
}

beforeAll(async () => {
  for (const [id, email] of [[OWNER, 'route-owner@example.test'], [OTHER, 'route-other@example.test']]) {
    await prisma.user.upsert({
      where: { id },
      create: { id, name: 'Route tests', email },
      update: {},
    })
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

describe('POST /api/shipments', () => {
  it('creates and answers 201 with the shipment', async () => {
    const response = await request(app).post('/api/shipments').send(validBody()).expect(201)

    expect(bodyOf(response).status).toBe('pending')
    expect(bodyOf(response).hasLabel).toBe(false)
    expect(bodyOf(response).trackingUrl).toContain('https://')
  })

  it.each([
    ['a missing store', { store: undefined }],
    ['an empty store', { store: '' }],
    ['a negative amount', { amountCents: -1 }],
    ['a fractional amount', { amountCents: 10.5 }],
    ['an unknown carrier', { carrier: 'dhl' }],
    ['a two letter country that is longer', { recipientCountry: 'BEL' }],
    ['a malformed date', { status: 'dropped_off', dropoffDate: '10-06-2026' }],
  ])('answers 422 for %s', async (_label, overrides) => {
    const response = await request(app).post('/api/shipments').send(validBody(overrides)).expect(422)

    expect(bodyOf<ApiError>(response).error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(bodyOf<ApiError>(response).error.details)).toBe(true)
  })

  it('answers 422 when the tracking number does not match the carrier format', async () => {
    const response = await request(app)
      .post('/api/shipments')
      .send(validBody({ carrier: 'postnl', trackingNumber: '323200000000000000000001' }))
      .expect(422)

    expect(bodyOf<ApiError>(response).error.details).toContainEqual(
      expect.objectContaining({ path: 'trackingNumber' })
    )
  })

  it('answers 409 when the tracking number is already registered', async () => {
    const taken = uniqueTracking()
    await request(app).post('/api/shipments').send(validBody({ trackingNumber: taken })).expect(201)

    const response = await request(app)
      .post('/api/shipments')
      .send(validBody({ trackingNumber: taken }))
      .expect(409)

    expect(bodyOf<ApiError>(response).error.code).toBe('CONFLICT')
  })
})

describe('GET /api/shipments', () => {
  it('lists a page with its total', async () => {
    await createShipment()
    await createShipment()

    const response = await request(app).get('/api/shipments').expect(200)

    expect(bodyOf(response).total).toBe(2)
    expect(bodyOf(response).items).toHaveLength(2)
    expect(bodyOf(response).page).toBe(1)
  })

  it('accepts filters, sorting and pagination from the query string', async () => {
    await createShipment({ store: 'Zara', amountCents: 100 })
    await createShipment({ store: 'Nike', amountCents: 900 })

    const response = await request(app)
      .get('/api/shipments?sort=amountCents&direction=asc&pageSize=1&page=2')
      .expect(200)

    expect(bodyOf<ListBody>(response).items[0].amountCents).toBe(900)
    expect(bodyOf(response).pageSize).toBe(1)
  })

  it.each([
    'sort=nonsense',
    'direction=sideways',
    'page=0',
    'pageSize=101',
    'carrier=dhl',
    'status=lost',
    'archived=maybe',
  ])('answers 422 for %s', async (query) => {
    await request(app).get(`/api/shipments?${query}`).expect(422)
  })
})

describe('the routes that must be declared before /:id', () => {
  it('reaches the exists route rather than reading it as an id', async () => {
    const tracking = uniqueTracking()
    const created = await createShipment({ trackingNumber: tracking })

    const response = await request(app)
      .get(`/api/shipments/exists?carrier=bpost&trackingNumber=${tracking}`)
      .expect(200)

    expect(response.body).toEqual({ exists: true, id: created.id, archived: false })
  })

  it('reaches the import route rather than reading import as an id', async () => {
    const response = await request(app)
      .post('/api/shipments/import')
      .send({ shipments: [validBody()] })
      .expect(200)

    expect(bodyOf<{ imported: number }>(response).imported).toBe(1)
  })

  it('answers 422 on an import with no rows at all', async () => {
    await request(app).post('/api/shipments/import').send({ shipments: [] }).expect(422)
  })

  it('names the row a file got wrong, alongside the ones it took', async () => {
    const response = await request(app)
      .post('/api/shipments/import')
      .send({ shipments: [validBody(), { store: 'Zalando' }, validBody()] })
      .expect(200)

    const outcome = bodyOf<{ imported: number; failures: { row: number; message: string }[] }>(response)

    expect(outcome.imported).toBe(2)
    expect(outcome.failures).toHaveLength(1)
    expect(outcome.failures[0].row).toBe(2)
    expect(outcome.failures[0].message).toContain('trackingNumber')
  })

  it('refuses a row with no order number, naming the column to fill in', async () => {
    const { orderNumber: _missing, ...noOrder } = validBody()

    const response = await request(app)
      .post('/api/shipments/import')
      .send({ shipments: [noOrder] })
      .expect(200)

    const outcome = bodyOf<{ imported: number; failures: { message: string }[] }>(response)

    expect(outcome.imported).toBe(0)
    expect(outcome.failures[0].message).toContain('orderNumber')
  })

  it('reports the refusals in file order, whichever layer refused them', async () => {
    const taken = uniqueTracking()
    await createShipment({ trackingNumber: taken })

    const response = await request(app)
      .post('/api/shipments/import')
      .send({
        shipments: [
          validBody({ trackingNumber: taken }),
          { store: 'Zalando' },
          validBody(),
        ],
      })
      .expect(200)

    const outcome = bodyOf<{ imported: number; failures: { row: number }[] }>(response)

    expect(outcome.imported).toBe(1)
    expect(outcome.failures.map((failure) => failure.row)).toEqual([1, 2])
  })

  it('drops the derived columns an export writes back, rather than refusing the row', async () => {
    const response = await request(app)
      .post('/api/shipments/import')
      .send({
        shipments: [{
          ...validBody(),
          decisionDelayDays: 4,
          totalDelayDays: 9,
          trackingUrl: 'https://example.test',
        }],
      })
      .expect(200)

    expect(bodyOf<{ imported: number }>(response).imported).toBe(1)
  })

  it('reaches the export route', async () => {
    await createShipment()

    const response = await request(app).get('/api/shipments/export').expect(200)

    expect(bodyOf(response).total).toBe(1)
  })

  it('exports csv with a header row and a download filename', async () => {
    await createShipment({ store: 'Zalando' })

    const response = await request(app).get('/api/shipments/export?format=csv').expect(200)

    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.headers['content-disposition']).toContain('shipments.csv')
    expect(response.text.split('\r\n')[0]).toContain('trackingNumber')
    expect(response.text).toContain('Zalando')
  })

  it('quotes a store that contains a comma, so the csv stays parsable', async () => {
    await createShipment({ store: 'Zalando, BE' })

    const response = await request(app).get('/api/shipments/export?format=csv').expect(200)

    expect(response.text).toContain('"Zalando, BE"')
  })

  it('answers 422 on the exists route when the query is incomplete', async () => {
    await request(app).get('/api/shipments/exists?carrier=bpost').expect(422)
  })
})

describe('GET /api/shipments/:id', () => {
  it('returns the shipment', async () => {
    const created = await createShipment()

    const response = await request(app).get(`/api/shipments/${created.id}`).expect(200)

    expect(bodyOf(response).id).toBe(created.id)
  })

  it('answers 422 for an id that is not a uuid', async () => {
    const response = await request(app).get('/api/shipments/not-a-uuid').expect(422)

    expect(bodyOf<ApiError>(response).error.details).toContainEqual(
      expect.objectContaining({ path: 'id' })
    )
  })

  it('answers 404 for a uuid that matches nothing', async () => {
    await request(app).get('/api/shipments/11111111-1111-4111-8111-111111111111').expect(404)
  })
})

describe('the transitions', () => {
  it('walks the chain through the http layer', async () => {
    const created = await createShipment()

    await request(app)
      .post(`/api/shipments/${created.id}/drop-off`)
      .send({ dropoffDate: todayIso() })
      .expect(200)

    await request(app)
      .post(`/api/shipments/${created.id}/receive`)
      .send({ receivedDate: todayIso() })
      .expect(200)

    const refunded = await request(app)
      .post(`/api/shipments/${created.id}/refund`)
      .send({ decisionDate: todayIso() })
      .expect(200)

    expect(bodyOf(refunded).status).toBe('refunded')
  })

  it('answers 409 on a step backwards', async () => {
    const created = await createShipment()
    await request(app).post(`/api/shipments/${created.id}/receive`).send({ receivedDate: todayIso() }).expect(200)

    const response = await request(app)
      .post(`/api/shipments/${created.id}/drop-off`)
      .send({ dropoffDate: todayIso() })
      .expect(409)

    expect(bodyOf<ApiError>(response).error.code).toBe('ILLEGAL_TRANSITION')
  })

  it('answers 422 when the date is missing', async () => {
    const created = await createShipment()

    await request(app).post(`/api/shipments/${created.id}/drop-off`).send({}).expect(422)
  })

  it('answers 422 when the date is in the future', async () => {
    const created = await createShipment()

    await request(app)
      .post(`/api/shipments/${created.id}/drop-off`)
      .send({ dropoffDate: '2099-01-01' })
      .expect(422)
  })

  it('records the reason that comes with a refusal, leaving the note alone', async () => {
    const created = await createShipment({ note: 'Bought on sale' })

    const response = await request(app)
      .post(`/api/shipments/${created.id}/reject`)
      .send({ decisionDate: todayIso(), rejectionReason: 'Worn item' })
      .expect(200)

    expect(bodyOf(response).rejectionReason).toBe('Worn item')
    expect(bodyOf(response).note).toBe('Bought on sale')
  })

  it('undoes the last step', async () => {
    const created = await createShipment()
    await request(app).post(`/api/shipments/${created.id}/refund`).send({ decisionDate: todayIso() }).expect(200)

    const response = await request(app).post(`/api/shipments/${created.id}/revert`).send().expect(200)

    expect(bodyOf(response).status).toBe('pending')
  })

  it('answers 409 when there is nothing to undo', async () => {
    const created = await createShipment()

    await request(app).post(`/api/shipments/${created.id}/revert`).send().expect(409)
  })
})

describe('PATCH and correct-identity', () => {
  it('edits the fields it accepts', async () => {
    const created = await createShipment()

    const response = await request(app)
      .patch(`/api/shipments/${created.id}`)
      .send({ amountCents: 1234, store: 'Zara' })
      .expect(200)

    expect(bodyOf(response).amountCents).toBe(1234)
    expect(bodyOf(response).store).toBe('Zara')
  })

  it('answers 422 on an empty patch', async () => {
    const created = await createShipment()

    await request(app).patch(`/api/shipments/${created.id}`).send({}).expect(422)
  })

  it.each(['requestedDate', 'dropoffDate', 'receivedDate', 'decisionDate'])(
    'answers 422 when the patch tries to erase %s',
    async (field) => {
      const created = await createShipment()

      await request(app)
        .patch(`/api/shipments/${created.id}`)
        .send({ [field]: null })
        .expect(422)
    }
  )

  it('ignores an attempt to change the identity through patch', async () => {
    const created = await createShipment()

    const response = await request(app)
      .patch(`/api/shipments/${created.id}`)
      .send({ amountCents: 1, trackingNumber: '323299999999999999999999', carrier: 'postnl' })
      .expect(200)

    expect(bodyOf(response).trackingNumber).toBe(created.trackingNumber)
    expect(bodyOf(response).carrier).toBe('bpost')
  })

  it('changes the identity through its own route', async () => {
    const created = await createShipment()
    const corrected = uniqueTracking()

    const response = await request(app)
      .post(`/api/shipments/${created.id}/correct-identity`)
      .send({ carrier: 'bpost', trackingNumber: corrected })
      .expect(200)

    expect(bodyOf(response).trackingNumber).toBe(corrected)
  })

  it('answers 422 when the corrected number does not match the carrier', async () => {
    const created = await createShipment()

    await request(app)
      .post(`/api/shipments/${created.id}/correct-identity`)
      .send({ carrier: 'postnl', trackingNumber: '323200000000000000000001' })
      .expect(422)
  })
})

describe('archive, unarchive and delete', () => {
  it('archives, hides from the list, then puts back', async () => {
    const created = await createShipment()

    await request(app).post(`/api/shipments/${created.id}/archive`).send().expect(200)
    expect(bodyOf(await request(app).get('/api/shipments').expect(200)).total).toBe(0)
    expect(bodyOf(await request(app).get('/api/shipments?archived=only').expect(200)).total).toBe(1)

    await request(app).post(`/api/shipments/${created.id}/unarchive`).send().expect(200)
    expect(bodyOf(await request(app).get('/api/shipments').expect(200)).total).toBe(1)
  })

  it('answers 409 when archiving twice', async () => {
    const created = await createShipment()
    await request(app).post(`/api/shipments/${created.id}/archive`).send().expect(200)

    await request(app).post(`/api/shipments/${created.id}/archive`).send().expect(409)
  })

  it('deletes for good and answers 204 without a body', async () => {
    const created = await createShipment()

    const response = await request(app).delete(`/api/shipments/${created.id}`).expect(204)

    expect(response.text).toBe('')
    await request(app).get(`/api/shipments/${created.id}`).expect(404)
  })
})

describe('GET /api/shipments/:id/label', () => {
  it('answers 404 when the shipment has no label', async () => {
    const created = await createShipment()

    await request(app).get(`/api/shipments/${created.id}/label`).expect(404)
  })

  it('returns the payload when there is one', async () => {
    const tracking = uniqueTracking()
    const created = await request(app)
      .post('/api/shipments')
      .send(
        validBody({
          trackingNumber: tracking,
          label: {
            payloadVersion: 1,
            payload: {
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
              tracking_number: tracking,
            },
          },
        })
      )
      .expect(201)

    const response = await request(app).get(`/api/shipments/${bodyOf<ShipmentBody>(created).id}/label`).expect(200)

    expect(bodyOf(response).payloadVersion).toBe(1)
    expect(bodyOf<{ payload: { tracking_number: string } }>(response).payload.tracking_number).toBe(tracking)
  })

  it('answers 422 when the label payload is incomplete', async () => {
    await request(app)
      .post('/api/shipments')
      .send(validBody({ label: { payloadVersion: 1, payload: { carrier: 'bpost' } } }))
      .expect(422)
  })
})

describe('user isolation through http', () => {
  it.each([
    ['GET', (id: string) => request(app).get(`/api/shipments/${id}`)],
    ['PATCH', (id: string) => request(app).patch(`/api/shipments/${id}`).send({ amountCents: 1 })],
    ['POST drop-off', (id: string) => request(app).post(`/api/shipments/${id}/drop-off`).send({ dropoffDate: todayIso() })],
    ['POST archive', (id: string) => request(app).post(`/api/shipments/${id}/archive`).send()],
    ['DELETE', (id: string) => request(app).delete(`/api/shipments/${id}`)],
    ['GET label', (id: string) => request(app).get(`/api/shipments/${id}/label`)],
  ])('answers 404 to %s on a shipment owned by someone else', async (_label, run) => {
    const mine = await createShipment()

    signedInAs = OTHER
    await run(mine.id).expect(404)
  })

  it('never lists the shipments of another user', async () => {
    await createShipment({ store: 'Mine' })

    signedInAs = OTHER
    const response = await request(app).get('/api/shipments').expect(200)

    expect(bodyOf(response).total).toBe(0)
  })

  it('leaves the shipment untouched after a refused write', async () => {
    const mine = await createShipment({ amountCents: 4999 })

    signedInAs = OTHER
    await request(app).patch(`/api/shipments/${mine.id}`).send({ amountCents: 1 }).expect(404)

    signedInAs = OWNER
    expect(bodyOf(await request(app).get(`/api/shipments/${mine.id}`).expect(200)).amountCents).toBe(4999)
  })
})
