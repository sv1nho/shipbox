import { describe, it, expect } from 'vitest'
import { openApiDocument } from '../openapi.js'
import { createApp } from '../app.js'
import { REGISTERED, ROUTERS } from './registered-routes.js'
import { ERROR_CODES } from '../errors.js'
import type { DashboardSummary, StoreStats } from '../../shared/dashboard.js'

const documented = openApiDocument.paths as Record<string, Record<string, unknown>>

describe('the document describes the api that actually exists', () => {
  it.each(REGISTERED)('documents $method $path', ({ path, method }) => {
    expect(documented[path]).toBeDefined()
    expect(documented[path][method]).toBeDefined()
  })

  it('documents nothing that is not routed', () => {
    const routed = new Set(REGISTERED.map(({ path, method }) => `${method} ${path}`))

    for (const [path, operations] of Object.entries(documented)) {
      for (const method of Object.keys(operations)) {
        expect(routed).toContain(`${method} ${path}`)
      }
    }
  })

  it('checks every router the app mounts, so a new one cannot escape the document', () => {
    const stack = (createApp() as unknown as {
      router: { stack: { handle?: { stack?: unknown[] } }[] }
    }).router.stack

    expect(stack.filter((layer) => Array.isArray(layer.handle?.stack))).toHaveLength(ROUTERS.length)
  })

  it('covers every registered route', () => {
    expect(REGISTERED.length).toBeGreaterThan(0)

    const documentedCount = Object.values(documented).reduce(
      (total, operations) => total + Object.keys(operations).length,
      0
    )

    expect(documentedCount).toBe(REGISTERED.length)
  })
})

describe('every operation carries what a reader needs', () => {
  const operations = Object.entries(documented).flatMap(([path, byMethod]) =>
    Object.entries(byMethod).map(([method, operation]) => ({
      name: `${method.toUpperCase()} ${path}`,
      operation: operation as { summary?: string; responses?: Record<string, unknown> },
    }))
  )

  it.each(operations)('$name has a summary', ({ operation }) => {
    expect(operation.summary).toBeTruthy()
  })

  it.each(operations)('$name documents the missing session case', ({ operation }) => {
    expect(operation.responses?.['401']).toBeDefined()
  })

  it.each(operations)('$name documents a success', ({ operation }) => {
    const codes = Object.keys(operation.responses ?? {})
    expect(codes.some((code) => code.startsWith('2'))).toBe(true)
  })
})

describe('the document itself', () => {
  it('announces the openapi version swagger ui expects', () => {
    expect(openApiDocument.openapi).toBe('3.1.0')
  })

  it('says what unit the day counts are in', () => {
    expect(openApiDocument.info.description).toContain('calendar days')
  })

  it('describes the request body of the create route from the zod schema', () => {
    const create = documented['/api/shipments'].post as {
      requestBody: { content: Record<string, { schema: { required?: string[] } }> }
    }

    expect(create.requestBody.content['application/json'].schema.required)
      .toEqual(expect.arrayContaining(['trackingNumber', 'carrier', 'amountCents', 'store']))
  })

  it('lists the carriers the api accepts, taken from the shared config', () => {
    const create = documented['/api/shipments'].post as {
      requestBody: { content: Record<string, { schema: { properties: Record<string, { enum?: string[] }> } }> }
    }

    expect(create.requestBody.content['application/json'].schema.properties.carrier.enum)
      .toEqual(['bpost', 'postnl'])
  })
})

describe('what the document says matches what the api sends', () => {
  const SUMMARY: DashboardSummary = {
    decided: 0,
    refunded: 0,
    successRate: null,
    open: 0,
    attention: 0,
    recoveredCents: 0,
    lostCents: 0,
    awaitingCents: 0,
    measuredDecisions: 0,
    byStore: [],
  }

  const STORE: StoreStats = {
    store: '',
    returns: 0,
    decided: 0,
    refunded: 0,
    measured: 0,
    averageDecisionDays: null,
  }

  const dashboard = (documented['/api/dashboard'].get as {
    responses: { 200: { content: Record<string, { schema: {
      properties: { byStore: { items: { properties: Record<string, unknown> } } }
    } }> } }
  }).responses[200].content['application/json'].schema

  it('names every figure of the dashboard summary, and nothing else', () => {
    expect(Object.keys(dashboard.properties).sort()).toEqual(Object.keys(SUMMARY).sort())
  })

  it('names every figure a store carries, and nothing else', () => {
    expect(Object.keys(dashboard.properties.byStore.items.properties).sort())
      .toEqual(Object.keys(STORE).sort())
  })

  it('lists the error codes the server can actually answer with', () => {
    const schemas = openApiDocument.components.schemas
    expect(schemas.Error.properties.error.properties.code.enum).toEqual(ERROR_CODES)
  })

  it('points every refusal at the one error body the client reads', () => {
    const refusals = Object.values(documented).flatMap((byMethod) =>
      Object.values(byMethod).flatMap((operation) =>
        Object.entries((operation as { responses: Record<string, { content?: unknown }> }).responses)
          .filter(([code]) => code.startsWith('4'))
          .map(([, response]) => response.content)))

    expect(refusals.length).toBeGreaterThan(0)
    for (const content of refusals) {
      expect(content).toEqual({
        'application/json': { schema: { $ref: '#/components/schemas/Error' } },
      })
    }
  })

  it('lets every operation ask for its errors in French', () => {
    const operations = Object.values(documented).flatMap((byMethod) => Object.values(byMethod))

    for (const operation of operations) {
      expect((operation as { parameters: unknown[] }).parameters)
        .toContainEqual({ $ref: '#/components/parameters/AcceptLanguage' })
    }
  })
})
