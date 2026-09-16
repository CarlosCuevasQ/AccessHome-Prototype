export function invitationPath(token: string): string {
  return `/invitacion/${encodeURIComponent(token)}`
}

export function invitationUrl(token: string, origin: string): string {
  return new URL(invitationPath(token), origin).href
}
