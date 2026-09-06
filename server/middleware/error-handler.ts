import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../errors.js'

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Unknown route: ${req.method} ${req.path}`))
}

export function createErrorHandler ({ exposeDetails }: { exposeDetails: boolean }): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details ?? null },
      })
      return
    }

    console.error(err)

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
        details: exposeDetails && err instanceof Error ? err.message : null,
      },
    })
  }
}
