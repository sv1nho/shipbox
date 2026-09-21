type ErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'ILLEGAL_TRANSITION'
  | 'INTERNAL_ERROR'

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  ILLEGAL_TRANSITION: 409,
  INTERNAL_ERROR: 500,
}

export type Vars = Record<string, string | number>

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: unknown
  readonly vars: Vars | undefined

  constructor (code: ErrorCode, message: string, details?: unknown, vars?: Vars) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
    this.details = details
    this.vars = vars
  }
}
