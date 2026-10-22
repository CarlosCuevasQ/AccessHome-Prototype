import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

// Contrato documentado: con la casa inactiva sus residentes con cuenta consultan,
// pero ninguna escritura pasa managed_residence; al reactivarla vuelve la gestión.
// Casa 24: Daniel (principal) y Mariana (habitante con cuenta). Casa 12 (Ana) y un
// condominio B con datos propios sirven para comprobar que nada ajeno se abre.
const db = new PGlite({ extensions: { pgcrypto } })
const users = Object.fromEntries(['admin','daniel','ana','mariana','adminB','residentB'].map(name => [name, randomUUID()]))
const ids = {}
async function actor(name, fn) {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated')
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: users[name], is_anonymous: false })])
    return fn(tx)
  })
}
const as = (name, rpc, args = [], casts = []) => actor(name, tx =>
  tx.query(`select accesshome.${rpc}(${args.map((_, i) => '$' + (i + 1) + (casts[i] ? '::' + casts[i] : '')).join(',')}) as result`, args)
).then(r => r.rows[0].result)
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]
const occasional = name => JSON.stringify({ source: 'occasional', visitorName: name, phone: '', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } })
const person = (firstName, active = true) => JSON.stringify({ firstName, lastName: 'Prueba', phone: '', email: '', relationship: '', active })
const car = plates => JSON.stringify({ plates, brand: 'Marca', model: 'Modelo', color: 'Gris', ownerId: null, active: true })
const contactInput = name => JSON.stringify({ name, phone: '', email: '', notes: '', active: true })
const contactCar = plates => JSON.stringify({ plates, brand: 'Marca', model: 'Modelo', color: 'Gris', active: true })
const household = (who, operation, target, input) => as(who, 'manage_household', [operation, ids.house24, target, input], ['text','uuid','uuid','jsonb'])
const contact = (who, operation, target, input, contactId = null) => as(who, 'manage_contact', [operation, target, input, contactId], ['text','uuid','jsonb','uuid'])
const report = (who, title) => as(who, 'create_report', [JSON.stringify({ title, category: 'Otro', description: 'Reporte de prueba' })], ['jsonb'])
const blocked = /principal de una residencia activa/

async function setHouse24(active) {
  const { number, street } = await one('select number,street from accesshome.residences where id=$1', [ids.house24])
  await as('admin', 'manage_community', ['update_residence', ids.house24, JSON.stringify({ number: String(number), street, active })], ['text','uuid','jsonb'])
  assert.equal((await one('select active from accesshome.residences where id=$1', [ids.house24])).active, active)
}
// Owner-level rows that a Casa 24 write could touch, including Daniel's private agenda.
async function house24Rows() {
  const house = async sql => (await db.query(sql, [ids.house24])).rows
  const agenda = async sql => (await db.query(sql, [users.daniel])).rows
  return {
    residence: await house('select * from accesshome.residences where id=$1'),
    profiles: await house('select * from accesshome.profiles where residence_id=$1 order by user_id'),
    inhabitants: await house('select * from accesshome.inhabitants where residence_id=$1 order by id'),
    vehicles: await house('select * from accesshome.residence_vehicles where residence_id=$1 order by id'),
    invitations: await house('select * from accesshome.invitations where residence_id=$1 order by id'),
    tokens: await house('select t.* from accesshome_private.invitation_tokens t join accesshome.invitations i on i.id=t.invitation_id where i.residence_id=$1 order by t.invitation_id'),
    access: await house('select * from accesshome.access_records where residence_id=$1 order by id'),
    reports: await house('select * from accesshome.reports where residence_id=$1 order by id'),
    assignments: await house('select * from accesshome_private.principal_assignments where residence_id=$1 order by id'),
    contacts: await agenda('select * from accesshome.frequent_contacts where owner_user_id=$1 order by id'),
    contactVehicles: await agenda('select v.* from accesshome.contact_vehicles v join accesshome.frequent_contacts c on c.id=v.contact_id where c.owner_user_id=$1 order by v.id'),
  }
}
async function condominiumRows(condo) {
  const result = {}
  for (const table of ['condominiums','residences','profiles','inhabitants','residence_vehicles','invitations','access_records','reports','frequent_contacts']) {
    const column = table === 'condominiums' ? 'id' : 'condominium_id'
    result[table] = (await db.query(`select * from accesshome.${table} where ${column}=$1 order by 1`, [condo])).rows
  }
  return result
}

before(async () => {
  await installSharedSchema(db)
  for (const id of Object.values(users)) await db.query('insert into auth.users values($1)', [id])
  const seed = (await db.query('select accesshome_private.seed_demo($1::jsonb) as s', [JSON.stringify({ admin: users.admin, daniel: users.daniel, ana: users.ana, mariana: users.mariana })])).rows[0].s
  ids.condo = seed.condominiumId; ids.house24 = seed.residence24
  ids.house12 = (await one('select id from accesshome.residences where condominium_id=$1 and number=12', [ids.condo])).id
  ids.andrea = (await one("select id from accesshome.inhabitants where residence_id=$1 and first_name='Andrea'", [ids.house24])).id
  ids.vehicle24 = (await one("select id from accesshome.residence_vehicles where residence_id=$1 and plates='DEMO-024'", [ids.house24])).id
  ids.contact = (await one('select id from accesshome.frequent_contacts where owner_user_id=$1 order by name limit 1', [users.daniel])).id
  ids.contactVehicle = (await one('select id from accesshome.contact_vehicles where contact_id=$1 limit 1', [ids.contact])).id

  // Casa 24: invitación activa con entrada registrada por el admin y un reporte de Daniel.
  ids.invitation24 = await as('daniel', 'create_invitation', [occasional('Visita Casa 24')], ['jsonb'])
  const token24 = (await as('daniel', 'invitation_details', [ids.invitation24])).token
  ids.record24 = (await as('admin', 'validate_access', [token24, randomUUID(), 'MANUAL'])).record.id
  ids.report24 = await report('daniel', 'Reporte Casa 24')
  // Casa 12 del mismo condominio, con datos propios.
  ids.invitation12 = await as('ana', 'create_invitation', [occasional('Visita Casa 12')], ['jsonb'])
  const token12 = (await as('ana', 'invitation_details', [ids.invitation12])).token
  ids.record12 = (await as('admin', 'validate_access', [token12, randomUUID(), 'MANUAL'])).record.id
  ids.report12 = await report('ana', 'Reporte Casa 12')
  // Condominio B independiente, con datos creados por sus propias RPC.
  ids.condoB = (await one("insert into accesshome.condominiums(name) values('Condominio B') returning id")).id
  ids.houseB = (await one("insert into accesshome.residences(condominium_id,number,street) values($1,3,'Calle B') returning id", [ids.condoB])).id
  await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role) values($1,$2,'Admin B','admin')", [users.adminB, ids.condoB])
  await db.query("insert into accesshome.profiles(user_id,condominium_id,residence_id,display_name,role) values($1,$2,$3,'Rosa B','resident')", [users.residentB, ids.condoB, ids.houseB])
  await db.query("insert into accesshome.inhabitants(condominium_id,residence_id,user_id,first_name,last_name) values($1,$2,$3,'Rosa','B')", [ids.condoB, ids.houseB, users.residentB])
  await db.query('update accesshome.residences set principal_user_id=$1 where id=$2', [users.residentB, ids.houseB])
  ids.invitationB = await as('residentB', 'create_invitation', [occasional('Visita B')], ['jsonb'])
  const tokenB = (await as('residentB', 'invitation_details', [ids.invitationB])).token
  ids.recordB = (await as('adminB', 'validate_access', [tokenB, randomUUID(), 'MANUAL'])).record.id
  ids.reportB = await report('residentB', 'Reporte B')
  ids.condoBBefore = await condominiumRows(ids.condoB)
})
after(() => db.close())

test('casa activa: el principal consulta y gestiona; el habitante con cuenta solo consulta', async () => {
  await setHouse24(true)
  for (const who of ['daniel', 'mariana']) {
    const profile = await as(who, 'session_profile')
    assert.equal(profile.role, 'resident'); assert.equal(profile.residenceId, ids.house24)
  }
  assert.deepEqual((await as('daniel', 'residence_details')).permissions, { manageHousehold: true, manageStructure: false })
  assert.deepEqual((await as('mariana', 'residence_details')).permissions, { manageHousehold: false, manageStructure: false })
  assert.equal((await as('daniel', 'contact_access')).canManage, true)
  assert.equal((await as('daniel', 'invitation_context')).canManage, true)
  assert.equal((await as('mariana', 'invitation_context')).canManage, false)
  assert.equal((await as('daniel', 'report_context')).canCreate, true)
  assert.equal((await as('mariana', 'report_context')).canCreate, false)
  // Operaciones del principal sobre datos desechables de este fixture.
  const extra = await as('daniel', 'create_invitation', [occasional('Activa y cancelada')], ['jsonb'])
  await as('daniel', 'cancel_invitation', [extra])
  assert.equal((await as('daniel', 'invitation_details', [extra])).status, 'cancelada')
  await household('daniel', 'create_inhabitant', null, person('Alta activa'))
  await household('daniel', 'create_vehicle', null, car('ACT-001'))
  const newContact = await contact('daniel', 'create', null, contactInput('Contacto activo'))
  assert.ok((await as('daniel', 'list_contacts', [''])).some(c => c.id === newContact))
  assert.ok(await report('daniel', 'Reporte con casa activa'))
  // El habitante no principal no obtiene permisos exclusivos del principal.
  const before = await house24Rows()
  await assert.rejects(as('mariana', 'create_invitation', [occasional('No principal')], ['jsonb']), blocked)
  await assert.rejects(as('mariana', 'cancel_invitation', [ids.invitation24]), blocked)
  await assert.rejects(household('mariana', 'create_inhabitant', null, person('No principal')), blocked)
  await assert.rejects(contact('mariana', 'create', null, contactInput('No principal')), blocked)
  await assert.rejects(report('mariana', 'No principal'), blocked)
  await assert.rejects(as('mariana', 'list_contacts', ['']), /Agenda privada del principal/)
  assert.deepEqual(await house24Rows(), before)
})

test('casa inactiva: principal y habitante con cuenta inician sesión y consultan lo permitido', async () => {
  await setHouse24(false)
  const inhabitants = (await db.query('select count(*)::int as n from accesshome.inhabitants where residence_id=$1', [ids.house24])).rows[0].n
  for (const who of ['daniel', 'mariana']) {
    const profile = await as(who, 'session_profile')
    assert.equal(profile.role, 'resident'); assert.equal(profile.residenceId, ids.house24); assert.equal(profile.condominiumId, ids.condo)
    const details = await as(who, 'residence_details')
    assert.equal(details.residence.id, ids.house24); assert.equal(details.residence.active, false)
    assert.deepEqual(details.permissions, { manageHousehold: false, manageStructure: false })
    assert.equal(details.inhabitants.length, inhabitants)
    const dashboard = await as(who, 'resident_dashboard')
    assert.equal(dashboard.residence.id, ids.house24); assert.equal(dashboard.canManage, false)
    assert.equal(dashboard.isPrincipal, who === 'daniel')
    const invitations = await as(who, 'list_invitations', ['', 'todas'])
    assert.ok(invitations.some(i => i.id === ids.invitation24))
    assert.ok(invitations.every(i => i.residenceId === ids.house24))
    const detail = await as(who, 'invitation_details', [ids.invitation24])
    assert.equal(detail.status, 'activa'); assert.match(detail.token, /^[a-f0-9]{64}$/)
    const access = await as(who, 'list_access', ['{}'], ['jsonb'])
    assert.ok(access.some(r => r.id === ids.record24))
    assert.ok(access.every(r => r.residenceId === ids.house24))
    assert.equal((await as(who, 'invitation_context')).canManage, false)
    assert.equal((await as(who, 'report_context')).canCreate, false)
  }
  // Reportes: cada residente ve solo los propios; la agenda sigue siendo exclusiva del principal.
  const reports = await as('daniel', 'list_reports')
  assert.ok(reports.some(r => r.id === ids.report24)); assert.ok(reports.every(r => r.authorUserId === users.daniel))
  assert.deepEqual(await as('mariana', 'list_reports'), [])
  assert.equal((await as('daniel', 'contact_access')).canManage, false)
  assert.ok((await as('daniel', 'list_contacts', [''])).some(c => c.id === ids.contact))
  assert.equal((await as('daniel', 'contact_details', [ids.contact])).id, ids.contact)
  await assert.rejects(as('mariana', 'list_contacts', ['']), /Agenda privada del principal/)
  await assert.rejects(as('mariana', 'contact_details', [ids.contact]), /Agenda privada del principal/)
})

test('casa inactiva: el backend rechaza todas las escrituras de residentes sin cambiar filas', async () => {
  await setHouse24(false)
  const before = await house24Rows()
  const attempts = [
    ['daniel', () => as('daniel', 'create_invitation', [occasional('Bloqueada')], ['jsonb'])],
    ['daniel', () => as('daniel', 'cancel_invitation', [ids.invitation24])],
    ['daniel', () => household('daniel', 'create_inhabitant', null, person('Bloqueado'))],
    ['daniel', () => household('daniel', 'update_inhabitant', ids.andrea, person('Andrea', false))],
    ['daniel', () => household('daniel', 'create_vehicle', null, car('BLK-001'))],
    ['daniel', () => household('daniel', 'update_vehicle', ids.vehicle24, car('BLK-002'))],
    ['daniel', () => household('daniel', 'delete_vehicle', ids.vehicle24, '{}')],
    ['daniel', () => contact('daniel', 'create', null, contactInput('Bloqueado'))],
    ['daniel', () => contact('daniel', 'update', ids.contact, contactInput('Renombrado'))],
    ['daniel', () => contact('daniel', 'delete', ids.contact, '{}')],
    ['daniel', () => contact('daniel', 'create_vehicle', null, contactCar('BLK-003'), ids.contact)],
    ['daniel', () => contact('daniel', 'delete_vehicle', ids.contactVehicle, '{}', ids.contact)],
    ['daniel', () => report('daniel', 'Bloqueado')],
    ['mariana', () => as('mariana', 'create_invitation', [occasional('Bloqueada')], ['jsonb'])],
    ['mariana', () => household('mariana', 'create_inhabitant', null, person('Bloqueado'))],
    ['mariana', () => contact('mariana', 'create', null, contactInput('Bloqueado'))],
    ['mariana', () => report('mariana', 'Bloqueado')],
  ]
  for (const [who, attempt] of attempts) await assert.rejects(attempt(), error => error.code === '42501' && blocked.test(error.message), who)
  assert.deepEqual(await house24Rows(), before)
})

test('casa inactiva no abre datos de otra casa ni de otro condominio', async () => {
  await setHouse24(false)
  for (const who of ['daniel', 'mariana']) {
    await assert.rejects(as(who, 'residence_details', [ids.house12]), /Residencia no disponible/)
    await assert.rejects(as(who, 'residence_details', [ids.houseB]), /Residencia no disponible/)
    for (const id of [ids.invitation12, ids.invitationB]) await assert.rejects(as(who, 'invitation_details', [id]), /Invitación no disponible/)
    for (const id of [ids.report12, ids.reportB]) await assert.rejects(as(who, 'report_details', [id]), /Reporte no disponible/)
    const access = (await as(who, 'list_access', ['{}'], ['jsonb'])).map(r => r.id)
    assert.equal(access.includes(ids.record12) || access.includes(ids.recordB), false)
    await assert.rejects(as(who, 'list_access', [JSON.stringify({ residenceId: ids.house12 })], ['jsonb']), /Residencia no disponible/)
    const invitations = (await as(who, 'list_invitations', ['', 'todas'])).map(i => i.id)
    assert.equal(invitations.includes(ids.invitation12) || invitations.includes(ids.invitationB), false)
    // La desactivación tampoco concede funciones de administración.
    await assert.rejects(as(who, 'manage_community', ['update_residence', ids.house24, JSON.stringify({ number: '24', street: 'Circuito Robles', active: true })], ['text','uuid','jsonb']), /permiso/)
    await assert.rejects(as(who, 'assign_principal', [ids.house24, ids.andrea]), /permiso/)
  }
  // Y no afecta a la casa vecina activa: Ana sigue gestionando la suya.
  assert.equal((await as('ana', 'residence_details')).permissions.manageHousehold, true)
})

test('reactivación: el principal recupera la gestión y el resto conserva su rol, sin reasignaciones', async () => {
  await setHouse24(false)
  const principalBefore = (await one('select principal_user_id from accesshome.residences where id=$1', [ids.house24])).principal_user_id
  const assignmentsBefore = (await one('select count(*)::int as n from accesshome_private.principal_assignments')).n
  const house12Before = await one('select principal_user_id,active from accesshome.residences where id=$1', [ids.house12])
  await setHouse24(true)
  assert.equal((await one('select principal_user_id from accesshome.residences where id=$1', [ids.house24])).principal_user_id, principalBefore)
  assert.equal(principalBefore, users.daniel)
  assert.equal((await one('select count(*)::int as n from accesshome_private.principal_assignments')).n, assignmentsBefore)
  assert.deepEqual(await one('select principal_user_id,active from accesshome.residences where id=$1', [ids.house12]), house12Before)
  // Principal: vuelve la gestión real, no solo el indicador.
  assert.deepEqual((await as('daniel', 'residence_details')).permissions, { manageHousehold: true, manageStructure: false })
  assert.equal((await as('daniel', 'contact_access')).canManage, true)
  const reactivated = await as('daniel', 'create_invitation', [occasional('Tras reactivar')], ['jsonb'])
  await as('daniel', 'cancel_invitation', [reactivated])
  await household('daniel', 'create_vehicle', null, car('REA-001'))
  await contact('daniel', 'update', ids.contact, contactInput('Contacto tras reactivar'))
  assert.ok(await report('daniel', 'Reporte tras reactivar'))
  // Habitante con cuenta: sigue sin permisos de principal.
  assert.deepEqual((await as('mariana', 'residence_details')).permissions, { manageHousehold: false, manageStructure: false })
  await assert.rejects(as('mariana', 'create_invitation', [occasional('Sigue sin permiso')], ['jsonb']), blocked)
  await assert.rejects(as('mariana', 'list_contacts', ['']), /Agenda privada del principal/)
  // El ciclo desactivar/reactivar no tocó el condominio B.
  assert.deepEqual(await condominiumRows(ids.condoB), ids.condoBBefore)
})
