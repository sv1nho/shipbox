import type { StoreStats } from '../../shared/dashboard.js'
import { useT } from '../i18n/context.js'

type StoreTableProps = {
  stores: StoreStats[]
  measured: number
}

const round = (days: number): string => days.toFixed(1).replace(/\.0$/, '')

const percent = (part: number, whole: number): string =>
  `${String(Math.round((part / whole) * 100))}%`

export function StoreTable ({ stores, measured }: StoreTableProps) {
  const t = useT()
  const judged = stores.filter((store) => store.decided > 0)

  const slowest = judged.reduce(
    (most, store) => Math.max(most, store.averageDecisionDays ?? 0),
    0
  )

  return (
    <figure className='dash-figure'>
      <figcaption className='dash-figure-title'>{t('How each store answers')}</figcaption>

      {judged.length === 0
        ? (
          <p className='card-text'>
            {t('No store has decided on a return yet. Record a decision and this table fills in.')}
          </p>
          )
        : (
          <>
            <div className='dash-rows'>
              <div className='dash-row dash-row-head' aria-hidden='true'>
                <span>{t('Store')}</span>
                <span>
                  <span className='dash-head-full'>{t('Days to decide')}</span>
                  <span className='dash-head-short'>{t('Days')}</span>
                </span>
                <span>{t('Refunded')}</span>
              </div>

              {judged.map((store) => (
                <div className='dash-row' key={store.store}>
                  <span className='dash-cell-label'>
                    <span className='dash-cell-name'>{store.store}</span>
                    <span className='dash-cell-sample'>
                      {t('{decided} of {returns} decided', {
                        decided: store.decided,
                        returns: store.returns,
                      })}
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
                          title={t('{store} takes {days} days on average, ' +
                            'over {measured} timed returns', {
                            store: store.store,
                            days: round(store.averageDecisionDays),
                            measured: store.measured,
                          })}
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
                    title={t('{store} refunded {refunded} of {decided} decided returns', {
                      store: store.store,
                      refunded: store.refunded,
                      decided: store.decided,
                    })}
                  >
                    {percent(store.refunded, store.decided)}
                  </span>
                </div>
              ))}
            </div>

            <p className='dash-figure-note'>
              {t('Days are counted from the day the store received the parcel, or from the ' +
                'drop-off when it never arrived, averaged over {measured} decided returns. ' +
                'A store is listed once it has decided on something.', { measured })}
            </p>
          </>
          )}
    </figure>
  )
}
