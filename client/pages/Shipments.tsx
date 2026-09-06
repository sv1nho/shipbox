import { useSession } from '../auth/client.js'

export function Shipments () {
  const { data: session } = useSession()

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>Shipments</h3>
      </div>
      <div className='space-y-3'>
        <p className='card-text'>
          Signed in as <strong>{session?.user.name}</strong> ({session?.user.email}).
        </p>
        <p className='card-text'>
          The shipment list, filters and the add form land in a later step.
        </p>
      </div>
    </div>
  )
}
