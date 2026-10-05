import { OWNER, fill, perfUrl, prepare, quantile, sql } from './perf-data.js'

const PORT = Number(process.env.MEASURE_PORT ?? 3200)
const BASE = `http://127.0.0.1:${String(PORT)}`
const REQUESTS = Number(process.env.MEASURE_REQUESTS ?? 300)
const AT_ONCE = Number(process.env.MEASURE_CONCURRENCY ?? 20)

const VISITOR = {
  name: 'Measure',
  email: `measure-${String(Date.now())}@example.test`,
  password: 'a-password-only-the-measurements-use',
}

await prepare()
await fill()

process.env.DATABASE_URL = perfUrl()
process.env.E2E_AUTH = 'true'
process.env.RATE_LIMIT_PER_MINUTE = '1000000'
process.env.WEB_ORIGIN = BASE
process.env.BETTER_AUTH_URL = BASE

const { createApp } = await import('../server/app.js')
const { prisma } = await import('../server/prisma.js')

const server = createApp().listen(PORT)

const signUp = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: BASE },
  body: JSON.stringify(VISITOR),
})

if (!signUp.ok) {
  console.error(`Sign-up answered ${String(signUp.status)}: ${await signUp.text()}`)
  process.exit(1)
}

const cookie = signUp.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')

const [{ id: visitorId }] = await sql('SELECT id FROM "user" WHERE email = $1', [VISITOR.email])

await sql('UPDATE stores SET user_id = $1 WHERE user_id = $2', [visitorId, OWNER])
await sql('UPDATE shipments SET user_id = $1 WHERE user_id = $2', [visitorId, OWNER])

const ROUTES = [
  ['GET /api/shipments', '/api/shipments'],
  ['GET /api/shipments?page=40', '/api/shipments?page=40'],
  ['GET /api/dashboard', '/api/dashboard'],
  ['GET /api/health', '/api/health'],
] as const

const once = async (path: string): Promise<number> => {
  const started = performance.now()
  const response = await fetch(`${BASE}${path}`, { headers: { cookie } })

  await response.arrayBuffer()

  if (!response.ok) throw new Error(`${path} answered ${String(response.status)}`)

  return performance.now() - started
}

console.log(`\n${String(REQUESTS)} requests, ${String(AT_ONCE)} at a time, through the whole stack\n`)

try {
  for (const [what, path] of ROUTES) {
    await once(path)

    const alone: number[] = []

    for (let run = 0; run < 20; run += 1) alone.push(await once(path))

    alone.sort((a, b) => a - b)

    const takes: number[] = []
    const started = performance.now()

    for (let sent = 0; sent < REQUESTS; sent += AT_ONCE) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(AT_ONCE, REQUESTS - sent) }, () => once(path))
      )

      takes.push(...batch)
    }

    const wall = performance.now() - started

    takes.sort((a, b) => a - b)

    console.log(
      `${what.padEnd(28)} ${quantile(alone, 0.5).toFixed(1).padStart(6)} ms alone` +
      `  ${quantile(takes, 0.5).toFixed(1).padStart(6)} ms median` +
      `  ${quantile(takes, 0.95).toFixed(1).padStart(6)} ms p95` +
      `  ${(REQUESTS / (wall / 1000)).toFixed(0).padStart(5)} req/s`
    )
  }
} finally {
  await sql('UPDATE shipments SET user_id = $1 WHERE user_id = $2', [OWNER, visitorId])
  await sql('UPDATE stores SET user_id = $1 WHERE user_id = $2', [OWNER, visitorId])
  await prisma.$disconnect()
  server.close()
}

console.log('')
