import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../errors.js'
import type { Vars } from '../errors.js'
import { localeOf, translate } from '../i18n/translate.js'
import type { Locale } from '../i18n/translate.js'

type Detail = { path: string; message: string; vars?: Vars }

const isDetail = (value: unknown): value is Detail =>
  typeof value === 'object' && value !== null &&
  typeof (value as Detail).path === 'string' && typeof (value as Detail).message === 'string'

const oneLine = (value: string): string => value.replaceAll(/[\r\n]/g, ' ')

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

const UNREADABLE_BODY = {
  'entity.parse.failed': 'The request body is not valid JSON.',
  'entity.too.large': 'The request body is larger than this API accepts.',
} as const

const refusalOf = (err: unknown): AppError | null => {
  if (err instanceof AppError) return err
  if (typeof err !== 'object' || err === null) return null

  const type = (err as { type?: unknown }).type

  if (type === 'entity.parse.failed') {
    return new AppError('BAD_REQUEST', UNREADABLE_BODY['entity.parse.failed'])
  }

  if (type === 'entity.too.large') {
    return new AppError('PAYLOAD_TOO_LARGE', UNREADABLE_BODY['entity.too.large'])
  }

  return null
}

type HandlerOptions = { exposeDetails: boolean; logRefusals: boolean }

export function createErrorHandler ({ exposeDetails, logRefusals }: HandlerOptions): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const refusal = refusalOf(err)

    if (refusal !== null) {
      const english = translate('en', refusal.message, refusal.vars)

      if (logRefusals) {
        console.warn(
          '%s %s -> %s %s: %s',
          req.method,
          oneLine(req.path),
          refusal.status,
          refusal.code,
          oneLine(english),
          refusal.details ?? ''
        )
      }

      const locale = localeOf(req.get('accept-language'))

      res.status(refusal.status).json({
        error: {
          code: refusal.code,
          message: translate(locale, refusal.message, refusal.vars),
          details: said(locale, refusal.details) ?? null,
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
