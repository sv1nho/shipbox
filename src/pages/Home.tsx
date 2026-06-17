import { useNavigate } from 'react-router-dom'

export const Home = () => {
  const navigate = useNavigate()
  return (
    <div className='old-home'>

      <div className='old-announce'>
        <span className='blink-text'>★ NOUVEAU ★</span>
        &nbsp;Version 2.0 — Bpost &amp; PostNL désormais supportés !&nbsp;
        <span className='blink-text'>★ NOUVEAU ★</span>
      </div>

      <div className='old-table-outer'>

        <div className='old-table-header'>
          📦 BIENVENUE SUR LABEL GENERATOR PRO
        </div>

        <div style={{ background: '#ffffff', padding: '14px 16px', borderBottom: '2px solid #aaaaaa' }}>
          <p style={{ margin: '0 0 8px', fontFamily: 'Arial, Verdana, sans-serif', fontSize: 13, color: '#000000', lineHeight: 1.7 }}>
            <strong>Label Generator Pro</strong> vous permet de créer et télécharger des étiquettes
            de livraison PDF pour <strong>Bpost</strong> et <strong>PostNL</strong> en quelques secondes.
            Remplissez le formulaire, choisissez votre transporteur et votre langue, et votre label est prêt.
          </p>
          <p style={{ margin: 0, fontFamily: 'Arial, Verdana, sans-serif', fontSize: 12, color: '#444444' }}>
            Supports : Belgique · Pays-Bas · Allemagne &nbsp;|&nbsp; Langues : FR · NL · EN &nbsp;|&nbsp; 100% gratuit
          </p>
        </div>

        <div className='old-table-footer'>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => { void navigate('/form') }}
          >
            ▶&nbsp;ACCÉDER AU FORMULAIRE
          </button>
          &nbsp;&nbsp;
          <span style={{ fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#666666' }}>
            ← Cliquez ici pour commencer !
          </span>
        </div>

      </div>

    </div>
  )
}
