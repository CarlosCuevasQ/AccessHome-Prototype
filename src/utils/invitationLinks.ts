export function invitationPath(token: string): string {
  return `/invitacion/${encodeURIComponent(token)}`
}

export function isPublicOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    return url.protocol === 'https:' && !url.username && !url.password && host.includes('.')
      && !host.endsWith('.localhost') && !host.endsWith('.local') && !host.endsWith('.internal')
      && !/^[\d.]+$/.test(host) && !host.includes(':')
  } catch { return false }
}

export function invitationUrl(token: string, origin: string, requirePublicOrigin = false): string {
  let base: URL
  try { base = new URL(origin) } catch { throw new Error('No se pudo determinar la dirección de la aplicación.') }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password
      || (requirePublicOrigin && !isPublicOrigin(origin))) {
    throw new Error('Abre la aplicación desde su dominio público HTTPS para compartir esta invitación.')
  }
  if (!token.trim()) throw new Error('La invitación no tiene un enlace disponible.')
  return new URL(invitationPath(token), base.origin).href
}

// Use the actual deployment origin for both the QR and every sharing action.
// No localhost constant, guessed domain or separate source of configuration.
export function currentInvitationUrl(token: string): string {
  return invitationUrl(token, window.location.origin, import.meta.env?.MODE === 'shared')
}

export const invitationShareText = 'Consulta tu invitación de AccessHome y presenta el QR en caseta.'

export function invitationWhatsAppUrl(url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${invitationShareText}\n${url}`)}`
}
