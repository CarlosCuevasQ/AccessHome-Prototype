import type { ShiftLogItem } from '../types/guardReports.js'
import { serviceCategories } from '../types/services.js'

export const shiftCsvHeaders = ['Fecha', 'Hora', 'Tipo', 'Movimiento', 'Nombre', 'Empresa', 'Categoría', 'Residencia', 'Vehículo', 'Placas', 'Método', 'Resultado', 'Hora llegada', 'Hora entrada', 'Hora salida', 'Guardia', 'Observaciones', 'Pendiente de salida', 'Ámbito', 'Zona horaria']

// Quote every cell and neutralize spreadsheet formula prefixes, including whitespace.
export function csvCell(value: string | number) {
  const text = String(value)
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text
  return '"' + safe.replaceAll('"', '""') + '"'
}
export function shiftLocalParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` }
}
export function shiftCategory(value: string) { return serviceCategories[value as keyof typeof serviceCategories] ?? '' }
export function shiftCsv(items: ShiftLogItem[], timeZone: string) {
  const timestamp = (value: string | null) => { if (!value) return ''; const p = shiftLocalParts(value, timeZone); return `${p.date} ${p.time}` }
  const rows = items.map(item => {
    const { date, time } = shiftLocalParts(item.occurredAt, timeZone)
    return [date, time, item.type === 'visitor' ? 'Visitante' : 'Servicio', item.movement, item.name, item.company, shiftCategory(item.category), item.residence, item.vehicle, item.plates, item.method, item.result, timestamp(item.arrivalAt), timestamp(item.entryAt), timestamp(item.exitAt), item.guard, item.notes, item.pendingExit ? 'Sí' : '', item.inPeriod ? 'Periodo' : 'Pendiente fuera del periodo', timeZone]
  })
  return '\uFEFF' + [shiftCsvHeaders, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
export function shiftCsvFilename(periodStart: string, timeZone: string) {
  return `accesshome-reporte-caseta-${shiftLocalParts(periodStart, timeZone).date}.csv`
}
