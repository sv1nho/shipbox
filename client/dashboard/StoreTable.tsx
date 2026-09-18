import type { StoreStats } from '../../shared/dashboard.js'

type StoreTableProps = {
  stores: StoreStats[]
  measured: number
}

const round = (days: number): string => days.toFixed(1).replace(/\.0$/, '')

const percent = (part: number, whole: number): string =>
  `${String(Math.round((part / whole) * 100))}%`

export function StoreTable ({ stores, measured }: StoreTableProps) {
  const judged = stores.filter((store) => store.decided > 0)

  const slowest = judged.reduce(
    (most, store) => Math.max(most, store.averageDecisionDays ?? 0),
    0
  )

  return (
    <figure className='dash-figure'>
      <figcaption className='dash-figure-title'>How each store answers</figcaption>

      {judged.length === 0
        ? (
          <p className='card-text'>
            No store has decided on a return yet. Record a decision and this table fills in.
          </p>
          )
        : (
          <>
            <div className='dash-rows'>
              <div className='dash-row dash-row-head' aria-hidden='true'>
                <span>Store</span>
                <span>Days to decide</span>
                <span className='dash-cell-number'>Refunded</span>
              </div>

              {judged.map((store) => (
                <div className='dash-row' key={store.store}>
                  <span className='dash-cell-label'>
                    <span className='dash-cell-name'>{store.store}</span>
                    <span className='dash-cell-sample'>
                      {store.decided} of {store.returns} decided
                    </span>
                  </span>

                  <span className='dash-cell-days'>
                    <span className='dash-bar-track'>
                      {store.averageDecisionDays !== null && (
                        <span
                          className='dash-bar-fill'
                          style={{
                            width: `${String((store.averageDecisionDays / slowest) * 100)}%`,
                          }}
                          title={`${store.store} takes ${round(store.averageDecisionDays)} days on average, over ${String(store.measured)} timed returns`}
                        />
                      )}
                    </span>
                    <span className='dash-cell-number'>
                      {store.averageDecisionDays === null
                        ? '—'
                        : round(store.averageDecisionDays)}
                    </span>
                  </span>

                  <span
                    className='dash-cell-number'
                    title={`${store.store} refunded ${String(store.refunded)} of ${String(store.decided)} decided returns`}
                  >
                    {percent(store.refunded, store.decided)}
                  </span>
                </div>
              ))}
            </div>

            <p className='dash-figure-note'>
              Days are counted from the day the store received the parcel, or from the drop-off
              when it never arrived, averaged over {measured} decided returns. A store is listed
              once it has decided on something.
            </p>
          </>
          )}
    </figure>
  )
}
