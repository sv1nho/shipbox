import type { StoreDecisionSpeed } from '../../shared/dashboard.js'

type StoreSpeedProps = {
  stores: StoreDecisionSpeed[]
  measured: number
}

type Timed = StoreDecisionSpeed & { averageDecisionDays: number }

const round = (days: number): string => days.toFixed(1).replace(/\.0$/, '')

export function StoreSpeed ({ stores, measured }: StoreSpeedProps) {
  const timed = stores.filter((store): store is Timed => store.averageDecisionDays !== null)
  const slowest = timed.reduce((most, store) => Math.max(most, store.averageDecisionDays), 0)

  return (
    <figure className='dash-figure'>
      <figcaption className='dash-figure-title'>Days to a decision, per store</figcaption>

      {timed.length === 0
        ? (
          <p className='card-text'>
            No decision has been timed yet. Record one and this chart fills in.
          </p>
          )
        : (
          <>
            <div className='dash-bars'>
              {timed.map((store) => (
                <div className='dash-bar-row' key={store.store}>
                  <span className='dash-bar-label'>
                    <span className='dash-bar-name'>{store.store}</span>
                    <span className='dash-bar-sample'>
                      {store.measured} of {store.returns} timed
                    </span>
                  </span>

                  <span className='dash-bar-track'>
                    <span
                      className='dash-bar-fill'
                      style={{ width: `${String((store.averageDecisionDays / slowest) * 100)}%` }}
                      title={`${store.store}: ${round(store.averageDecisionDays)} days on average over ${String(store.measured)} decided returns`}
                    />
                  </span>

                  <span className='dash-bar-value'>{round(store.averageDecisionDays)}</span>
                </div>
              ))}
            </div>

            <p className='dash-figure-note'>
              Counted from the day the store received the parcel, or from the drop-off when it
              never arrived. Averaged over {measured} decided returns.
            </p>
          </>
          )}
    </figure>
  )
}
