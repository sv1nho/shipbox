import type { z } from 'zod'
import { AppError } from '../errors.js'

type Source = 'body' | 'query' | 'params'

export function parse<T> (schema: z.ZodType<T>, value: unknown, source: Source): T {
  const result = schema.safeParse(value)

  if (result.success) return result.data

  throw new AppError(
    'VALIDATION_ERROR',
    `Invalid request ${source}.`,
    result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
  )
}
