import type { CalcInput, CalcResult, TransportRate, VisaSettings } from './types'

function getAdultVisaRate(visa: VisaSettings, pax: number): number {
  if (pax <= 1) return visa.visa_rate_1_pax
  if (pax === 2) return visa.visa_rate_2_pax
  if (pax === 3) return visa.visa_rate_3_pax
  if (pax === 4) return visa.visa_rate_4_pax
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
  transportMode: 'included' | 'separate'
): CalcResult {
  const { adult, child, infant, airline, transportType,
          makkahHotel, makkahRoom, makkahNights,
          madinahHotel, madinahRoom, madinahNights,
          profitType, profitValue, sellingOverride, advance,
          makkahZiarat, madinahZiarat, badrZiarat, taifZiarat,
          includeMakkahHotel, includeMadinahHotel,
          customTicket, customTicketPkr } = input

  const pax = Math.max(1, adult + child + infant)

  const ticketCost = customTicket
    ? customTicketPkr
    : airline
      ? adult * airline.adult_pkr + child * airline.child_pkr + infant * airline.infant_pkr
      : 0

  const visaAdultSar = getAdultVisaRate(visa, pax)
  const visaCost = ((adult + child) * visaAdultSar + infant * visa.infant_sar) * sarToPkr

  let transportCost = 0
  if (transportMode === 'separate') {
    const paxKey = Math.min(Math.max(pax, 1), 4)
    const rate = transportRates.find(r => r.type === transportType && r.pax_count === paxKey)
    transportCost = (rate?.rate_sar ?? 0) * sarToPkr
  }

  const makkahRateSar = includeMakkahHotel ? hotelRateSar(makkahHotel, makkahRoom) : 0
  const makkahCost = makkahRateSar * sarToPkr * makkahNights * pax

  const madinahRateSar = includeMadinahHotel ? hotelRateSar(madinahHotel, madinahRoom) : 0
  const madinahCost = madinahRateSar * sarToPkr * madinahNights * pax

  const makkahZiaratCost = makkahZiarat ? visa.makkah_ziarat_rate * sarToPkr : 0
  const madinahZiaratCost = madinahZiarat ? visa.madina_ziarat_rate * sarToPkr : 0
  const badrZiaratCost = badrZiarat ? (visa.badr_ziarat_rate ?? 0) * sarToPkr : 0
  const taifZiaratCost = taifZiarat ? (visa.taif_ziarat_rate ?? 0) * sarToPkr : 0

  const totalCost = ticketCost + visaCost + transportCost + makkahCost + madinahCost
    + makkahZiaratCost + madinahZiaratCost + badrZiaratCost + taifZiaratCost

  let autoSelling: number
  if (profitType === 'fixed') {
    autoSelling = totalCost + profitValue
  } else {
    autoSelling = Math.round(totalCost + totalCost * (profitValue / 100))
  }

  const autoProfit = autoSelling - totalCost
  const selling = sellingOverride && sellingOverride > 0 ? sellingOverride : autoSelling
  let profit: number
  if (sellingOverride && sellingOverride > 0 && sellingOverride !== autoSelling) {
    const discount = Math.max(0, autoSelling - sellingOverride)
    profit = discount > autoProfit ? 2 * autoProfit - discount : autoProfit - discount
  } else {
    profit = selling - totalCost
  }
  const remaining = Math.max(0, selling - advance)
  const perPax = Math.round(selling / pax)

  return {
    pax,
    ticketCost,
    visaCost,
    transportCost,
    makkahCost,
    madinahCost,
    makkahZiaratCost,
    madinahZiaratCost,
    badrZiaratCost,
    taifZiaratCost,
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
