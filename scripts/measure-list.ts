import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { Client } from 'pg'
import { loadLocalEnv } from '../server/load-env.js'

loadLocalEnv()

const ROWS = Number(process.env.MEASURE_ROWS ?? 20_000)
const OWNER = 'measure-owner'
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js')

const perfUrl = (): string => {
  const base = process.env.DATABASE_URL

  if (base === undefined || base === '') throw new Error('DATABASE_URL must be set')

  const url = new URL(base)
  const name = url.pathname.replace(/^\//, '')

  url.pathname = name.endsWith('_perf') ? `/${name}` : `/${name}_perf`

  return url.toString()
}

const URL_PERF = perfUrl()
const NAME = new URL(URL_PERF).pathname.replace(/^\//, '')

const adminUrl = (): string => {
  const url = new URL(URL_PERF)
  url.pathname = '/postgres'

  return url.toString()
}

const sql = async (statement: string, values: unknown[] = []): Promise<Record<string, unknown>[]> => {
  const client = new Client({ connectionString: URL_PERF })

  await client.connect()
  try {
    const { rows } = await client.query(statement, values)

    return rows as Record<string, unknown>[]
  } finally {
    await client.end()
  }
}

const prepare = async (): Promise<void> => {
  const admin = new Client({ connectionString: adminUrl() })

  await admin.connect()
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [NAME])

    if (existing.rowCount === 0) await admin.query(`CREATE DATABASE "${NAME}"`)
  } finally {
    await admin.end()
  }

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: URL_PERF },
    stdio: 'pipe',
  })
}

const fill = async (): Promise<void> => {
  const [{ count }] = await sql('SELECT count(*)::int AS count FROM shipments WHERE user_id = $1', [OWNER])

  if (count === ROWS) {
    console.log(`${String(ROWS)} shipments already in ${NAME}.`)
    return
  }

  await sql(`
    INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    VALUES ($1, 'Measure', $1 || '@example.test', true, now(), now())
    ON CONFLICT (id) DO NOTHING
  `, [OWNER])

  await sql('DELETE FROM shipments WHERE user_id = $1', [OWNER])
  await sql('DELETE FROM stores WHERE user_id = $1', [OWNER])

  await sql(`
    INSERT INTO stores (id, user_id, name, support_email, created_at, updated_at)
    SELECT gen_random_uuid(), $1, 'Store ' || n, 'help' || n || '@example.test', now(), now()
    FROM generate_series(1, 10) AS n
  `, [OWNER])

  await sql(`
    INSERT INTO shipments (
      id, user_id, tracking_number, carrier, recipient_postal_code, recipient_country,
      status, amount_cents, store_id, requested_date, dropoff_date, received_date,
      decision_date, order_number, note, created_at, updated_at, archived_at
    )
    SELECT
      gen_random_uuid(),
      $1,
      '3232' || lpad(n::text, 20, '0'),
      'bpost',
      '2000',
      'BE',
      (ARRAY['pending', 'dropped_off', 'received', 'refunded', 'rejected'])[1 + (n % 5)],
      1000 + (n % 50000),
      (SELECT id FROM stores WHERE user_id = $1 OFFSET (n % 10) LIMIT 1),
      current_date - ((n % 700) || ' days')::interval,
      CASE WHEN n % 5 = 0 THEN NULL ELSE current_date - ((n % 700) || ' days')::interval END,
      CASE WHEN n % 5 < 2 THEN NULL ELSE current_date - ((n % 700) || ' days')::interval END,
      CASE WHEN n % 5 < 3 THEN NULL ELSE current_date - ((n % 700) || ' days')::interval END,
      'CMD-' || n,
      NULL,
      now(),
      now(),
      CASE WHEN n % 20 = 0 THEN now() ELSE NULL END
    FROM generate_series(1, ${String(ROWS)}) AS n
  `, [OWNER])

  await sql('ANALYZE shipments')

  console.log(`Filled ${NAME} with ${String(ROWS)} shipments across 10 stores.`)
}

process.env.DATABASE_URL = URL_PERF

await prepare()
await fill()

const { list } = await import('../server/services/shipments/index.js')
const { prisma } = await import('../server/prisma.js')

const CASES = [
  ['the default list', {}],
  ['page 40', { page: 40 }],
  ['only what needs attention', { attention: true }],
  ['one store', { store: 'Store 3' }],
  ['a free text search', { search: 'CMD-19999' }],
  ['sorted by amount', { sort: 'amountCents' as const, direction: 'asc' as const }],
] as const

console.log('')

const quantile = (sorted: number[], part: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * part))]

for (const [what, params] of CASES) {
  await list(OWNER, params)

  const takes: number[] = []

  for (let run = 0; run < 20; run += 1) {
    const started = performance.now()
    await list(OWNER, params)
    takes.push(performance.now() - started)
  }

  takes.sort((a, b) => a - b)

  console.log(
    `${what.padEnd(28)} ${quantile(takes, 0.5).toFixed(1).padStart(6)} ms median` +
    `  ${quantile(takes, 0.95).toFixed(1).padStart(6)} ms p95` +
    `  ${String((await list(OWNER, params)).total).padStart(6)} rows`
  )
}

console.log('')

const CONCURRENT = 50
const started = performance.now()

await Promise.all(Array.from({ length: CONCURRENT }, () => list(OWNER, {})))

const underLoad = performance.now() - started

console.log(
  `${String(CONCURRENT)} lists at once took ${underLoad.toFixed(0)} ms, ` +
  `${(underLoad / CONCURRENT).toFixed(1)} ms each`
)

console.log('')

const plan = await sql(`
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT * FROM shipments
  WHERE user_id = $1 AND archived_at IS NULL
  ORDER BY requested_date DESC
  LIMIT 20
`, [OWNER])

for (const line of plan) console.log(String(line['QUERY PLAN']))

await prisma.$disconnect()
