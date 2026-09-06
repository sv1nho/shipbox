import { useSession } from '../auth/client.js'

export function Shipments () {
  const { data: session } = useSession()

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>Shipments</h3>
      </div>
      <p className='hero-text'>
        Signed in as <strong>{session?.user.name}</strong> ({session?.user.email}).
      </p>
      <p className='hero-text'>
        The shipment list, filters and the add form land in a later step.
      </p>
    </div>
  )
}
