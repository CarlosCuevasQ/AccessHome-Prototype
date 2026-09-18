import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

export function containsPrivilegedSecret(text) {
  if (/sb_secret_[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]+@/i.test(text)) return true
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(match[1], 'base64url').toString()).role === 'service_role') return true }
    catch { /* Not a JWT payload. */ }
  }
  return false
}

export async function checkDist(root = 'dist') {
  const findings = []
  async function inspect(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await inspect(path)
      else if (entry.isFile()) {
        if (/^\.env(?:\.|$)|\.sql$|\.pem$|\.key$/i.test(entry.name)
            || containsPrivilegedSecret(await readFile(path, 'utf8'))) findings.push(relative(root, path))
      }
    }
  }
  await inspect(root)
  return findings
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const findings = await checkDist()
    if (findings.length) {
      // Never print matched values, tokens or source lines.
      console.error(`No publicar: ${findings.length} archivo(s) con posibles secretos o configuración privada. Revisarlos localmente.`)
      process.exitCode = 1
    } else console.log('Artefacto revisado: sin claves privilegiadas reconocidas ni archivos .env, SQL o claves privadas. Revisar también las variables de Vercel.')
  } catch {
    console.error('No se pudo revisar dist. Ejecuta primero el build y comprueba que el directorio sea accesible.')
    process.exitCode = 1
  }
}
