import { useNavigate } from 'react-router'

export const Success = () => {
  const navigate = useNavigate()
  return (
    <div className='hero'>
      <h1 className='hero-title'>Thank you for your purchase!</h1>

      <p className='hero-text'>
        Your license key is on its way — check your inbox in the next few minutes.
        Once you have it, come back and redeem it to start generating labels.
      </p>

      <button
        type='button'
        className='btn btn-primary btn-on-hero'
        onClick={() => { void navigate('/') }}
      >
        Back to home
      </button>
    </div>
  )
}
