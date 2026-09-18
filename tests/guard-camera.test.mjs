import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeQR } from 'qr'
import { decodeQR } from 'qr/decode.js'
import { QrCamera } from '../.test-build/services/qrCamera.js'
import { GuardScanSession, accessTokenFromCode } from '../.test-build/services/guardScanSession.js'

const token='a'.repeat(64), url='https://acceso.example/invitacion/'+token
const allowed={authorized:true,record:{id:'entry'},usedUses:1,maxUses:2,status:'activa'}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
function fixture(overrides={}) {
  let opened=0,stopped=0,scheduled
  const stream={getTracks:()=>[{stop:()=>stopped++,addEventListener(){},removeEventListener(){}}]}
  const video={srcObject:null,pause(){},async play(){},videoWidth:960,videoHeight:720,readyState:2}
  const canvas={getContext:()=>({drawImage(){},getImageData:()=>({})})}
  const runtime={open:async()=>{opened++;return stream},decoder:async()=>()=>url,canvas:()=>canvas,
    schedule:fn=>{scheduled=fn;return 1},cancel:()=>{scheduled=undefined},...overrides}
  const values=[],errors=[]
  const camera=new QrCamera(video,value=>values.push(value),error=>errors.push(error),runtime)
  return {camera,video,stream,values,errors,frame:()=>scheduled?.(),opened:()=>opened,stopped:()=>stopped}
}
test('lector QR real decodifica imagen y extrae token; nunca navega URLs arbitrarias',()=>{
  const raw=encodeQR(url,'raw',{border:4,scale:5})
  const width=raw.length,data=new Uint8ClampedArray(width*width*4)
  for(let y=0;y<width;y++) for(let x=0;x<width;x++) {
    const n=(y*width+x)*4
    data[n]=data[n+1]=data[n+2]=raw[y][x]?0:255;data[n+3]=255
  }
  assert.equal(decodeQR({width,height:width,data}),url)
  assert.equal(accessTokenFromCode(url),token);assert.equal(accessTokenFromCode(' '+token+' '),token)
  for(const bad of ['javascript:alert(1)','https://acceso.example/otro/'+token,url+'?tracking=1',url+'#x','https://user:pass@acceso.example/invitacion/'+token,'not-a-token']) assert.throws(()=>accessTokenFromCode(bad),/Código no válido/)
})
test('sesión bloquea frames simultáneos, resultado y siguiente antes de terminar',async()=>{
  const response=deferred();let calls=0
  const session=new GuardScanSession(async()=>{calls++;return response.promise})
  const first=session.scan(url,'QR')
  assert.equal(session.phase,'pending');assert.equal(session.next(),false)
  assert.equal(await session.scan(url,'QR'),null);assert.equal(calls,1)
  response.resolve(allowed);assert.deepEqual(await first,allowed)
  assert.equal(await session.scan(url,'QR'),null);assert.equal(calls,1)
  assert.equal(session.next(),true);await session.scan(token,'MANUAL');assert.equal(calls,2)
})
test('respuesta incierta bloquea siguiente y conserva token/método para reintentar',async()=>{
  const attempts=[]
  const session=new GuardScanSession(async(...args)=>{attempts.push(args);if(attempts.length===1) throw Error(url);return allowed})
  await assert.rejects(session.scan(token,'MANUAL'),error=>!error.message.includes(token)&&/podría haberse registrado/.test(error.message))
  assert.equal(session.phase,'uncertain');assert.equal(session.next(),false)
  assert.equal(await session.scan(token,'QR'),null)
  await session.retry();assert.deepEqual(attempts,[[token,'MANUAL'],[token,'MANUAL']])
  assert.equal(session.next(),true)
})
test('código inválido no consulta backend y permite siguiente',async()=>{
  const session=new GuardScanSession(()=>assert.fail('No enviar basura al RPC'))
  await assert.rejects(session.scan('bad','MANUAL'),/Código no válido/)
  assert.equal(session.phase,'done');assert.equal(session.next(),true)
})
test('cámara no pide permisos al construir; primera lectura detiene stream y no duplica',async()=>{
  const f=fixture();assert.equal(f.opened(),0)
  assert.equal(await f.camera.start(),true);assert.equal(f.opened(),1)
  f.frame();f.frame();assert.deepEqual(f.values,[url]);assert.equal(f.stopped(),1)
  assert.equal(f.video.srcObject,null)
})
test('detener/salir mientras permiso está pendiente cierra el stream que llega tarde',async()=>{
  const pending=deferred();let requested=false
  const f=fixture({open:()=>{requested=true;return pending.promise}})
  const start=f.camera.start();await Promise.resolve();assert.equal(requested,true)
  f.camera.stop();pending.resolve(f.stream)
  assert.equal(await start,false);assert.equal(f.stopped(),1);assert.equal(f.video.srcObject,null)
  assert.deepEqual(f.values,[])
})
test('permiso denegado y ausencia de cámara ofrecen manual sin arrojar detalles sensibles',async()=>{
  for(const name of ['NotAllowedError','NotFoundError']) {
    const f=fixture({open:async()=>{throw {name,message:url}}})
    assert.equal(await f.camera.start(),false)
    assert.match(f.errors[0],/manual/);assert.ok(!f.errors[0].includes(token))
    assert.equal(f.video.srcObject,null)
  }
})
test('fallo de reproducción o canvas y desmontaje liberan todos los tracks',async()=>{
  const f=fixture();f.video.play=async()=>{throw Error('play failed')}
  assert.equal(await f.camera.start(),false);assert.equal(f.stopped(),1)
  const g=fixture({canvas:()=>({getContext:()=>({drawImage(){throw Error('frame')},getImageData(){}})})})
  await g.camera.start();g.frame();assert.equal(g.stopped(),1);assert.equal(g.errors.length,1)
  const h=fixture();await h.camera.start();h.camera.stop();h.frame()
  assert.equal(h.stopped(),1);assert.deepEqual(h.values,[])
})
