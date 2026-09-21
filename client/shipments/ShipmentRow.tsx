import type { ShipmentDto } from '../../shared/shipment.js'
import { TRANSITIONS, menuSteps, nextStep, undoLabel } from '../../shared/transitions.js'
import type { NextStep } from '../../shared/transitions.js'
import { CARRIERS } from '../../shared/carriers.js'
import { useT } from '../i18n/context.js'
import { alertMessage, delayInfo, formatAmount, formatDate, statusDate } from './format.js'
import { needsMail } from './mail.js'
import { StatusPill } from './StatusPill.js'

export type RowHandlers = {
  onTransition: (shipment: ShipmentDto, actions: NextStep['actions']) => void
  onRevert: (shipment: ShipmentDto) => void
  onArchive: (shipment: ShipmentDto) => void
  onUnarchive: (shipment: ShipmentDto) => void
  onDelete: (shipment: ShipmentDto) => void
  onDownloadLabel: (shipment: ShipmentDto) => void
  onShowDetails: (shipment: ShipmentDto) => void
  onWriteToStore: (shipment: ShipmentDto) => void
  onToggleMenu: (shipment: ShipmentDto) => void
}

const stepClass = (step: NextStep): string =>
  step.actions.length === 1
    ? `status-btn-${TRANSITIONS[step.actions[0]].target}`
    : 'status-btn-choice'

type RowProps = {
  shipment: ShipmentDto
  handlers: RowHandlers
  menuOpen: boolean
}

export function ShipmentRow ({ shipment, handlers, menuOpen }: RowProps) {
  const t = useT()
  const alert = alertMessage(t, shipment)
  const step = nextStep(shipment.status)
  const undo = undoLabel(shipment.status)
  const archived = shipment.archivedAt !== null
  const state = statusDate(shipment)
  const delay = delayInfo(t, shipment)

  return (
    <article className={archived ? 'shipment-row shipment-row-archived' : 'shipment-row'}>
      <StatusPill status={shipment.status} />

      <div className='shipment-identity'>
        <a
          className='shipment-tracking'
          href={shipment.trackingUrl}
          title={t('Track this parcel on {carrier}', { carrier: CARRIERS[shipment.carrier].label })}
          target='_blank'
          rel='noreferrer'
        >
          {shipment.trackingNumber}
        </a>
        <span className='shipment-carrier'>{CARRIERS[shipment.carrier].label}</span>
      </div>

      <span className='shipment-store' title={shipment.store}>{shipment.store}</span>
      <span className='shipment-amount'>{formatAmount(shipment.amountCents, shipment.currency)}</span>

      <span className='shipment-dates'>
        <span className='shipment-date'>{t(state.label)} {formatDate(state.date)}</span>
        {delay !== null && (
          <span className={alert === null ? 'shipment-delay' : 'shipment-delay shipment-delay-alert'}>
            {alert !== null && (
              <svg
                className='delay-warning'
                viewBox='0 0 16 16'
                width='14'
                height='14'
                role='img'
                aria-label={t('Needs attention')}
              >
                <path
                  fill='currentColor'
                  fillRule='evenodd'
                  d='M8 1L15.5 14.5H0.5ZM6.9 5.4h2.2v4.4H6.9zM6.9 10.9h2.2v2H6.9z'
                />
              </svg>
            )}
            {delay}
          </span>
        )}
      </span>

      <div className='shipment-transitions'>
        {!archived && step !== null && (
          <button
            type='button'
            className={`btn status-btn ${stepClass(step)}`}
            onClick={() => { handlers.onTransition(shipment, step.actions) }}
          >
            {t(step.label)}
          </button>
        )}
      </div>

      <div className='shipment-mail'>
        {!archived && !needsMail(shipment) && shipment.lastChasedAt !== null && (
          <span
            className='chased-mark'
            role='img'
            aria-label={t('Chased on {date}', { date: formatDate(shipment.lastChasedAt) })}
          >
            ✓
          </span>
        )}

        {!archived && needsMail(shipment) && (
          <button
            type='button'
            className='icon-btn icon-btn-mail'
            aria-label={t('Chase {store} about {tracking}', {
              store: shipment.store,
              tracking: shipment.trackingNumber,
            })}
            onClick={() => { handlers.onWriteToStore(shipment) }}
          >
            <svg
              viewBox='0 0 16 16'
              width='13'
              height='13'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.4'
              aria-hidden='true'
            >
              <rect x='1.7' y='3.5' width='12.6' height='9' rx='1.2' />
              <path d='M2.4 4.6 8 8.9l5.6-4.3' />
            </svg>
          </button>
        )}
      </div>

      <button
        type='button'
        className='icon-btn icon-btn-info'
        aria-label={t('Details for {tracking}', { tracking: shipment.trackingNumber })}
        onClick={() => { handlers.onShowDetails(shipment) }}
      >
        i
      </button>

      <div className='row-menu'>
        <button
          type='button'
          className='icon-btn'
          aria-label={t('More actions for {tracking}', { tracking: shipment.trackingNumber })}
          aria-expanded={menuOpen}
          onClick={() => { handlers.onToggleMenu(shipment) }}
        >
          ⋯
        </button>

        {menuOpen && (
          <div className='row-menu-items' role='menu'>
            {!archived &&
              menuSteps(shipment.status).map((entry) => (
                <button
                  key={entry.label}
                  type='button'
                  role='menuitem'
                  className='row-menu-item'
                  onClick={() => { handlers.onTransition(shipment, entry.actions) }}
                >
                  {t(entry.label)}
                </button>
              ))}

            {!archived && undo !== null && (
              <button
                type='button'
                role='menuitem'
                className='row-menu-item'
                onClick={() => { handlers.onRevert(shipment) }}
              >
                {t(undo)}
              </button>
            )}

            {shipment.hasLabel && (
              <button
                type='button'
                role='menuitem'
                className='row-menu-item'
                onClick={() => { handlers.onDownloadLabel(shipment) }}
              >
                {t('Download the label again')}
              </button>
            )}

            <button
              type='button'
              role='menuitem'
              className='row-menu-item'
              onClick={() => {
                if (archived) handlers.onUnarchive(shipment)
                else handlers.onArchive(shipment)
              }}
            >
              {archived ? t('Put back in the list') : t('Archive')}
            </button>

            <button
              type='button'
              role='menuitem'
              className='row-menu-item row-menu-item-danger'
              onClick={() => { handlers.onDelete(shipment) }}
            >
              {t('Delete for good')}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
