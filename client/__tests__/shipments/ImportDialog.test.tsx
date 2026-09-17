import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportDialog } from '../../shipments/ImportDialog.js'
import type { ImportOutcome } from '../../../shared/shipment.js'

type Options = {
  busy?: boolean
  error?: string | null
  outcome?: ImportOutcome | null
}

const renderDialog = ({ busy = false, error = null, outcome = null }: Options = {}) => {
  const onClose = vi.fn()
  const onImport = vi.fn()

  render(
    <ImportDialog
      busy={busy}
      error={error}
      outcome={outcome}
      onClose={onClose}
      onImport={onImport}
    />
  )

  return { onClose, onImport }
}

const upload = async (name: string, content: string) => {
  await userEvent.upload(screen.getByLabelText('File'), new File([content], name))
}

const importButton = () => screen.getByRole('button', { name: /^import/i })

describe('before a file is chosen', () => {
  it('says what a row needs, so a hand written file has a chance', () => {
    renderDialog()

    expect(screen.getByText(/trackingNumber, carrier, store/)).toBeInTheDocument()
  })

  it('lists the columns an export writes', () => {
    renderDialog()

    expect(screen.getByText(/decisionDelayDays/)).toBeInTheDocument()
  })

  it('has nothing to import yet', () => {
    renderDialog()

    expect(importButton()).toBeDisabled()
  })
})

describe('once a file is chosen', () => {
  it('counts what it found before anything is sent', async () => {
    renderDialog()

    await upload('returns.csv', 'trackingNumber,store\r\n3232,Zalando\r\n3299,Zara')

    expect(await screen.findByText(/2 returns/)).toBeInTheDocument()
    expect(importButton()).toBeEnabled()
  })

  it('counts a single return without saying 1 returns', async () => {
    renderDialog()

    await upload('returns.csv', 'store\r\nZalando')

    expect(await screen.findByText(/1 return/)).toBeInTheDocument()
  })

  it('stays put when the picker is dismissed without a file', () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText('File'), { target: { files: [] } })

    expect(importButton()).toBeDisabled()
    expect(screen.queryByText(/holds/)).not.toBeInTheDocument()
  })

  it('refuses to send a file it could not read', async () => {
    renderDialog()

    await upload('returns.json', '{oops')

    expect(await screen.findByText('This file is not valid JSON.')).toBeInTheDocument()
    expect(importButton()).toBeDisabled()
  })

  it('sends the rows with the empty cells dropped and the amount in cents', async () => {
    const { onImport } = renderDialog()

    await upload('returns.csv', 'store,amount,note\r\nZalando,49.99,')
    await screen.findByText(/1 return/)

    await userEvent.click(importButton())

    expect(onImport).toHaveBeenCalledWith([{ store: 'Zalando', amountCents: 4999 }])
  })
})

describe('once the api has answered', () => {
  const outcome = (imported: number, failures: ImportOutcome['failures'] = []): ImportOutcome =>
    ({ imported, failures })

  it('says how many landed', () => {
    renderDialog({ outcome: outcome(2) })

    expect(screen.getByText(/Imported/)).toBeInTheDocument()
  })

  it('names the row and the reason for each refusal', () => {
    renderDialog({
      outcome: outcome(1, [
        { row: 2, message: 'trackingNumber: must match the bpost format' },
        { row: 5, message: 'This tracking number is already registered.' },
      ]),
    })

    expect(screen.getByText(/2 rows were refused/)).toBeInTheDocument()
    expect(screen.getByText(/Row 2: trackingNumber/)).toBeInTheDocument()
    expect(screen.getByText(/Row 5: This tracking number/)).toBeInTheDocument()
  })

  it('counts a single refusal without saying 1 rows', () => {
    renderDialog({ outcome: outcome(1, [{ row: 2, message: 'nope' }]) })

    expect(screen.getByText('1 row was refused:')).toBeInTheDocument()
  })

  it('says nothing about refusals when every row landed', () => {
    renderDialog({ outcome: outcome(3) })

    expect(screen.queryByText(/refused/)).not.toBeInTheDocument()
  })

  it('cannot be sent twice, so an import is never doubled', () => {
    renderDialog({ outcome: outcome(2) })

    expect(importButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
  })
})

describe('while it runs', () => {
  it('cannot be fired again', () => {
    renderDialog({ busy: true })

    expect(screen.getByRole('button', { name: /importing/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('shows what the api refused outright', () => {
    renderDialog({ error: 'The server could not be reached.' })

    expect(screen.getByText('The server could not be reached.')).toBeInTheDocument()
  })
})
