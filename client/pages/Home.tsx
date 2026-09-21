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
        className='btn btn-primary btn-hero'
        onClick={() => { void navigate('/form') }}
      >
        {t('Go to the form')}
        <svg
          viewBox='0 0 16 16'
          width='16'
          height='16'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden='true'
        >
          <line x1='3' y1='8' x2='13' y2='8' />
          <polyline points='9,4 13,8 9,12' />
        </svg>
      </button>
    </div>
  )
}
