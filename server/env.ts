import { existsSync } from 'node:fs'
import { envSchema } from './env-schema.js'

if (existsSync('.env')) process.loadEnvFile()

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
