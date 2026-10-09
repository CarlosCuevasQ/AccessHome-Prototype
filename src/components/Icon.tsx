// Original, shared line icons. The surrounding label supplies the accessible name.
const paths = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  scan: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z',
  invitation: 'M3 5h18v14H3zM3 6l9 7 9-7',
  package: 'm3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M7.5 5l9 4',
  report: 'M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
  exit: 'M9 21H3V3h6M8 12h13M16 7l5 5-5 5',
  entry: 'M15 3h6v18h-6M3 12h13M11 7l5 5-5 5',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  back: 'M20 12H4M10 6l-6 6 6 6',
  chevron: 'm9 5 7 7-7 7',
  car: 'm5 7 2-4h10l2 4 2 3v8H3v-8zM5 7h14M7 13h.01M17 13h.01M5 18v3M19 18v3',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
  share: 'M12 16V3M7 8l5-5 5 5M5 12H3v9h18v-9h-2',
  copy: 'M9 9h12v12H9zM5 15H3V3h12v2',
  message: 'M21 11a9 9 0 0 1-9 9H7l-4 2v-7a9 9 0 1 1 18-4M8 10h8M8 14h5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  plus: 'M12 4v16M4 12h16',
  check: 'm5 12 4 4L19 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM12 8v5M12 16h.01',
} as const
export type IconName = keyof typeof paths
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}
export function navigationIcon(path: string): IconName {
  if (/escanear|control-acceso/.test(path)) return 'scan'
  if (/salidas/.test(path)) return 'exit'
  if (/servicios/.test(path)) return 'package'
  if (/reportes/.test(path)) return 'report'
  if (/historial/.test(path)) return 'history'
  if (/contactos/.test(path)) return 'people'
  if (/invitaciones/.test(path)) return 'invitation'
  if (/perfil/.test(path)) return 'user'
  return 'home'
}
