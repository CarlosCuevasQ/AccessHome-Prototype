import { invitationShareText } from '../utils/invitationLinks.js'

type ShareBrowser = Pick<Navigator, 'share' | 'canShare' | 'clipboard'>
export type ShareResult = 'shared' | 'copied' | 'manual' | 'cancelled'

export async function copyInvitationLink(url: string, browser: ShareBrowser = navigator): Promise<ShareResult> {
  if (typeof browser.clipboard?.writeText !== 'function') return 'manual'
  try { await browser.clipboard.writeText(url); return 'copied' }
  catch { return 'manual' }
}

// Called only from an explicit button click. Never logs URLs, tokens or API errors.
export async function shareInvitationLink(url: string, browser: ShareBrowser = navigator): Promise<ShareResult> {
  const data: ShareData = { title: 'Invitación de AccessHome', text: invitationShareText, url }
  try {
    if (typeof browser.share !== 'function' || (typeof browser.canShare === 'function' && !browser.canShare(data))) {
      return copyInvitationLink(url, browser)
    }
    await browser.share(data); return 'shared'
  }
  catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'
    throw new Error('No se pudo abrir el menú para compartir. Usa WhatsApp o Copiar enlace.')
  }
}
