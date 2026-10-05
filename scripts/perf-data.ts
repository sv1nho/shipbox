import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { Client } from 'pg'
import { loadLocalEnv } from '../server/load-env.js'

loadLocalEnv()

export const ROWS = Number(process.env.MEASURE_ROWS ?? 20_000)
export const OWNER = 'measure-owner'

const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js')

export const perfUrl = (): string => {
  const base = process.env.DATABASE_URL

  if (base === undefined || base === '') throw new Error('DATABASE_URL must be set')

  const url = new URL(base)
  const name = url.pathname.replace(/^\//, '')

  url.pathname = name.endsWith('_perf') ? `/${name}` : `/${name}_perf`

  return url.toString()
}

export const perfName = (): string => new URL(perfUrl()).pathname.replace(/^\//, '')

export const sql = async (
  statement: string,
  values: unknown[] = []
): Promise<Record<string, unknown>[]> => {
  const client = new Client({ connectionString: perfUrl() })

  await client.connect()
  try {
    const { rows } = await client.query(statement, values)

    return rows as Record<string, unknown>[]
  } finally {
    await client.end()
  }
}

export const prepare = async (): Promise<void> => {
  const url = new URL(perfUrl())
  url.pathname = '/postgres'

  const admin = new Client({ connectionString: url.toString() })

  await admin.connect()
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [perfName()])

    if (existing.rowCount === 0) await admin.query(`CREATE DATABASE "${perfName()}"`)
  } finally {
    await admin.end()
  }

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: perfUrl() },
    stdio: 'pipe',
  })
}

export const fill = async (): Promise<void> => {
  const [{ count }] = await sql(
    'SELECT count(*)::int AS count FROM shipments WHERE user_id = $1',
    [OWNER]
  )

  if (count === ROWS) {
    console.log(`${String(ROWS)} shipments already in ${perfName()}.`)
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

  console.log(`Filled ${perfName()} with ${String(ROWS)} shipments across 10 stores.`)
}

export const quantile = (sorted: number[], part: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * part))]
