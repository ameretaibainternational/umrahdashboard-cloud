export const DEFAULT_PK_FLIGHT_CITIES = [
  'Islamabad', 'Lahore', 'Karachi', 'Peshawar', 'Multan', 'Sialkot', 'Faisalabad', 'Quetta',
]

export const DEFAULT_SA_FLIGHT_CITIES = [
  'Jeddah', 'Madinah', 'Riyadh', 'Dammam',
]

export function parseFlightCities(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map(s => s.trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean)
    } catch { /* ignore */ }
  }
  return [...fallback]
}

export function citiesToFormValue(cities: string[]): string {
  return cities.join('\n')
}

export function formValueToCities(text: string, fallback: string[]): string[] {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
  return lines.length > 0 ? lines : [...fallback]
}
