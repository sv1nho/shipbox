import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { signIn, useSession } from '../auth/client.js'
import { Spinner } from '../components/Spinner.js'

const DEFAULT_REDIRECT = '/shipments'

export function Login () {
  const { data: session, isPending } = useSession()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const redirectTo = searchParams.get('redirect') ?? DEFAULT_REDIRECT

  if (isPending) {
    return (
      <div className='auth-pending'>
        <Spinner />
        <span>Checking your session…</span>
      </div>
    )
  }

  if (session) {
    return <Navigate to={redirectTo} replace />
  }

  const handleGoogle = async () => {
    setError(null)
    setIsSigningIn(true)

    const result = await signIn.social({
      provider: 'google',
      callbackURL: redirectTo,
      errorCallbackURL: '/login?error=oauth',
    })

    if (result.error) {
      setIsSigningIn(false)
      setError(
        result.error.code === 'PROVIDER_NOT_FOUND'
          ? 'Google sign-in is not configured on this server.'
          : (result.error.message ?? 'Sign-in failed, please try again.')
      )
    }
  }

  return (
    <div className='auth-page'>
      <div className='auth-card'>
        <h1 className='auth-title'>Sign in</h1>
        <p className='auth-text'>
          Sign in to track your returns from drop-off to refund. Generating
          labels stays free and needs no account.
        </p>

        {searchParams.get('error') === 'oauth' && (
          <div className='alert-error'>
            Google sign-in was cancelled or refused. You can try again.
          </div>
        )}

        {error && <div className='alert-error'>{error}</div>}

        <button
          type='button'
          className='btn btn-google'
          disabled={isSigningIn}
          onClick={() => { void handleGoogle() }}
        >
          {isSigningIn
            ? (
              <>
                <Spinner />
                Redirecting to Google…
              </>
              )
            : (
              <>
                <svg width='18' height='18' viewBox='0 0 24 24' aria-hidden='true'>
                  <path fill='#4285F4' d='M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z' />
                  <path fill='#34A853' d='M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z' />
                  <path fill='#FBBC05' d='M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z' />
                  <path fill='#EA4335' d='M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z' />
                </svg>
                Continue with Google
              </>
              )}
        </button>

        <p className='auth-note'>
          No password is ever stored. Signing in only shares your name, email
          address and profile picture with ShipBox.
        </p>
      </div>
    </div>
  )
}
