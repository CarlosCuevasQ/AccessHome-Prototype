import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const tokens = Object.fromEntries([...css.matchAll(/--(color-[\w-]+):\s*(#[\da-f]{6});/gi)].map(m => [m[1], m[2]]))
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
}
function contrast(a, b) {
  const values = [luminance(tokens[`color-${a}`]), luminance(tokens[`color-${b}`])].sort((a, b) => b - a)
  return (values[0] + .05) / (values[1] + .05)
}

test('contraste AA: texto normal, navegación, botones y mensajes semánticos', () => {
  for (const [fg, bg] of [
    ['text', 'surface'], ['text', 'background'], ['muted', 'surface'], ['muted', 'brand-light'],
    ['brand-primary', 'surface'], ['surface', 'brand-primary'], ['surface', 'brand-dark'],
    ['brand-light', 'brand-dark'], ['brand-dark', 'pending-surface'], ['brand-dark', 'accent'],
    ['accent', 'brand-dark'], ['success', 'success-surface'], ['danger', 'danger-surface'], ['warning', 'pending-surface'],
  ]) assert.ok(contrast(fg, bg) >= 4.5, `${fg}/${bg}: ${contrast(fg, bg).toFixed(2)} < 4.5`)
})

test('contraste AA: bordes de controles y foco visible en superficies utilizadas', () => {
  for (const [fg, bg] of [
    ['control-border', 'surface'], ['control-border', 'background'], ['control-border', 'brand-light'], ['brand-primary', 'surface'],
    ['brand-primary', 'brand-light'], ['accent', 'brand-dark'],
  ]) assert.ok(contrast(fg, bg) >= 3, `${fg}/${bg}: ${contrast(fg, bg).toFixed(2)} < 3`)
})
