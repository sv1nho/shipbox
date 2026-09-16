import { useState } from 'react'
import type { ShipmentDto } from '../../shared/shipment.js'
import { TRANSITIONS, allowedActions, nextActions } from '../../shared/transitions.js'
import type { TransitionAction } from '../../shared/transitions.js'
import { CARRIERS } from '../../shared/carriers.js'
import { alertMessage, formatAmount, formatDate, statusLabel, workingDays } from './format.js'

export type RowHandlers = {
  onTransition: (shipment: ShipmentDto, action: TransitionAction) => void
  onRevert: (shipment: ShipmentDto) => void
  onArchive: (shipment: ShipmentDto) => void
  onUnarchive: (shipment: ShipmentDto) => void
  onDelete: (shipment: ShipmentDto) => void
  onDownloadLabel: (shipment: ShipmentDto) => void
}

const lastStep = (shipment: ShipmentDto): string | null =>
  shipment.decisionDate ?? shipment.receivedDate ?? shipment.dropoffDate

export function ShipmentRow ({ shipment, handlers }: { shipment: ShipmentDto; handlers: RowHandlers }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const alert = alertMessage(shipment)
  const chained = nextActions(shipment.status)
  const archived = shipment.archivedAt !== null

  const close = () => { setMenuOpen(false) }

  return (
    <article className={archived ? 'shipment-row shipment-row-archived' : 'shipment-row'}>
      <div className='shipment-main'>
        <span className={`status-pill status-${shipment.status}`}>{statusLabel(shipment.status)}</span>

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

        <span className='shipment-store'>{shipment.store}</span>
        <span className='shipment-amount'>{formatAmount(shipment.amountCents, shipment.currency)}</span>

        <span className='shipment-dates'>
          <span title='Last recorded step'>{formatDate(lastStep(shipment))}</span>
          <span className='shipment-delay'>{workingDays(shipment.decisionDelayDays)}</span>
        </span>

        {alert !== null && (
          <span className='shipment-alert' role='img' aria-label={alert} title={alert}>
            !
          </span>
        )}
      </div>

      <div className='shipment-actions'>
        {!archived &&
          chained.map((action) => (
            <button
              key={action}
              type='button'
              className='btn btn-primary text-xs px-2.5 py-1'
              onClick={() => { handlers.onTransition(shipment, action) }}
            >
              {TRANSITIONS[action].label}
            </button>
          ))}

        <div className='row-menu'>
          <button
            type='button'
            className='btn btn-ghost text-xs px-2.5 py-1'
            aria-label={`More actions for ${shipment.trackingNumber}`}
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen(!menuOpen) }}
          >
            ⋯
          </button>

          {menuOpen && (
            <div className='row-menu-items' role='menu'>
              {!archived &&
                allowedActions(shipment.status)
                  .filter((action) => !chained.includes(action))
                  .map((action) => (
                    <button
                      key={action}
                      type='button'
                      role='menuitem'
                      className='row-menu-item'
                      onClick={() => { close(); handlers.onTransition(shipment, action) }}
                    >
                      Record {TRANSITIONS[action].label.toLowerCase()} directly
                    </button>
                  ))}

              {shipment.status !== 'pending' && (
                <button
                  type='button'
                  role='menuitem'
                  className='row-menu-item'
                  onClick={() => { close(); handlers.onRevert(shipment) }}
                >
                  Undo the last step
                </button>
              )}

              {shipment.hasLabel && (
                <button
                  type='button'
                  role='menuitem'
                  className='row-menu-item'
                  onClick={() => { close(); handlers.onDownloadLabel(shipment) }}
                >
                  Download the label again
                </button>
              )}

              <button
                type='button'
                role='menuitem'
                className='row-menu-item'
                onClick={() => {
                  close()
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
                onClick={() => { close(); handlers.onDelete(shipment) }}
              >
                Delete for good
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
