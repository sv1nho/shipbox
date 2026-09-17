import { useState } from 'react'
import { CSV_COLUMNS } from '../../shared/csv.js'
import { REQUIRED_CREATE_FIELDS } from '../../shared/shipment.js'
import type { ImportOutcome } from '../../shared/shipment.js'
import { parseImportFile, toShipmentInput } from './import-file.js'
import { Modal } from './Modal.js'

type ImportDialogProps = {
  busy: boolean
  error: string | null
  outcome: ImportOutcome | null
  onClose: () => void
  onImport: (rows: Record<string, unknown>[]) => void
}

export function ImportDialog ({ busy, error, outcome, onClose, onImport }: ImportDialogProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  const read = async (file: File) => {
    const parsed = parseImportFile(file.name, await file.text())

    setFileName(file.name)
    setRows(parsed.rows)
    setProblem(parsed.problem)
  }

  return (
    <Modal titleId='import-title' onClose={onClose}>
      <div className='modal-header'>
        <h2 className='modal-title' id='import-title'>Import returns</h2>
      </div>

      <div className='modal-body space-y-3'>
        <p className='card-text'>
          A CSV or JSON file, laid out like the export. Each row needs at least{' '}
          {REQUIRED_CREATE_FIELDS.join(', ')}.
        </p>

        <label className='form-label' htmlFor='import-file'>File</label>
        <input
          id='import-file'
          type='file'
          className='form-input'
          accept='.csv,.json,text/csv,application/json'
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file !== undefined) void read(file)
          }}
        />

        {problem !== null && <p className='field-error'>{problem}</p>}

        {problem === null && rows.length > 0 && (
          <p className='card-text'>
            {fileName} holds{' '}
            <strong>{rows.length === 1 ? '1 return' : `${String(rows.length)} returns`}</strong>.
          </p>
        )}

        {outcome !== null && (
          <div className='space-y-3'>
            <p className='card-text'>
              Imported <strong>{outcome.imported}</strong> of {rows.length}.
            </p>

            {outcome.failures.length > 0 && (
              <>
                <p className='field-error'>
                  {outcome.failures.length === 1
                    ? '1 row was refused:'
                    : `${String(outcome.failures.length)} rows were refused:`}
                </p>
                <ul className='consequence-list'>
                  {outcome.failures.map((failure) => (
                    <li key={failure.row}>Row {failure.row}: {failure.message}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {error !== null && <div className='alert-error'>{error}</div>}

        <details className='import-help'>
          <summary>The columns an export writes</summary>
          <p className='card-text'>{CSV_COLUMNS.join(', ')}</p>
        </details>
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-ghost' onClick={onClose} disabled={busy}>
          {outcome === null ? 'Cancel' : 'Close'}
        </button>
        <button
          type='button'
          className='btn btn-primary'
          disabled={busy || rows.length === 0 || problem !== null || outcome !== null}
          onClick={() => { onImport(rows.map(toShipmentInput)) }}
        >
          {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
    </Modal>
  )
}
