import { NavLink } from 'react-router-dom'
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
            <NavLink end to={item.path} onClick={onNavigate} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
