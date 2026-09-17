import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../auth/client.js'
import { ApiError, errorMessage } from '../api/client.js'
import { createShipment, shipmentExists } from '../api/shipments.js'
import { CURRENT_PAYLOAD_VERSION } from '../../shared/label-payload.js'
import type { LabelPayload } from '../../shared/label-payload.js'
import type { CreateShipmentInput } from '../../shared/shipment.js'
import { AddShipmentDialog } from './AddShipmentDialog.js'
import type { Prefill } from './AddShipmentDialog.js'
import { Modal } from './Modal.js'

type TrackOfferProps = {
  payload: LabelPayload
  onClose: () => void
}

type Known = { tracked: boolean } | 'unknown'

const prefillFrom = (payload: LabelPayload): Prefill => ({
  trackingNumber: payload.tracking_number,
  carrier: payload.carrier,
  recipientPostalCode: payload.recipient_postal,
  recipientCountry: payload.recipient_country,
  label: { payload, payloadVersion: CURRENT_PAYLOAD_VERSION },
})

export function TrackOffer ({ payload, onClose }: TrackOfferProps) {
  const { data: session, isPending } = useSession()
  const signedIn = !isPending && session !== null

  const [known, setKnown] = useState<Known | null>(null)
  const [filling, setFilling] = useState(false)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refused, setRefused] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!signedIn) return

    const controller = new AbortController()

    shipmentExists(payload.carrier, payload.tracking_number, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setKnown({ tracked: result.exists })
      })
      .catch(() => {
        if (!controller.signal.aborted) setKnown('unknown')
      })

    return () => { controller.abort() }
  }, [signedIn, payload.carrier, payload.tracking_number])

  const add = async (input: CreateShipmentInput) => {
    setBusy(true)
    setError(null)
    setRefused(null)

    try {
      await createShipment(input)
      setAdded(true)
      setFilling(false)
    } catch (cause) {
      setError(errorMessage(cause))
      setRefused(cause instanceof ApiError ? cause : null)
    } finally {
      setBusy(false)
    }
  }

  if (filling) {
    return (
      <AddShipmentDialog
        busy={busy}
        error={error}
        fieldError={(path) => refused?.messageFor(path)}
        prefill={prefillFrom(payload)}
        onCancel={() => { setFilling(false); setError(null) }}
        onSubmit={(input) => { void add(input) }}
      />
    )
  }

  return (
    <Modal titleId='track-offer-title' onClose={onClose}>
      <div className='modal-header'>
        <h2 className='modal-title' id='track-offer-title'>Keep an eye on this return</h2>
      </div>

      <div className='modal-body space-y-3'>
        {!signedIn && (
          <p className='card-text'>
            <Link to='/login'>Sign in</Link> to follow this parcel from the drop-off to the refund.
          </p>
        )}

        {signedIn && added && (
          <p className='card-text'>
            It is on your list. <Link to='/shipments'>Open the list</Link> to record the drop-off
            once the parcel is gone.
          </p>
        )}

        {signedIn && !added && known === null && (
          <p className='card-text'>Looking for this parcel in your list…</p>
        )}

        {signedIn && !added && known !== null && known !== 'unknown' && known.tracked && (
          <p className='card-text'>
            You already track this parcel.{' '}
            <Link to={`/shipments?search=${payload.tracking_number}`}>Open it</Link>.
          </p>
        )}

        {signedIn && !added && known !== null && (known === 'unknown' || !known.tracked) && (
          <p className='card-text'>
            Add it to your list and ShipBox will keep the label, count the days and warn you when
            the store sits on it.
          </p>
        )}
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-ghost' onClick={onClose}>
          {added ? 'Close' : 'Not now'}
        </button>

        {signedIn && !added && (known === null || known === 'unknown' || !known.tracked) && (
          <button
            type='button'
            className='btn btn-primary'
            disabled={known === null}
            onClick={() => { setFilling(true) }}
          >
            Add to tracking
          </button>
        )}
      </div>
    </Modal>
  )
}
