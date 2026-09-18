import assert from 'node:assert/strict'
import { test } from 'node:test'
import { invitationUrl, invitationPath, invitationWhatsAppUrl, invitationShareText } from '../.test-build/utils/invitationLinks.js'
import { copyInvitationLink, shareInvitationLink } from '../.test-build/services/invitationSharingService.js'

// Reserved fixture domain only; never a configured deployment.
const url=invitationUrl('a'.repeat(64),'https://acceso.example',true)
test('enlace y QR utilizan origen recibido y token codificado sin arrastrar ruta/query/hash',()=>{
  assert.equal(url,'https://acceso.example/invitacion/'+'a'.repeat(64))
  assert.equal(invitationUrl('local/token ?','http://localhost:5174/otra?x=y#hash'), 'http://localhost:5174'+invitationPath('local/token ?'))
  assert.throws(()=>invitationUrl('','https://acceso.example'),/enlace disponible/)
})
test('modo de despliegue rechaza localhost, LAN, IP, protocolos inseguros y credenciales incrustadas',()=>{
  for(const origin of ['http://acceso.example','https://localhost','https://app.localhost','https://192.168.1.2','https://10.0.0.2','https://127.1','https://2130706433','https://[::1]','https://app.local','https://user:pass@acceso.example','javascript:alert(1)']) {
    assert.throws(()=>invitationUrl('test',origin,true),/dominio público/)
  }
})
test('WhatsApp contiene únicamente mensaje breve y URL codificados; no inicia ninguna petición',()=>{
  const target=new URL(invitationWhatsAppUrl(url))
  assert.equal(target.origin,'https://wa.me')
  assert.equal(target.searchParams.get('text'),invitationShareText+'\n'+url)
  assert.deepEqual([...target.searchParams.keys()],['text'])
})
test('Web Share se invoca una vez con enlace correcto y conserva receptor',async()=>{
  let calls=0
  const api={share:async function(data){assert.equal(this,api);assert.equal(data.url,url);calls++},canShare:()=>true}
  assert.equal(await shareInvitationLink(url,api),'shared'); assert.equal(calls,1)
})
test('sin Web Share o con datos no soportados copia el enlace por acción del usuario',async()=>{
  for(const supported of [undefined,false]) {
    let copied=''
    const api={clipboard:{writeText:async value=>{copied=value}}}
    if(supported===false) {api.canShare=()=>false;api.share=()=>assert.fail('No compartir datos no soportados')}
    assert.equal(await shareInvitationLink(url,api),'copied'); assert.equal(copied,url)
  }
})
test('cancelar Web Share no copia ni envía nada; un error no devuelve token en su mensaje',async()=>{
  const api={share:async()=>{throw {name:'AbortError'}},clipboard:{writeText:()=>assert.fail('Cancelado')}}
  assert.equal(await shareInvitationLink(url,api),'cancelled')
  api.share=async()=>{throw new Error(url)}
  await assert.rejects(shareInvitationLink(url,api),error=>!error.message.includes(url)&&/Copiar enlace/.test(error.message))
  api.canShare=()=>{throw new Error(url)}
  await assert.rejects(shareInvitationLink(url,api),error=>!error.message.includes(url)&&/Copiar enlace/.test(error.message))
})
test('portapapeles ausente o denegado devuelve copia manual; no anuncia éxito falso',async()=>{
  assert.equal(await copyInvitationLink(url,{}),'manual')
  assert.equal(await copyInvitationLink(url,{clipboard:{writeText:async()=>{throw new Error('denied')}}}),'manual')
})
