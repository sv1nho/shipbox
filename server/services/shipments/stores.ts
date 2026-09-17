import { prisma } from '../../prisma.js'
import { normalizeStore } from '../../../shared/normalize.js'
import type { StoreDto } from '../../../shared/store.js'

const SIMILARITY_FLOOR = 0.2

const DEFAULT_LIMIT = 10

type StoreRow = { name: string; support_email: string | null }

const toDto = (row: StoreRow): StoreDto => ({ name: row.name, supportEmail: row.support_email })

export async function searchStores (
  userId: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<StoreDto[]> {
  const trimmed = query.trim()

  if (trimmed === '') {
    const rows = await prisma.$queryRaw<StoreRow[]>`
      SELECT s.name, s.support_email
      FROM stores s
      LEFT JOIN shipments sh ON sh.store_id = s.id
      WHERE s.user_id = ${userId}
      GROUP BY s.id, s.name, s.support_email
      ORDER BY max(sh.created_at) DESC NULLS LAST, s.name ASC
      LIMIT ${limit}
    `
    return rows.map(toDto)
  }

  const rows = await prisma.$queryRaw<StoreRow[]>`
    SELECT s.name, s.support_email
    FROM stores s
    WHERE s.user_id = ${userId}
      AND (
        lower(immutable_unaccent(s.name)) LIKE '%' || lower(immutable_unaccent(${trimmed})) || '%'
        OR similarity(lower(immutable_unaccent(s.name)), lower(immutable_unaccent(${trimmed}))) >= ${SIMILARITY_FLOOR}
      )
    ORDER BY
      (lower(immutable_unaccent(s.name)) = lower(immutable_unaccent(${trimmed}))) DESC,
      similarity(lower(immutable_unaccent(s.name)), lower(immutable_unaccent(${trimmed}))) DESC,
      s.name ASC
    LIMIT ${limit}
  `

  return rows.map(toDto)
}

type StoreWriter = {
  store: {
    upsert: (args: {
      where: { userId_name: { userId: string; name: string } }
      create: { userId: string; name: string; supportEmail: string | null }
      update: { supportEmail?: string | null }
      select: { id: true }
    }) => Promise<{ id: string }>
  }
}

export async function storeIdFor (
  tx: StoreWriter,
  userId: string,
  name: string,
  supportEmail?: string | null
): Promise<string> {
  const normalized = normalizeStore(name)

  const row = await tx.store.upsert({
    where: { userId_name: { userId, name: normalized } },
    create: { userId, name: normalized, supportEmail: supportEmail ?? null },
    update: supportEmail === undefined ? {} : { supportEmail },
    select: { id: true },
  })

  return row.id
}
