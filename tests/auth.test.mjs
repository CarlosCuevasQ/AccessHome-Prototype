import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { authService } from '../.test-build/services/authService.js'
import { demoService } from '../.test-build/services/demoService.js'
import { createDemoData } from '../.test-build/data/demo.js'
import { DEMO_STORAGE_KEY } from '../.test-build/services/demoStorage.js'

let storage
let credentials

beforeEach(() => {
  storage = new Map()
  globalThis.window = new EventTarget()
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  credentials = demoService.getCredentials()
})

test('inicializa los datos solo una vez y empieza sin sesión', async () => {
  assert.equal(await authService.getSession(), null)
  assert.deepEqual(JSON.parse(storage.get(DEMO_STORAGE_KEY)), createDemoData())
  const data = JSON.parse(storage.get(DEMO_STORAGE_KEY))
  data.condominiums[0].name = 'Cambio de prueba'
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
  await authService.getSession()
  assert.equal(JSON.parse(storage.get(DEMO_STORAGE_KEY)).condominiums[0].name, 'Cambio de prueba')
})

test('rechaza credenciales incorrectas sin crear una sesión', async () => {
  await assert.rejects(authService.login({ email: credentials[0].email, password: 'incorrecta' }), /Correo o contraseña incorrectos/)
  await assert.rejects(authService.login({ email: 'desconocido@example.test', password: credentials[0].password }), /Correo o contraseña incorrectos/)
  assert.equal(await authService.getSession(), null)
})

test('login de ambos roles persiste la referencia y no expone contraseñas en sesión', async () => {
  for (const account of credentials) {
    const user = await authService.login(account)
    assert.equal(user.role, account.role)
    assert.equal(user.name, account.name)
    assert.equal('password' in user, false)
    assert.deepEqual(await authService.getSession(), user)
    assert.deepEqual(JSON.parse(storage.get(DEMO_STORAGE_KEY)).session, { userId: user.id })
    await authService.logout()
  }
})

test('normaliza correo, pero respeta mayúsculas y espacios de la contraseña', async () => {
  const account = credentials[1]
  const user = await authService.login({ email: `  ${account.email.toUpperCase()}  `, password: account.password })
  assert.equal(user.role, 'resident')
  await authService.logout()
  await assert.rejects(authService.login({ ...account, password: `${account.password} ` }), /incorrectos/)
  await assert.rejects(authService.login({ ...account, password: account.password.toLowerCase() }), /incorrectos/)
})

test('logout elimina la sesión, conserva datos y notifica a los suscriptores', async () => {
  let notifications = 0
  const unsubscribe = authService.subscribe(() => { notifications++ })
  await authService.login(credentials[0])
  await authService.logout()
  assert.equal(await authService.getSession(), null)
  assert.equal(notifications, 2)
  assert.deepEqual(JSON.parse(storage.get(DEMO_STORAGE_KEY)).residences, createDemoData().residences)
  unsubscribe()
  await authService.login(credentials[1])
  assert.equal(notifications, 2)
})

test('los eventos de otras pestañas solo reaccionan a los datos propios o al vaciado', () => {
  let notifications = 0
  const unsubscribe = authService.subscribe(() => { notifications++ })
  for (const key of ['otra-aplicacion', DEMO_STORAGE_KEY, null]) {
    const event = new Event('storage')
    Object.defineProperty(event, 'key', { value: key })
    window.dispatchEvent(event)
  }
  assert.equal(notifications, 2)
  unsubscribe()
})

test('restaurar recupera toda la semilla, cierra sesión y conserva otras aplicaciones', async () => {
  storage.set('otra-aplicacion', 'conservar')
  await authService.login(credentials[1])
  const data = JSON.parse(storage.get(DEMO_STORAGE_KEY))
  data.users[1].name = 'Nombre modificado'
  data.vehicles = []
  data.residences[0].name = 'Casa modificada'
  storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
  await demoService.resetDemoData()
  assert.deepEqual(JSON.parse(storage.get(DEMO_STORAGE_KEY)), createDemoData())
  assert.equal(storage.get('otra-aplicacion'), 'conservar')
  assert.equal(await authService.getSession(), null)
  assert.equal((await authService.login(credentials[1])).name, credentials[1].name)
})

test('JSON corrupto se conserva, rechaza acceso y puede restaurarse', async () => {
  storage.set(DEMO_STORAGE_KEY, '{incompleto')
  await assert.rejects(authService.getSession(), /datos locales no son válidos/)
  await assert.rejects(authService.login(credentials[0]), /datos locales no son válidos/)
  assert.equal(storage.get(DEMO_STORAGE_KEY), '{incompleto')
  await demoService.resetDemoData()
  assert.equal(await authService.getSession(), null)
})

test('rechaza sesiones huérfanas, roles desconocidos y relaciones inválidas', async () => {
  const mutations = [
    (data) => { data.session = { userId: 'no-existe' } },
    (data) => { data.users[0].role = 'superadmin' },
    (data) => { data.users[1].residenceId = 'casa-inexistente' },
    (data) => { data.version = 99 },
  ]
  for (const mutate of mutations) {
    const data = createDemoData()
    mutate(data)
    storage.set(DEMO_STORAGE_KEY, JSON.stringify(data))
    await assert.rejects(authService.getSession(), /datos locales no son válidos/)
  }
})

test('el contexto de residencia solo se entrega al usuario de la sesión', async () => {
  const user = await authService.login(credentials[1])
  const context = await demoService.getProfileContext(user.id)
  assert.equal(context.residence.name, 'Casa 24')
  await assert.rejects(demoService.getProfileContext('user-admin'), /Inicia sesión/)
})

test('fallos de almacenamiento no reportan login, logout ni restauración exitosos', async () => {
  await authService.getSession()
  const originalWrite = window.localStorage.setItem
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(authService.login(credentials[0]), /No se pudieron guardar/)
  assert.equal(await authService.getSession(), null)
  window.localStorage.setItem = originalWrite
  await authService.login(credentials[0])
  window.localStorage.setItem = () => { throw new Error('quota') }
  await assert.rejects(authService.logout(), /No se pudieron guardar/)
  await assert.rejects(demoService.resetDemoData(), /No se pudieron guardar/)
  assert.equal((await authService.getSession()).role, 'admin')
  window.localStorage.getItem = () => { throw new Error('denied') }
  await assert.rejects(authService.getSession(), /No se puede leer/)
})
