import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

// B1: un guardia que el responsable desactivó con la función original, antes de
// 20261021000300, conserva ese bloqueo al aplicar la migración.
const MIGRATION = '20261021000300_admin_guard_management.sql'
const db = new PGlite({ extensions: { pgcrypto } })
const users = Object.fromEntries(['admin','daniel','ana','mariana','blocked','active','inactiveAdmin'].map(name => [name, randomUUID()]))
let seed, beforeProfiles
async function actor(name, fn) {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated')
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: users[name], is_anonymous: false })])
    return fn(tx)
  })
}
const call = (name, sql, args = []) => actor(name, async tx => (await tx.query(sql, args)).rows[0].data)
const profiles = async () => (await db.query('select * from accesshome.profiles order by user_id')).rows

before(async () => {
  await installSharedSchema(db, { before: MIGRATION.slice(0, 14) })
  for (const id of Object.values(users)) await db.query('insert into auth.users values($1)', [id])
  seed = (await db.query('select accesshome_private.seed_demo($1::jsonb) as s', [JSON.stringify({ admin: users.admin, daniel: users.daniel, ana: users.ana, mariana: users.mariana })])).rows[0].s
  for (const [name, label] of [['blocked','Guardia bloqueado'],['active','Guardia activo']]) {
    await db.query('select accesshome_private.provision_guard($1,$2,$3)', [users[name], seed.condominiumId, label])
  }
  // Función original de 20260917000600: solo desactiva (todavía no existe la tabla de bloqueos).
  await db.query('select accesshome_private.set_guard_active($1,$2,false)', [users.blocked, seed.condominiumId])
  assert.equal(await db.query("select to_regclass('accesshome_private.guard_owner_blocks') as t").then(r => r.rows[0].t), null)
  // Perfiles inactivos que no son guardias: no deben recibir bloqueo.
  await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role,active) values($1,$2,'Admin inactivo','admin',false)", [users.inactiveAdmin, seed.condominiumId])
  await db.query("update accesshome.inhabitants set active=false where user_id=$1", [users.mariana])
  await db.query("update accesshome.profiles set active=false where user_id=$1", [users.mariana])
  beforeProfiles = await profiles()
  await db.exec(await readFile('supabase/migrations/' + MIGRATION, 'utf8'))
})
after(() => db.close())

test('la migración convierte en bloqueo solo a los guardias ya inactivos, sin reactivar ni auditar', async () => {
  const blocks = (await db.query('select guard_user_id,condominium_id from accesshome_private.guard_owner_blocks')).rows
  assert.deepEqual(blocks, [{ guard_user_id: users.blocked, condominium_id: seed.condominiumId }])
  assert.deepEqual(await profiles(), beforeProfiles)
  assert.equal((await db.query('select count(*)::int as n from accesshome_private.guard_status_changes')).rows[0].n, 0)
})

test('el administrador no puede reactivar al guardia bloqueado antes de la migración', async () => {
  const snapshot = await profiles()
  await assert.rejects(call('admin', 'select accesshome.set_guard_status($1,true) as data', [users.blocked]), /responsable del sistema/)
  assert.deepEqual(await profiles(), snapshot)
  await assert.rejects(call('blocked', 'select accesshome.guard_dashboard() as data'), /Solo un guardia/)
  await assert.rejects(db.query("update accesshome.profiles set role='admin', active=true where user_id=$1", [users.blocked]), /rol guard/)
  assert.deepEqual(await profiles(), snapshot)
  // El guardia que seguía activo no quedó bloqueado: el admin lo gestiona con normalidad.
  assert.equal((await call('admin', 'select accesshome.set_guard_status($1,false) as data', [users.active])).changed, true)
  assert.equal((await call('admin', 'select accesshome.set_guard_status($1,true) as data', [users.active])).changed, true)
})

test('solo el responsable retira el bloqueo preservado', async () => {
  await db.query('select accesshome_private.set_guard_active($1,$2,true)', [users.blocked, seed.condominiumId])
  assert.equal((await call('blocked', 'select accesshome.guard_dashboard() as data')).guardName, 'Guardia bloqueado')
  const log = (await db.query('select source,enabled,owner_blocked from accesshome_private.guard_status_changes where guard_user_id=$1', [users.blocked])).rows
  assert.deepEqual(log, [{ source: 'owner', enabled: true, owner_blocked: false }])
})
