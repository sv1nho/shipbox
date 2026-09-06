import express from 'express'
import type { Express } from 'express'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { prisma } from './prisma.js'

export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '256kb' }))

  app.get('/api/health', (_req, res, next) => {
    prisma.$queryRaw`SELECT 1`
      .then(() => {
        res.json({ status: 'ok', database: 'up' })
      })
      .catch(next)
  })

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
