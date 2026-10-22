import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { installSharedSchema } from './helpers/shared-sql-fixture.mjs'

// Two populated condominiums. A comes from seed_demo; B is built by the owner with
// its own admin, principal, inhabitants, vehicle, invitation, movement and report,
// so every isolation check has foreign rows that could actually leak.
const db = new PGlite({ extensions: { pgcrypto } })
const users = Object.fromEntries(['admin','daniel','ana','adminB','residentB','residentB2'].map(name => [name, randomUUID()]))
const A = {}, B = {}
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
const occasional = name => JSON.stringify({ source: 'occasional', visitorName: name, phone: '', vehicle: null, saveAsContact: false, validity: { kind: '24hours' } })
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]

// Owner-level view of one condominium (PGlite owner bypasses RLS). Used to prove
// that a denied operation leaves every row of that condominium untouched.
async function snapshot(condo) {
  const tables = ['residences','profiles','inhabitants','residence_vehicles','invitations','access_records','reports']
  const result = { condominium: (await db.query('select * from accesshome.condominiums where id=$1', [condo])).rows }
  for (const table of tables) result[table] = (await db.query(`select * from accesshome.${table} where condominium_id=$1 order by 1`, [condo])).rows
  result.principal_assignments = (await db.query(`select p.* from accesshome_private.principal_assignments p
    join accesshome.residences r on r.id=p.residence_id where r.condominium_id=$1 order by p.assigned_at,p.id`, [condo])).rows
  return result
}

before(async () => {
  await installSharedSchema(db)
  for (const id of Object.values(users)) await db.query('insert into auth.users values($1)', [id])
  const seed = (await db.query('select accesshome_private.seed_demo($1::jsonb) as s', [JSON.stringify({ admin: users.admin, daniel: users.daniel, ana: users.ana })])).rows[0].s
  A.condo = seed.condominiumId; A.house24 = seed.residence24

  B.condo = (await one("insert into accesshome.condominiums(name,address) values('Condominio Norte','Calle Norte 1') returning id")).id
  B.house = (await one("insert into accesshome.residences(condominium_id,number,street) values($1,7,'Calle Norte') returning id", [B.condo])).id
  await db.query("insert into accesshome.profiles(user_id,condominium_id,display_name,role) values($1,$2,'Admin Norte','admin')", [users.adminB, B.condo])
  for (const [name, display] of [['residentB','Rosa Norte'],['residentB2','Raúl Norte']]) {
    await db.query("insert into accesshome.profiles(user_id,condominium_id,residence_id,display_name,role) values($1,$2,$3,$4,'resident')", [users[name], B.condo, B.house, display])
    const [first, last] = display.split(' ')
    await db.query('insert into accesshome.inhabitants(condominium_id,residence_id,user_id,first_name,last_name) values($1,$2,$3,$4,$5)', [B.condo, B.house, users[name], first, last])
  }
  B.inhabitant2 = (await one('select id from accesshome.inhabitants where user_id=$1', [users.residentB2])).id
  await db.query('update accesshome.residences set principal_user_id=$1 where id=$2', [users.residentB, B.house])
  await db.query("insert into accesshome.residence_vehicles(condominium_id,residence_id,plates,brand,model,color) values($1,$2,'NOR-007','Ford','Focus','Negro')", [B.condo, B.house])

  // Real operations through the RPCs in both condominiums.
  const invitationB = await as('residentB', 'invitation_details', [await as('residentB', 'create_invitation', [occasional('Visita Norte')], ['jsonb'])])
  B.token = invitationB.token
  B.record = (await as('adminB', 'validate_access', [invitationB.token, randomUUID(), 'MANUAL'])).record.id
  B.report = await as('residentB', 'create_report', [JSON.stringify({ title: 'Portón Norte', category: 'Seguridad', description: 'Reporte privado del condominio B' })], ['jsonb'])
  const invitationA = await as('daniel', 'invitation_details', [await as('daniel', 'create_invitation', [occasional('Visita Robles')], ['jsonb'])])
  A.token = invitationA.token
  A.record = (await as('admin', 'validate_access', [invitationA.token, randomUUID(), 'MANUAL'])).record.id
  A.report = await as('daniel', 'create_report', [JSON.stringify({ title: 'Lámpara Robles', category: 'Instalaciones', description: 'Reporte del condominio A' })], ['jsonb'])
  A.inhabitantDaniel = (await one('select id from accesshome.inhabitants where user_id=$1', [users.daniel])).id
})
after(() => db.close())

test('fixture: ambos condominios tienen datos propios visibles para su administrador', async () => {
  const aIds = new Set((await as('admin', 'list_access', ['{}'], ['jsonb'])).map(r => r.id))
  const bIds = new Set((await as('adminB', 'list_access', ['{}'], ['jsonb'])).map(r => r.id))
  assert.ok(aIds.has(A.record)); assert.ok(bIds.has(B.record))
  assert.ok((await as('adminB', 'list_reports')).some(r => r.id === B.report))
  assert.ok((await as('adminB', 'list_residences', [''])).some(r => r.id === B.house))
  assert.equal((await as('adminB', 'admin_dashboard')).activeInvitationCount, 1)
})

test('manage_community: admin A no edita casas de B; solo edita su propio condominio', async () => {
  const before = await snapshot(B.condo)
  await assert.rejects(as('admin', 'manage_community', ['update_residence', B.house, JSON.stringify({ number: '7', street: 'Calle tomada', active: false })], ['text','uuid','jsonb']), /Residencia no disponible/)
  // Operaciones sin destino actúan sobre el condominio de la sesión, nunca sobre B.
  await as('admin', 'manage_community', ['condominium', null, JSON.stringify({ name: 'Residencial Los Robles', address: 'Av. de los Robles 120' })], ['text','uuid','jsonb'])
  const created = await as('admin', 'manage_community', ['create_residence', null, JSON.stringify({ number: '7', street: 'Circuito Robles', active: true })], ['text','uuid','jsonb'])
  assert.equal((await one('select condominium_id from accesshome.residences where id=$1', [created])).condominium_id, A.condo)
  assert.deepEqual(await snapshot(B.condo), before)
})

test('assign_principal: admin A no reasigna principal en B ni usa habitantes de B', async () => {
  const before = await snapshot(B.condo), beforeA = await snapshot(A.condo)
  await assert.rejects(as('admin', 'assign_principal', [B.house, B.inhabitant2]), /Residencia no disponible/)
  await assert.rejects(as('admin', 'assign_principal', [A.house24, B.inhabitant2]), /habitante activo con cuenta vinculada a esta casa/)
  await assert.rejects(as('adminB', 'assign_principal', [A.house24, A.inhabitantDaniel]), /Residencia no disponible/)
  assert.deepEqual(await snapshot(B.condo), before)
  assert.deepEqual(await snapshot(A.condo), beforeA)
})

test('advance_report y report_details: admin A no ve ni avanza reportes de B', async () => {
  const before = await snapshot(B.condo)
  await assert.rejects(as('admin', 'advance_report', [B.report, 'en_proceso']), /Reporte no disponible/)
  await assert.rejects(as('admin', 'report_details', [B.report]), /Reporte no disponible/)
  assert.deepEqual(await snapshot(B.condo), before)
  assert.equal((await one('select status from accesshome.reports where id=$1', [B.report])).status, 'pendiente')
})

test('list_reports: cada admin recibe solo reportes de su condominio', async () => {
  const forA = await as('admin', 'list_reports'), forB = await as('adminB', 'list_reports')
  assert.ok(forA.some(r => r.id === A.report)); assert.equal(forA.some(r => r.id === B.report), false)
  assert.ok(forA.every(r => r.condominiumId === A.condo))
  assert.deepEqual(forB.map(r => r.id), [B.report])
})

test('list_access: sin movimientos ajenos; residenceId de otro condominio se rechaza', async () => {
  const forA = await as('admin', 'list_access', ['{}'], ['jsonb'])
  assert.ok(forA.some(r => r.id === A.record)); assert.equal(forA.some(r => r.id === B.record), false)
  assert.ok(forA.every(r => r.residenceId !== B.house))
  assert.equal((await as('admin', 'list_access', [JSON.stringify({ search: 'Visita Norte' })], ['jsonb'])).length, 0)
  await assert.rejects(as('admin', 'list_access', [JSON.stringify({ residenceId: B.house })], ['jsonb']), /Residencia no disponible/)
  await assert.rejects(as('adminB', 'list_access', [JSON.stringify({ residenceId: A.house24 })], ['jsonb']), /Residencia no disponible/)
  // Un residente tampoco puede filtrar por otra casa, ni de su condominio ni de B.
  const house12 = (await one('select id from accesshome.residences where condominium_id=$1 and number=12', [A.condo])).id
  await assert.rejects(as('daniel', 'list_access', [JSON.stringify({ residenceId: house12 })], ['jsonb']), /Residencia no disponible/)
  await assert.rejects(as('daniel', 'list_access', [JSON.stringify({ residenceId: B.house })], ['jsonb']), /Residencia no disponible/)
  const history = await as('admin', 'history_context')
  assert.equal(history.residences.some(r => r.id === B.house), false)
})

test('paneles y consultas administrativas: cifras y listas del condominio de la sesión', async () => {
  // Conteos esperados calculados por el propietario solo para A.
  const expected = await one(`select
    (select count(*)::int from accesshome.residences where condominium_id=$1) as residences,
    (select count(*)::int from accesshome.inhabitants where condominium_id=$1 and active) as inhabitants,
    (select count(*)::int from accesshome.residence_vehicles where condominium_id=$1) as vehicles,
    (select count(*)::int from accesshome.reports where condominium_id=$1 and status='pendiente') as reports,
    (select count(*)::int from accesshome.invitations where condominium_id=$1 and status='activa' and expires_at>now()) as invitations`, [A.condo])
  const dashboard = await as('admin', 'admin_dashboard')
  assert.equal(dashboard.condominium.id, A.condo)
  assert.equal(dashboard.residenceCount, expected.residences)
  assert.equal(dashboard.activeInhabitantCount, expected.inhabitants)
  assert.equal(dashboard.vehicleCount, expected.vehicles)
  assert.equal(dashboard.pendingReportCount, expected.reports)
  assert.equal(dashboard.activeInvitationCount, expected.invitations)
  assert.equal(dashboard.recentAccess.some(r => r.id === B.record), false)
  const summary = await as('admin', 'community_summary')
  assert.equal(summary.condominium.id, A.condo)
  assert.equal(summary.residenceCount, expected.residences); assert.equal(summary.vehicleCount, expected.vehicles)
  assert.equal((await as('admin', 'list_residences', [''])).some(r => r.id === B.house), false)
  assert.equal((await as('admin', 'active_access_invitations')).some(i => i.token === B.token), false)
  await assert.rejects(as('admin', 'residence_details', [B.house]), /Residencia no disponible/)
  const dashboardB = await as('adminB', 'admin_dashboard')
  assert.equal(dashboardB.residenceCount, 1); assert.equal(dashboardB.pendingReportCount, 1)
  assert.deepEqual(dashboardB.recentAccess.map(r => r.id), [B.record])
})

test('residentes no invocan funciones exclusivas del administrador ni alteran datos', async () => {
  const beforeA = await snapshot(A.condo), beforeB = await snapshot(B.condo)
  const adminOnly = [
    ['manage_community', ['update_residence', A.house24, JSON.stringify({ number: '24', street: 'Tomada', active: false })], ['text','uuid','jsonb']],
    ['manage_community', ['create_residence', null, JSON.stringify({ number: '99', street: 'Nueva', active: true })], ['text','uuid','jsonb']],
    ['assign_principal', [A.house24, A.inhabitantDaniel]],
    ['advance_report', [A.report, 'en_proceso']],
    ['admin_dashboard', []],
    ['community_summary', []],
    ['list_residences', ['']],
    ['active_access_invitations', []],
  ]
  for (const user of ['daniel', 'residentB']) {
    for (const [rpc, args, casts] of adminOnly) await assert.rejects(as(user, rpc, args, casts), /permiso/, user + ' → ' + rpc)
  }
  assert.deepEqual(await snapshot(A.condo), beforeA)
  assert.deepEqual(await snapshot(B.condo), beforeB)
})
