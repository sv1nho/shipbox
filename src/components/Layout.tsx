import { NavLink, Outlet, useNavigate } from 'react-router-dom'

export function Layout () {
  const navigate = useNavigate()
  return (
    <div className='page-wrapper'>
      <div className='deco-layer' aria-hidden='true'>
        <span className='deco-star deco-star-1'>★</span>
        <span className='deco-star deco-star-2'>✦</span>
        <span className='deco-star deco-star-3'>◆</span>
        <span className='deco-star deco-star-4'>★</span>
        <span className='deco-star deco-star-5'>✦</span>
        <span className='deco-star deco-star-6'>◆</span>
        <div className='deco-bubble deco-bubble-1' />
        <div className='deco-bubble deco-bubble-2' />
        <div className='deco-bubble deco-bubble-3' />
      </div>

      <nav className='navbar'>
        <div className='navbar-inner relative'>
          <button
            type='button'
            className='navbar-brand'
            onClick={() => { void navigate('/') }}
          >
            <svg
              width='20'
              height='20'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14' />
              <path d='M16.5 9.4 7.55 4.24' />
              <polyline points='3.29 7 12 12 20.71 7' />
              <line x1='12' y1='22' x2='12' y2='12' />
              <circle cx='18.5' cy='15.5' r='2.5' />
              <path d='M20.27 17.27 22 19' />
            </svg>
            Label Generator
          </button>

          <div className='absolute left-1/2 -translate-x-1/2 flex navbar-links'>
            <NavLink
              to='/form'
              className={({ isActive }) =>
                isActive ? 'navbar-link navbar-link-active' : 'navbar-link'}
            >
              Formulaire
            </NavLink>
          </div>
        </div>
      </nav>

      <main className='page-content'>
        <Outlet />
      </main>
    </div>
  )
}
