export function CopyIcon ({ copied }: { copied: boolean }) {
  return (
    <svg
      viewBox='0 0 16 16'
      width='12'
      height='12'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      {copied
        ? <path d='M3 8.6 6.4 12 13 4.8' />
        : (
          <>
            <rect x='5.6' y='2.2' width='8.2' height='9.6' rx='1.2' />
            <path d='M10.4 13.8H3.4a1.2 1.2 0 0 1-1.2-1.2V5.2' />
          </>
        )}
    </svg>
  )
}
