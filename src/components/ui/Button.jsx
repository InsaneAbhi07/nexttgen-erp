import { Link } from 'react-router-dom'

/**
 * Button — variants: primary | secondary | ghost | danger | soft | success
 * Pass `to` to render a router link styled as a button.
 */
export default function Button({
  variant = 'secondary',
  size,
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  block = false,
  iconOnly = false,
  to,
  className = '',
  children,
  type = 'button',
  ...rest
}) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    iconOnly ? 'btn-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const iconSize = size === 'sm' ? 14 : 15
  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden /> : Icon ? <Icon size={iconSize} strokeWidth={2} aria-hidden /> : null}
      {children}
      {IconRight && !loading ? <IconRight size={iconSize} strokeWidth={2} aria-hidden /> : null}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    )
  }
  return (
    <button type={type} className={cls} disabled={loading || rest.disabled} {...rest}>
      {content}
    </button>
  )
}
