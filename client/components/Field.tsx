import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  htmlFor: string
  problem: string | undefined
  hideLabel?: boolean
  children: ReactNode
}

export function Field ({ label, htmlFor, problem, hideLabel = false, children }: FieldProps) {
  return (
    <div className='form-field'>
      <label className={hideLabel ? 'sr-only' : 'form-label'} htmlFor={htmlFor}>{label}</label>
      {children}
      {problem !== undefined && <p className='field-error' id={`${htmlFor}-error`}>{problem}</p>}
    </div>
  )
}

type Marks = {
  className: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

export const fieldMarks = (htmlFor: string, problem: string | undefined): Marks =>
  problem === undefined
    ? { className: 'form-input' }
    : {
        className: 'form-input form-input-invalid',
        'aria-invalid': true,
        'aria-describedby': `${htmlFor}-error`,
      }
