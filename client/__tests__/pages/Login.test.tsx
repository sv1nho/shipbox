import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

vi.mock('../../auth/client.js', () => ({
  useSession: vi.fn(),
  signIn: { social: vi.fn() },
}))

import { Login } from '../../pages/Login.js'
import { signIn, useSession } from '../../auth/client.js'

type SessionState = ReturnType<typeof useSession>

const session = (state: { signedIn?: boolean; pending?: boolean }) => {
  vi.mocked(useSession).mockReturnValue({
    data: state.signedIn === true ? { user: { id: 'u1', name: 'Alex' } } : null,
    isPending: state.pending === true,
  } as unknown as SessionState)
}

const answerConfig = (body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: () => Promise.resolve(body),
  } as unknown as Response)

function Where () {
  const location = useLocation()
  return <p>At {location.pathname}</p>
}

const renderLogin = (entry = '/login') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path='/login' element={<Login />} />
        <Route path='*' element={<Where />} />
      </Routes>
    </MemoryRouter>
  )

const googleButton = () => screen.findByRole('button', { name: /continue with google/i })

beforeEach(() => {
  vi.clearAllMocks()
  session({})
  answerConfig({ providers: ['google', 'github'] })
  vi.mocked(signIn.social).mockResolvedValue({ data: null, error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('before anything is known', () => {
  it('waits for the session rather than flashing the sign-in buttons', () => {
    session({ pending: true })

    renderLogin()

    expect(screen.getByText(/checking your session/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('says it is loading the options until the server answers', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))

    renderLogin()

    expect(screen.getByText(/loading sign-in options/i)).toBeInTheDocument()
  })
})

describe('someone already signed in', () => {
  it('goes to the shipments, the page most people came for', async () => {
    session({ signedIn: true })

    renderLogin()

    expect(await screen.findByText('At /shipments')).toBeInTheDocument()
  })

  it('goes back to the page that sent them here instead', async () => {
    session({ signedIn: true })

    renderLogin('/login?redirect=/dashboard')

    expect(await screen.findByText('At /dashboard')).toBeInTheDocument()
  })
})

describe('the providers on offer', () => {
  it('offers every provider the server has configured', async () => {
    renderLogin()

    expect(await googleButton()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument()
  })

  it('asks the server which providers exist, not a list baked into the page', async () => {
    const fetched = answerConfig({ providers: ['github'] })

    renderLogin()

    expect(await screen.findByRole('button', { name: /continue with github/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
    expect(fetched.mock.calls[0][0]).toBe('/api/config')
  })

  it('ignores a provider it has no button for', async () => {
    answerConfig({ providers: ['google', 'myspace'] })

    renderLogin()

    await googleButton()

    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it.each([
    ['nothing configured', { providers: [] }],
    ['a malformed answer', { providers: 'google' }],
  ])('says sign-in is unavailable on %s', async (_label, body) => {
    answerConfig(body)

    renderLogin()

    expect(await screen.findByText(/no sign-in provider is configured/i)).toBeInTheDocument()
  })

  it('says the same when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    renderLogin()

    expect(await screen.findByText(/no sign-in provider is configured/i)).toBeInTheDocument()
  })

  it('treats an aborted request as nothing, not as a server without providers', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    renderLogin()

    await waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled() })

    expect(screen.getByText(/loading sign-in options/i)).toBeInTheDocument()
    expect(screen.queryByText(/no sign-in provider is configured/i)).not.toBeInTheDocument()
  })
})

describe('signing in', () => {
  it('hands the provider the page to come back to, and where to land on failure', async () => {
    renderLogin('/login?redirect=/dashboard')

    await userEvent.click(await googleButton())

    expect(signIn.social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/dashboard',
      errorCallbackURL: '/login?error=oauth',
    })
  })

  it('says it is redirecting and blocks a second click on any provider', async () => {
    vi.mocked(signIn.social).mockReturnValue(new Promise(() => {}))

    renderLogin()
    await userEvent.click(await googleButton())

    expect(screen.getByRole('button', { name: /redirecting/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeDisabled()
  })

  it('shows why the provider refused, and lets the user try again', async () => {
    vi.mocked(signIn.social)
      .mockResolvedValue({ data: null, error: { message: 'Account suspended.' } })

    renderLogin()
    await userEvent.click(await googleButton())

    expect(await screen.findByText('Account suspended.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled()
  })

  it('still says something when the refusal comes without a reason', async () => {
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: {} })

    renderLogin()
    await userEvent.click(await googleButton())

    expect(await screen.findByText(/sign-in failed, please try again/i)).toBeInTheDocument()
  })

  it('explains a sign-in the provider sent back as cancelled', async () => {
    renderLogin('/login?error=oauth')

    expect(await screen.findByText(/cancelled or refused/i)).toBeInTheDocument()
  })

  it('reassures that no password is ever kept', async () => {
    renderLogin()

    expect(await screen.findByText(/no password is ever stored/i)).toBeInTheDocument()
  })
})
