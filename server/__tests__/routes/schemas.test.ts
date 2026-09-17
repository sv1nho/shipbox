import { describe, it, expect } from 'vitest'
import { createShipmentSchema } from '../../routes/schemas.js'
import { REQUIRED_CREATE_FIELDS } from '../../../shared/shipment.js'

const complete = {
  trackingNumber: '323200000000000000004050',
  carrier: 'bpost',
  store: 'Zalando',
  amountCents: 4999,
  recipientPostalCode: '2000',
  recipientCountry: 'BE',
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
})
