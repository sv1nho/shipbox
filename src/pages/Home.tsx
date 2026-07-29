import { useNavigate } from 'react-router'

export const Home = () => {
  const navigate = useNavigate()
  return (
    <div className='hero'>
      <h1 className='hero-title'>Label Generator</h1>

      <p className='hero-text'>
        Create and download PDF shipping labels for <strong>Bpost</strong> and{' '}
        <strong>PostNL</strong> in seconds. Fill in the form, choose your carrier and language,
        and your label is ready.
      </p>

      <div className='hero-badges'>
        <span className='badge-pill'>Belgium · Netherlands · Germany</span>
        <span className='badge-pill'>FR · NL · EN</span>
        <span className='badge-pill'>100% free</span>
      </div>

      <button
        type='button'
        className='btn btn-primary btn-on-hero'
        onClick={() => { void navigate('/form') }}
      >
        Go to the form
      </button>
    </div>
  )
}
