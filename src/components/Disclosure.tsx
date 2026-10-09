import type { ReactNode } from 'react'

// Native disclosure: Tab/Enter/Space work without emulating an ARIA menu.
export function Disclosure({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <details className={`disclosure ${className}`} onKeyDown={event => {
    if (event.key === 'Escape' && event.currentTarget.open) {
      event.stopPropagation(); event.currentTarget.open = false
      event.currentTarget.querySelector('summary')?.focus()
    }
  }}><summary>{title}</summary><div className="disclosure-content">{children}</div></details>
}
