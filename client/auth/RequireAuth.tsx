import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './client.js'
import { Spinner } from '../components/Spinner.js'

export function RequireAuth () {
  const { data: session, isPending } = useSession()
  const location = useLocation()

  if (isPending) {
    return (
      <div className='auth-pending'>
        <Spinner />
        <span>Checking your session…</span>
      </div>
    )
  }

  if (!session) {
    const target = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} replace />
  }

  return <Outlet />
}
