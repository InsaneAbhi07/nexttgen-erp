/** NexttGen brand mark — an "N" with a brass keyhole dot (lock & hardware heritage). */
export default function BrandMark({ size = 32, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1F5FD6" />
      <path d="M8.5 23.5v-15h3.3l6.9 9.4V8.5h3.3v15h-3.2l-7-9.5v9.5z" fill="#fff" />
      <circle cx="25.2" cy="21.6" r="1.9" fill="#C9962F" />
      <path d="M24.4 22.8h1.6l.5 2.7h-2.6z" fill="#C9962F" />
    </svg>
  )
}
