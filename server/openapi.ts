import { z } from 'zod'
import {
  correctIdentitySchema,
  createShipmentSchema,
  dropOffSchema,
  existsQuerySchema,
  exportQuerySchema,
  listQuerySchema,
  receiveSchema,
  refundSchema,
  rejectSchema,
  createStoreSchema,
  importShipmentsSchema,
  storesQuerySchema,
  updateShipmentSchema,
} from './routes/schemas.js'

const body = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input' })

const queryParameters = (schema: z.ZodObject): unknown[] => {
  const json = z.toJSONSchema(schema, { io: 'input' }) as {
    properties: Record<string, unknown>
    required?: string[]
  }

  return Object.entries(json.properties).map(([name, value]) => ({
    name,
    in: 'query',
    required: json.required?.includes(name) ?? false,
    schema: value,
  }))
}

const ID_PARAMETER = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
}

const jsonBody = (schema: z.ZodType) => ({
  required: true,
  content: { 'application/json': { schema: body(schema) } },
})

const shipmentResponse = {
  description: 'A shipment with its derived fields, tracking url and label presence.',
}

const errorResponses = {
  401: { description: 'No session.' },
  404: { description: 'Unknown shipment, or one that belongs to another user.' },
  409: { description: 'Tracking number already registered, or illegal transition.' },
  422: { description: 'Request failed validation.' },
}

const transitionPath = (summary: string, schema: z.ZodType) => ({
  post: {
    tags: ['shipments'],
    summary,
    parameters: [ID_PARAMETER],
    requestBody: jsonBody(schema),
    responses: { 200: shipmentResponse, ...errorResponses },
  },
})

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'ShipBox tracking API',
    version: '1.0.0',
    description:
      'Every route requires a session cookie and only ever sees the shipments of the signed-in user. ' +
      'Day counts are calendar days, and the derived ones are null when a source date is missing.',
  },
  tags: [{ name: 'shipments' }, { name: 'stores' }],
  paths: {
    '/api/shipments': {
      get: {
        tags: ['shipments'],
        summary: 'List the shipments of the signed-in user.',
        parameters: queryParameters(listQuerySchema),
        responses: { 200: { description: 'A page of shipments with the total.' }, ...errorResponses },
      },
      post: {
        tags: ['shipments'],
        summary: 'Create a shipment, with its label in the same transaction.',
        requestBody: jsonBody(createShipmentSchema),
        responses: { 201: shipmentResponse, ...errorResponses },
      },
    },
    '/api/shipments/exists': {
      get: {
        tags: ['shipments'],
        summary: 'Tell whether a tracking number is already followed, archived ones included.',
        parameters: queryParameters(existsQuerySchema),
        responses: { 200: { description: '{ exists, id?, archived? }' }, ...errorResponses },
      },
    },
    '/api/shipments/import': {
      post: {
        tags: ['shipments'],
        summary: 'Import many returns at once, reporting the rows it could not take.',
        requestBody: jsonBody(importShipmentsSchema),
        responses: {
          200: { description: '{ imported, failures: { row, message }[] }' },
          ...errorResponses,
        },
      },
    },
    '/api/stores': {
      get: {
        tags: ['stores'],
        summary: 'Suggest stores, tolerating case, accents, substrings and typos.',
        parameters: queryParameters(storesQuerySchema),
        responses: { 200: { description: '{ stores: { name, supportEmail }[] }' }, ...errorResponses },
      },
      post: {
        tags: ['stores'],
        summary: 'Add a store, reusing an existing name and refusing a near duplicate.',
        requestBody: jsonBody(createStoreSchema),
        responses: { 201: { description: 'The store.' }, ...errorResponses },
      },
    },
    '/api/shipments/export': {
      get: {
        tags: ['shipments'],
        summary: 'Export the filtered view, as JSON or CSV, without pagination.',
        parameters: queryParameters(exportQuerySchema),
        responses: { 200: { description: 'The filtered shipments.' }, ...errorResponses },
      },
    },
    '/api/shipments/{id}': {
      get: {
        tags: ['shipments'],
        summary: 'Read one shipment.',
        parameters: [ID_PARAMETER],
        responses: { 200: shipmentResponse, ...errorResponses },
      },
      patch: {
        tags: ['shipments'],
        summary: 'Edit the fields that are not the physical identity of the label.',
        parameters: [ID_PARAMETER],
        requestBody: jsonBody(updateShipmentSchema),
        responses: { 200: shipmentResponse, ...errorResponses },
      },
      delete: {
        tags: ['shipments'],
        summary: 'Delete for good, taking the stored label payload with it.',
        parameters: [ID_PARAMETER],
        responses: { 204: { description: 'Deleted.' }, ...errorResponses },
      },
    },
    '/api/shipments/{id}/label': {
      get: {
        tags: ['shipments'],
        summary: 'Return the payload needed to regenerate the PDF.',
        parameters: [ID_PARAMETER],
        responses: {
          200: { description: '{ payload, payloadVersion }' },
          ...errorResponses,
        },
      },
    },
    '/api/shipments/{id}/correct-identity': {
      post: {
        tags: ['shipments'],
        summary: 'Fix a typo in the carrier or tracking number of a printed label.',
        parameters: [ID_PARAMETER],
        requestBody: jsonBody(correctIdentitySchema),
        responses: { 200: shipmentResponse, ...errorResponses },
      },
    },
    '/api/shipments/{id}/drop-off': transitionPath('Record the drop-off.', dropOffSchema),
    '/api/shipments/{id}/receive': transitionPath('Record the reception by the handler.', receiveSchema),
    '/api/shipments/{id}/refund': transitionPath('Record a refund.', refundSchema),
    '/api/shipments/{id}/reject': transitionPath('Record a refusal, with an optional note.', rejectSchema),
    '/api/shipments/{id}/revert': {
      post: {
        tags: ['shipments'],
        summary: 'Undo the last step and derive the status from the dates left.',
        parameters: [ID_PARAMETER],
        responses: { 200: shipmentResponse, ...errorResponses },
      },
    },
    '/api/shipments/{id}/archive': {
      post: {
        tags: ['shipments'],
        summary: 'Take the shipment out of the main list without losing it.',
        parameters: [ID_PARAMETER],
        responses: { 200: shipmentResponse, ...errorResponses },
      },
    },
    '/api/shipments/{id}/chase': {
      post: {
        tags: ['shipments'],
        summary: 'Record that the store was chased about this return today.',
        parameters: [ID_PARAMETER],
        responses: { 200: shipmentResponse, ...errorResponses },
      },
    },
    '/api/shipments/{id}/unarchive': {
      post: {
        tags: ['shipments'],
        summary: 'Put an archived shipment back into the main list.',
        parameters: [ID_PARAMETER],
        responses: { 200: shipmentResponse, ...errorResponses },
      },
    },
  },
}
