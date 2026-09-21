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

const fakeRequest = (method = 'GET', path = '/api/unknown') =>
  ({ method, path }) as unknown as Request

const run = (err: unknown, exposeDetails: boolean) => {
  const { res, captured } = fakeResponse()
  createErrorHandler({ exposeDetails })(err, fakeRequest(), res, (() => {}) as NextFunction)
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

  it('says in the terminal why it refused, so no refusal is silent', () => {
    const details = [{ path: 'store', message: 'Say which store the parcel goes back to.' }]

    run(new AppError('VALIDATION_ERROR', 'Some details were refused.', details), true)

    expect(console.warn).toHaveBeenCalledWith(
      'GET /api/unknown -> 422 VALIDATION_ERROR: Some details were refused.',
      details
    )
  })

  it('keeps refusals out of the log where details are not exposed', () => {
    run(new AppError('CONFLICT', 'Already tracked.'), false)

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
