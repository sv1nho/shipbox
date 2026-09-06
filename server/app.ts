import express from 'express'
import type { Express } from 'express'
import { toNodeHandler } from 'better-auth/node'
import { auth, enabledProviders } from './auth/auth.js'
import { requireUser, currentUser } from './auth/require-user.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { prisma } from './prisma.js'

export function createApp (): Express {
  const app = express()

  app.disable('x-powered-by')

  app.all('/api/auth/{*any}', toNodeHandler(auth))

  app.use(express.json({ limit: '256kb' }))

  app.get('/api/health', (_req, res, next) => {
    prisma.$queryRaw`SELECT 1`
      .then(() => {
        res.json({ status: 'ok', database: 'up' })
      })
      .catch(next)
  })

  app.get('/api/config', (_req, res) => {
    res.json({ providers: enabledProviders })
  })

  app.get('/api/me', requireUser, (req, res) => {
    res.json({ user: currentUser(req) })
  })

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
