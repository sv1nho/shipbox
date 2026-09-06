import { existsSync } from 'node:fs'
import { z } from 'zod'

if (existsSync('.env')) process.loadEnvFile()

const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional()
)

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z
      .string()
      .refine((value) => /^postgres(ql)?:\/\//.test(value), {
        message: 'must be a PostgreSQL URL (postgresql://…)',
      }),

    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1024).max(65535).default(3000),

    WEB_ORIGIN: z.url({ message: 'must be an absolute URL, e.g. http://localhost:5173' }),

    BETTER_AUTH_URL: z.url({ message: 'must be an absolute URL, e.g. http://localhost:5173' }),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, { message: 'must be at least 32 characters, generate one with `openssl rand -base64 32`' }),

    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return

    for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'is required in production',
        })
      }
    }
  })

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  console.error(`Invalid environment configuration:\n${details}\n\nCopy .env.example to .env and fill it in.`)
  process.exit(1)
}

export const env = parsed.data

export const isProduction = env.NODE_ENV === 'production'

export const hasGoogleCredentials =
  env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined
