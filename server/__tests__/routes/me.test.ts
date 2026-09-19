import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import type { NextFunction, Request, Response } from 'express'

const SIGNED_IN = { id: 'me-tests', email: 'me@example.test', name: 'Me', image: null }

vi.mock('../../auth/require-user.js', () => ({
  requireUser: (req: Request, _res: Response, next: NextFunction) => {
    req.user = SIGNED_IN
    next()
  },
  currentUser: (req: Request) => req.user,
}))

const { createApp } = await import('../../app.js')

describe('GET /api/me', () => {
  it('answers with the user the session belongs to', async () => {
    const response = await request(createApp()).get('/api/me').expect(200)

    expect(response.body).toEqual({ user: SIGNED_IN })
  })
})
