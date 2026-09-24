import type { ReactNode } from 'react'
import type { DatedField } from '../../shared/transitions.js'

export type Step = {
  field: DatedField
  label: string
  done: boolean
  value: ReactNode
}

export function Timeline ({ steps }: { steps: Step[] }) {
  return (
    <ol className='timeline'>
      {steps.map((step) => (
        <li
          key={step.field}
          className={step.done ? 'timeline-step timeline-step-done' : 'timeline-step'}
        >
          <span className='timeline-mark' aria-hidden='true' />
          <span className='timeline-label'>{step.label}</span>
          <span className='timeline-value'>{step.value}</span>
        </li>
      ))}
    </ol>
  )
}
