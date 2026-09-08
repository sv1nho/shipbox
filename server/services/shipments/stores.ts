import { prisma } from '../../prisma.js'

const SIMILARITY_FLOOR = 0.2

const DEFAULT_LIMIT = 10

export async function searchStores (
  userId: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<string[]> {
  const trimmed = query.trim()

  if (trimmed === '') {
    const rows = await prisma.$queryRaw<{ store: string }[]>`
      SELECT store
      FROM shipments
      WHERE user_id = ${userId}
      GROUP BY store
      ORDER BY max(created_at) DESC
      LIMIT ${limit}
    `
    return rows.map((row) => row.store)
  }

  const rows = await prisma.$queryRaw<{ store: string }[]>`
    SELECT store
    FROM shipments
    WHERE user_id = ${userId}
      AND (
        lower(immutable_unaccent(store)) LIKE '%' || lower(immutable_unaccent(${trimmed})) || '%'
        OR similarity(lower(immutable_unaccent(store)), lower(immutable_unaccent(${trimmed}))) >= ${SIMILARITY_FLOOR}
      )
    GROUP BY store
    ORDER BY
      (lower(immutable_unaccent(store)) = lower(immutable_unaccent(${trimmed}))) DESC,
      max(similarity(lower(immutable_unaccent(store)), lower(immutable_unaccent(${trimmed})))) DESC,
      store ASC
    LIMIT ${limit}
  `

  return rows.map((row) => row.store)
}
