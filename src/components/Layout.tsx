import { NavLink, Outlet, useNavigate } from 'react-router-dom'

export function Layout () {
  const navigate = useNavigate()
  return (
    <div className='page-wrapper'>

      {/* ── Site header banner ── */}
      <div className='site-header'>
        <div className='site-header-inner'>
          <div className='site-header-logo'>
            📦&nbsp;<em>Label</em>&nbsp;Generator&nbsp;<em>Pro</em>
          </div>
          <div className='site-header-right'>
            <strong>★ 100% GRATUIT ★</strong><br />
            Bpost &amp; PostNL<br />
            Belgique · Pays-Bas · Allemagne
          </div>
        </div>
      </div>

      {/* ── Navigation bar ── */}
      <nav className='navbar'>
        <div className='navbar-inner'>
          <div className='navbar-links'>
            <button
              type='button'
              className='navbar-brand'
              onClick={() => { void navigate('/') }}
            >
              🏠 Accueil
            </button>
            <span className='nav-sep'>|</span>
            <NavLink
              to='/form'
              className={({ isActive }) =>
                isActive ? 'navbar-link navbar-link-active' : 'navbar-link'}
            >
              📋 Formulaire
            </NavLink>
          </div>
          <div className='nav-badge'>
            <span className='new-badge'>NEW!</span>
            Version 2.0 disponible
          </div>
        </div>
      </nav>

      {/* ── Marquee ticker ── */}
      <div className='marquee-bar' aria-hidden='true'>
        <div className='marquee-inner'>
          ★ NOUVEAU — Génération de labels PDF instantanée ★&nbsp;&nbsp;
          Bpost &amp; PostNL supportés ★&nbsp;&nbsp;
          3 langues disponibles : FR · NL · EN ★&nbsp;&nbsp;
          Belgique, Pays-Bas, Allemagne ★&nbsp;&nbsp;
          100% gratuit — aucune inscription requise ★&nbsp;&nbsp;
          Téléchargez vos labels en quelques secondes ★
        </div>
      </div>

      {/* ── Main content ── */}
      <main className='page-content'>
        <Outlet />
      </main>

      {/* ── Old-web footer ── */}
      <div className='site-footer'>
        <div>© 2004 Label Generator Pro — Tous droits réservés</div>
        <div style={{ fontStyle: 'italic', color: '#888888', marginTop: 2 }}>
          Best viewed in Internet Explorer 6.0 at 800×600 resolution
        </div>
        <div style={{ marginTop: 4 }}>
          Nombre de visites :&nbsp;
          <span className='hit-counter'>004219</span>
        </div>
      </div>

    </div>
  )
}
