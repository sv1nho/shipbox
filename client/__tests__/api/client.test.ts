import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiError, buildUrl, errorMessage, request } from '../../api/client.js'

const respondWith = (status: number, body?: unknown, ok = status < 400) => {
  const response = {
    ok,
    status,
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
  }

  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response as unknown as Response)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildUrl', () => {
  it('leaves the path alone without a query', () => {
    expect(buildUrl('/api/shipments', undefined)).toBe('/api/shipments')
  })

  it('leaves the path alone when every value is empty', () => {
    expect(buildUrl('/api/shipments', { store: undefined, search: '' })).toBe('/api/shipments')
  })

  it('drops the keys that carry nothing, so the url stays readable', () => {
    expect(buildUrl('/api/shipments', { status: 'received', store: undefined, search: '' }))
      .toBe('/api/shipments?status=received')
  })

  it('keeps a zero, which is a value and not an absence', () => {
    expect(buildUrl('/api/shipments', { page: 0 })).toBe('/api/shipments?page=0')
  })

  it('escapes what would otherwise break the query string', () => {
    expect(buildUrl('/api/shipments', { search: 'Zalando & Co' }))
      .toBe('/api/shipments?search=Zalando+%26+Co')
  })
})

describe('request', () => {
  it('returns the parsed body on success', async () => {
    respondWith(200, { total: 3 })

    expect(await request<{ total: number }>('/api/shipments')).toEqual({ total: 3 })
  })

  it('sends no body and no content type on a plain read', async () => {
    const fetchMock = respondWith(200, {})

    await request('/api/shipments')

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', body: undefined, headers: undefined })
  })

  it('serialises the body and announces json when writing', async () => {
    const fetchMock = respondWith(201, {})

    await request('/api/shipments', { method: 'POST', body: { store: 'Zalando' } })

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: '{"store":"Zalando"}',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('returns nothing on 204 rather than trying to parse an empty body', async () => {
    respondWith(204, undefined)

    expect(await request<undefined>('/api/shipments/x', { method: 'DELETE' })).toBeUndefined()
  })

  it('passes the abort signal through', async () => {
    const fetchMock = respondWith(200, {})
    const controller = new AbortController()

    await request('/api/shipments', { signal: controller.signal })

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal })
  })
})

describe('request, when the api refuses', () => {
  const failure = async (status: number, body?: unknown): Promise<ApiError> => {
    respondWith(status, body, false)
    return (await request('/api/shipments').catch((cause: unknown) => cause)) as ApiError
  }

  it('throws an ApiError carrying the code and the message', async () => {
    const error = await failure(409, {
      error: { code: 'CONFLICT', message: 'This tracking number is already registered.', details: null },
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.code).toBe('CONFLICT')
    expect(error.message).toBe('This tracking number is already registered.')
  })

  it('keeps the field details a form needs', async () => {
    const error = await failure(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body.',
        details: [{ path: 'trackingNumber', message: 'must match the bpost format' }],
      },
    })

    expect(error.messageFor('trackingNumber')).toBe('must match the bpost format')
    expect(error.messageFor('store')).toBeUndefined()
  })

  it('drops details that are not shaped like field errors', async () => {
    const error = await failure(422, {
      error: { code: 'VALIDATION_ERROR', message: 'Invalid.', details: ['nope', { path: 1 }] },
    })

    expect(error.details).toEqual([])
  })

  it('treats a non array details as absent', async () => {
    const error = await failure(500, {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error.', details: 'boom' },
    })

    expect(error.details).toBeNull()
  })

  it('survives a response that is not json at all', async () => {
    const error = await failure(502)

    expect(error.code).toBe('UNKNOWN_ERROR')
    expect(error.message).toContain('502')
  })

  it('survives a json body that has no error envelope', async () => {
    const error = await failure(500, { oops: true })

    expect(error.code).toBe('UNKNOWN_ERROR')
  })

  it.each([
    [401, 'isUnauthorized'],
    [409, 'isConflict'],
  ] as const)('flags %i through %s', async (status, flag) => {
    const error = await failure(status, { error: { code: 'X', message: 'x' } })

    expect(error[flag]).toBe(true)
  })

  it('does not flag an unrelated status', async () => {
    const error = await failure(404, { error: { code: 'NOT_FOUND', message: 'Shipment not found.' } })

    expect(error.isUnauthorized).toBe(false)
    expect(error.isConflict).toBe(false)
  })
})

describe('errorMessage', () => {
  it('shows what the api said, which is written for the user', () => {
    expect(errorMessage(new ApiError(404, 'NOT_FOUND', 'Shipment not found.', null)))
      .toBe('Shipment not found.')
  })

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['something thrown that is not an error', 'boom'],
  ])('falls back to a connection message on %s', (_case, cause) => {
    expect(errorMessage(cause)).toContain('could not be reached')
  })
})
