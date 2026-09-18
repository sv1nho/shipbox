import { NavLink, Outlet, useNavigate } from 'react-router'
import { signOut, useSession } from '../auth/client.js'

const initialOf = (name: string, email: string): string => {
  const source = name.trim() || email.trim()
  return source ? source.charAt(0).toUpperCase() : '?'
}

export function Layout () {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()

  const handleSignOut = async () => {
    await signOut()
    await navigate('/')
  }

  return (
    <div className='page-wrapper'>
      <nav className='navbar'>
        <div className='navbar-inner'>
          <button
            type='button'
            className='navbar-brand'
            onClick={() => { void navigate('/') }}
          >
            <span className='navbar-brand-mark'>
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14' />
                <path d='M16.5 9.4 7.55 4.24' />
                <polyline points='3.29 7 12 12 20.71 7' />
                <line x1='12' y1='22' x2='12' y2='12' />
              </svg>
            </span>
            ShipBox
          </button>
          <div className='navbar-links'>
            <NavLink
              to='/form'
              className={({ isActive }) =>
                isActive ? 'navbar-link navbar-link-active' : 'navbar-link'}
            >
              Form
            </NavLink>
            {!isPending && (session
              ? (
                <>
                  <NavLink
                    to='/shipments'
                    className={({ isActive }) =>
                      isActive ? 'navbar-link navbar-link-active' : 'navbar-link'}
                  >
                    Shipments
                  </NavLink>
                  <NavLink
                    to='/dashboard'
                    className={({ isActive }) =>
                      isActive ? 'navbar-link navbar-link-active' : 'navbar-link'}
                  >
                    Dashboard
                  </NavLink>
                  <div className='navbar-user'>
                    <span className='navbar-avatar' aria-hidden='true'>
                      {initialOf(session.user.name, session.user.email)}
                    </span>
                    <span className='navbar-user-name' title={session.user.email}>
                      {session.user.name}
                    </span>
                    <button
                      type='button'
                      className='btn btn-ghost text-xs px-2.5 py-1'
                      onClick={() => { void handleSignOut() }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
                )
              : (
                <NavLink
                  to='/login'
                  className={({ isActive }) =>
                    isActive ? 'navbar-link navbar-link-active' : 'navbar-link'}
                >
                  Sign in
                </NavLink>
                ))}
          </div>
        </div>
      </nav>
      <main className='page-content'>
        <Outlet />
      </main>
      <div className='site-footer'>
        <strong>ShipBox</strong> — Bpost &amp; PostNL shipping labels, 100% free
        <br />
        © 2026 ShipBox — All rights reserved
      </div>

    </div>
  )
}
