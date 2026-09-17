import { sharedMode } from './shared/provider.js'
import { sharedContacts } from './shared/adapters.js'
import type { ContactAccess, ContactInput, ContactVehicleInput, FrequentContact } from '../types/contacts.js'
import { contactFields, contactVehicleFields, requireContactUser, requireOwnContact } from './contactRules.js'
import { readDemoData, saveDemoData, subscribeToDemoChanges } from './demoStorage.js'
import { generateId } from '../utils/id.js'

const searchKey = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

const localService = {
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
    const id = generateId()
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

  async deleteContact(id: string): Promise<void> {
    const data = readDemoData()
    requireOwnContact(data, id, true)
    data.contacts = data.contacts.filter((contact) => contact.id !== id)
    saveDemoData(data)
  },

  async createVehicle(contactId: string, input: ContactVehicleInput): Promise<void> {
    const data = readDemoData()
    const contact = requireOwnContact(data, contactId, true)
    contact.vehicles.push({ ...contactVehicleFields(contact, input), id: generateId() })
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

  async deleteVehicle(contactId: string, id: string): Promise<void> {
    const data = readDemoData()
    const contact = requireOwnContact(data, contactId, true)
    if (!contact.vehicles.some((vehicle) => vehicle.id === id)) throw new Error('No se encontró ese vehículo en el contacto.')
    contact.vehicles = contact.vehicles.filter((vehicle) => vehicle.id !== id)
    saveDemoData(data)
  },
}

export const contactsService = sharedMode ? sharedContacts : localService
