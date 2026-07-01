import type { HotelContact } from './types'

export const HOTEL_CONTACT_CITIES = ['Makkah', 'Madinah', 'Jeddah'] as const

export function hotelContactLabel(contact: Pick<HotelContact, 'name' | 'city'>): string {
  return `${contact.name} · ${contact.city}`
}

export function isMakkahContactCity(city: string): boolean {
  return city.trim().toLowerCase() === 'makkah'
}

export function isMadinahContactCity(city: string): boolean {
  const c = city.trim().toLowerCase()
  return c === 'madinah' || c === 'madina'
}

export function filterHotelContactsByCity(contacts: HotelContact[], kind: 'makkah' | 'madinah'): HotelContact[] {
  return contacts.filter(c =>
    kind === 'makkah' ? isMakkahContactCity(c.city) : isMadinahContactCity(c.city),
  )
}

export function findHotelContactByNumber(contacts: HotelContact[], number: string): HotelContact | undefined {
  const trimmed = number.trim()
  if (!trimmed) return undefined
  return contacts.find(c => c.contact_number.trim() === trimmed)
}
