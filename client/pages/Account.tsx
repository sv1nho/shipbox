import { useState } from 'react'
import { useSession, deleteUser } from '../auth/client.js'
import { DeleteAccountDialog } from '../account/DeleteAccountDialog.js'
import { useT } from '../i18n/context.js'

export function Account () {
  const t = useT()
  const { data: session } = useSession()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const email = session?.user.email ?? ''

  const remove = async () => {
    setBusy(true)
    setError(null)

    const { error: refused } = await deleteUser({})

    if (refused) {
      setError(
        refused.status === 400
          ? t('Sign in again, then delete the account. This is only allowed from a fresh sign-in.')
          : t('The account was not deleted. Try again in a moment.')
      )
      setBusy(false)
      return
    }

    window.location.assign('/')
  }

  return (
    <section className='card space-y-4'>
      <h3 className='card-title'>{t('Your account')}</h3>

      <dl className='account-identity'>
        <dt>{t('Name')}</dt>
        <dd>{session?.user.name}</dd>
        <dt>{t('Email address')}</dt>
        <dd>{email}</dd>
      </dl>

      <h4 className='card-title'>{t('Leaving ShipBox')}</h4>

      <p className='card-text'>
        {t('Deleting the account removes everything it holds, on the spot and for good.')}
      </p>

      <button
        type='button'
        className='btn btn-danger'
        onClick={() => { setError(null); setAsking(true) }}
      >
        {t('Delete my account')}
      </button>

      {asking && (
        <DeleteAccountDialog
          email={email}
          busy={busy}
          error={error}
          onCancel={() => { setAsking(false) }}
          onConfirm={() => { void remove() }}
        />
      )}
    </section>
  )
}
