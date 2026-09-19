import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

vi.mock('../../auth/client.js', () => ({ useSession: vi.fn(), signOut: vi.fn() }))

import { Layout } from '../../components/Layout.js'
import { signOut, useSession } from '../../auth/client.js'

const session = (state: { user?: { name: string; email: string }; pending?: boolean }) => {
  vi.mocked(useSession).mockReturnValue({
    data: state.user === undefined ? null : { user: { id: 'u1', ...state.user } },
    isPending: state.pending === true,
  } as unknown as ReturnType<typeof useSession>)
}

const renderLayout = (entry = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path='/' element={<p>The home page</p>} />
          <Route path='/dashboard' element={<p>The dashboard</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )

const link = (name: string) => screen.queryByRole('link', { name })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(signOut).mockResolvedValue({ data: null, error: null })
})

describe('what every page gets', () => {
  it('draws the page inside the frame', () => {
    session({})

    renderLayout()

    expect(screen.getByText('The dashboard')).toBeInTheDocument()
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument()
  })

  it('always offers the label form, which needs no account', () => {
    session({})

    renderLayout()

    expect(link('Form')).toBeInTheDocument()
  })

  it('goes home from the brand', async () => {
    session({})

    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: /shipbox/i }))

    expect(screen.getByText('The home page')).toBeInTheDocument()
  })
})

describe('a visitor', () => {
  it('is offered to sign in, and never shown the pages that need it', () => {
    session({})

    renderLayout()

    expect(link('Sign in')).toBeInTheDocument()
    expect(link('Shipments')).not.toBeInTheDocument()
    expect(link('Dashboard')).not.toBeInTheDocument()
  })
})

describe('while the session is checked', () => {
  it('shows neither the sign-in link nor the private pages, so nothing flickers', () => {
    session({ pending: true })

    renderLayout()

    expect(link('Sign in')).not.toBeInTheDocument()
    expect(link('Shipments')).not.toBeInTheDocument()
  })
})

describe('someone signed in', () => {
  const yann = { name: 'Alex Dupont', email: 'alex@example.test' }

  it('reaches the shipments and the dashboard', () => {
    session({ user: yann })

    renderLayout()

    expect(link('Shipments')).toBeInTheDocument()
    expect(link('Dashboard')).toBeInTheDocument()
    expect(link('Sign in')).not.toBeInTheDocument()
  })

  it('marks the page being looked at', () => {
    session({ user: yann })

    renderLayout('/dashboard')

    expect(link('Dashboard')).toHaveClass('navbar-link-active')
    expect(link('Shipments')).not.toHaveClass('navbar-link-active')
  })

  it('shows who is signed in, the address a hover away', () => {
    session({ user: yann })

    renderLayout()

    expect(screen.getByText('Alex Dupont')).toHaveAttribute('title', 'alex@example.test')
  })

  it.each([
    ['the first letter of the name', { name: 'yann', email: 'z@example.test' }, 'Y'],
    ['the email when there is no name', { name: '  ', email: 'zoe@example.test' }, 'Z'],
    ['a question mark when there is neither', { name: '', email: '' }, '?'],
  ])('draws the avatar from %s', (_label, user, initial) => {
    session({ user })

    const { container } = renderLayout()

    expect(container.querySelector('.navbar-avatar')).toHaveTextContent(initial)
  })

  it('signs out and goes back home', async () => {
    session({ user: yann })

    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(signOut).toHaveBeenCalledOnce()
    expect(await screen.findByText('The home page')).toBeInTheDocument()
  })
})
