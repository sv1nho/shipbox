import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

const navigate = vi.fn()

vi.mock('react-router', async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  useNavigate: () => navigate,
}))

vi.mock('../../auth/client.js', () => ({
  emailOtp: { sendVerificationOtp: vi.fn() },
  signIn: { emailOtp: vi.fn() },
}))

import { CodeSignIn } from '../../auth/CodeSignIn.js'
import { emailOtp, signIn } from '../../auth/client.js'

const renderIt = (disabled = false) =>
  render(
    <MemoryRouter>
      <CodeSignIn redirectTo='/shipments' disabled={disabled} />
    </MemoryRouter>
  )

const askFor = async (address: string) => {
  await userEvent.type(screen.getByLabelText('Email address'), address)
  await userEvent.click(screen.getByRole('button', { name: 'Send me a code' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(emailOtp.sendVerificationOtp).mockResolvedValue({ error: null })
  vi.mocked(signIn.emailOtp).mockResolvedValue({ error: null })
})

describe('asking for a code', () => {
  it('asks the server for one meant to sign in', async () => {
    renderIt()
    await askFor('someone@example.test')

    expect(emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: 'someone@example.test',
      type: 'sign-in',
    })
  })

  it('then says where it went, so a typo is visible before waiting', async () => {
    renderIt()
    await askFor('someone@example.test')

    expect(await screen.findByText(/We sent a code to someone@example.test/)).toBeInTheDocument()
  })

  it('says so when it could not be sent, and stays on the address', async () => {
    vi.mocked(emailOtp.sendVerificationOtp).mockResolvedValue({ error: { status: 500 } })

    renderIt()
    await askFor('someone@example.test')

    expect(await screen.findByText(/could not send the code/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  it('stays quiet while an OAuth redirect is already under way', () => {
    renderIt(true)

    expect(screen.getByRole('button', { name: 'Send me a code' })).toBeDisabled()
  })
})

describe('entering the code', () => {
  const reachTheCode = async () => {
    renderIt()
    await askFor('someone@example.test')
  }

  it('signs in and lands on the page that was asked for', async () => {
    await reachTheCode()

    await userEvent.type(screen.getByLabelText('Sign-in code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signIn.emailOtp).toHaveBeenCalledWith({
      email: 'someone@example.test',
      otp: '123456',
    })
    expect(navigate).toHaveBeenCalledWith('/shipments', { replace: true })
  })

  it('says a wrong code is wrong without sending the visitor away', async () => {
    vi.mocked(signIn.emailOtp).mockResolvedValue({ error: { status: 400 } })

    await reachTheCode()

    await userEvent.type(screen.getByLabelText('Sign-in code'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/wrong or expired/i)).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('lets the visitor go back and use another address', async () => {
    await reachTheCode()

    await userEvent.click(screen.getByRole('button', { name: 'Use another address' }))

    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sign-in code')).not.toBeInTheDocument()
  })
})
