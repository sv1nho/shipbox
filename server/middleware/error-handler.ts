import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../errors.js'
import type { Vars } from '../errors.js'
import { localeOf, translate } from '../i18n/translate.js'
import type { Locale } from '../i18n/translate.js'

type Detail = { path: string; message: string; vars?: Vars }

const isDetail = (value: unknown): value is Detail =>
  typeof value === 'object' && value !== null &&
  typeof (value as Detail).path === 'string' && typeof (value as Detail).message === 'string'

const said = (locale: Locale, details: unknown): unknown =>
  Array.isArray(details) && details.every(isDetail)
    ? details.map((detail: Detail) => ({
      path: detail.path,
      message: translate(locale, detail.message, detail.vars),
    }))
    : details

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Unknown route: ${req.method} ${req.path}`))
}

export function createErrorHandler ({ exposeDetails }: { exposeDetails: boolean }): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof AppError) {
      const english = translate('en', err.message, err.vars)

      if (exposeDetails) {
        console.warn(
          `${req.method} ${req.path} -> ${String(err.status)} ${err.code}: ${english}`,
          err.details ?? ''
        )
      }

      const locale = localeOf(req.get('accept-language'))

      res.status(err.status).json({
        error: {
          code: err.code,
          message: translate(locale, err.message, err.vars),
          details: said(locale, err.details) ?? null,
        },
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
