import type { CalcInput, CalcResult, TransportRate, VisaSettings, ZiaratOption, RouteVehicleRate, TransportRoute, TransportVehicle } from './types'
import { normalizeTransportType } from './transport'

function getAdultVisaRate(visa: VisaSettings, pax: number): number {
  if (pax <= 1) return visa.visa_rate_1_pax
  if (pax === 2) return visa.visa_rate_2_pax
  if (pax === 3) return visa.visa_rate_3_pax
  if (pax === 4) return visa.visa_rate_4_pax
  if (pax === 5) return visa.visa_rate_5_pax
  return visa.visa_rate_group_pax
}

function hotelRateSar(hotel: CalcInput['makkahHotel'], room: CalcInput['makkahRoom']): number {
  if (!hotel) return 0
  const key = `${room}_sar` as keyof typeof hotel
  return (hotel[key] as number) ?? 0
}

export function getCalc(
  input: CalcInput,
  transportRates: TransportRate[],
  sarToPkr: number,
  visa: VisaSettings,
  transportMode: 'included' | 'separate',
  ziarats: ZiaratOption[],
  routeVehicleRates?: RouteVehicleRate[],
  transportVehicles?: TransportVehicle[],
  transportRoutes?: TransportRoute[],
): CalcResult {
  const { adult, child, infant, airline, transportType,
          makkahHotel, makkahRoom, makkahNights,
          madinahHotel, madinahRoom, madinahNights,
          profitType, profitValue, sellingOverride, advance,
          selectedZiaratIds,
          includeMakkahHotel, includeMadinahHotel,
          includeTickets, includeTransport = true, includeVisa = true,
          customTicket, customTicketPkr,
          currencyUnit = 'PKR',
          customVisaPkr } = input

  const pax = Math.max(1, adult + child + infant)

  const rawTicketCostPkr = includeTickets
    ? (customTicket
      ? customTicketPkr
      : airline
        ? adult * airline.adult_pkr + child * airline.child_pkr + infant * airline.infant_pkr
        : 0)
    : 0

  const ticketCost = currencyUnit === 'SAR'
    ? rawTicketCostPkr / sarToPkr
    : rawTicketCostPkr

  let visaCost = 0
  if (includeVisa) {
    if (customVisaPkr && customVisaPkr > 0) {
      visaCost = currencyUnit === 'SAR' ? customVisaPkr / sarToPkr : customVisaPkr
    } else {
      const visaAdultSar = getAdultVisaRate(visa, pax)
      const rawVisaCostSar = adult * visaAdultSar + child * visa.child_sar + infant * visa.infant_sar
      visaCost = currencyUnit === 'SAR' ? rawVisaCostSar : rawVisaCostSar * sarToPkr
    }
  }


  let rawTransportCostSar = 0
  if (routeVehicleRates && transportVehicles && input.selectedTransportRouteIds && input.selectedTransportRouteIds.length > 0) {
    const selectedVehicle = transportVehicles.find(v => v.name === transportType)
    if (selectedVehicle) {
      const activeRates = routeVehicleRates.filter(
        r => r.vehicle_id === selectedVehicle.id && input.selectedTransportRouteIds?.includes(r.route_id)
      )
      rawTransportCostSar = includeTransport ? activeRates.reduce((s, r) => s + Number(r.rate_sar), 0) : 0
    }
  } else {
    const vehicle = normalizeTransportType(transportType)
    const paxKey = Math.min(Math.max(pax, 1), 4)
    const rate = transportRates.find(r => r.type === vehicle && r.pax_count === paxKey)
      ?? transportRates.find(r => normalizeTransportType(r.type) === vehicle && r.pax_count === paxKey)
    rawTransportCostSar = includeTransport ? (rate?.rate_sar ?? 0) : 0
  }
  const transportCost = currencyUnit === 'SAR' ? rawTransportCostSar : rawTransportCostSar * sarToPkr

  const makkahRateSar = includeMakkahHotel ? hotelRateSar(makkahHotel, makkahRoom) : 0
  const makkahMultiplier = makkahRoom === 'room' ? 1 : Math.max(1, adult + child)
  const rawMakkahCostSar = makkahRateSar * makkahNights * makkahMultiplier
  const makkahCost = currencyUnit === 'SAR' ? rawMakkahCostSar : rawMakkahCostSar * sarToPkr

  const madinahRateSar = includeMadinahHotel ? hotelRateSar(madinahHotel, madinahRoom) : 0
  const madinahMultiplier = madinahRoom === 'room' ? 1 : Math.max(1, adult + child)
  const rawMadinahCostSar = madinahRateSar * madinahNights * madinahMultiplier
  const madinahCost = currencyUnit === 'SAR' ? rawMadinahCostSar : rawMadinahCostSar * sarToPkr

  const selected = new Set(selectedZiaratIds)
  const ziaratItems = ziarats
    .filter(z => selected.has(z.id))
    .map(z => ({
      id: z.id,
      name: z.name,
      cost: currencyUnit === 'SAR' ? z.rate_sar : z.rate_sar * sarToPkr,
    }))
  const ziaratTotalCost = ziaratItems.reduce((sum, item) => sum + item.cost, 0)

  const totalCost = ticketCost + visaCost + transportCost + makkahCost + madinahCost + ziaratTotalCost

  let autoSelling: number
  if (profitType === 'fixed') {
    autoSelling = totalCost + profitValue
  } else {
    autoSelling = Math.round(totalCost + totalCost * (profitValue / 100))
  }

  const selling = sellingOverride && sellingOverride > 0 ? sellingOverride : autoSelling
  const profit = selling - totalCost
  const remaining = Math.max(0, selling - advance)
  const perPax = Math.round(selling / pax)

  return {
    pax,
    ticketCost,
    visaCost,
    transportCost,
    makkahCost,
    madinahCost,
    ziaratItems,
    totalCost,
    selling,
    profit,
    remaining,
    perPax,
  }
}

export function generateInvoiceNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = String(Date.now()).slice(-4)
  return `INV-${y}${m}${d}-${rand}`
}
