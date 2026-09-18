import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

const db = new PGlite({ extensions: { pgcrypto } })
const users = Object.fromEntries(['admin','daniel','ana','mariana','guard','outsider','inactive','unassigned'].map(name => [name,randomUUID()]))
let ids
let house12
let contact
async function actor(name, fn) {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${name ? 'authenticated' : 'anon'}`)
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: name ? users[name] : null, is_anonymous: false })])
    return fn(tx)
  })
}
function call(tx, name, args = [], casts = []) {
  return tx.query(`select accesshome.${name}(${args.map((_,i)=>'$'+(i+1)+(casts[i]?'::'+casts[i]:'')).join(',')}) as result`, args).then(r=>r.rows[0].result)
}
const as = (name, rpc, args=[], casts=[]) => actor(name, tx => call(tx,rpc,args,casts))
const occasional = (extra={}) => ({source:'occasional',visitorName:'Visita de prueba',phone:'',vehicle:null,saveAsContact:false,validity:{kind:'24hours'},...extra})

before(async () => {
 await installSharedSchema(db)
 for (const id of Object.values(users)) await db.query('insert into auth.users values($1)',[id])
 ids=(await db.query('select accesshome_private.seed_demo($1::jsonb) as seed',[JSON.stringify(Object.fromEntries(['admin','daniel','ana','mariana'].map(k=>[k,users[k]])))])).rows[0].seed
 house12=(await db.query('select id from accesshome.residences where number=12')).rows[0].id
 contact=(await db.query('select id from accesshome.frequent_contacts order by name limit 1')).rows[0].id
 await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role) values($1,$2,'Guardia reservado','guard')",[users.guard,ids.condominiumId])
 const other=(await db.query("insert into accesshome.condominiums(name) values('Otro condominio') returning id")).rows[0].id
 await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role) values($1,$2,'Otro admin','admin')",[users.outsider,other])
 await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role,active) values($1,$2,'Inactivo','admin',false)",[users.inactive,ids.condominiumId])
})
after(()=>db.close())

test('migraciones: RLS en cada tabla, sin escrituras genéricas ni lecturas anónimas',async()=>{
 await db.exec(await readFile('supabase/tests/security_baseline.sql','utf8'))
 assert.equal((await as(null,'backend_health')).schemaVersion,9)
 const tables=await db.query("select n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('accesshome','accesshome_private') and c.relkind='r'")
 for (const t of tables.rows) {
  assert.equal(t.relrowsecurity,true,t.relname)
  const name=t.nspname+'.'+t.relname
  const p=(await db.query("select has_table_privilege('anon',$1,'SELECT') as anon,has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') as writes",[name])).rows[0]
  assert.equal(p.anon,false,name); assert.equal(p.writes,false,name)
 }
 await assert.rejects(actor(null, tx=>tx.query('select * from accesshome.invitations')),/permission denied/)
 await assert.rejects(actor('daniel',tx=>tx.query("update accesshome.profiles set role='admin'")),/permission denied/)
 await assert.rejects(actor('admin',tx=>tx.query('select * from accesshome_private.invitation_tokens')),/permission denied/)
 await assert.rejects(actor('admin',tx=>tx.query("select accesshome_private.seed_demo('{}')")),/permission denied/)
})

test('contactos y vehículos: CRUD privado y borrado conserva los snapshots históricos',async()=>{
 const input={name:'Ángela Prueba',phone:'',email:'',notes:'',active:true}
 const id=await as('daniel','manage_contact',['create',null,JSON.stringify(input),null],['text','uuid','jsonb','uuid'])
 const vehicle={plates:'CRUD-24',brand:'',model:'',color:'',active:true}
 await as('daniel','manage_contact',['create_vehicle',null,JSON.stringify(vehicle),id],['text','uuid','jsonb','uuid'])
 const saved=await as('daniel','contact_details',[id])
 assert.equal((await as('daniel','list_contacts',['angela'])).length,1)
 const visit=await as('daniel','create_invitation',[JSON.stringify({source:'contact',contactId:id,vehicleChoice:{kind:'saved',vehicleId:saved.vehicles[0].id},validity:{kind:'today'}})],['jsonb'])
 await as('daniel','manage_contact',['update_vehicle',saved.vehicles[0].id,JSON.stringify({...vehicle,color:'Gris'}),id],['text','uuid','jsonb','uuid'])
 assert.equal((await as('daniel','contact_details',[id])).vehicles[0].color,'Gris')
 await assert.rejects(as('ana','manage_contact',['delete',id,'{}',null],['text','uuid','jsonb','uuid']),/principal|no disponible/)
 await as('daniel','manage_contact',['delete_vehicle',saved.vehicles[0].id,'{}',id],['text','uuid','jsonb','uuid'])
 await as('daniel','manage_contact',['delete',id,'{}',null],['text','uuid','jsonb','uuid'])
 const historical=await as('daniel','invitation_details',[visit])
 assert.equal(historical.contactId,null); assert.equal(historical.visitorName,input.name)
 assert.equal(historical.vehicle.plates,vehicle.plates); assert.equal(historical.vehicle.color,'')
})

test('vehículos de residencia: integridad del propietario, edición y eliminación autorizadas',async()=>{
 const input={plates:'TEST-249',brand:'Honda',model:'Civic',color:'Gris',active:true,ownerId:null}
 await as('daniel','manage_household',['create_vehicle',ids.residence24,null,JSON.stringify(input)],['text','uuid','uuid','jsonb'])
 const r=await as('daniel','residence_details',[ids.residence24]); const v=r.vehicles.find(v=>v.plates===input.plates)
 const foreign=(await db.query('select id from accesshome.inhabitants where residence_id=$1 limit 1',[house12])).rows[0].id
 await assert.rejects(as('daniel','manage_household',['update_vehicle',ids.residence24,v.id,JSON.stringify({...input,ownerId:foreign})],['text','uuid','uuid','jsonb']),/foreign key/)
 await as('daniel','manage_household',['update_vehicle',ids.residence24,v.id,JSON.stringify({...input,color:'Azul'})],['text','uuid','uuid','jsonb'])
 assert.equal((await as('daniel','residence_details',[ids.residence24])).vehicles.find(x=>x.id===v.id).color,'Azul')
 await as('daniel','manage_household',['delete_vehicle',ids.residence24,v.id,'{}'],['text','uuid','uuid','jsonb'])
 assert.ok(!(await as('daniel','residence_details',[ids.residence24])).vehicles.some(x=>x.id===v.id))
})

test('alta de invitación inválida revierte el contacto opcional y rechaza campos de autoridad',async()=>{
 const before=(await as('daniel','list_contacts',[''])).length
 await assert.rejects(as('daniel','create_invitation',[JSON.stringify(occasional({saveAsContact:true,vehicle:{plates:'!',brand:'',model:'',color:''}}))],['jsonb']),/check constraint/)
 assert.equal((await as('daniel','list_contacts',[''])).length,before)
 for(const injected of [{residenceId:house12},{inviterUserId:users.ana},{usedUses:0},{token:'a'.repeat(64)}]) {
  await assert.rejects(as('daniel','create_invitation',[JSON.stringify(occasional(injected))],['jsonb']),/Campos no permitidos/)
 }
 await assert.rejects(as('daniel','create_invitation',[JSON.stringify(occasional({validity:{kind:'custom',startsAt:'2020-01-01',expiresAt:'2020-01-02'}}))],['jsonb']),/futuro/)
})

test('asignación de principal auditada revoca inmediatamente la gestión anterior',async()=>{
 const r=await as('admin','residence_details',[ids.residence24])
 const m=r.inhabitants.find(i=>i.userId===users.mariana); const d=r.inhabitants.find(i=>i.userId===users.daniel)
 await assert.rejects(as('daniel','assign_principal',[ids.residence24,m.id]),/permiso/)
 await as('admin','assign_principal',[ids.residence24,m.id])
 await assert.rejects(as('daniel','create_invitation',[JSON.stringify(occasional())],['jsonb']),/principal/)
 assert.equal((await as('mariana','invitation_context')).canManage,true)
 await assert.rejects(as('daniel','list_contacts',['']),/Agenda privada/)
 await as('admin','assign_principal',[ids.residence24,d.id])
 assert.equal((await db.query('select count(*)::int as n from accesshome_private.principal_assignments')).rows[0].n,2)
})

test('metadata del JWT no cambia los roles y anonymous sign-in no recibe permisos',async()=>{
 await db.transaction(async tx=>{
  await tx.exec('set local role authenticated')
  await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:users.daniel,user_metadata:{role:'admin',residence_id:house12}})])
  assert.equal((await call(tx,'session_profile')).role,'resident')
 })
 await db.transaction(async tx=>{
  await tx.exec('set local role authenticated')
  await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:users.daniel,is_anonymous:true})])
  assert.equal(await call(tx,'session_profile'),null)
  assert.equal((await tx.query('select * from accesshome.residences')).rows.length,0)
 })
})

test('consulta pública limita intentos inválidos sin almacenar tokens o crear filas ilimitadas',async()=>{
 let last
 for(let n=0;n<242;n++) last=await as(null,'public_invitation',['invalid-rate-test',null])
 assert.ok(last.error)
 assert.ok((await db.query('select count(*)::int as n from accesshome_private.public_request_buckets')).rows[0].n<=256)
})
test('roles activos: perfil propio, guardia sin administración, sin perfil e inactivo sin permisos',async()=>{
 assert.equal((await as('daniel','session_profile')).name,'Daniel Cuevas')
 assert.equal((await as('guard','session_profile')).role,'guard')
 assert.equal(await as('inactive','session_profile'),null)
 assert.equal(await as('unassigned','session_profile'),null)
 for(const role of ['guard','inactive','unassigned']) await assert.rejects(as(role,'community_summary'),/permiso/)
 await assert.rejects(as('daniel','community_summary'),/permiso/)
})
test('semilla controlada: cuatro casas, habitantes, vehículos y contactos; repetir no sobrescribe',async()=>{
 const data=await as('admin','community_summary')
 assert.equal(data.residenceCount,4); assert.equal(data.residentCount,8); assert.equal(data.vehicleCount,5)
 const r=await as('daniel','residence_details',[null])
 assert.equal(r.residence.name,'Casa 24'); assert.equal(r.inhabitants.length,4)
 assert.equal(r.primaryResident.email,''); assert.equal(r.permissions.manageHousehold,true)
 assert.equal((await as('daniel','list_contacts',[''])).length,3)
 await assert.rejects(db.query("select accesshome_private.seed_demo($1::jsonb)",[JSON.stringify({admin:users.admin,daniel:users.daniel,ana:users.ana})]),/ya contiene datos/)
})
test('aislamiento de lectura por residencia y condominio, incluso con UUID conocido',async()=>{
 await assert.rejects(as('ana','residence_details',[ids.residence24]),/no disponible/)
 await assert.rejects(as('outsider','residence_details',[ids.residence24]),/no disponible/)
 const visible=await actor('daniel',tx=>tx.query('select * from accesshome.residences'))
 assert.equal(visible.rows.length,1)
 await assert.rejects(as('admin','contact_details',[contact]),/permiso/)
 await assert.rejects(as('ana','contact_details',[contact]),/no disponible/)
 await assert.rejects(as('mariana','list_contacts',['']),/Agenda privada/)
})
test('escrituras de casa desde principal; admin consulta; campos de autoridad rechazados',async()=>{
 const input={firstName:'Lucía',lastName:'Prueba',phone:'',email:'',relationship:'Visita familiar',active:true}
 await as('daniel','manage_household',['create_inhabitant',ids.residence24,null,JSON.stringify(input)],['text','uuid','uuid','jsonb'])
 const b=await as('daniel','residence_details',[ids.residence24])
 assert.ok(b.inhabitants.some(p=>p.firstName==='Lucía'))
 await assert.rejects(as('ana','manage_household',['create_inhabitant',ids.residence24,null,JSON.stringify(input)],['text','uuid','uuid','jsonb']),/principal/)
 await assert.rejects(as('admin','manage_household',['create_inhabitant',ids.residence24,null,JSON.stringify(input)],['text','uuid','uuid','jsonb']),/permiso/)
 await assert.rejects(as('daniel','manage_household',['create_inhabitant',ids.residence24,null,JSON.stringify({...input,userId:users.admin})],['text','uuid','uuid','jsonb']),/Campos no permitidos/)
})
test('invitación compartida: snapshot, token CSPRNG separado, consulta de otro cliente y cancelación',async()=>{
 const saved=await as('daniel','contact_details',[contact])
 const id=await as('daniel','create_invitation',[JSON.stringify({source:'contact',contactId:contact,vehicleChoice:{kind:'saved',vehicleId:saved.vehicles[0].id},validity:{kind:'24hours'}})],['jsonb'])
 const i=await as('daniel','invitation_details',[id])
 assert.match(i.token,/^[a-f0-9]{64}$/); assert.notEqual(id,i.token)
 assert.equal(i.maxUses,2); assert.equal(i.usedUses,0)
 assert.equal((await as(null,'public_invitation',[i.token,null])).visitorName,saved.name)
 await as('daniel','manage_contact',['update',contact,JSON.stringify({name:'Nombre cambiado',phone:'',email:'',notes:'',active:true}),null],['text','uuid','jsonb','uuid'])
 assert.equal((await as('daniel','invitation_details',[id])).visitorName,saved.name)
 await as('daniel','cancel_invitation',[id])
 assert.equal((await as('mariana','invitation_details',[id])).status,'cancelada')
 assert.equal((await as(null,'public_invitation',[i.token,null])).status,'cancelada')
 await assert.rejects(as('ana','invitation_details',[id]),/no disponible/)
 await assert.rejects(as('ana','cancel_invitation',[id]),/no disponible/)
 await assert.rejects(as('outsider','invitation_details',[id]),/no disponible/)
 const projection=await as(null,'public_invitation',[i.token,null])
 assert.deepEqual(Object.keys(projection).sort(),['token','visitorName','residenceName','condominiumName','startsAt','expiresAt','status','hasOpenEntry'].sort())
})
test('visitante público: solo consulta; vehicle rechazado sin modificar datos',async()=>{
 assert.equal(await as(null,'public_invitation',['invalid',null]),null)
 assert.equal(await as(null,'public_invitation',['a'.repeat(64),null]),null)
 const id=await as('daniel','create_invitation',[JSON.stringify(occasional())],['jsonb'])
 const i=await as('daniel','invitation_details',[id])
 const before=(await db.query('select to_jsonb(i) as data from accesshome.invitations i where id=$1',[id])).rows[0].data
 for(const user of [null,'daniel','admin','guard']) {
  for(const vehicle of [{plates:'ABC-123',brand:'',model:'',color:''},{},[],false,'anything']) {
   const result=await as(user,'public_invitation',[i.token,JSON.stringify(vehicle)],['text','jsonb'])
   assert.match(result.error,/solo lectura/)
   assert.deepEqual(Object.keys(result),['error'])
  }
 }
 const privateAttempt=await actor(null,tx=>tx.query('select accesshome_private.public_invitation($1,$2::jsonb) as data',[i.token,JSON.stringify({plates:'FORGED'})]))
 assert.match(privateAttempt.rows[0].data.error,/solo lectura/)
 const normal=await as(null,'public_invitation',[i.token,null])
 assert.deepEqual(await as(null,'public_invitation',[i.token]),normal)
 assert.deepEqual(await as(null,'public_invitation',[i.token,'null'],['text','jsonb']),normal)
 assert.equal('vehicle' in normal,false)
 assert.deepEqual((await db.query('select to_jsonb(i) as data from accesshome.invitations i where id=$1',[id])).rows[0].data,before)
})

test('consulta anónima usa estado actual en servidor: activa, cancelada, expirada y completada',async()=>{
 const condoName=(await db.query('select name from accesshome.condominiums where id=$1',[ids.condominiumId])).rows[0].name
 for(const state of ['activa','cancelada','expirada','completada']) {
  const id=await as('daniel','create_invitation',[JSON.stringify(occasional())],['jsonb'])
  const item=await as('daniel','invitation_details',[id])
  if(state==='cancelada') await as('daniel','cancel_invitation',[id])
  if(state==='expirada') await db.query("update accesshome.invitations set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[id])
  if(state==='completada') {
   await as('admin','validate_access',[item.token,randomUUID()]); await as('admin','validate_access',[item.token,randomUUID()])
  }
  await actor(null,async tx=>{
   const data=await call(tx,'public_invitation',[item.token,null])
   assert.equal(data.status,state)
   assert.equal(data.condominiumName,condoName)
   assert.deepEqual(Object.keys(data).sort(),['token','visitorName','residenceName','condominiumName','startsAt','expiresAt','status','hasOpenEntry'].sort())
   const headers=(await tx.query("select current_setting('response.headers') as value")).rows[0].value
   assert.deepEqual(JSON.parse(headers),[{'Cache-Control':'no-store'}])
  })
 }
})
test('acceso administrativo conserva atomicidad e idempotencia y rechaza residentes',async()=>{
 const id=await as('daniel','create_invitation',[JSON.stringify(occasional())],['jsonb'])
 const i=await as('daniel','invitation_details',[id]); const request=randomUUID()
 await assert.rejects(as('ana','validate_access',[i.token,request]),/permiso/)
 const entry=await as('admin','validate_access',[i.token,request])
 const duplicate=await as('admin','validate_access',[i.token,request])
 assert.equal(entry.authorized,true); assert.equal(entry.record.type,'entrada')
 assert.deepEqual(duplicate,{...entry,replayed:true})
 const exit=await as('admin','validate_access',[i.token,randomUUID()])
 assert.equal(exit.record.type,'salida'); assert.equal(exit.status,'completada')
 assert.equal((await as('admin','validate_access',[i.token,randomUUID()])).reason,'completed')
 assert.equal((await as('daniel','invitation_details',[id])).usedUses,2)
 assert.equal((await as('outsider','validate_access',[i.token,randomUUID()])).reason,'not_found')
})
test('reportes con privacidad por autor y avance administrativo controlado',async()=>{
 const id=await as('daniel','create_report',[JSON.stringify({title:'Lámpara',category:'Instalaciones',description:'Lámpara del acceso apagada'})],['jsonb'])
 await assert.rejects(as('mariana','report_details',[id]),/no disponible/)
 await assert.rejects(as('ana','report_details',[id]),/no disponible/)
 await assert.rejects(as('daniel','advance_report',[id,'en_proceso']),/permiso/)
 await assert.rejects(as('admin','advance_report',[id,'completado']),/solo puede avanzar/)
 await as('admin','advance_report',[id,'en_proceso']); await as('admin','advance_report',[id,'completado'])
 assert.equal((await as('daniel','report_details',[id])).status,'completado')
 assert.ok(Array.isArray((await as('admin','admin_dashboard')).recentAccess))
 assert.ok(Array.isArray((await as('daniel','resident_dashboard')).recentAccess))
})
test('casa inactiva permite consulta pero bloquea invitaciones y modificaciones',async()=>{
 await as('admin','manage_community',['update_residence',house12,JSON.stringify({number:'12',street:'Circuito Robles',active:false})],['text','uuid','jsonb'])
 assert.equal((await as('ana','residence_details',[house12])).permissions.manageHousehold,false)
 await assert.rejects(as('ana','create_invitation',[JSON.stringify(occasional())],['jsonb']),/principal/)
})

const instant = hours => new Date(Date.now() + hours * 3600000).toISOString()
const contactInvitation = (contactId, startsAt, expiresAt) => ({
 source:'contact',contactId,vehicleChoice:{kind:'none'},validity:{kind:'custom',startsAt,expiresAt},
})
const create = input => as('daniel','create_invitation',[JSON.stringify(input)],['jsonb'])
const newContact = (name='Contacto de superposición') => as('daniel','manage_contact',[
 'create',null,JSON.stringify({name,phone:'',email:'',notes:'',active:true}),null,
],['text','uuid','jsonb','uuid'])

test('superposición: rechaza igualdad, inclusión y cruces; permite periodos consecutivos',async()=>{
 const id=await newContact()
 const times=Array.from({length:7},(_,i)=>instant(24+i))
 await create(contactInvitation(id,times[2],times[4]))
 const before=(await db.query('select count(*)::int as n from accesshome_private.invitation_tokens')).rows[0].n
 for(const [start,end] of [[2,4],[1,5],[2,3],[3,5],[1,3]]) {
  await assert.rejects(create(contactInvitation(id,times[start],times[end])),error=>error.code==='P0001' && /superpuesta/.test(error.message))
 }
 assert.equal((await db.query('select count(*)::int as n from accesshome_private.invitation_tokens')).rows[0].n,before)
 await create(contactInvitation(id,times[0],times[2]))
 await create(contactInvitation(id,times[4],times[6]))
 assert.equal((await db.query('select count(*)::int as n from accesshome.invitations where contact_id=$1',[id])).rows[0].n,3)
})

test('canceladas, completadas y realmente expiradas permiten reutilizar el contacto',async()=>{
 for(const state of ['cancelada','completada','activa_expirada','expirada']) {
  const id=await newContact(state)
  const start=instant(-4), end=instant(4)
  const old=await create(contactInvitation(id,start,end))
  if(state==='cancelada') await as('daniel','cancel_invitation',[old])
  else if(state==='completada') {
   const invitation=await as('daniel','invitation_details',[old])
   await as('admin','validate_access',[invitation.token,randomUUID()])
   await as('admin','validate_access',[invitation.token,randomUUID()])
  } else {
   // Advance the fixture's end into the past without waiting for wall time.
   await db.query('update accesshome.invitations set status=$1,expires_at=$2 where id=$3',[
    state==='activa_expirada'?'activa':'expirada',instant(-1),old,
   ])
  }
  assert.notEqual(await create(contactInvitation(id,start,end)),old)
 }
})

test('duplicados se identifican por contacto y residencia, nunca solo por nombre',async()=>{
 const first=await newContact('Mismo nombre'), second=await newContact('Mismo nombre')
 const start=instant(48),end=instant(49)
 const historical=await create(contactInvitation(first,start,end))
 await create(contactInvitation(second,start,end))
 await create(occasional({visitorName:'Mismo nombre'}))
 await create(occasional({visitorName:'Mismo nombre'}))
 // A historical row in another house must not block this pair. Only the fixture
 // owner can establish this case; clients cannot move contacts or invitations.
 await db.query('update accesshome.invitations set residence_id=$1,inviter_user_id=$2 where id=$3',[house12,users.ana,historical])
 await create(contactInvitation(first,start,end))
 await assert.rejects(create(contactInvitation(first,start,end)),/superpuesta/)
})

test('interfaces invoker y adaptador legado conservan contratos y EXECUTE específico',async()=>{
 const signatures=['manage_community(text,uuid,jsonb)','assign_principal(uuid,uuid)',
  'manage_household(text,uuid,uuid,jsonb)','manage_contact(text,uuid,jsonb,uuid)',
  'invitation_details(uuid)','create_invitation(jsonb)','cancel_invitation(uuid)',
  'public_invitation(text,jsonb)','active_access_invitations()','validate_access(text,uuid)','validate_access(text,uuid,text)',
  'create_report(jsonb)','advance_report(uuid,text)']
 for(const signature of signatures) {
  const publicOid='accesshome.'+signature, privateOid='accesshome_private.'+signature
  const result=(await db.query(`select p.prosecdef as elevated,w.prosecdef as wrapper_elevated,
   p.proargnames is not distinct from w.proargnames as same_names,p.proargtypes=w.proargtypes as same_types,
   p.prorettype=w.prorettype as same_return,
   has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
   has_function_privilege('anon',p.oid,'EXECUTE') as anon
   from pg_proc p,pg_proc w where p.oid=$1::regprocedure and w.oid=$2::regprocedure`,[privateOid,publicOid])).rows[0]
  assert.deepEqual(result,{elevated:signature!=='validate_access(text,uuid)',wrapper_elevated:false,same_names:true,same_types:true,same_return:true,authenticated:true,anon:signature.startsWith('public_invitation(')})
 }
 for(const role of ['anon','authenticated','service_role']) {
  const privileges=(await db.query("select has_schema_privilege($1,'accesshome','CREATE') as exposed,has_schema_privilege($1,'accesshome_private','CREATE') as private",[role])).rows[0]
  assert.deepEqual(privileges,{exposed:false,private:false})
 }
 await assert.rejects(actor(null,tx=>tx.query("select accesshome_private.create_invitation('{}')")),/permission denied/)
 const invitationId=(await db.query('select id from accesshome.invitations where residence_id=$1 limit 1',[ids.residence24])).rows[0].id
 await assert.rejects(actor('ana',tx=>tx.query('select accesshome_private.invitation_details($1)',[invitationId])),/no disponible/)
})

test('implementaciones privadas no permiten saltarse autorización ni el límite público',async()=>{
 const calls=[
  "manage_community('condominium',null,'{}')",
  "assign_principal(null,null)","manage_household('create_inhabitant',null,null,'{}')",
  "manage_contact('create',null,'{}',null)","invitation_details(null)",
  "create_invitation('{}')","cancel_invitation(null)","active_access_invitations()",
  "validate_access('invalid',null)","create_report('{}')","advance_report(null,'en_proceso')",
 ]
 for(const role of ['guard','unassigned','inactive']) {
  for(const invocation of calls) {
   if(role==='guard' && invocation.startsWith('validate_access(')) continue // Now explicitly allowed; scanner suite verifies scope.
   await assert.rejects(actor(role,tx=>tx.query('select accesshome_private.'+invocation)),error=>error.code==='42501')
  }
 }
 await assert.rejects(actor('daniel',tx=>tx.query("select accesshome_private.manage_community('condominium',null,'{}')")),/permiso/)
 await assert.rejects(actor('admin',tx=>tx.query("select accesshome_private.create_invitation('{}')")),/permiso/)
 await assert.rejects(actor('daniel',tx=>tx.query('select accesshome_private.provision_resident($1,$2)',[users.unassigned,randomUUID()])),/permission denied/)
 await assert.rejects(actor(null,tx=>tx.query("select accesshome_private.public_request_allowed('invalid-rate-test')")),/permission denied/)
 const result=await actor(null,tx=>tx.query("select accesshome_private.public_invitation('invalid-rate-test',null) as value"))
 assert.match(result.rows[0].value.error,/Demasiadas/)
})

