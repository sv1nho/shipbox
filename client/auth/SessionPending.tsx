import { Spinner } from '../components/Spinner.js'

export function SessionPending ({ label }: { label: string }) {
  return (
    <div className='auth-pending'>
      <Spinner />
      <span>{label}</span>
    </div>
  )
}
