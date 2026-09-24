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

type Marks = { 'aria-invalid'?: true, 'aria-describedby'?: string }

export const problemMarks = (htmlFor: string, problem: string | undefined): Marks =>
  problem === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': `${htmlFor}-error` }
