import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

// Administración de guardias por el admin de su condominio: list_guards y
// set_guard_status. Dos condominios con guardias propios; un admin inactivo.
const db = new PGlite({ extensions: { pgcrypto } })
const users = Object.fromEntries(['admin','daniel','ana','guard','guard2','adminB','guardB','inactiveAdmin'].map(name => [name, randomUUID()]))
let seed, condoB
async function actor(name, fn, metadata = {}) {
  return db.transaction(async tx => {
    await tx.exec('set local role ' + (name ? 'authenticated' : 'anon'))
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: name ? users[name] : null, is_anonymous: false, ...metadata })])
    return fn(tx)
  })
}
const call = (name, sql, args = [], metadata) => actor(name, async tx => (await tx.query(sql, args)).rows[0].data, metadata)
const listGuards = (name, metadata) => call(name, 'select accesshome.list_guards() as data', [], metadata)
const setStatus = (name, guardId, enabled, metadata) => call(name, 'select accesshome.set_guard_status($1,$2) as data', [guardId, enabled], metadata)
const profiles = async () => (await db.query('select * from accesshome.profiles order by user_id')).rows
const changes = async () => (await db.query('select * from accesshome_private.guard_status_changes order by changed_at,id')).rows
const state = async () => ({ profiles: await profiles(), changes: await changes() })
const active = async id => (await db.query('select active from accesshome.profiles where user_id=$1', [id])).rows[0].active

before(async () => {
  await installSharedSchema(db)
  for (const id of Object.values(users)) await db.query('insert into auth.users values($1)', [id])
  seed = (await db.query('select accesshome_private.seed_demo($1::jsonb) as s', [JSON.stringify({ admin: users.admin, daniel: users.daniel, ana: users.ana })])).rows[0].s
  await db.query('select accesshome_private.provision_guard($1,$2,$3)', [users.guard, seed.condominiumId, 'Beatriz Caseta'])
  await db.query('select accesshome_private.provision_guard($1,$2,$3)', [users.guard2, seed.condominiumId, 'Arturo Caseta'])
  condoB = (await db.query("insert into accesshome.condominiums(name) values('Condominio B') returning id")).rows[0].id
  await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role) values($1,$2,'Admin B','admin')", [users.adminB, condoB])
  await db.query('select accesshome_private.provision_guard($1,$2,$3)', [users.guardB, condoB, 'Guardia B'])
  await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role,active) values($1,$2,'Admin inactivo','admin',false)", [users.inactiveAdmin, seed.condominiumId])
})
after(() => db.close())

test('list_guards: el admin ve solo los guardias de su condominio, con datos mínimos', async () => {
  const listA = await listGuards('admin')
  assert.deepEqual(listA.map(g => g.name), ['Arturo Caseta', 'Beatriz Caseta'])
  assert.deepEqual(listA.map(g => g.id).sort(), [users.guard, users.guard2].sort())
  for (const guard of listA) {
    assert.deepEqual(Object.keys(guard).sort(), ['active', 'createdAt', 'id', 'name'])
    assert.equal(guard.active, true)
  }
  const listB = await listGuards('adminB')
  assert.deepEqual(listB.map(g => g.id), [users.guardB])
})

test('list_guards rechaza residente, guardia, anónimo, admin inactivo y metadata falsificada', async () => {
  for (const name of ['daniel', 'guard', 'inactiveAdmin']) await assert.rejects(listGuards(name), /permiso/, name)
  await assert.rejects(listGuards(null), /permission denied/)
  await assert.rejects(listGuards('daniel', { user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' } }), /permiso/)
  await assert.rejects(listGuards('admin', { is_anonymous: true }), /permiso/)
})

test('desactivar corta el acceso del guardia con su misma sesión; repetir es idempotente; reactivar lo restaura', async () => {
  assert.equal((await call('guard', 'select accesshome.guard_dashboard() as data')).guardName, 'Beatriz Caseta')
  const before = await profiles()
  const off = await setStatus('admin', users.guard, false)
  assert.deepEqual(off, { id: users.guard, name: 'Beatriz Caseta', active: false, changed: true })
  // Mismas claims JWT que antes: la revocación se aplica en la siguiente llamada.
  assert.equal(await call('guard', 'select accesshome.session_profile() as data'), null)
  await assert.rejects(call('guard', 'select accesshome.guard_dashboard() as data'), /Solo un guardia/)
  await assert.rejects(call('guard', 'select accesshome.guard_open_visits(0) as data'), /Solo un guardia/)
  await assert.rejects(call('guard', 'select accesshome.validate_access($1,$2,$3) as data', ['a'.repeat(64), randomUUID(), 'QR']), /permiso/)
  await assert.rejects(call('guard', 'select accesshome.list_services() as data'), /permiso/)
  // Solo cambió active del guardia; rol, condominio y residencia intactos.
  const after = await profiles()
  assert.deepEqual(after.map(p => ({ ...p, active: p.user_id === users.guard ? true : p.active })), before)
  const log = await changes()
  assert.equal(log.length, 1)
  assert.equal(log[0].guard_user_id, users.guard); assert.equal(log[0].condominium_id, seed.condominiumId)
  assert.equal(log[0].enabled, false); assert.equal(log[0].changed_by, users.admin)
  // Repetir no cambia filas ni audita de nuevo.
  const snapshot = await state()
  assert.deepEqual(await setStatus('admin', users.guard, false), { ...off, changed: false })
  assert.deepEqual(await state(), snapshot)
  assert.equal((await listGuards('admin')).find(g => g.id === users.guard).active, false)
  // Reactivar devuelve el acceso; repetir tampoco audita.
  assert.deepEqual(await setStatus('admin', users.guard, true), { ...off, active: true, changed: true })
  assert.equal((await call('guard', 'select accesshome.session_profile() as data')).role, 'guard')
  assert.equal((await call('guard', 'select accesshome.guard_dashboard() as data')).guardName, 'Beatriz Caseta')
  const reactivated = await state()
  assert.equal((await setStatus('admin', users.guard, true)).changed, false)
  assert.deepEqual(await state(), reactivated)
  assert.deepEqual((await changes()).map(c => c.enabled), [false, true])
})

test('identificadores ajenos, inexistentes o que no son guardias se rechazan igual y sin cambios', async () => {
  const snapshot = await state()
  const targets = [users.guardB, users.daniel, users.admin, users.adminB, users.inactiveAdmin, randomUUID()]
  for (const target of targets) await assert.rejects(setStatus('admin', target, false), error => error.code === '42501' && /Guardia no disponible/.test(error.message), target)
  await assert.rejects(setStatus('adminB', users.guard, false), /Guardia no disponible/)
  for (const [guardId, enabled] of [[null, false], [users.guard, null]]) await assert.rejects(setStatus('admin', guardId, enabled), error => error.code === '22023')
  assert.deepEqual(await state(), snapshot)
})

test('set_guard_status rechaza residente, guardia, anónimo, admin inactivo y metadata falsificada sin cambios', async () => {
  const snapshot = await state()
  for (const name of ['daniel', 'guard', 'guard2', 'guardB', 'inactiveAdmin']) await assert.rejects(setStatus(name, users.guard, false), /permiso/, name)
  await assert.rejects(setStatus(null, users.guard, false), /permission denied/)
  await assert.rejects(setStatus('daniel', users.guard, false, { user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' } }), /permiso/)
  await assert.rejects(setStatus('admin', users.guard, false, { is_anonymous: true }), /permiso/)
  // La implementación privada tampoco permite saltarse la autorización.
  await assert.rejects(call('daniel', 'select accesshome_private.set_guard_status($1,$2) as data', [users.guard, false]), /permiso/)
  await assert.rejects(call(null, 'select accesshome_private.set_guard_status($1,$2) as data', [users.guard, false]), /permission denied/)
  assert.deepEqual(await state(), snapshot)
})

test('la bitácora privada no es legible ni escribible por clientes', async () => {
  for (const name of ['admin', 'guard', 'daniel', null]) {
    await assert.rejects(actor(name, tx => tx.query('select * from accesshome_private.guard_status_changes')), /permission denied/)
    await assert.rejects(actor(name, tx => tx.query('insert into accesshome_private.guard_status_changes(guard_user_id,condominium_id,enabled,changed_by) values($1,$2,false,$3)', [users.guard, seed.condominiumId, users.admin])), /permission denied/)
  }
})

test('compatibilidad: tras desactivar y reactivar, el guardia escanea entrada y salida y el aislamiento se mantiene', async () => {
  await setStatus('admin', users.guard2, false)
  await setStatus('admin', users.guard2, true)
  const id = await call('daniel', 'select accesshome.create_invitation($1::jsonb) as data', [JSON.stringify({ source: 'occasional', visitorName: 'Visita tras reactivar', phone: '', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } })])
  const { token } = await call('daniel', 'select accesshome.invitation_details($1) as data', [id])
  assert.equal((await call('guard2', 'select accesshome.validate_access($1,$2,$3) as data', [token, randomUUID(), 'QR'])).record.type, 'entrada')
  await db.query("update accesshome.access_records set occurred_at=clock_timestamp()-interval '4 seconds' where invitation_id=$1", [id])
  assert.equal((await call('guard2', 'select accesshome.validate_access($1,$2,$3) as data', [token, randomUUID(), 'QR'])).record.type, 'salida')
  assert.equal((await call('guardB', 'select accesshome.validate_access($1,$2,$3) as data', [token, randomUUID(), 'QR'])).reason, 'not_found')
  assert.equal(await active(users.guardB), true)
  assert.equal((await call(null, 'select accesshome.backend_health() as data')).guardManagementVersion, 1)
})

// Bloqueo del responsable del sistema (set_guard_active, solo propietario): prevalece sobre el admin.
const ownerSet = (guardId, enabled) => db.query('select accesshome_private.set_guard_active($1,$2,$3)', [guardId, seed.condominiumId, enabled])
const blocks = async () => (await db.query('select guard_user_id from accesshome_private.guard_owner_blocks order by guard_user_id')).rows.map(r => r.guard_user_id)
const fullState = async () => ({ ...(await state()), blocks: await blocks() })

test('bloqueo del responsable: el admin no puede reactivar y el intento no cambia estado, bloqueo ni bitácora', async () => {
  await ownerSet(users.guard, false)
  assert.deepEqual(await blocks(), [users.guard])
  assert.equal(await active(users.guard), false)
  await assert.rejects(call('guard', 'select accesshome.guard_dashboard() as data'), /Solo un guardia/)
  const snapshot = await fullState()
  await assert.rejects(setStatus('admin', users.guard, true), error => error.code === 'P0001' && /responsable del sistema/.test(error.message))
  assert.deepEqual(await fullState(), snapshot)
  // Desactivar un guardia ya bloqueado es idempotente y no audita.
  assert.equal((await setStatus('admin', users.guard, false)).changed, false)
  assert.deepEqual(await fullState(), snapshot)
  // Una escritura directa del propietario no pasa por las funciones auditadas: se rechaza.
  await assert.rejects(db.query('update accesshome.profiles set active=true where user_id=$1', [users.guard]), /set_guard_active o set_guard_status/)
  assert.deepEqual(await fullState(), snapshot)
})

test('solo el responsable retira su bloqueo; después el admin gestiona al guardia con normalidad', async () => {
  const before = (await changes()).length
  await ownerSet(users.guard, true)
  assert.deepEqual(await blocks(), [])
  assert.equal(await active(users.guard), true)
  assert.equal((await call('guard', 'select accesshome.guard_dashboard() as data')).guardName, 'Beatriz Caseta')
  // Repetir la retirada no audita.
  await ownerSet(users.guard, true)
  const log = (await changes()).slice(before)
  assert.deepEqual(log.map(c => [c.source, c.enabled, c.owner_blocked, c.changed_by]), [['owner', true, false, null]])
  assert.equal((await setStatus('admin', users.guard, false)).changed, true)
  assert.equal((await setStatus('admin', users.guard, true)).changed, true)
  assert.equal(await active(users.guard), true)
})

test('la desactivación del admin no crea bloqueo; el responsable bloquea y desbloquea sobre ella', async () => {
  await setStatus('admin', users.guard, false)
  assert.deepEqual(await blocks(), [])
  // El propietario bloquea a un guardia ya inactivo: cambio efectivo del bloqueo, auditado una vez.
  const before = (await changes()).length
  await ownerSet(users.guard, false)
  await ownerSet(users.guard, false)
  assert.deepEqual(await blocks(), [users.guard])
  assert.deepEqual((await changes()).slice(before).map(c => [c.source, c.enabled, c.owner_blocked]), [['owner', false, true]])
  await ownerSet(users.guard, true)
  assert.equal(await active(users.guard), true)
  // El propietario también reactiva a un guardia desactivado solo por el admin.
  await setStatus('admin', users.guard, false)
  await ownerSet(users.guard, true)
  assert.equal(await active(users.guard), true)
  assert.deepEqual(await blocks(), [])
  // Procedimiento de configuración intacto: mismos errores y sin permiso para clientes.
  await assert.rejects(db.query('select accesshome_private.set_guard_active($1,$2,true)', [users.guardB, seed.condominiumId]), /no encontrado/)
  await assert.rejects(db.query('select accesshome_private.set_guard_active($1,$2,true)', [users.admin, seed.condominiumId]), /no encontrado/)
  await assert.rejects(db.query('select accesshome_private.set_guard_active($1,$2,null)', [users.guard, seed.condominiumId]), /true o false/)
  await assert.rejects(call('admin', 'select accesshome_private.set_guard_active($1,$2,true) as data', [users.guard, seed.condominiumId]), /permission denied/)
})

// Inyección de fallo en la bitácora, mismo patrón que guard-scanning.
async function withAuditFailure(fn) {
  await db.exec("create function accesshome_private.fixture_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$; create trigger fixture_failure before insert on accesshome_private.guard_status_changes for each row execute function accesshome_private.fixture_failure();")
  try { await fn() } finally {
    await db.exec('drop trigger fixture_failure on accesshome_private.guard_status_changes; drop function accesshome_private.fixture_failure();')
  }
}
// Desactiva un trigger de producción solo dentro de la base desechable y siempre lo restaura.
async function withTriggerDisabled(table, trigger, fn) {
  await db.exec(`alter table ${table} disable trigger ${trigger}`)
  try { await fn() } finally { await db.exec(`alter table ${table} enable trigger ${trigger}`) }
}
const triggerEnabled = async name => (await db.query("select tgenabled from pg_trigger where tgname=$1", [name])).rows[0].tgenabled

test('si falla la bitácora al bloquear o desactivar se revierte todo', async () => {
  await withAuditFailure(async () => {
    const snapshot = await fullState()
    await assert.rejects(setStatus('admin', users.guard2, false), /fixture failure/)
    await assert.rejects(ownerSet(users.guard2, false), /fixture failure/)
    assert.deepEqual(await fullState(), snapshot)
    assert.equal(await active(users.guard2), true)
  })
})

test('si falla la bitácora al retirar el bloqueo, ni el desbloqueo ni la activación persisten', async () => {
  await ownerSet(users.guard2, false)
  await withAuditFailure(async () => {
    const snapshot = await fullState()
    await assert.rejects(ownerSet(users.guard2, true), /fixture failure/)
    assert.deepEqual(await fullState(), snapshot)
    assert.deepEqual(await blocks(), [users.guard2])
    assert.equal(await active(users.guard2), false)
  })
  await ownerSet(users.guard2, true)
})

test('si falla la bitácora al reactivar por el admin, el guardia sigue inactivo', async () => {
  await setStatus('admin', users.guard2, false)
  await withAuditFailure(async () => {
    const snapshot = await fullState()
    await assert.rejects(setStatus('admin', users.guard2, true), /fixture failure/)
    assert.deepEqual(await fullState(), snapshot)
    assert.equal(await active(users.guard2), false)
  })
  await setStatus('admin', users.guard2, true)
})

test('auditoría al bloquear a un guardia activo: origen owner, desactivado y con bloqueo', async () => {
  assert.equal(await active(users.guard2), true)
  const before = (await changes()).length
  await ownerSet(users.guard2, false)
  const log = (await changes()).slice(before)
  assert.deepEqual(log.map(c => ({ guard: c.guard_user_id, condo: c.condominium_id, source: c.source, enabled: c.enabled, blocked: c.owner_blocked, by: c.changed_by })),
    [{ guard: users.guard2, condo: seed.condominiumId, source: 'owner', enabled: false, blocked: true, by: null }])
  assert.deepEqual(await blocks(), [users.guard2])
  await ownerSet(users.guard2, true)
})

test('barrera del RPC independiente: con el trigger de perfiles deshabilitado, el admin sigue sin poder reactivar', async () => {
  await ownerSet(users.guard2, false)
  try {
    await withTriggerDisabled('accesshome.profiles', 'profiles_guard_active_write_rules', async () => {
      const snapshot = await fullState()
      await assert.rejects(setStatus('admin', users.guard2, true), error => error.code === 'P0001' && /responsable del sistema/.test(error.message))
      assert.deepEqual(await fullState(), snapshot)
    })
    assert.equal(await triggerEnabled('profiles_guard_active_write_rules'), 'O')
  } finally { await ownerSet(users.guard2, true) }
})

test('barrera del trigger independiente: ni una escritura que se presenta como función activa a un guardia bloqueado', async () => {
  await ownerSet(users.guard2, false)
  try {
    for (const writer of ['set_guard_status', 'set_guard_active']) {
      await assert.rejects(db.transaction(async tx => {
        await tx.query("select set_config('accesshome.guard_status_writer',$1,true)", [writer])
        await tx.query('update accesshome.profiles set active=true where user_id=$1', [users.guard2])
      }), /responsable del sistema/)
    }
    assert.equal(await active(users.guard2), false)
  } finally { await ownerSet(users.guard2, true) }
})

test('el bloqueo solo cambia mediante set_guard_active y nunca sobre un guardia activo', async () => {
  const snapshot = await fullState()
  // Insertar directamente un bloqueo para un guardia activo: rechazado (escenario de la sonda).
  await assert.rejects(db.query('insert into accesshome_private.guard_owner_blocks(guard_user_id,condominium_id) values($1,$2)', [users.guard2, seed.condominiumId]), /Solo set_guard_active/)
  // Ni presentándose como set_guard_active se puede bloquear a un guardia activo.
  await assert.rejects(db.transaction(async tx => {
    await tx.query("select set_config('accesshome.guard_status_writer','set_guard_active',true)")
    await tx.query('insert into accesshome_private.guard_owner_blocks(guard_user_id,condominium_id) values($1,$2)', [users.guard2, seed.condominiumId])
  }), /Desactiva al guardia/)
  assert.deepEqual(await fullState(), snapshot)
  // El RPC del admin no puede tocar bloqueos aunque su marca esté activa.
  await ownerSet(users.guard2, false)
  const blocked = await fullState()
  assert.deepEqual(blocked.changes.slice(snapshot.changes.length).map(c => [c.guard_user_id, c.source, c.enabled, c.owner_blocked]),
    [[users.guard2, 'owner', false, true]])
  await assert.rejects(db.transaction(async tx => {
    await tx.query("select set_config('accesshome.guard_status_writer','set_guard_status',true)")
    await tx.query('delete from accesshome_private.guard_owner_blocks where guard_user_id=$1', [users.guard2])
  }), /Solo set_guard_active/)
  await assert.rejects(db.query('delete from accesshome_private.guard_owner_blocks'), /Solo set_guard_active/)
  await assert.rejects(db.query('truncate accesshome_private.guard_owner_blocks'), /Solo set_guard_active/)
  // Desactivar directamente por SQL tampoco: todo cambio pasa por una función auditada.
  await assert.rejects(db.query('update accesshome.profiles set active=false where user_id=$1', [users.guard]), /set_guard_active o set_guard_status/)
  // Los rechazos no dejan cambios parciales ni filas de bitácora.
  assert.deepEqual(await fullState(), blocked)
  await ownerSet(users.guard2, true)
  const after = await fullState()
  assert.deepEqual(after.profiles, snapshot.profiles)
  assert.deepEqual(after.blocks, snapshot.blocks)
  assert.deepEqual(after.changes.slice(0, blocked.changes.length), blocked.changes)
  assert.deepEqual(after.changes.slice(blocked.changes.length).map(c => [c.guard_user_id, c.source, c.enabled, c.owner_blocked]),
    [[users.guard2, 'owner', true, false]])
})

// Marcador accesshome.guard_status_writer: transaccional, cerrado al terminar cada función.
const writer = async tx => (await tx.query("select current_setting('accesshome.guard_status_writer',true) as v")).rows[0].v
async function asAdminIn(tx, fn) {
  await tx.exec('set local role authenticated')
  await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: users.admin, is_anonymous: false })])
  try { return await fn() } finally { await tx.exec('reset role') }
}
// Cada intento directo en su propio savepoint para seguir usando la transacción.
async function rejectsIn(tx, sql, args, pattern) {
  await tx.query('savepoint attempt')
  await assert.rejects(tx.query(sql, args), pattern)
  await tx.query('rollback to savepoint attempt')
}

test('el marcador queda cerrado tras cada función autorizada y una escritura directa posterior en la misma transacción se rechaza', async () => {
  const snapshot = await fullState()
  const authorized = {
    owner: tx => tx.query('select accesshome_private.set_guard_active($1,$2,false)', [users.guard2, seed.condominiumId]),
    admin: tx => asAdminIn(tx, async () => assert.equal((await tx.query('select accesshome.set_guard_status($1,false) as data', [users.guard2])).rows[0].data.changed, true)),
  }
  for (const [name, run] of Object.entries(authorized)) {
    await db.transaction(async tx => {
      await run(tx)
      assert.equal(await writer(tx), '', name)
      await rejectsIn(tx, 'update accesshome.profiles set active=true where user_id=$1', [users.guard2], /set_guard_active o set_guard_status/)
      await rejectsIn(tx, 'update accesshome.profiles set active=false where user_id=$1', [users.guard], /set_guard_active o set_guard_status/)
      await rejectsIn(tx, 'insert into accesshome_private.guard_owner_blocks(guard_user_id,condominium_id) values($1,$2)', [users.guard, seed.condominiumId], /Solo set_guard_active/)
      await tx.rollback()
    })
  }
  assert.deepEqual(await fullState(), snapshot)
})

test('una operación idempotente no toca el marcador y un fallo revierte el marcador junto con el cambio', async () => {
  const snapshot = await fullState()
  await db.transaction(async tx => {
    await tx.query("select set_config('accesshome.guard_status_writer','previo',true)")
    await tx.query('select accesshome_private.set_guard_active($1,$2,true)', [users.guard2, seed.condominiumId])
    await asAdminIn(tx, async () => assert.equal((await tx.query('select accesshome.set_guard_status($1,true) as data', [users.guard2])).rows[0].data.changed, false))
    assert.equal(await writer(tx), 'previo')
    await rejectsIn(tx, 'update accesshome.profiles set active=false where user_id=$1', [users.guard2], /set_guard_active o set_guard_status/)
    await tx.rollback()
  })
  await withAuditFailure(async () => {
    await db.transaction(async tx => {
      await tx.query("select set_config('accesshome.guard_status_writer','previo',true)")
      await rejectsIn(tx, 'select accesshome_private.set_guard_active($1,$2,false)', [users.guard2, seed.condominiumId], /fixture failure/)
      assert.equal(await writer(tx), 'previo')
      await rejectsIn(tx, 'update accesshome.profiles set active=false where user_id=$1', [users.guard2], /set_guard_active o set_guard_status/)
      await tx.rollback()
    })
  })
  assert.deepEqual(await fullState(), snapshot)
})

test('cambio de rol: un guardia bloqueado no acaba activo y bloqueado ni vía admin y vuelta a guard', async () => {
  await ownerSet(users.guard2, false)
  try {
    const snapshot = await fullState()
    // Secuencia exacta de la auditoría, sin marcador: el primer paso ya se rechaza.
    await assert.rejects(db.query("update accesshome.profiles set role='admin', active=true where user_id=$1", [users.guard2]), /rol guard/)
    await assert.rejects(db.query("update accesshome.profiles set role='admin' where user_id=$1", [users.guard2]), /rol guard/)
    // Ni presentándose como función auditada: el cambio de rol es la única barrera aquí.
    await assert.rejects(db.transaction(async tx => {
      await tx.query("select set_config('accesshome.guard_status_writer','set_guard_active',true)")
      await tx.query("update accesshome.profiles set role='admin' where user_id=$1", [users.guard2])
    }), /rol guard/)
    assert.deepEqual(await fullState(), snapshot)
    // Si el primer paso se forzara con el trigger deshabilitado, devolver role=guard también se rechaza.
    await db.transaction(async tx => {
      await tx.exec('alter table accesshome.profiles disable trigger profiles_guard_active_write_rules')
      await tx.query("update accesshome.profiles set role='admin', active=true where user_id=$1", [users.guard2])
      await tx.exec('alter table accesshome.profiles enable trigger profiles_guard_active_write_rules')
      await rejectsIn(tx, "update accesshome.profiles set role='guard' where user_id=$1", [users.guard2], /rol guard/)
      await tx.rollback()
    })
    assert.equal(await triggerEnabled('profiles_guard_active_write_rules'), 'O')
    assert.deepEqual(await fullState(), snapshot)
    const row = (await db.query('select role,active from accesshome.profiles where user_id=$1', [users.guard2])).rows[0]
    assert.deepEqual(row, { role: 'guard', active: false })
  } finally { await ownerSet(users.guard2, true) }
})

test('cambio de rol rechazado también sin bloqueo; otros cambios del perfil y la gestión normal siguen', async () => {
  const snapshot = await fullState()
  await assert.rejects(db.query("update accesshome.profiles set role='admin' where user_id=$1", [users.guard]), /rol guard/)
  await assert.rejects(db.query("update accesshome.profiles set role='guard' where user_id=$1", [users.inactiveAdmin]), /rol guard/)
  await db.query('update accesshome.profiles set display_name=display_name where user_id=$1', [users.guard])
  assert.deepEqual(await fullState(), snapshot)
  assert.equal((await setStatus('admin', users.guard, false)).changed, true)
  assert.equal((await setStatus('admin', users.guard, true)).changed, true)
})

test('security_baseline detecta un trigger crítico deshabilitado', async () => {
  const baseline = await readFile('supabase/tests/security_baseline.sql', 'utf8')
  await db.exec(baseline)
  for (const [table, trigger] of [['accesshome.profiles', 'profiles_guard_active_write_rules'], ['accesshome_private.guard_owner_blocks', 'guard_owner_blocks_write_rules'], ['accesshome_private.guard_owner_blocks', 'guard_owner_blocks_no_truncate']]) {
    await withTriggerDisabled(table, trigger, async () => {
      try { await assert.rejects(db.exec(baseline), new RegExp('deshabilitado: ' + trigger)) }
      finally { await db.exec('rollback') } // el baseline abre su propia transacción
    })
    assert.equal(await triggerEnabled(trigger), 'O')
  }
})

test('barrera por solicitud: un guardia con bloqueo no usa la caseta aunque su perfil quedara activo', async () => {
  // Estado imposible por las vías normales; se fuerza con ambos triggers deshabilitados en la base desechable.
  await withTriggerDisabled('accesshome_private.guard_owner_blocks', 'guard_owner_blocks_write_rules', async () => {
    await db.query('insert into accesshome_private.guard_owner_blocks(guard_user_id,condominium_id) values($1,$2)', [users.guard2, seed.condominiumId])
    try {
      assert.equal(await active(users.guard2), true)
      await assert.rejects(call('guard2', 'select accesshome.guard_dashboard() as data'), /Solo un guardia/)
      await assert.rejects(call('guard2', 'select accesshome.guard_open_visits(0) as data'), /Solo un guardia/)
      await assert.rejects(call('guard2', 'select accesshome.validate_access($1,$2,$3) as data', ['a'.repeat(64), randomUUID(), 'QR']), /guardia activo|permiso/)
      await assert.rejects(call('guard2', 'select accesshome.list_services() as data'), /guardia activo|permiso/)
    } finally {
      await db.query('delete from accesshome_private.guard_owner_blocks where guard_user_id=$1', [users.guard2])
    }
  })
  assert.equal(await triggerEnabled('guard_owner_blocks_write_rules'), 'O')
  assert.equal((await call('guard2', 'select accesshome.guard_dashboard() as data')).guardName, 'Arturo Caseta')
})

test('las tablas privadas y las funciones de control no son accesibles para clientes', async () => {
  for (const name of ['admin', 'guard', 'daniel', null]) {
    await assert.rejects(actor(name, tx => tx.query('select * from accesshome_private.guard_owner_blocks')), /permission denied/)
    await assert.rejects(actor(name, tx => tx.query('delete from accesshome_private.guard_owner_blocks')), /permission denied/)
    for (const fn of ['guard_active_write_rules', 'guard_owner_block_write_rules']) {
      await assert.rejects(actor(name, tx => tx.query(`select accesshome_private.${fn}()`)), /permission denied|trigger/)
    }
  }
})
