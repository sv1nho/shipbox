import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../api/shipments.js', () => ({ addStore: vi.fn() }))

import { NewStoreDialog } from '../../shipments/NewStoreDialog.js'
import { addStore } from '../../api/shipments.js'
import { ApiError } from '../../api/client.js'

const renderDialog = (name = '') => {
  const onCancel = vi.fn()
  const onAdded = vi.fn()

  render(<NewStoreDialog name={name} onCancel={onCancel} onAdded={onAdded} />)

  return { onCancel, onAdded }
}

const submit = async () => {
  await userEvent.click(screen.getByRole('button', { name: /add the store/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(addStore).mockResolvedValue({ name: 'Zalando', supportEmail: 'service@zalando.be' })
})

describe('what it starts from', () => {
  it('carries over the name already typed, so nothing is retyped', () => {
    renderDialog('Brand new shop')

    expect(screen.getByLabelText('Name')).toHaveValue('Brand new shop')
  })

  it('says why the address is worth giving', () => {
    renderDialog()

    expect(screen.getByText(/writes to this address when a return sits too long/i))
      .toBeInTheDocument()
  })
})

describe('what it refuses', () => {
  it('says nothing before the first attempt', () => {
    renderDialog()

    expect(screen.queryByText(/is required/i)).not.toBeInTheDocument()
  })

  it('refuses a store with no name', async () => {
    renderDialog()

    await submit()

    expect(screen.getByText('A name is required.')).toBeInTheDocument()
    expect(addStore).not.toHaveBeenCalled()
  })

  it('refuses a store with no address, which is the point of keeping one', async () => {
    renderDialog('Zalando')

    await submit()

    expect(screen.getByText('An email address is required.')).toBeInTheDocument()
    expect(addStore).not.toHaveBeenCalled()
  })

  it.each(['zalando.be', 'service@', 'service@zalando', 'a b@c.be'])(
    'refuses %s, which is not an address',
    async (typed) => {
      renderDialog('Zalando')

      await userEvent.type(screen.getByLabelText(/customer service email/i), typed)
      await submit()

      expect(screen.getByText('An email address is required.')).toBeInTheDocument()
    }
  )
})

describe('what it sends', () => {
  it('trims what was typed', async () => {
    const { onAdded } = renderDialog('  Zalando  ')

    await userEvent.type(screen.getByLabelText(/customer service email/i), ' service@zalando.be ')
    await submit()

    expect(addStore).toHaveBeenCalledWith('Zalando', 'service@zalando.be')
    expect(onAdded).toHaveBeenCalledWith({ name: 'Zalando', supportEmail: 'service@zalando.be' })
  })
})

describe('when the name is close to a store already there', () => {
  it('names the store to pick instead, rather than creating a near duplicate', async () => {
    vi.mocked(addStore).mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'You already track Zalando. Pick it instead of creating a near duplicate.', null)
    )

    const { onAdded } = renderDialog('Zalndo')

    await userEvent.type(screen.getByLabelText(/customer service email/i), 'service@zalando.be')
    await submit()

    expect(await screen.findByText(/You already track Zalando/)).toBeInTheDocument()
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('drops the warning as soon as the name is changed', async () => {
    vi.mocked(addStore).mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'You already track Zalando.', null)
    )

    renderDialog('Zalndo')
    await userEvent.type(screen.getByLabelText(/customer service email/i), 'a@b.test')
    await submit()
    await screen.findByText(/You already track Zalando/)

    await userEvent.type(screen.getByLabelText('Name'), ' BE')

    expect(screen.queryByText(/You already track Zalando/)).not.toBeInTheDocument()
  })
})

describe('when it cannot reach the api', () => {
  it('says so without blaming the name', async () => {
    vi.mocked(addStore).mockRejectedValue(new TypeError('Failed to fetch'))

    renderDialog('Zalando')
    await userEvent.type(screen.getByLabelText(/customer service email/i), 'a@b.test')
    await submit()

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument()
  })
})

describe('backing out', () => {
  it('adds nothing', async () => {
    const { onCancel, onAdded } = renderDialog('Zalando')

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onAdded).not.toHaveBeenCalled()
    expect(addStore).not.toHaveBeenCalled()
  })
})
