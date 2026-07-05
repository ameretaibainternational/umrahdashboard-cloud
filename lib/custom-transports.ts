import type { CustomTransport } from '@/lib/types'

export function customTransportRates(ct: CustomTransport): [number, number, number, number] {
  return [ct.rate_1_sar, ct.rate_2_sar, ct.rate_3_sar, ct.rate_4_sar]
}

export function customTransportToRateRows(ct: CustomTransport) {
  return ([1, 2, 3, 4] as const).map((pax_count, index) => ({
    id: `${ct.id}-${pax_count}`,
    type: ct.name,
    pax_count,
    rate_sar: customTransportRates(ct)[index],
  }))
}
