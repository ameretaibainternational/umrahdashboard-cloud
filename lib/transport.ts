export const TRANSPORT_VEHICLES = ['CAR', 'H1', 'STARIA', 'GMC', 'HIACE', 'COASTER'] as const

export type TransportVehicle = (typeof TRANSPORT_VEHICLES)[number]

export const DEFAULT_TRANSPORT_VEHICLE: TransportVehicle = 'CAR'

/** Default SAR rates per vehicle (1–4 pax). Editable in Settings → Transport. */
export const DEFAULT_TRANSPORT_RATE_SAR: Record<TransportVehicle, [number, number, number, number]> = {
  CAR: [450, 430, 410, 390],
  H1: [550, 520, 490, 460],
  STARIA: [600, 570, 540, 510],
  GMC: [700, 670, 640, 610],
  HIACE: [800, 760, 720, 680],
  COASTER: [1200, 1100, 1000, 900],
}

export function isTransportVehicle(value: string): value is TransportVehicle {
  return (TRANSPORT_VEHICLES as readonly string[]).includes(value)
}

/** Map legacy bus/private values and unknown strings to a valid vehicle. */
export function normalizeTransportType(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value === 'private') return 'CAR'
  if (value === 'bus') return 'HIACE'
  return DEFAULT_TRANSPORT_VEHICLE
}

export function listTransportOptions(rates: { type: string }[]): string[] {
  const custom = [...new Set(
    rates
      .map(r => r.type)
      .filter(type => !isTransportVehicle(type)),
  )].sort((a, b) => a.localeCompare(b))
  return [...TRANSPORT_VEHICLES, ...custom]
}

export function transportServiceName(vehicle: string): string {
  return `Transport — ${vehicle}`
}

export function transportServiceNames(vehicles: readonly string[] = TRANSPORT_VEHICLES): string[] {
  return vehicles.map(transportServiceName)
}
