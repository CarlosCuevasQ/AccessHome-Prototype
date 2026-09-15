import type { ContactAccess, ContactInput, ContactVehicleInput, FrequentContact } from '../types/contacts.js'
import { contactFields, contactVehicleFields, requireContactUser, requireOwnContact } from './contactRules.js'
import { readDemoData, saveDemoData, subscribeToDemoChanges } from './demoStorage.js'

const searchKey = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

export const contactsService = {
  subscribe: subscribeToDemoChanges,

  async getAccess(): Promise<ContactAccess> {
    const { canManage } = requireContactUser(readDemoData())
    return { canManage }
  },

  async listContacts(search = ''): Promise<FrequentContact[]> {
    const data = readDemoData()
    const { user } = requireContactUser(data)
    const query = searchKey(search)
    return data.contacts.filter((contact) => contact.ownerUserId === user.id
      && searchKey([contact.name, contact.phone, contact.email, ...contact.vehicles.map((vehicle) => vehicle.plates)].join(' ')).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  },

  async getContact(id: string): Promise<FrequentContact> {
    return requireOwnContact(readDemoData(), id)
  },

  async createContact(input: ContactInput): Promise<string> {
    const data = readDemoData()
    const { user } = requireContactUser(data, true)
    const id = crypto.randomUUID()
    data.contacts.push({ ...contactFields(input), id, ownerUserId: user.id, vehicles: [] })
    saveDemoData(data)
    return id
  },

  async updateContact(id: string, input: ContactInput): Promise<void> {
    const data = readDemoData()
    const contact = requireOwnContact(data, id, true)
    Object.assign(contact, contactFields(input))
    saveDemoData(data)
  },

  async createVehicle(contactId: string, input: ContactVehicleInput): Promise<void> {
    const data = readDemoData()
    const contact = requireOwnContact(data, contactId, true)
    contact.vehicles.push({ ...contactVehicleFields(contact, input), id: crypto.randomUUID() })
    saveDemoData(data)
  },

  async updateVehicle(contactId: string, id: string, input: ContactVehicleInput): Promise<void> {
    const data = readDemoData()
    const contact = requireOwnContact(data, contactId, true)
    const vehicle = contact.vehicles.find((item) => item.id === id)
    if (!vehicle) throw new Error('No se encontró ese vehículo en el contacto.')
    Object.assign(vehicle, contactVehicleFields(contact, input, id))
    saveDemoData(data)
  },
}
