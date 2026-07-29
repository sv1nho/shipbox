import { NavLink, Outlet, useNavigate } from 'react-router'

export function Layout () {
  const navigate = useNavigate()
  return (
    <div className='page-wrapper'>

      {/* ── Navigation bar ── */}
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
            Label Generator
          </button>
          <div className='navbar-links'>
            <NavLink
              to='/form'
              className={({ isActive }) =>
                isActive ? 'navbar-link navbar-link-active' : 'navbar-link'}
            >
              Form
            </NavLink>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className='page-content'>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <div className='site-footer'>
        <strong>Label Generator</strong> — Bpost &amp; PostNL shipping labels, 100% free
        <br />
        © 2026 Label Generator — All rights reserved
      </div>

    </div>
  )
}
