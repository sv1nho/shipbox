import { describe, it, expect } from 'vitest'
import { createShipmentSchema, updateShipmentSchema } from '../../routes/schemas.js'
import { REQUIRED_CREATE_FIELDS } from '../../../shared/shipment.js'

const complete = {
  trackingNumber: '323200000000000000004050',
  carrier: 'bpost',
  store: 'Zalando',
  amountCents: 4999,
  recipientPostalCode: '2000',
  recipientCountry: 'BE',
  orderNumber: 'ZAL-2026-0001',
}

describe('the fields a create cannot do without', () => {
  it('accepts a body that carries exactly the shared list', () => {
    expect(createShipmentSchema.safeParse(complete).success).toBe(true)
  })

  it.each(REQUIRED_CREATE_FIELDS)('refuses a body with no %s', (field) => {
    const { [field]: _removed, ...rest } = complete

    expect(createShipmentSchema.safeParse(rest).success).toBe(false)
  })

  it('names no field the schema would accept as absent', () => {
    for (const field of REQUIRED_CREATE_FIELDS) {
      const { [field]: _removed, ...rest } = complete

      expect(createShipmentSchema.safeParse(rest).error?.issues[0].path).toContain(field)
    }
  })

  it.each([null, '', '   '])('refuses %p as an order number, which the store cannot search for', (given) => {
    expect(createShipmentSchema.safeParse({ ...complete, orderNumber: given }).success).toBe(false)
  })

  it('trims the order number, a trailing space not being part of it', () => {
    expect(createShipmentSchema.parse({ ...complete, orderNumber: ' HM-55120 ' }).orderNumber)
      .toBe('HM-55120')
  })
})

describe('what it says when it refuses', () => {
  const messageFor = (overrides: Record<string, unknown>): string => {
    const result = createShipmentSchema.safeParse({ ...complete, ...overrides })

    if (result.success) throw new Error('expected a refusal')

    return result.error.issues[0].message
  }

  it.each([
    ['an amount above a million', { amountCents: 100_000_001 }, 'An amount cannot be more than 1,000,000.'],
    ['a negative amount', { amountCents: -1 }, 'An amount cannot be negative.'],
    ['an empty store', { store: '' }, 'Say which store the parcel goes back to.'],
    ['an empty order number', { orderNumber: '' }, 'The store searches by its own order number, not by the tracking number.'],
    ['an empty postal code', { recipientPostalCode: '' }, 'A postal code is required.'],
    ['a country that is not a code', { recipientCountry: 'Belgium' }, 'A country is a two-letter code, such as BE.'],
    ['an address that is not one', { storeSupportEmail: 'nope' }, 'This is not a valid email address.'],
  ])('explains %s in words a person can act on', (_label, overrides, expected) => {
    expect(messageFor(overrides)).toBe(expected)
  })
})

describe('the name a label carries for each party', () => {
  const payload = (over: Record<string, unknown>) => ({
    sender_address: 'Rue de la Paix 1', sender_postal: '1000', sender_city: 'Bruxelles',
    sender_country: 'BE', sender_isCompany: false,
    recipient_address: 'Avenue Centrale 45', recipient_postal: '4000', recipient_city: 'Liege',
    recipient_country: 'BE', recipient_isCompany: false,
    label_language: 'fr', carrier: 'bpost', tracking_number: '323200000000000000004050',
    ...over,
  })

  const refusals = (over: Record<string, unknown>): string[] => {
    const result = createShipmentSchema.safeParse({
      ...complete,
      label: { payload: payload(over), payloadVersion: 1 },
    })

    return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
  }

  const PERSON = { firstname: 'Jean', lastname: 'Dupont' }

  it.each([
    ['two people, with no company anywhere', {
      sender_firstname: PERSON.firstname, sender_lastname: PERSON.lastname,
      recipient_firstname: 'Marie', recipient_lastname: 'Martin',
    }],
    ['two companies, with no person anywhere', {
      sender_isCompany: true, sender_company: 'Acme',
      recipient_isCompany: true, recipient_company: 'Nike',
    }],
    ['a company sending to a person', {
      sender_isCompany: true, sender_company: 'Acme',
      recipient_firstname: 'Marie', recipient_lastname: 'Martin',
    }],
  ])('takes %s', (_label, over) => {
    expect(refusals(over)).toEqual([])
  })

  it('asks for the two halves of a name when nobody is named', () => {
    expect(refusals({})).toEqual([
      'label.payload.sender_firstname',
      'label.payload.sender_lastname',
      'label.payload.recipient_firstname',
      'label.payload.recipient_lastname',
    ])
  })

  it('asks for the company when a company was chosen and left blank', () => {
    expect(refusals({
      sender_isCompany: true, sender_company: '   ',
      recipient_isCompany: true, recipient_company: 'Nike',
    })).toEqual(['label.payload.sender_company'])
  })
})

describe('what an update may not take away', () => {
  it.each([null, ''])('refuses %p, the order number having become required', (given) => {
    expect(updateShipmentSchema.safeParse({ orderNumber: given }).success).toBe(false)
  })

  it('still lets the note go back to nothing, since no store searches by it', () => {
    expect(updateShipmentSchema.safeParse({ note: null }).success).toBe(true)
  })
})
