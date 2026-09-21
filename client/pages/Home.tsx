import { useNavigate } from 'react-router'
import { useT } from '../i18n/context.js'

export const Home = () => {
  const navigate = useNavigate()
  const t = useT()
  return (
    <div className='hero'>
      <h1 className='hero-title'>ShipBox</h1>

      <p className='hero-text'>
        {t('Create and download PDF shipping labels for Bpost and PostNL in seconds. ' +
          'Fill in the form, choose your carrier and language, and your label is ready.')}
      </p>

      <div className='hero-badges'>
        <span className='badge-pill'>{t('Belgium · Netherlands · Germany')}</span>
        <span className='badge-pill'>FR · NL · EN</span>
        <span className='badge-pill'>{t('100% free')}</span>
      </div>

      <button
        type='button'
        className='btn btn-primary btn-on-hero'
        onClick={() => { void navigate('/form') }}
      >
        {t('Go to the form')}
      </button>
    </div>
  )
}
