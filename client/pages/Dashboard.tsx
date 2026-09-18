import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../api/client.js'
import { getDashboard } from '../api/dashboard.js'
import { StoreSpeed } from '../dashboard/StoreSpeed.js'
import { formatAmount } from '../shipments/format.js'
import type { DashboardSummary } from '../../shared/dashboard.js'

const percent = (rate: number): string => `${String(Math.round(rate * 100))}%`

const returns = (count: number): string => (count === 1 ? '1 return' : `${String(count)} returns`)

function Tile ({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className='dash-tile'>
      <p className='dash-tile-label'>{label}</p>
      <p className='dash-tile-value'>{value}</p>
      <p className='dash-tile-note'>{note}</p>
    </div>
  )
}

export function Dashboard () {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    getDashboard(controller.signal)
      .then((found) => { setSummary(found); setError(null) })
      .catch((cause: unknown) => { setError(errorMessage(cause)) })

    return () => { controller.abort() }
  }, [])

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>Dashboard</h3>
      </div>

      {error !== null && <div className='alert-error'>{error}</div>}

      {error === null && summary === null && <p className='card-text'>Counting your returns…</p>}

      {summary !== null && (
        <div className='space-y-4'>
          <section className='dash-hero'>
            <p className='dash-hero-label'>Returns refunded</p>
            <p className='dash-hero-value'>
              {summary.successRate === null ? '—' : percent(summary.successRate)}
            </p>
            <p className='dash-hero-note'>
              {summary.decided === 0
                ? 'No decision recorded yet.'
                : `${String(summary.refunded)} of ${returns(summary.decided)} the stores decided on.`}
            </p>
          </section>

          <div className='dash-tiles'>
            <Tile
              label='Recovered'
              value={formatAmount(summary.recoveredCents, 'EUR')}
              note={`${returns(summary.refunded)} refunded`}
            />
            <Tile
              label='Lost'
              value={formatAmount(summary.lostCents, 'EUR')}
              note={`${returns(summary.decided - summary.refunded)} refused`}
            />
            <Tile
              label='Still in play'
              value={formatAmount(summary.awaitingCents, 'EUR')}
              note={`${returns(summary.open)} not decided yet`}
            />

            <Link className='dash-tile dash-tile-action' to='/shipments?attention=1'>
              <span className='dash-tile-label'>Needs attention</span>
              <span className='dash-tile-value'>{summary.attention}</span>
              <span className='dash-tile-note'>
                {summary.attention === 0 ? 'Nothing to chase today' : 'Open the list'}
              </span>
            </Link>
          </div>

          <StoreSpeed stores={summary.byStore} measured={summary.measuredDecisions} />
        </div>
      )}
    </div>
  )
}
