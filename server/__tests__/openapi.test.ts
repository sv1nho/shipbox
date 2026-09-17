import { describe, it, expect } from 'vitest'
import { openApiDocument } from '../openapi.js'
import { shipmentsRouter } from '../routes/shipments.js'
import { storesRouter } from '../routes/stores.js'

type Layer = { route?: { path: string; methods: Record<string, boolean> } }

const routesOf = (router: { stack: unknown[] }, base: string) =>
  (router.stack as Layer[]).flatMap(({ route }) =>
    route === undefined
      ? []
      : [
          {
            path: `${base}${route.path === '/' ? '' : route.path}`.replace(/:(\w+)/g, '{$1}'),
            method: Object.keys(route.methods)[0],
          },
        ]
  )

const registered = [
  ...routesOf(shipmentsRouter, '/api/shipments'),
  ...routesOf(storesRouter, '/api/stores'),
]

const documented = openApiDocument.paths as Record<string, Record<string, unknown>>

describe('the document describes the api that actually exists', () => {
  it.each(registered)('documents $method $path', ({ path, method }) => {
    expect(documented[path]).toBeDefined()
    expect(documented[path][method]).toBeDefined()
  })

  it('documents nothing that is not routed', () => {
    const routed = new Set(registered.map(({ path, method }) => `${method} ${path}`))

    for (const [path, operations] of Object.entries(documented)) {
      for (const method of Object.keys(operations)) {
        expect(routed).toContain(`${method} ${path}`)
      }
    }
  })

  it('covers every registered route', () => {
    expect(registered.length).toBeGreaterThan(0)

    const documentedCount = Object.values(documented).reduce(
      (total, operations) => total + Object.keys(operations).length,
      0
    )

    expect(documentedCount).toBe(registered.length)
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
