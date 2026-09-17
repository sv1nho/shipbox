import type { ShipmentDto } from '../../shared/shipment.js'
import { TRANSITIONS, menuSteps, nextStep } from '../../shared/transitions.js'
import type { NextStep } from '../../shared/transitions.js'
import { CARRIERS } from '../../shared/carriers.js'
import { alertMessage, days, delayInfo, formatAmount, formatDate, statusDate } from './format.js'
import { StatusPill } from './StatusPill.js'

export type RowHandlers = {
  onTransition: (shipment: ShipmentDto, actions: NextStep['actions']) => void
  onRevert: (shipment: ShipmentDto) => void
  onArchive: (shipment: ShipmentDto) => void
  onUnarchive: (shipment: ShipmentDto) => void
  onDelete: (shipment: ShipmentDto) => void
  onDownloadLabel: (shipment: ShipmentDto) => void
  onShowDetails: (shipment: ShipmentDto) => void
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
  const alert = alertMessage(shipment)
  const step = nextStep(shipment.status)
  const archived = shipment.archivedAt !== null
  const state = statusDate(shipment)
  const delay = delayInfo(shipment)

  return (
    <article className={archived ? 'shipment-row shipment-row-archived' : 'shipment-row'}>
      <StatusPill status={shipment.status} />

      <div className='shipment-identity'>
        <a
          className='shipment-tracking'
          href={shipment.trackingUrl}
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
        <span className='shipment-date'>{state.label} {formatDate(state.date)}</span>
        {delay !== null && (
          <span className={alert === null ? 'shipment-delay' : 'shipment-delay shipment-delay-alert'}>
            {alert !== null && (
              <svg
                className='delay-warning'
                viewBox='0 0 16 16'
                width='14'
                height='14'
                role='img'
                aria-label='Needs attention'
              >
                <path
                  fill='currentColor'
                  fillRule='evenodd'
                  d='M8 1L15.5 14.5H0.5ZM6.9 5.4h2.2v4.4H6.9zM6.9 10.9h2.2v2H6.9z'
                />
              </svg>
            )}
            {delay.label} {days(delay.days)}
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
            {step.label}
          </button>
        )}
      </div>

      <button
        type='button'
        className='icon-btn icon-btn-info'
        aria-label={`Details for ${shipment.trackingNumber}`}
        onClick={() => { handlers.onShowDetails(shipment) }}
      >
        i
      </button>

      <div className='row-menu'>
        <button
          type='button'
          className='icon-btn'
          aria-label={`More actions for ${shipment.trackingNumber}`}
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
                  Record {entry.label.toLowerCase()} directly
                </button>
              ))}

            {!archived && shipment.status !== 'pending' && (
              <button
                type='button'
                role='menuitem'
                className='row-menu-item'
                onClick={() => { handlers.onRevert(shipment) }}
              >
                Undo the last step
              </button>
            )}

            {shipment.hasLabel && (
              <button
                type='button'
                role='menuitem'
                className='row-menu-item'
                onClick={() => { handlers.onDownloadLabel(shipment) }}
              >
                Download the label again
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
              {archived ? 'Put back in the list' : 'Archive'}
            </button>

            <button
              type='button'
              role='menuitem'
              className='row-menu-item row-menu-item-danger'
              onClick={() => { handlers.onDelete(shipment) }}
            >
              Delete for good
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
