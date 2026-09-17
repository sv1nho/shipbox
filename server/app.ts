import express from 'express'
import type { Express } from 'express'
import swaggerUi from 'swagger-ui-express'
import { toNodeHandler } from 'better-auth/node'
import { auth, enabledProviders } from './auth/auth.js'
import { requireUser, currentUser } from './auth/require-user.js'
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js'
import { shipmentsRouter } from './routes/shipments.js'
import { storesRouter } from './routes/stores.js'
import { openApiDocument } from './openapi.js'
import { prisma } from './prisma.js'
import { isProduction } from './env.js'

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

  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiDocument)
  })

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))

  app.use('/api/shipments', shipmentsRouter)
  app.use('/api/stores', storesRouter)

  app.use(notFoundHandler)
  app.use(createErrorHandler({ exposeDetails: !isProduction }))

  return app
}
