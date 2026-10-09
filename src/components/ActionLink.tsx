import { Link, type LinkProps } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

/** Navigation with the same visual hierarchy and touch area as an action button. */
export function ActionLink({ variant = 'secondary', icon, children, className = '', ...props }: LinkProps & { variant?: 'primary' | 'secondary' | 'ghost' | 'back' | 'detail'; icon?: IconName }) {
  const leading = icon ?? (variant === 'back' ? 'back' : undefined)
  return <Link {...props} className={`${variant === 'primary' ? 'button-link' : 'secondary-button'} action-link action-${variant} ${className}`}>
    {leading && <Icon name={leading} />}{children}{variant === 'detail' && <Icon name="chevron" />}
  </Link>
}
