import { prisma } from '../prisma.js'
import { today, toUtcDate } from './shipments/dates.js'
import type { IsoDate } from './shipments/dates.js'
import { attentionCutoffs, chasedRecentlyOnOrAfter } from './shipments/status.js'
import { DECISION_STATUSES, OPEN_STATUSES } from '../../shared/shipment-status.js'
import type { DashboardSummary, StoreDecisionSpeed } from '../../shared/dashboard.js'

type StoreRow = {
  store: string
  returns: number
  measured: number
  average_decision_days: number | null
}

type StatusRow = {
  status: string
  count: number
  cents: number
}

const attentionWhere = (userId: string, now: IsoDate) => ({
  userId,
  archivedAt: null,
  AND: [
    {
      OR: attentionCutoffs(now).map(({ status, field, onOrBefore }) => ({
        status,
        [field]: { lte: toUtcDate(onOrBefore) },
      })),
    },
    {
      OR: [
        { lastChasedAt: null },
        { lastChasedAt: { lt: toUtcDate(chasedRecentlyOnOrAfter(now)) } },
      ],
    },
  ],
})

const sumOf = (rows: StatusRow[], wanted: readonly string[]) =>
  rows
    .filter((row) => wanted.includes(row.status))
    .reduce(
      (totals, row) => ({ count: totals.count + row.count, cents: totals.cents + row.cents }),
      { count: 0, cents: 0 }
    )

export async function summary (userId: string): Promise<DashboardSummary> {
  const now = today()

  const [groups, attention, stores] = await Promise.all([
    prisma.$queryRaw<StatusRow[]>`
      SELECT
        status,
        count(*)::int AS count,
        coalesce(sum(amount_cents), 0)::int AS cents
      FROM shipments
      WHERE user_id = ${userId}
      GROUP BY status
    `,
    prisma.shipment.count({ where: attentionWhere(userId, now) }),
    prisma.$queryRaw<StoreRow[]>`
      SELECT
        s.name AS store,
        count(*)::int AS returns,
        count(sh.decision_date) FILTER (
          WHERE coalesce(sh.received_date, sh.dropoff_date) IS NOT NULL
        )::int AS measured,
        avg(sh.decision_date - coalesce(sh.received_date, sh.dropoff_date)) AS average_decision_days
      FROM stores s
      JOIN shipments sh ON sh.store_id = s.id
      WHERE s.user_id = ${userId}
      GROUP BY s.id, s.name
      ORDER BY average_decision_days DESC NULLS LAST, s.name ASC
    `,
  ])

  const decided = sumOf(groups, DECISION_STATUSES)
  const refunded = sumOf(groups, ['refunded'])
  const rejected = sumOf(groups, ['rejected'])
  const open = sumOf(groups, OPEN_STATUSES)

  const byStore: StoreDecisionSpeed[] = stores.map((row) => ({
    store: row.store,
    returns: row.returns,
    measured: row.measured,
    averageDecisionDays:
      row.average_decision_days === null ? null : Number(row.average_decision_days),
  }))

  return {
    decided: decided.count,
    refunded: refunded.count,
    successRate: decided.count === 0 ? null : refunded.count / decided.count,
    open: open.count,
    attention,
    recoveredCents: refunded.cents,
    lostCents: rejected.cents,
    awaitingCents: open.cents,
    measuredDecisions: byStore.reduce((total, row) => total + row.measured, 0),
    byStore,
  }
}
