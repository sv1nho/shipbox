import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'

vi.mock('../auth/client.js', () => ({
  useSession: vi.fn(),
  signIn: { social: vi.fn() },
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('../api/shipments.js', () => ({
  listShipments: vi.fn(() => new Promise(() => {})),
  searchStores: vi.fn(() => new Promise(() => {})),
  exportUrl: vi.fn(() => '#'),
}))

vi.mock('../api/dashboard.js', () => ({
  getDashboard: vi.fn(() => new Promise(() => {})),
}))

import { App, routes } from '../App.js'
import { useSession } from '../auth/client.js'

const session = (signedIn: boolean) => {
  vi.mocked(useSession).mockReturnValue({
    data: signedIn ? { user: { id: 'u1', name: 'Alex', email: 'y@example.test' } } : null,
    isPending: false,
  } as unknown as ReturnType<typeof useSession>)
}

const visit = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })

  render(<RouterProvider router={router} />)

  return router
}

const PAGES = [
  ['/', 'ShipBox'],
  ['/form', 'Sender'],
  ['/login', 'Sign in'],
  ['/shipments', 'Shipments'],
  ['/dashboard', 'Dashboard'],
  ['/account', 'Your account'],
] as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the pages anyone can open', () => {
  it.each(PAGES.slice(0, 3))('shows %s to a visitor', async (path, heading) => {
    session(false)

    const router = visit(path)

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })
})

describe('the pages that need a session', () => {
  it.each(PAGES.slice(3))('sends a visitor from %s to sign in, and back afterwards', async (path) => {
    session(false)

    const router = visit(path)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe(`?redirect=${encodeURIComponent(path)}`)
  })

  it.each(PAGES.slice(3))('opens %s to someone signed in', async (path, heading) => {
    session(true)

    visit(path)

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })
})

describe('the frame around them', () => {
  it.each(PAGES.map(([path]) => path))('draws the navigation around %s', async (path) => {
    session(true)

    visit(path)

    expect(await screen.findByRole('link', { name: 'Form' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shipbox/i })).toBeInTheDocument()
  })
})

describe('the app itself', () => {
  it('opens on the page the browser is at', async () => {
    session(false)
    window.history.pushState({}, '', '/')

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'ShipBox' })).toBeInTheDocument()
  })
})
