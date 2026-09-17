// Browser-only fixture. Real SQL/RLS is tested by guard-backend.test.mjs.
// Loopback, isolated port, no .env edits or remote requests. No real Auth credentials.
import { createServer } from 'vite'
import { randomUUID } from 'node:crypto'

process.env.VITE_SUPABASE_URL='http://127.0.0.1:5175'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture_only'
const profile={id:randomUUID(),name:'Claudia Seguridad',role:'guard',condominiumId:randomUUID(),residenceId:null}
const token=randomUUID()
let signedIn=false
const entry={id:randomUUID(),visitorName:'Carlos López',residenceName:'Casa 24',type:'entrada',method:'QR',occurredAt:new Date().toISOString(),vehicle:{plates:'ABC-123'}}
const departure={...entry,id:randomUUID(),visitorName:'Elena Martínez',residenceName:'Casa 12',type:'salida',vehicle:null}
const server=await createServer({server:{host:'127.0.0.1',port:5175,strictPort:true},plugins:[{
 name:'guard-browser-fixture',
 configureServer(server) {
  server.middlewares.use(async(req,res,next)=>{
   const path=req.url?.split('?')[0]
   if(!path?.startsWith('/auth/v1/') && !path?.startsWith('/rest/v1/')) return next()
   res.setHeader('Content-Type','application/json')
   const reply=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data))}
   try {
    let raw=''; for await(const chunk of req) raw+=chunk
    const body=raw?JSON.parse(raw):{}
    if(path==='/auth/v1/token') {
     if(body.email!=='guard@fixture.invalid'||!body.password) return reply({error:'invalid_grant'},400)
     signedIn=true
     return reply({access_token:token,refresh_token:randomUUID(),token_type:'bearer',expires_in:3600,user:{id:profile.id,email:body.email}})
    }
    if(path==='/auth/v1/logout') {signedIn=false;return reply({})}
    if(!signedIn||req.headers.authorization!=='Bearer '+token) return reply({code:'42501',message:'Sesión de fixture requerida'},403)
    if(path.endsWith('/session_profile')) return reply(profile)
    if(path.endsWith('/guard_dashboard')) return reply({guardName:profile.name,condominiumName:'Los Robles · Prueba local',timeZone:'America/Mexico_City',serverTime:new Date().toISOString(),todayAccessCount:2,recentEntries:[entry],recentExits:[departure],pendingExitCount:1,pendingExits:[entry]})
    if(path.endsWith('/guard_history')) return reply({timeZone:'America/Mexico_City',from:new Date().toISOString(),to:new Date().toISOString(),hasMore:false,records:[entry,departure].filter(r=>!body.movement||r.type===body.movement)})
    return reply({code:'42501',message:'Operación no autorizada para guardia'},403)
   } catch {return reply({message:'Fixture request failed'},400)}
  })
 },
}]})
await server.listen()
console.log('UI fixture aislado: http://127.0.0.1:5175 · guard@fixture.invalid · cualquier texto efímero no vacío en contraseña. No es Supabase Auth.')
async function stop(){await server.close();process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
