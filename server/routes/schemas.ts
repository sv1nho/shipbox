import { z } from 'zod'
import { CARRIERS, CARRIER_IDS } from '../../shared/carriers.js'
import type { CarrierId } from '../../shared/carriers.js'
import { SHIPMENT_STATUSES, STATUS_FILTERS } from '../../shared/shipment-status.js'
import { COUNTRIES, LANGUAGES } from '../../shared/label-payload.js'
import { MAX_AMOUNT_CENTS, SORT_KEYS } from '../../shared/shipment.js'
import { normalizeTrackingNumber } from '../../shared/normalize.js'

const asTuple = <T extends string>(values: readonly T[]): [T, ...T[]] =>
  values as unknown as [T, ...T[]]

const carrierSchema = z.enum(asTuple(CARRIER_IDS))

const statusSchema = z.enum(asTuple(SHIPMENT_STATUSES))

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')

const trackingNumberSchema = z.string().min(1).max(64)

const storeSchema = z.string().min(1).max(120)

const postalCodeSchema = z.string().min(1).max(16)

const countryCodeSchema = z.string().length(2)

const amountCentsSchema = z
  .int('An amount like 49.99 is required.')
  .min(0, 'An amount cannot be negative.')
  .max(MAX_AMOUNT_CENTS, 'An amount cannot be more than 1,000,000.')

const orderNumberSchema = z.string().trim().min(1).max(64)

const noteSchema = z.string().max(2000).nullish()

const supportEmailSchema = z.email().max(320).nullish()

export const idParamSchema = z.object({ id: z.uuid() })

const labelPayloadSchema = z.object({
  sender_firstname: z.string().max(120),
  sender_lastname: z.string().max(120),
  sender_company: z.string().max(120),
  sender_address: z.string().max(200),
  sender_postal: z.string().max(16),
  sender_city: z.string().max(120),
  sender_country: z.enum(asTuple(COUNTRIES)),
  sender_isCompany: z.boolean(),
  recipient_firstname: z.string().max(120),
  recipient_lastname: z.string().max(120),
  recipient_company: z.string().max(120),
  recipient_address: z.string().max(200),
  recipient_postal: z.string().max(16),
  recipient_city: z.string().max(120),
  recipient_country: z.enum(asTuple(COUNTRIES)),
  recipient_isCompany: z.boolean(),
  label_language: z.enum(asTuple(LANGUAGES)),
  carrier: carrierSchema,
  tracking_number: trackingNumberSchema,
})

const labelSchema = z.object({
  payload: labelPayloadSchema,
  payloadVersion: z.int().min(1),
})

const matchesCarrierPattern = (
  value: { carrier: CarrierId; trackingNumber: string },
  ctx: z.RefinementCtx
): void => {
  const config = CARRIERS[value.carrier]

  if (!config.pattern.test(normalizeTrackingNumber(value.trackingNumber))) {
    ctx.addIssue({
      code: 'custom',
      path: ['trackingNumber'],
      message: `must match the ${config.label} format: ${config.patternHint}`,
    })
  }
}

export const createShipmentSchema = z
  .object({
    trackingNumber: trackingNumberSchema,
    carrier: carrierSchema,
    recipientPostalCode: postalCodeSchema,
    recipientCountry: countryCodeSchema,
    amountCents: amountCentsSchema,
    store: storeSchema,
    storeSupportEmail: supportEmailSchema,
    status: statusSchema.optional(),
    requestedDate: isoDateSchema.optional(),
    dropoffDate: isoDateSchema.nullish(),
    receivedDate: isoDateSchema.nullish(),
    neverReceived: z.boolean().optional(),
    decisionDate: isoDateSchema.nullish(),
    orderNumber: orderNumberSchema,
    note: noteSchema,
    rejectionReason: noteSchema,
    label: labelSchema.optional(),
  })
  .superRefine(matchesCarrierPattern)

export const updateShipmentSchema = z
  .object({
    recipientPostalCode: postalCodeSchema.optional(),
    recipientCountry: countryCodeSchema.optional(),
    amountCents: amountCentsSchema.optional(),
    store: storeSchema.optional(),
    orderNumber: orderNumberSchema.optional(),
    note: noteSchema,
    requestedDate: isoDateSchema.optional(),
    dropoffDate: isoDateSchema.optional(),
    receivedDate: isoDateSchema.optional(),
    decisionDate: isoDateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'at least one field must be given')

export const correctIdentitySchema = z
  .object({
    carrier: carrierSchema,
    trackingNumber: trackingNumberSchema,
  })
  .superRefine(matchesCarrierPattern)

export const dropOffSchema = z.object({ dropoffDate: isoDateSchema })

export const receiveSchema = z.object({ receivedDate: isoDateSchema })

export const refundSchema = z.object({
  decisionDate: isoDateSchema,
  neverReceived: z.boolean().optional(),
})

export const rejectSchema = z.object({
  decisionDate: isoDateSchema,
  rejectionReason: z.string().max(2000).optional(),
  neverReceived: z.boolean().optional(),
})

export const listQuerySchema = z.object({
  carrier: carrierSchema.optional(),
  status: z.enum(asTuple(STATUS_FILTERS)).optional(),
  store: z.string().min(1).max(120).optional(),
  search: z.string().min(1).max(120).optional(),
  archived: z.enum(['exclude', 'only', 'include']).optional(),
  attention: z.stringbool().optional(),
  sort: z.enum(asTuple(SORT_KEYS)).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

export const exportQuerySchema = listQuerySchema
  .omit({ page: true, pageSize: true })
  .extend({ format: z.enum(['json', 'csv']).default('json') })

export const existsQuerySchema = z.object({
  carrier: carrierSchema,
  trackingNumber: trackingNumberSchema,
})

export const importShipmentsSchema = z.object({
  shipments: z.array(z.unknown()).min(1).max(500),
})

export const createStoreSchema = z.object({
  name: storeSchema,
  supportEmail: z.email().max(320),
})

export const storesQuerySchema = z.object({
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})
