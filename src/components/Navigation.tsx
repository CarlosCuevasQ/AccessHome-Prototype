import { NavLink } from 'react-router-dom'
import { Icon, navigationIcon } from './Icon'
import type { NavigationItem } from '../types/navigation'

interface NavigationProps {
  items: NavigationItem[]
  onNavigate: () => void
}

export function Navigation({ items, onNavigate }: NavigationProps) {
  return (
    <nav aria-label="Navegación principal">
      <ul className="navigation-list">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink end={item.end ?? true} to={item.path} onClick={onNavigate} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Icon name={navigationIcon(item.path)} /><span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
