import { useState } from 'react'
import { useNavigate } from 'react-router'
import { emailOtp, signIn } from './client.js'
import { Field, fieldMarks } from '../components/Field.js'
import { Spinner } from '../components/Spinner.js'
import { useT } from '../i18n/context.js'

type CodeSignInProps = {
  redirectTo: string
  disabled: boolean
}

export function CodeSignIn ({ redirectTo, disabled }: CodeSignInProps) {
  const t = useT()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | undefined>(undefined)

  const ask = async () => {
    setBusy(true)
    setProblem(undefined)

    const { error } = await emailOtp.sendVerificationOtp({ email, type: 'sign-in' })

    setBusy(false)

    if (error) {
      setProblem(t('We could not send the code. Try again in a moment.'))
      return
    }

    setSentTo(email)
  }

  const enter = async () => {
    setBusy(true)
    setProblem(undefined)

    const { error } = await signIn.emailOtp({ email, otp: code })

    setBusy(false)

    if (error) {
      setProblem(t('That code is wrong or expired. Ask for a new one.'))
      return
    }

    void navigate(redirectTo, { replace: true })
  }

  if (sentTo === null) {
    return (
      <form
        className='auth-code'
        onSubmit={(event) => { event.preventDefault(); void ask() }}
      >
        <Field label={t('Email address')} htmlFor='otp-email' problem={problem}>
          <input
            id='otp-email'
            type='email'
            required
            autoComplete='email'
            value={email}
            onChange={(event) => { setEmail(event.target.value) }}
            {...fieldMarks('otp-email', problem)}
          />
        </Field>

        <button type='submit' className='btn btn-social' disabled={disabled || busy}>
          {busy ? <><Spinner />{t('Sending…')}</> : t('Send me a code')}
        </button>
      </form>
    )
  }

  return (
    <form
      className='auth-code'
      onSubmit={(event) => { event.preventDefault(); void enter() }}
    >
      <p className='auth-note'>
        {t('We sent a code to {email}. It is valid for ten minutes.', { email: sentTo })}
      </p>

      <Field label={t('Sign-in code')} htmlFor='otp-code' problem={problem}>
        <input
          id='otp-code'
          type='text'
          required
          inputMode='numeric'
          autoComplete='one-time-code'
          maxLength={6}
          value={code}
          onChange={(event) => { setCode(event.target.value) }}
          {...fieldMarks('otp-code', problem)}
        />
      </Field>

      <button type='submit' className='btn btn-social' disabled={disabled || busy}>
        {busy ? <><Spinner />{t('Signing in…')}</> : t('Sign in')}
      </button>

      <button
        type='button'
        className='link-button'
        disabled={busy}
        onClick={() => { setSentTo(null); setCode(''); setProblem(undefined) }}
      >
        {t('Use another address')}
      </button>
    </form>
  )
}
