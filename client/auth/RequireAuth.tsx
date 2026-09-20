import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './client.js'
import { PendingNote } from '../components/PendingNote.js'

export function RequireAuth () {
  const { data: session, isPending } = useSession()
  const location = useLocation()

  if (isPending) {
    return <PendingNote label='Checking your session…' />
  }

  if (!session) {
    const target = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} replace />
  }

  return <Outlet />
}
