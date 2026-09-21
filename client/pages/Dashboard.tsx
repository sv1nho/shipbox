import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage, isAbort } from '../api/client.js'
import { getDashboard } from '../api/dashboard.js'
import { PendingNote } from '../components/PendingNote.js'
import { useT } from '../i18n/context.js'
import type { Translate } from '../i18n/context.js'
import { StoreTable } from '../dashboard/StoreTable.js'
import { searchFromFilters } from '../shipments/filters.js'
import { formatAmount } from '../shipments/format.js'
import type { DashboardSummary } from '../../shared/dashboard.js'
import type { ListParams } from '../../shared/shipment.js'

const listing = (filters: ListParams): string =>
  `/shipments?${searchFromFilters(filters).toString()}`

const percent = (rate: number): string => `${String(Math.round(rate * 100))}%`

const returns = (t: Translate, count: number): string =>
  count === 1 ? t('1 return') : t('{count} returns', { count })

type TileProps = {
  label: string
  value: string
  note: string
  to: string
}

function Tile ({ label, value, note, to }: TileProps) {
  return (
    <Link className='dash-tile dash-tile-action' to={to}>
      <span className='dash-tile-label'>{label}</span>
      <span className='dash-tile-value'>{value}</span>
      <span className='dash-tile-note'>{note}</span>
    </Link>
  )
}

export function Dashboard () {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    const controller = new AbortController()

    getDashboard(controller.signal)
      .then((found) => { setSummary(found); setError(null) })
      .catch((cause: unknown) => {
        if (isAbort(cause)) return
        setError(errorMessage(cause))
      })

    return () => { controller.abort() }
  }, [])

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>{t('Dashboard')}</h3>
      </div>

      {error !== null && <div className='alert-error'>{error}</div>}

      {error === null && summary === null && <PendingNote label={t('Counting your returns…')} />}

      {summary !== null && (
        <div className='space-y-4'>
          <section className='dash-hero'>
            <p className='dash-hero-label'>{t('Returns refunded')}</p>
            <p className='dash-hero-value'>
              {summary.successRate === null ? '—' : percent(summary.successRate)}
            </p>
            <p className='dash-hero-note'>
              {summary.decided === 0
                ? t('No decision recorded yet.')
                : t('{refunded} of {decided} the stores decided on.', {
                  refunded: summary.refunded,
                  decided: returns(t, summary.decided),
                })}
            </p>
          </section>

          <div className='dash-tiles'>
            <Tile
              label={t('Recovered')}
              value={formatAmount(summary.recoveredCents, 'EUR')}
              note={t('{count} refunded', { count: returns(t, summary.refunded) })}
              to={listing({ status: 'refunded', archived: 'include' })}
            />
            <Tile
              label={t('Lost')}
              value={formatAmount(summary.lostCents, 'EUR')}
              note={t('{count} refused', {
                count: returns(t, summary.decided - summary.refunded),
              })}
              to={listing({ status: 'rejected', archived: 'include' })}
            />
            <Tile
              label={t('Not decided yet')}
              value={formatAmount(summary.awaitingCents, 'EUR')}
              note={returns(t, summary.open)}
              to={listing({ status: 'open', archived: 'include' })}
            />
            <Tile
              label={t('Needs attention')}
              value={String(summary.attention)}
              note={summary.attention === 0 ? t('Nothing to chase today') : t('Open the list')}
              to={listing({ attention: true })}
            />
          </div>

          <StoreTable stores={summary.byStore} measured={summary.measuredDecisions} />
        </div>
      )}
    </div>
  )
}
