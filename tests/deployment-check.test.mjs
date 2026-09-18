import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { checkDist, containsPrivilegedSecret } from '../scripts/check-dist.mjs'

test('inspección del artefacto detecta secretos conocidos sin confundir publishable o mensajes del SDK',()=>{
  assert.equal(containsPrivilegedSecret('sb_publishable_fixture_only; service_role; sb_secret_'),false)
  assert.equal(containsPrivilegedSecret('sb_secret_'+'a'.repeat(24)),true)
  assert.equal(containsPrivilegedSecret('-----BEGIN PRIVATE KEY-----'),true)
  assert.equal(containsPrivilegedSecret('postgresql://fixture:fixture@localhost/test'),true)
  const jwt=role=>[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({role})).toString('base64url'),'fixture'].join('.')
  assert.equal(containsPrivilegedSecret(jwt('anon')),false)
  assert.equal(containsPrivilegedSecret(jwt('service_role')),true)
})

test('build compartido falla sin configuración o con secretos; demo y metadatos Vercel quedan separados',async()=>{
  const root=await mkdtemp(join(tmpdir(),'accesshome-config-'))
  const previousCwd=process.cwd()
  const previousEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>name.startsWith('VITE_')))
  const configPath=fileURLToPath(new URL('../vite.config.ts',import.meta.url))
  const load=mode=>loadConfigFromFile({mode,command:'build'},configPath,undefined,'silent')
  try {
    // An empty temporary cwd prevents reading the user's .env.local.
    process.chdir(root)
    for(const name of Object.keys(previousEnv)) delete process.env[name]
    await assert.rejects(load('shared'),/dos variables públicas/)
    assert.ok(await load('production'))
    process.env.VITE_SUPABASE_URL='https://supabase.example'
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_secret_'+'a'.repeat(24)
    await assert.rejects(load('shared'),/solo admite una clave/)
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture_only'
    process.env.VITE_SUPABASE_URL='http://localhost:54321'
    await assert.rejects(load('shared'),/URL HTTPS/)
    process.env.VITE_SUPABASE_URL='https://supabase.example'
    process.env.VITE_ADMIN_KEY='fixture-only'
    await assert.rejects(load('shared'),/dos variables VITE/)
    delete process.env.VITE_ADMIN_KEY
    process.env.VITE_VERCEL_ENV='preview'
    const result=await load('shared')
    assert.deepEqual(result.config.envPrefix,['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'])
  } finally {
    process.chdir(previousCwd)
    for(const name of Object.keys(process.env)) if(name.startsWith('VITE_')) delete process.env[name]
    Object.assign(process.env,previousEnv)
    await rm(root,{recursive:true,force:true})
  }
})

test('inspección recorre dist y detecta archivos privados; no devuelve su contenido',async()=>{
  const root=await mkdtemp(join(tmpdir(),'accesshome-artifact-'))
  try {
    await mkdir(join(root,'assets'))
    await writeFile(join(root,'index.html'),'<div id="root"></div>')
    await writeFile(join(root,'assets','app.js'),'sb_publishable_fixture_only')
    assert.deepEqual(await checkDist(root),[])
    await writeFile(join(root,'assets','unsafe.js'),'sb_secret_'+'a'.repeat(24))
    await writeFile(join(root,'.env.local'),'fixture only')
    assert.deepEqual((await checkDist(root)).sort(),['.env.local',join('assets','unsafe.js')].sort())
  } finally { await rm(root,{recursive:true,force:true}) }
})
