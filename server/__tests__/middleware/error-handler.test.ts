import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { createErrorHandler, notFoundHandler } from '../../middleware/error-handler.js'
import { AppError } from '../../errors.js'

type Captured = { status: number; body: unknown }

const fakeResponse = () => {
  const captured: Captured = { status: 0, body: undefined }
  const res = {
    status (code: number) {
      captured.status = code
      return res
    },
    json (payload: unknown) {
      captured.body = payload
      return res
    },
  }
  return { res: res as unknown as Response, captured }
}

const fakeRequest = (method = 'GET', path = '/api/unknown', language?: string) =>
  ({ method, path, get: () => language }) as unknown as Request

const run = (err: unknown, exposeDetails: boolean, language?: string, logRefusals = false) => {
  const { res, captured } = fakeResponse()
  createErrorHandler({ exposeDetails, logRefusals })(
    err,
    fakeRequest('GET', '/api/unknown', language),
    res,
    (() => {}) as NextFunction
  )
  return captured
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('notFoundHandler', () => {
  it('forwards a NOT_FOUND AppError naming the route, instead of answering itself', () => {
    const next = vi.fn()

    notFoundHandler(fakeRequest('POST', '/api/shipments'), fakeResponse().res, next as NextFunction)

    expect(next).toHaveBeenCalledOnce()
    const forwarded: unknown = next.mock.calls[0][0]
    expect(forwarded).toBeInstanceOf(AppError)
    expect((forwarded as AppError).code).toBe('NOT_FOUND')
    expect((forwarded as AppError).message).toContain('POST /api/shipments')
  })
})

describe('a body express itself could not read', () => {
  const bodyFailure = (type: string): Error => Object.assign(new SyntaxError('bad body'), { type })

  it('calls unreadable json a bad request, not a server fault', () => {
    const captured = run(bodyFailure('entity.parse.failed'), false)

    expect(captured.status).toBe(400)
    expect(captured.body).toMatchObject({
      error: { code: 'BAD_REQUEST', message: 'The request body is not valid JSON.' },
    })
  })

  it('says a body is too large rather than failing on it', () => {
    const captured = run(bodyFailure('entity.too.large'), false)

    expect(captured.status).toBe(413)
    expect(captured.body).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } })
  })

  it('says both in the language the caller reads', () => {
    expect(run(bodyFailure('entity.parse.failed'), false, 'fr-BE').body)
      .toMatchObject({ error: { message: 'Le corps de la requête n’est pas du JSON valide.' } })
    expect(run(bodyFailure('entity.too.large'), false, 'fr-BE').body)
      .toMatchObject({ error: { message: 'Le corps de la requête dépasse ce que cette API accepte.' } })
  })

  it('survives a thrown value that is not even an object', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(run('a bare string', false).status).toBe(500)
  })

  it('still treats an error it does not know as a server fault', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const captured = run(Object.assign(new Error('boom'), { type: 'something.else' }), false)

    expect(captured.status).toBe(500)
  })
})

describe('createErrorHandler', () => {
  it('answers an AppError with its own status and code', () => {
    const captured = run(new AppError('CONFLICT', 'Already tracked.'), true)

    expect(captured.status).toBe(409)
    expect(captured.body).toEqual({
      error: { code: 'CONFLICT', message: 'Already tracked.', details: null },
    })
  })

  it('passes the details of an AppError through', () => {
    const captured = run(new AppError('VALIDATION_ERROR', 'Invalid body.', { field: 'store' }), true)

    expect(captured.status).toBe(422)
    expect(captured.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid body.', details: { field: 'store' } },
    })
  })

  it('answers in the language the caller asked for, fields and all', () => {
    const details = [{ path: 'store', message: 'Say which store the parcel goes back to.' }]
    const captured = run(
      new AppError('VALIDATION_ERROR', 'A postal code is required.', details),
      false,
      'fr-BE,fr;q=0.9'
    )

    expect(captured.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Un code postal est obligatoire.',
        details: [{ path: 'store', message: 'Indiquez à quel magasin le colis retourne.' }],
      },
    })
  })

  it('fills in what a message was about, in that language too', () => {
    const captured = run(
      new AppError(
        'VALIDATION_ERROR',
        '{date} cannot be in the future.',
        undefined,
        { date: 'The drop-off date' }
      ),
      false,
      'fr'
    )

    expect(captured.body).toMatchObject({
      error: { message: 'La date de dépôt ne peut pas être dans le futur.' },
    })
  })

  it('answers in English when nothing was asked for', () => {
    const captured = run(new AppError('NOT_FOUND', 'Shipment not found.'), false)

    expect(captured.body).toMatchObject({ error: { message: 'Shipment not found.' } })
  })

  it('says in the terminal why it refused, so no refusal is silent', () => {
    const details = [{ path: 'store', message: 'Say which store the parcel goes back to.' }]

    run(new AppError('VALIDATION_ERROR', 'Some details were refused.', details), true, undefined, true)

    expect(console.warn).toHaveBeenCalledWith(
      'GET /api/unknown -> 422 VALIDATION_ERROR: Some details were refused.',
      details
    )
  })

  it('logs a refusal that names no field without printing undefined after it', () => {
    run(new AppError('NOT_FOUND', 'Shipment not found.'), true, undefined, true)

    expect(console.warn).toHaveBeenCalledWith('GET /api/unknown -> 404 NOT_FOUND: Shipment not found.', '')
  })

  it('keeps refusals out of the log outside development, even where details are exposed', () => {
    run(new AppError('CONFLICT', 'Already tracked.'), true)

    expect(console.warn).not.toHaveBeenCalled()
  })

  it('turns an unexpected error into a 500 that reveals nothing by itself', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const captured = run(new Error('connect ECONNREFUSED 127.0.0.1:5433'), false)

    expect(captured.status).toBe(500)
    expect(captured.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error.', details: null },
    })
  })

  it('reveals the cause only when details are allowed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const captured = run(new Error('connect ECONNREFUSED 127.0.0.1:5433'), true)

    expect(captured.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
        details: 'connect ECONNREFUSED 127.0.0.1:5433',
      },
    })
  })

  it('logs the unexpected error rather than swallowing it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const thrown = new Error('boom')

    run(thrown, false)

    expect(spy).toHaveBeenCalledWith(thrown)
  })

  it.each([
    ['a string', 'something broke'],
    ['null', null],
    ['an object', { message: 'not an Error' }],
  ])('never exposes details for %s, even when details are allowed', (_label, thrown) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const captured = run(thrown, true)

    expect(captured.status).toBe(500)
    expect(captured.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error.', details: null },
    })
  })
})
