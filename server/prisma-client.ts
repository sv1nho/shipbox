import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

export function createPrismaClient (connectionString: string, verbose: boolean): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: verbose ? ['warn', 'error'] : ['error'],
  })
}
