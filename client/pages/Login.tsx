import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { signIn, useSession } from '../auth/client.js'
import { SOCIAL_PROVIDERS } from '../auth/providers.js'
import { isSocialProviderId } from '../../shared/auth-providers.js'
import type { SocialProviderId } from '../../shared/auth-providers.js'
import { PendingNote } from '../components/PendingNote.js'
import { Spinner } from '../components/Spinner.js'

const DEFAULT_REDIRECT = '/shipments'

export function Login () {
  const { data: session, isPending } = useSession()
  const [searchParams] = useSearchParams()
  const [providers, setProviders] = useState<SocialProviderId[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingProvider, setPendingProvider] = useState<SocialProviderId | null>(null)

  const redirectTo = searchParams.get('redirect') ?? DEFAULT_REDIRECT

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/config', { signal: controller.signal })
      .then((response) => response.json())
      .then((body: { providers?: unknown }) => {
        setProviders(Array.isArray(body.providers) ? body.providers.filter(isSocialProviderId) : [])
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setProviders([])
      })

    return () => { controller.abort() }
  }, [])

  if (isPending) {
    return <PendingNote label='Checking your session…' />
  }

  if (session) {
    return <Navigate to={redirectTo} replace />
  }

  const handleSignIn = async (provider: SocialProviderId) => {
    setError(null)
    setPendingProvider(provider)

    const result = await signIn.social({
      provider,
      callbackURL: redirectTo,
      errorCallbackURL: '/login?error=oauth',
    })

    if (result.error) {
      setPendingProvider(null)
      setError(result.error.message ?? 'Sign-in failed, please try again.')
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
            Sign-in was cancelled or refused. You can try again.
          </div>
        )}

        {error && <div className='alert-error'>{error}</div>}

        {providers === null && <PendingNote label='Loading sign-in options…' />}

        {providers !== null && providers.length === 0 && (
          <div className='alert-error'>
            No sign-in provider is configured on this server.
          </div>
        )}

        {providers?.map((provider) => (
          <button
            key={provider}
            type='button'
            className='btn btn-social'
            disabled={pendingProvider !== null}
            onClick={() => { void handleSignIn(provider) }}
          >
            {pendingProvider === provider
              ? (
                <>
                  <Spinner />
                  Redirecting…
                </>
                )
              : (
                <>
                  {SOCIAL_PROVIDERS[provider].icon}
                  {SOCIAL_PROVIDERS[provider].label}
                </>
                )}
          </button>
        ))}

        <p className='auth-note'>
          No password is ever stored. Signing in only shares your name, email
          address and profile picture with ShipBox.
        </p>
      </div>
    </div>
  )
}
