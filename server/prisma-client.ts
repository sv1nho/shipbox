import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

export type PrismaLogLevel = 'query' | 'info' | 'warn' | 'error'

export function createPrismaClient (connectionString: string, log: PrismaLogLevel[]): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log,
  })
}
