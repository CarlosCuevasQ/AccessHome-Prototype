import { DEMO_PASSWORD } from '../data/demo.js'
import type { PrincipalInput } from '../types/community.js'
import { inhabitantName } from '../utils/people.js'
import { inhabitantFields, requireResidence, requireUser, validEmail } from './communityRules.js'
import { readDemoData, saveDemoData } from './demoStorage.js'
import { generateId } from '../utils/id.js'

export async function assignPrincipal(residenceId: string, input: PrincipalInput): Promise<void> {
  const data = readDemoData()
  const admin = requireUser(data, true)
  const residence = requireResidence(data, admin, residenceId)
  let person
  if ('inhabitantId' in input) {
    person = data.inhabitants.find((item) => item.id === input.inhabitantId && item.residenceId === residenceId && item.active)
    if (!person) throw new Error('Selecciona un habitante activo de esta residencia.')
  } else {
    person = {
      ...inhabitantFields({ ...input, phone: '', relationship: '', active: true }),
      id: generateId(), residenceId, userId: null,
    }
    data.inhabitants.push(person)
  }
  if (!person.userId) {
    const email = validEmail('inhabitantId' in input ? input.loginEmail ?? '' : input.email)
    if (data.users.some((user) => user.email.toLowerCase() === email)) throw new Error('Ese correo ya tiene una cuenta. Selecciona al habitante existente de esta casa; no se pueden trasladar cuentas entre residencias.')
    const id = generateId()
    data.users.push({ id, name: inhabitantName(person), email, password: DEMO_PASSWORD, role: 'resident', condominiumId: residence.condominiumId, residenceId })
    person.userId = id
  }
  residence.principalUserId = person.userId
  saveDemoData(data)
}
