import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../auth/client.js', () => ({
  useSession: vi.fn(),
  deleteUser: vi.fn(),
}))

import { Account } from '../../pages/Account.js'
import { useSession, deleteUser } from '../../auth/client.js'

const signedInAs = (email: string) => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: 'u1', name: 'Alex', email } },
    isPending: false,
  } as unknown as ReturnType<typeof useSession>)
}

const assign = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  signedInAs('alex@example.test')
  vi.stubGlobal('location', { assign })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('what the page shows', () => {
  it('names who is signed in, so nobody deletes the wrong account', () => {
    render(<Account />)

    expect(screen.getByText('alex@example.test')).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
  })

  it('still renders when no session came back, rather than throwing', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof useSession>)

    render(<Account />)

    expect(screen.getByRole('heading', { name: 'Your account' })).toBeInTheDocument()
  })

  it('asks nothing until the dialog is opened', () => {
    render(<Account />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('the confirmation', () => {
  it('spells out what disappears rather than asking if you are sure', async () => {
    render(<Account />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }))

    const dialog = screen.getByRole('dialog')

    expect(dialog).toHaveTextContent('Delete the account of alex@example.test?')
    expect(dialog).toHaveTextContent('every return you track')
    expect(dialog).toHaveTextContent('every store you added')
    expect(dialog).toHaveTextContent('every stored label')
    expect(dialog).toHaveTextContent('Export your returns')
  })

  it('leaves the account alone when it is dismissed', async () => {
    render(<Account />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteUser).not.toHaveBeenCalled()
  })
})

describe('deleting', () => {
  const confirm = async () => {
    render(<Account />)

    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    await userEvent.click(
      screen.getByRole('dialog').querySelector('.btn-danger') as HTMLElement
    )
  }

  it('sends the visitor home once the account is gone', async () => {
    vi.mocked(deleteUser).mockResolvedValue({ error: null })

    await confirm()

    await waitFor(() => { expect(assign).toHaveBeenCalledWith('/') })
  })

  it('says to sign in again when the session is too old to allow it', async () => {
    vi.mocked(deleteUser).mockResolvedValue({ error: { status: 400 } })

    await confirm()

    expect(await screen.findByText(/Sign in again/)).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it('says to try later when the server refused for another reason', async () => {
    vi.mocked(deleteUser).mockResolvedValue({ error: { status: 500 } })

    await confirm()

    expect(await screen.findByText(/Try again in a moment/)).toBeInTheDocument()
  })
})
