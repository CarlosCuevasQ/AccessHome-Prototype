// Isolated UI/API fixture: real disposable PGlite SQL, simulated Auth only.
// Never loads remote connections or logs tokens, bodies or passwords.
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './shared-sql-fixture.mjs'

process.env.VITE_SUPABASE_URL='http://127.0.0.1:5176'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture_only'
const db=new PGlite({extensions:{pgcrypto}})
await installSharedSchema(db)
const users={admin:randomUUID(),daniel:randomUUID(),ana:randomUUID()}
for(const id of Object.values(users)) await db.query('insert into auth.users values($1)',[id])
const seed=(await db.query('select accesshome_private.seed_demo($1) as data',[JSON.stringify(users)])).rows[0].data
users.guard=randomUUID()
await db.query('insert into auth.users values($1)',[users.guard])
await db.query('select accesshome_private.provision_guard($1,$2,$3)',[users.guard,seed.condominiumId,'Claudia Seguridad'])
const accounts={'resident@fixture.invalid':users.daniel,'guard@fixture.invalid':users.guard,'admin@fixture.invalid':users.admin}
const sessions=new Map()
const queries={
 session_profile:()=>['select accesshome.session_profile() as data',[]],
 resident_dashboard:()=>['select accesshome.resident_dashboard() as data',[]],
 admin_dashboard:()=>['select accesshome.admin_dashboard() as data',[]],
 community_summary:()=>['select accesshome.community_summary() as data',[]],
 history_context:()=>['select accesshome.history_context() as data',[]],
 list_access:b=>['select accesshome.list_access($1::jsonb) as data',[JSON.stringify(b.filters??{})]],
 guard_dashboard:()=>['select accesshome.guard_dashboard() as data',[]],
 guard_history:b=>['select accesshome.guard_history($1,$2) as data',[b.movement??'',b.page??0]],
 validate_access:b=>['select accesshome.validate_access($1,$2,$3) as data',[b.token,b.request_id,b.scan_method??'QR']],
 contact_access:()=>['select accesshome.contact_access() as data',[]],
 invitation_context:()=>['select accesshome.invitation_context() as data',[]],
 create_invitation:b=>['select accesshome.create_invitation($1::jsonb) as data',[JSON.stringify(b.input)]],
 invitation_details:b=>['select accesshome.invitation_details($1) as data',[b.target]],
 cancel_invitation:b=>['select accesshome.cancel_invitation($1) as data',[b.target]],
 list_invitations:b=>['select accesshome.list_invitations($1,$2) as data',[b.search??'',b.status_filter??'todas']],
 public_invitation:b=>['select accesshome.public_invitation($1,null) as data',[b.token]],
}
const server=await createServer({server:{host:'127.0.0.1',port:5176,strictPort:true},plugins:[{
 name:'invitation-sql-fixture',
 configureServer(server) {
  server.middlewares.use(async(req,res,next)=>{
   const path=req.url?.split('?')[0]
   if(!path?.startsWith('/auth/v1/')&&!path?.startsWith('/rest/v1/')) return next()
   const origin=req.headers.origin
   if(origin&&['http://127.0.0.1:5176','http://localhost:5176'].includes(origin)) res.setHeader('Access-Control-Allow-Origin',origin)
   res.setHeader('Access-Control-Allow-Headers','apikey,authorization,content-type,content-profile,x-client-info')
   res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS')
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
   if(req.method==='OPTIONS'){res.statusCode=204;res.end();return}
   const reply=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data))}
   try {
    let raw='';for await(const chunk of req) raw+=chunk
    const body=raw?JSON.parse(raw):{}
    if(path==='/auth/v1/token') {
     if(!Object.hasOwn(accounts,body.email)||!body.password) return reply({error:'invalid_grant'},400)
     const token=randomUUID();sessions.set(token,accounts[body.email])
     return reply({access_token:token,refresh_token:randomUUID(),token_type:'bearer',expires_in:3600,user:{id:accounts[body.email],email:body.email}})
    }
    const bearer=req.headers.authorization?.replace(/^Bearer /,'')
    if(path==='/auth/v1/logout'){sessions.delete(bearer);return reply({})}
    const query=queries[path.split('/').at(-1)]
    if(!query) return reply({message:'Fixture route not supported'},404)
    const user=sessions.get(bearer)??null
    const data=await db.transaction(async tx=>{
     await tx.exec('set local role '+(user?'authenticated':'anon'))
     await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,is_anonymous:false})])
     const [sql,args]=query(body)
     return (await tx.query(sql,args)).rows[0].data
    })
    reply(data)
   } catch {reply({message:'La operación del fixture fue rechazada.'},400)}
  })
 },
}]})
await server.listen()
console.log('Fixture SQL local: http://127.0.0.1:5176 · resident@fixture.invalid, guard@fixture.invalid, admin@fixture.invalid · texto efímero no vacío en contraseña (Auth simulado).')
async function stop(){await server.close();await db.close();process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
