import { createPrismaClient } from './prisma-client.js'
import { env, isProduction } from './env.js'

export const prisma = createPrismaClient(
  env.DATABASE_URL,
  isProduction ? ['error'] : ['warn', 'error']
)
