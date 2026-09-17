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
const {demoService}=await import('../.test-build/services/demoService.js')
const {readDemoData,writeDemoData}=await import('../.test-build/services/demoStorage.js')
const {getClient}=await import('../.test-build/services/shared/client.js')
after(()=>{ getClient().auth.stopAutoRefresh(); globalThis.fetch=originalFetch; hooks.deregister(); delete globalThis.window })

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
 await communityService.getSummary(); await communityService.listResidences(); await communityService.getResidence()
 await contactsService.listContacts(); await invitationsService.listInvitations()
 await invitationsService.createInvitation({source:'occasional',visitorName:'Test',phone:'',vehicle:null,saveAsContact:false,validity:{kind:'24hours'}})
 await invitationsService.cancelInvitation('new-invitation'); await publicInvitationService.getInvitation('token-fixture')
 await reportsService.listReports(); await accessHistoryService.listRecords(); await dashboardService.getResidentDashboard()
 await demoService.getProfileContext(profile.id)
 const rpcRequests=requests.filter(r=>r.path.includes('/rpc/'))
 for(const request of rpcRequests) {
  assert.equal(request.headers.get('content-profile'),'accesshome')
  assert.equal(request.headers.get('authorization'),'Bearer fixture.token.only')
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
