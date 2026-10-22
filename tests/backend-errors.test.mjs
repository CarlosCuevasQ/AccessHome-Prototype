import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { registerHooks } from 'node:module'

// Fixtures only: no .env, real project or network. Same injection as shared-client.
const fixtureEnv={VITE_SUPABASE_URL:'https://accesshome-fixture.invalid',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_not_a_real_key'}
const hooks=registerHooks({
 load(url,context,nextLoad) {
  const result=nextLoad(url,context)
  if(url.includes('/.test-build/services/shared/') && (url.endsWith('/client.js')||url.endsWith('/provider.js'))) {
   return {...result,source:result.source.toString().replaceAll('import.meta.env',JSON.stringify(fixtureEnv))}
  }
  return result
 }
})
let reply=null
const originalFetch=globalThis.fetch
globalThis.fetch=async()=>{ if(reply instanceof Error) throw reply; return new Response(JSON.stringify(reply.body),{status:reply.status}) }
const {backendError,rpc}=await import('../.test-build/services/shared/transport.js')
const {getClient}=await import('../.test-build/services/shared/client.js')
after(()=>{ getClient().auth.stopAutoRefresh(); globalThis.fetch=originalFetch; hooks.deregister() })

// Rasgos de PostgreSQL/PostgREST que nunca deben llegar a la interfaz.
const technical=/accesshome|relation|function|constraint|column|schema|serializ|statement|timeout|select |insert |violates|duplicate key|syntax|TypeError|FetchError|PGRST|SQLSTATE|\(.*uuid/i
const fields='Revisa los campos, sus límites y las fechas.'
const permission='No tienes permiso para esta operación. Comprueba tu cuenta y residencia.'

test('errores técnicos no reconocidos no muestran el mensaje original de PostgreSQL/PostgREST', () => {
 const cases=[
  {code:'40001',message:'could not serialize access due to concurrent update'},
  {code:'40P01',message:'deadlock detected'},
  {code:'57014',message:'canceling statement due to statement timeout'},
  {code:'55P03',message:'canceling statement due to lock timeout'},
  {code:'42883',message:'function accesshome_private.validate_access(text, uuid, unknown) does not exist'},
  {code:'42P01',message:'relation "accesshome.access_records" does not exist'},
  {code:'XX000',message:'internal error in accesshome_private.shift_snapshot'},
  {code:'PGRST202',message:'Could not find the function accesshome.validate_access(scan_method, token) in the schema cache'},
  {code:'PGRST301',message:'JWT expired'},
 ]
 for(const error of cases) {
  const shown=backendError(error).message
  assert.notEqual(shown,error.message,error.code)
  assert.doesNotMatch(shown,technical,error.code)
  assert.ok(shown.length>0)
 }
 // Distintos según lo que el usuario puede hacer: reintentar tras concurrencia o tiempo de espera.
 assert.match(backendError({code:'40001',message:'x'}).message,/al mismo tiempo/)
 assert.match(backendError({code:'57014',message:'x'}).message,/tardó demasiado/)
 assert.match(backendError({code:'42883',message:'x'}).message,/No se pudo completar la operación/)
})

test('fallos sin código (red, abortos) muestran un mensaje de conexión, no el error del navegador', () => {
 for(const message of ['TypeError: fetch failed','FetchError: getaddrinfo ENOTFOUND accesshome-fixture.invalid','AbortError: This operation was aborted']) {
  const shown=backendError({code:'',message}).message
  assert.equal(shown,'No se pudo contactar con el servidor. Vuelve a consultar antes de reintentar.')
 }
 assert.equal(backendError({message:''}).message,'No se pudo contactar con el servidor. Vuelve a consultar antes de reintentar.')
})

test('clases 22xxx, 23xxx y 42501 devuelven mensajes seguros del contrato actual', () => {
 const cases=[
  [{code:'22001',message:'value too long for type character varying(80)'},fields],
  [{code:'22P02',message:'invalid input syntax for type uuid: "x"'},fields],
  [{code:'22023',message:'Hora inexistente en la zona del condominio'},fields],
  [{code:'22007',message:'invalid input syntax for type timestamp with time zone'},fields],
  [{code:'23505',message:'duplicate key value violates unique constraint "residences_condominium_id_number_key"'},'Ya existe un registro con esos datos.'],
  [{code:'23503',message:'insert or update on table "residence_vehicles" violates foreign key constraint "residence_vehicles_owner_fkey"'},'La relación seleccionada no es válida o el registro tiene información relacionada.'],
  [{code:'23514',message:'new row for relation "invitations" violates check constraint "invitations_check"'},fields],
  [{code:'23502',message:'null value in column "street" of relation "residences" violates not-null constraint'},fields],
  [{code:'23P01',message:'conflicting key value violates exclusion constraint "invitations_no_overlap"'},fields],
  [{code:'42501',message:'Invitación no disponible'},permission],
  [{code:'42501',message:'permission denied for table access_records'},permission],
 ]
 for(const [error,expected] of cases) {
  const shown=backendError(error).message
  assert.equal(shown,expected,error.code)
  assert.doesNotMatch(shown,technical,error.code)
 }
})

test('mensajes funcionales de AccessHome (RAISE sin SQLSTATE, P0001) se conservan', () => {
 for(const message of [
  'Este contacto ya tiene una invitación activa con vigencia superpuesta en esta residencia.',
  'Solo se puede cancelar una invitación activa',
  'Ya cerraste este periodo. Consulta el reporte existente',
  'Este servicio ya recibió una decisión. Actualiza la lista',
  'El reporte solo puede avanzar de pendiente a en proceso y después a completado',
 ]) assert.equal(backendError({code:'P0001',message}).message,message)
})

test('rpc aplica el mapeo a respuestas reales de PostgREST y a fallos de red', async () => {
 reply={status:500,body:{code:'57014',message:'canceling statement due to statement timeout',details:null,hint:null}}
 await assert.rejects(rpc('list_access'),error=>error.message.includes('tardó demasiado') && !technical.test(error.message))
 reply={status:404,body:{code:'PGRST202',message:'Could not find the function accesshome.validate_access(scan_method, token) in the schema cache',details:'Searched for the function accesshome.validate_access with parameters scan_method, token',hint:'Perhaps you meant to call the function accesshome.validate_access(request_id, token)'}}
 await assert.rejects(rpc('validate_access',{token:'x',scan_method:'QR'}),error=>!technical.test(error.message))
 reply={status:400,body:{code:'P0001',message:'Este servicio ya recibió una decisión. Actualiza la lista',details:null,hint:null}}
 await assert.rejects(rpc('service_command'),{message:'Este servicio ya recibió una decisión. Actualiza la lista'})
 reply={status:403,body:{code:'42501',message:'Residencia no disponible',details:null,hint:null}}
 await assert.rejects(rpc('residence_details'),{message:permission})
 reply=new TypeError('fetch failed')
 await assert.rejects(rpc('list_access'),{message:'No se pudo contactar con el servidor. Vuelve a consultar antes de reintentar.'})
 // Errores de negocio devueltos como datos (vista pública) siguen intactos.
 reply={status:200,body:{error:'Demasiadas consultas. Espera un minuto.'}}
 await assert.rejects(rpc('public_invitation'),{message:'Demasiadas consultas. Espera un minuto.'})
})
