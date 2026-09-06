import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../errors.js'
import { isProduction } from '../env.js'

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Unknown route: ${req.method} ${req.path}`,
      details: null,
    },
  })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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
      details: isProduction || !(err instanceof Error) ? null : err.message,
    },
  })
}
