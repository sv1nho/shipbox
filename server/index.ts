import { createApp } from './app.js'
import { env } from './env.js'
import { prisma } from './prisma.js'

const app = createApp()

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(
    `API listening on http://${env.API_HOST}:${env.API_PORT} (${env.NODE_ENV})`
  )
})

const shutdown = (signal: string): void => {
  console.log(`\n${signal} received, shutting down`)
  server.close(() => {
    void prisma.$disconnect().finally(() => {
      process.exit(0)
    })
  })
}

process.on('SIGINT', () => {
  shutdown('SIGINT')
})
process.on('SIGTERM', () => {
  shutdown('SIGTERM')
})
