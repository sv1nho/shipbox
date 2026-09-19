import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

vi.mock('../../auth/client.js', () => ({ useSession: vi.fn() }))

import { RequireAuth } from '../../auth/RequireAuth.js'
import { useSession } from '../../auth/client.js'

const session = (state: { signedIn?: boolean; pending?: boolean }) => {
  vi.mocked(useSession).mockReturnValue({
    data: state.signedIn === true ? { user: { id: 'u1' } } : null,
    isPending: state.pending === true,
  } as unknown as ReturnType<typeof useSession>)
}

function Where () {
  const location = useLocation()
  return <p>At {location.pathname}{location.search}</p>
}

const visit = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path='/shipments' element={<p>The shipments</p>} />
        </Route>
        <Route path='/login' element={<Where />} />
      </Routes>
    </MemoryRouter>
  )

describe('the session guard', () => {
  it('shows the page to someone signed in', () => {
    session({ signedIn: true })

    visit('/shipments')

    expect(screen.getByText('The shipments')).toBeInTheDocument()
  })

  it('holds the page back while the session is still being checked', () => {
    session({ pending: true })

    visit('/shipments')

    expect(screen.getByText(/checking your session/i)).toBeInTheDocument()
    expect(screen.queryByText('The shipments')).not.toBeInTheDocument()
  })

  it('sends a stranger to sign in, remembering the page and its filters', () => {
    session({})

    visit('/shipments?status=refunded')

    expect(screen.getByText('At /login?redirect=%2Fshipments%3Fstatus%3Drefunded'))
      .toBeInTheDocument()
    expect(screen.queryByText('The shipments')).not.toBeInTheDocument()
  })
})
