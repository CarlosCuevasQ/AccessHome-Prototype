/* Adapted from React Bits FadeContent, Copyright (c) 2026 David Haz.
 * MIT + Commons Clause; see LICENSE.md. Upstream revision:
 * 1eeb6f105c68b964289d85dabbe84a1d551f3797 / src/ts-default/Animations/FadeContent/FadeContent.tsx
 * AccessHome: mount-only Web Animations instead of GSAP/ScrollTrigger; no blur,
 * no disappearance, no delay. Content stays visible without animation support.
 */
import { useEffect, useRef } from 'react'
import type { HTMLAttributes } from 'react'

export function FadeContent({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.animate !== 'function' || typeof window.matchMedia !== 'function') return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return
    const animation = el.animate([{ opacity: .55, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' })
    const stop = () => { if (preference.matches) animation.cancel() }
    // Focused controls must be fully visible immediately, even during entry.
    const focus = () => animation.cancel()
    preference.addEventListener('change', stop)
    el.addEventListener('focusin', focus)
    return () => { animation.cancel(); preference.removeEventListener('change', stop); el.removeEventListener('focusin', focus) }
  }, [])
  return <div ref={ref} className={className} {...props}>{children}</div>
}
