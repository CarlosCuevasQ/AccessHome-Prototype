import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { registerHooks } from 'node:module'
import { randomUUID } from 'node:crypto'

// Fixtures are injected into compiled test modules only. No .env or real project is used.
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
const requests=[]
let responseError=false
let lostAccessResponse=false
let signInError=false
let profile={id:randomUUID(),name:'Daniel',role:'resident',condominiumId:randomUUID(),residenceId:randomUUID()}
const originalFetch=globalThis.fetch
globalThis.fetch=async (url,options={})=>{
 const path=new URL(url).pathname
 const body=options.body ? JSON.parse(options.body) : null
 requests.push({path,body,headers:new Headers(options.headers)})
 if(responseError) return new Response(JSON.stringify({code:'42501',message:'Denied'}),{status:403})
 if(path==='/auth/v1/token') {
  if(signInError) return new Response(JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials'}),{status:400})
  return new Response(JSON.stringify({access_token:'fixture.token.only',refresh_token:randomUUID(),token_type:'bearer',expires_in:3600,user:{id:profile?.id ?? randomUUID(),email:body.email}}),{status:200})
 }
 if(path==='/auth/v1/logout') return new Response('{}',{status:200})
 if(path.endsWith('/session_profile')) return new Response(JSON.stringify(profile),{status:200})
 if((path.endsWith('/validate_access') || path.endsWith('/guard_register_exit')) && lostAccessResponse) throw new TypeError('Fixture: response lost')
 if(profile?.role==='guard' && path.endsWith('/manage_community')) return new Response(JSON.stringify({code:'42501',message:'Denied'}),{status:403})
 if(path.endsWith('/guard_dashboard')) return new Response(JSON.stringify({guardName:profile.name,condominiumName:'Condominio fixture',todayAccessCount:2}),{status:200})
 if(path.endsWith('/guard_history')) return new Response(JSON.stringify({records:[],hasMore:false}),{status:200})
 if(path.endsWith('/guard_open_visits')) return new Response(JSON.stringify({records:[],hasMore:false,timeZone:'America/Mexico_City'}),{status:200})
 return new Response(JSON.stringify(path.endsWith('/create_invitation')?'new-invitation':[]),{status:200})
}
globalThis.window=new EventTarget()
window.localStorage={ getItem(){throw new Error('DOMAIN LOCAL READ')},setItem(){throw new Error('DOMAIN LOCAL WRITE')} }
const {authService}=await import('../.test-build/services/authService.js')
const {communityService}=await import('../.test-build/services/communityService.js')
const {contactsService}=await import('../.test-build/services/contactsService.js')
const {invitationsService}=await import('../.test-build/services/invitationsService.js')
const {publicInvitationService}=await import('../.test-build/services/publicInvitationService.js')
const {reportsService}=await import('../.test-build/services/reportsService.js')
const {accessHistoryService}=await import('../.test-build/services/accessHistoryService.js')
const {dashboardService}=await import('../.test-build/services/dashboardService.js')
const {guardService}=await import('../.test-build/services/guardService.js')
const {getRoleHome}=await import('../.test-build/utils/auth.js')
const {demoService}=await import('../.test-build/services/demoService.js')
const {readDemoData,writeDemoData}=await import('../.test-build/services/demoStorage.js')
const {getClient}=await import('../.test-build/services/shared/client.js')
after(()=>{ getClient().auth.stopAutoRefresh(); globalThis.fetch=originalFetch; hooks.deregister(); delete globalThis.window })

test('salida sin QR: RPC acotado, reintento de red con mismo ID y limpieza al cerrar sesión',async()=>{
 const entry=randomUUID()
 assert.deepEqual((await guardService.getOpenVisits(1)).records,[])
 assert.deepEqual(requests.findLast(r=>r.path.endsWith('/guard_open_visits')).body,{page:1})
 lostAccessResponse=true
 await assert.rejects(guardService.registerExit(entry))
 const first=requests.findLast(r=>r.path.endsWith('/guard_register_exit')).body
 assert.deepEqual(Object.keys(first).sort(),['entry_id','request_id'])
 assert.equal(first.entry_id,entry)
 lostAccessResponse=false
 await guardService.registerExit(entry)
 assert.deepEqual(requests.findLast(r=>r.path.endsWith('/guard_register_exit')).body,first)
 lostAccessResponse=true
 await assert.rejects(guardService.registerExit(entry))
 const uncertain=requests.findLast(r=>r.path.endsWith('/guard_register_exit')).body
 await authService.logout()
 lostAccessResponse=false
 await guardService.registerExit(entry)
 assert.notEqual(requests.findLast(r=>r.path.endsWith('/guard_register_exit')).body.request_id,uncertain.request_id)
})

test('Auth real adapter sends individual credentials to Auth and resolves the role through RPC',async()=>{
 const password=randomUUID()
 const user=await authService.login({email:'daniel@example.test',password})
 assert.equal(user.name,'Daniel'); assert.equal(user.role,'resident'); assert.equal('password' in user,false)
 const request=requests.find(r=>r.path==='/auth/v1/token')
 assert.equal(request.body.password,password)
 assert.equal(request.headers.get('apikey'),fixtureEnv.VITE_SUPABASE_PUBLISHABLE_KEY)
 assert.ok(requests.some(r=>r.path.endsWith('/session_profile')))
 assert.equal((await authService.getSession()).residenceId,profile.residenceId)
})
test('all service facades select the shared provider; no domain localStorage reads/writes',async()=>{
 const start=requests.length
 await communityService.getSummary(); await communityService.listResidences(); await communityService.getResidence()
 await contactsService.listContacts(); await invitationsService.listInvitations()
 await invitationsService.createInvitation({source:'occasional',visitorName:'Test',phone:'',vehicle:null,saveAsContact:false,validity:{kind:'24hours'}})
 await invitationsService.cancelInvitation('new-invitation'); await publicInvitationService.getInvitation('token-fixture')
 await reportsService.listReports(); await accessHistoryService.listRecords(); await dashboardService.getResidentDashboard()
 await demoService.getProfileContext(profile.id)
 const rpcRequests=requests.slice(start).filter(r=>r.path.includes('/rpc/'))
 for(const request of rpcRequests) {
  assert.equal(request.headers.get('content-profile'),'accesshome')
  assert.equal(request.headers.get('authorization'),request.path.endsWith('/public_invitation') ? 'Bearer '+fixtureEnv.VITE_SUPABASE_PUBLISHABLE_KEY : 'Bearer fixture.token.only')
 }
 assert.throws(readDemoData,/no puede leer/)
 assert.throws(()=>writeDemoData({}),/no puede escribir/)
 await assert.rejects(demoService.resetDemoData(),/No se pueden restaurar/)
})
test('network/authorization failures never silently select local data',async()=>{
 responseError=true
 await assert.rejects(communityService.getSummary(),/permiso/)
 await assert.rejects(invitationsService.createInvitation({}),/permiso/)
 responseError=false
})
test('guard uses real Auth adapter, its home and scoped RPCs; administrative service rejects backend denial',async()=>{
 await authService.logout()
 profile={id:randomUUID(),name:'Guardia',role:'guard',condominiumId:randomUUID(),residenceId:null}
 const user=await authService.login({email:'guard@example.test',password:randomUUID()})
 assert.equal(user.role,'guard'); assert.equal(getRoleHome(user.role),'/guardia')
 assert.equal(getRoleHome('admin'),'/admin'); assert.equal(getRoleHome('resident'),'/residente')
 assert.equal((await guardService.getDashboard()).guardName,'Guardia')
 assert.deepEqual((await guardService.getHistory('entrada',1)).records,[])
 assert.deepEqual(requests.findLast(r=>r.path.endsWith('/guard_history')).body,{movement:'entrada',page:1})
 await assert.rejects(communityService.createResidence({number:'91',street:'No autorizado',active:true}),/permiso/)
 responseError=true
 await assert.rejects(guardService.getDashboard(),/permiso/)
 await assert.rejects(guardService.getHistory(),/permiso/)
 responseError=false
})

test('logout removes session; invalid credentials and missing profile never authorize a demo account',async()=>{
 await authService.logout()
 assert.equal(await authService.getSession(),null)
 signInError=true
 await assert.rejects(authService.login({email:'admin@example.test',password:randomUUID()}),/No se pudo iniciar/)
 signInError=false
 profile=null
 await assert.rejects(authService.login({email:'unassigned@example.test',password:randomUUID()}))
 assert.equal(await authService.getSession(),null)
})

test('visitante sin sesión consulta por POST anónimo sin token en URL ni localStorage',async()=>{
 const start=requests.length
 await publicInvitationService.getInvitation('public-token-fixture')
 const own=requests.slice(start)
 assert.equal(own.length,1)
 assert.equal(own[0].path,'/rest/v1/rpc/public_invitation')
 assert.deepEqual(own[0].body,{token:'public-token-fixture',vehicle:null})
 assert.equal(own[0].headers.get('authorization'),'Bearer '+fixtureEnv.VITE_SUPABASE_PUBLISHABLE_KEY)
})

test('cliente compartido conserva addVehicle solo como compatibilidad y no intenta escribir',async()=>{
 const start=requests.length
 await assert.rejects(publicInvitationService.addVehicle('token-fixture',{plates:'AB-123',brand:'',model:'',color:''}),/solo lectura/)
 assert.equal(requests.length,start)
})

test('guardia reutiliza validate_access y el mismo request_id tras fallo de red; nunca envía autorizado ni actor',async()=>{
 profile={id:randomUUID(),name:'Guardia fixture',role:'guard',condominiumId:randomUUID(),residenceId:null}
 await authService.login({email:'guard@fixture.invalid',password:randomUUID()})
 const start=requests.length
 lostAccessResponse=true
 await assert.rejects(guardService.validateToken('a'.repeat(64),'MANUAL'))
 lostAccessResponse=false
 await guardService.validateToken('a'.repeat(64),'MANUAL')
 await guardService.validateToken('a'.repeat(64),'QR')
 const attempts=requests.slice(start).filter(r=>r.path.endsWith('/validate_access'))
 assert.equal(attempts.length,3)
 assert.equal(attempts[0].body.request_id,attempts[1].body.request_id)
 assert.notEqual(attempts[1].body.request_id,attempts[2].body.request_id)
 assert.equal(attempts[0].body.scan_method,'MANUAL');assert.equal(attempts[2].body.scan_method,'QR')
 for(const attempt of attempts) {
  assert.deepEqual(Object.keys(attempt.body).sort(),['request_id','scan_method','token'])
  assert.equal(attempt.headers.get('authorization'),'Bearer fixture.token.only')
 }
})

test('reconfirmar la misma sesión Auth conserva el reintento; cambiar de cuenta lo elimina',async()=>{
 const unsubscribe=authService.subscribe(()=>{})
 try {
  await authService.login({email:'guard@fixture.invalid',password:randomUUID()})
  lostAccessResponse=true
  await assert.rejects(guardService.validateToken('b'.repeat(64),'QR'))
  const first=requests.findLast(r=>r.path.endsWith('/validate_access')).body.request_id
  // Real SDK emits SIGNED_IN again for the same user, as during session recovery.
  await getClient().auth.signInWithPassword({email:'guard@fixture.invalid',password:randomUUID()})
  await assert.rejects(guardService.validateToken('b'.repeat(64),'QR'))
  assert.equal(requests.findLast(r=>r.path.endsWith('/validate_access')).body.request_id,first)
  profile={...profile,id:randomUUID()}
  await getClient().auth.signInWithPassword({email:'other-guard@fixture.invalid',password:randomUUID()})
  lostAccessResponse=false
  await guardService.validateToken('b'.repeat(64),'QR')
  assert.notEqual(requests.findLast(r=>r.path.endsWith('/validate_access')).body.request_id,first)
 } finally {lostAccessResponse=false;unsubscribe()}
})
