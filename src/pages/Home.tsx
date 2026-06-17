import { useNavigate } from 'react-router-dom'

export const Home = () => {
  const navigate = useNavigate()
  return (
    <div className='home-wrap'>
      <div className='home-card'>
        <div className='home-badge'>⚡ Version 2.0 ⚡</div>

        <h1 className='home-title'>
          Label
          <span className='home-title-accent'>Generator Pro</span>
        </h1>

        <p className='home-desc'>
          Génère tes étiquettes Bpost &amp; PostNL en quelques secondes !<br />
          Rapide • Gratuit • Magnifique 🌟
        </p>

        <div className='home-features'>
          <div className='home-feature'>
            <div className='home-feature-icon'>📦</div>
            <div className='home-feature-label'>Multi-Carrier</div>
          </div>
          <div className='home-feature'>
            <div className='home-feature-icon'>🌍</div>
            <div className='home-feature-label'>3 Langues</div>
          </div>
          <div className='home-feature'>
            <div className='home-feature-icon'>📄</div>
            <div className='home-feature-label'>Export PDF</div>
          </div>
          <div className='home-feature'>
            <div className='home-feature-icon'>⚡</div>
            <div className='home-feature-label'>Ultra Rapide</div>
          </div>
        </div>

        <button
          type='button'
          className='btn btn-primary'
          onClick={() => { void navigate('/form') }}
        >
          🚀 Créer une étiquette !
        </button>

        <div className='home-stars' style={{ marginTop: '1.5rem' }}>
          ★★★★★<span>5 / 5 étoiles</span>
        </div>
      </div>
    </div>
  )
}
