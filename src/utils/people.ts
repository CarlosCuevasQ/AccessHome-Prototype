import type { DemoAccount, Inhabitant } from '../types/demo.js'

export const inhabitantName = (person: Pick<Inhabitant, 'firstName' | 'lastName'>) => `${person.firstName} ${person.lastName}`.trim()

export function inhabitantFromAccount(user: DemoAccount): Inhabitant {
  const [firstName, ...surname] = user.name.trim().split(/\s+/)
  return {
    id: `inhabitant-${user.id}`, residenceId: user.residenceId!, userId: user.id,
    firstName, lastName: surname.join(' '), email: user.email,
    phone: '', relationship: '', active: true,
  }
}
