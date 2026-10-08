import { loadEnvFile } from 'node:process'
try { loadEnvFile('.env.local') } catch { /* Public variables may already be in the process environment. */ }
const url=process.env.VITE_SUPABASE_URL?.trim()
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
if(!url || !key?.startsWith('sb_publishable_')) {
 console.error('Completa las dos variables públicas de .env.example en .env.local. Usa una clave sb_publishable_.')
 process.exitCode=1
} else {
 try {
  const endpoint=new URL('/rest/v1/rpc/backend_health',url)
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json','Content-Profile':'accesshome'},body:'{}',signal:AbortSignal.timeout(10000)})
  if(!response.ok) throw new Error('HTTP '+response.status+': verifica URL, clave publishable, esquema accesshome expuesto y las ocho migraciones aplicadas.')
  const data=await response.json()
  if(data.application!=='AccessHome'||data.schemaVersion!==9) throw new Error('Versión de backend inesperada.')
  console.log('Conexión correcta: AccessHome, esquema 9. Este chequeo no modifica datos ni prueba el login; continúa con las cuentas demo y las pruebas entre residencias.')
  console.log(data.guardWorkspaceVersion===1
    ? 'Incremental de caseta detectada (guardWorkspaceVersion: 1). Falta comprobar la cuenta de guardia y sus permisos con una sesión real.'
    : 'Incremental de caseta pendiente o no detectada. La conexión base funciona, pero no confirma el panel de guardia.')
  console.log(data.publicInvitationVersion>=2
    ? 'Proyección pública mínima detectada.'
    : 'Proyección pública mínima pendiente: revisar la incremental 20260917000700 antes de publicar invitaciones.')
  console.log(data.guardScanningVersion===1
    ? 'Escaneo de guardia detectado (guardScanningVersion: 1). Falta probar cámara y movimientos con cuentas reales.'
    : 'Escaneo de guardia pendiente: revisar la incremental 20260918000100.')
  console.log(data.openVisitExitsVersion===1 && data.publicInvitationVersion>=3
    ? 'Salidas sin QR e indicador público de entrada abierta detectados. Falta probar los flujos con cuentas reales.'
    : 'Salidas sin QR pendientes: revisar la incremental 20260918000200.')
  console.log(data.serviceAccessVersion===1
    ? 'Módulo de servicios detectado (serviceAccessVersion: 1). Falta comprobar roles y operación con cuentas reales.'
    : 'Módulo de servicios pendiente: revisar 20260919000100_service_access.sql.')
  console.log(data.guardReportsVersion===1
    ? 'Reportes de caseta detectados (guardReportsVersion: 1). Falta comprobar cierres y consulta con cuentas reales.'
    : 'Reportes de caseta pendientes: revisar 20261007000100_guard_reports.sql.')
  console.log(data.guardReportLogVersion===1
    ? 'Detalle de turno detectado (guardReportLogVersion: 1). Falta aceptación remota de bitácora y CSV.'
    : 'Detalle de turno pendiente: revisar 20261007000200_guard_report_log.sql.')
 } catch(error) { console.error(error.message); process.exitCode=1 }
}
