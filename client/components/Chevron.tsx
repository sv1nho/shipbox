const PATHS = {
  left: 'M10 3 5 8l5 5',
  right: 'M6 3l5 5-5 5',
  up: 'M3 10l5-5 5 5',
  down: 'M3 6l5 5 5-5',
}

export function Chevron ({ pointing }: { pointing: keyof typeof PATHS }) {
  return (
    <svg
      viewBox='0 0 16 16'
      width='14'
      height='14'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d={PATHS[pointing]} />
    </svg>
  )
}
