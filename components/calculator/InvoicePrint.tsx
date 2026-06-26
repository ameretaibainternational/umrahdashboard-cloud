import { forwardRef } from 'react'
import { Plane } from 'lucide-react'
import type { Airline, Hotel, CalcResult, Company } from '@/lib/types'
import { pkr } from '@/lib/formatters'

interface Props {
  invoiceNo: string
  customerName: string
  adult: number
  child: number
  infant: number
  airline: Airline | null
  makkahHotel: Hotel | null
  makkahRoom: string
  makkahNights: number
  madinahHotel: Hotel | null
  madinahRoom: string
  madinahNights: number
  calc: CalcResult
  advance: number
  transportMode: 'included' | 'separate'
  company: Company
  customTicket: boolean
  customTicketLabel: string
  customTicketPkr: number
  makkahZiarat: boolean
  madinahZiarat: boolean
  travelDate: string
  departureCity: string
  arrivalCity: string
  returnCity: string
}

const InvoicePrint = forwardRef<HTMLDivElement, Props>(function InvoicePrint(
  { invoiceNo, customerName, adult, child, infant, airline,
    makkahHotel, makkahRoom, makkahNights, madinahHotel, madinahRoom, madinahNights,
    calc, advance, transportMode, company,
    customTicket, customTicketLabel, customTicketPkr,
    makkahZiarat, madinahZiarat, travelDate,
    departureCity, arrivalCity, returnCity }, ref
) {
  const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })
  const formattedTravelDate = travelDate
    ? new Date(travelDate + 'T00:00:00').toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })
    : null
  const totalNights = makkahNights + madinahNights
  const totalPax = adult + child + infant
  const paxStr = [
    adult > 0 ? `${adult} Adult${adult > 1 ? 's' : ''}` : '',
    child > 0 ? `${child} Child${child > 1 ? 'ren' : ''}` : '',
    infant > 0 ? `${infant} Infant${infant > 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(', ')

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  // Helper: single label→value row inside a card
  const row = (label: string, value: string, bold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
      <span style={{ fontSize: '10px', color: '#111827', flexShrink: 0, minWidth: '64px', paddingRight: '8px', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '10px', fontWeight: bold ? 700 : 500, textAlign: 'right', color: bold ? '#111827' : '#374151', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )

  const sectionHead = (title: string) => (
    <p style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', margin: '0 0 8px', paddingBottom: '6px', borderBottom: '1px solid #e5e7eb' }}>{title}</p>
  )

  return (
    <div ref={ref} style={{ fontFamily: 'Inter, sans-serif', color: '#1a1a1a', background: 'white' }}>
      <div style={{ width: '194mm', margin: '0 auto', padding: '8mm' }}>
        {/* Header */}
        <div style={{ background: '#071426', color: 'white', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Logo */}
            {company.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={company.logo_url}
                alt={company.name}
                style={{ width: '44px', height: '44px', borderRadius: '100%', objectFit: 'contain', background: 'transparent', padding: '0px', flexShrink: 0 }}
              />
            ) : (
              <img src="/logo.webp" alt="Fast Travels & Tours" style={{ width: '54px', height: '54px', borderRadius: '100%', objectFit: 'contain', background: 'transparent', padding: '0px', flexShrink: 0 }} />
            )}
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#d4a84f' }}>{company.name}</h1>
              {company.license && <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', margin: '2px 0 0', fontWeight: 500 }}>{company.license}</p>}
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{company.address} • {company.website}</p>
              {company.phone && <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', margin: '1px 0 0' }}>{company.phone}</p>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#d4a84f', margin: 0 }}>INVOICE</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: '2px 0 0' }}>{invoiceNo}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', margin: '1px 0 0' }}>{today}</p>
          </div>
        </div>

        {/* Customer */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>CUSTOMER</p>
            <p style={{ fontSize: '14px', fontWeight: 700 }}>{customerName}</p>
            <p style={{ fontSize: '11px', color: '#6b7280' }}>{paxStr}</p>
          </div>
          {formattedTravelDate && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>TRAVEL DATE</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#d4a84f' }}>{formattedTravelDate}</p>
            </div>
          )}
        </div>

        {/* Package Details — 2×2 card grid */}
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.07em', marginBottom: '8px' }}>PACKAGE DETAILS</p>

          {/* Row 1: Flight & Passengers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>

            {/* Flight */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px' }}>
              {sectionHead('✈  FLIGHT & TRANSPORT')}
              {row('Airline', customTicket ? (customTicketLabel || 'Custom') : (airline?.name ?? 'N/A'), true)}
              {customTicket && customTicketPkr > 0 && row('Ticket Cost', pkr(customTicketPkr))}
              {(departureCity || arrivalCity) && row('Route', `${departureCity || '—'} → ${arrivalCity || '—'} → ${returnCity || '—'}`)}
              {row('Transport', transportMode === 'included' ? 'Included in Pkg' : 'Separate')}
              {row('Total Nights', `${totalNights} Nights`, true)}
              {makkahZiarat  && row('Makkah Ziarats',  'Included')}
              {madinahZiarat && row('Madinah Ziarats', 'Included')}
            </div>

            {/* Passengers */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px' }}>
              {sectionHead('👥  PASSENGERS')}
              {adult > 0   && row('Adults',   `${adult}`)}
              {child > 0   && row('Children', `${child}`)}
              {infant > 0  && row('Infants',  `${infant}`)}
              {row('Total PAX', `${totalPax} Person${totalPax > 1 ? 's' : ''}`, true)}
            </div>
          </div>

          {/* Row 2: Makkah & Madinah */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

            {/* Makkah */}
            <div style={{ border: '1px solid #e5e7eb', borderLeft: '3px solid #d7ab52', borderRadius: '8px', padding: '10px 12px' }}>
              {sectionHead('🕌  MAKKAH HOTEL')}
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#111827', margin: '0 0 7px', lineHeight: 1.3 }}>
                {makkahHotel?.name ?? 'N/A'}
              </p>
              {row('Room Type', cap(makkahRoom))}
              {makkahHotel && row('Location', makkahHotel.location)}
              {makkahHotel && row('Distance', makkahHotel.distance)}
              {row('Nights', `${makkahNights} Nights`, true)}
            </div>

            {/* Madinah */}
            <div style={{ border: '1px solid #e5e7eb', borderLeft: '3px solid #d7ab52', borderRadius: '8px', padding: '10px 12px' }}>
              {sectionHead('🕌  MADINAH HOTEL')}
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#111827', margin: '0 0 7px', lineHeight: 1.3 }}>
                {madinahHotel?.name ?? 'N/A'}
              </p>
              {row('Room Type', cap(madinahRoom))}
              {madinahHotel && row('Location', madinahHotel.location)}
              {madinahHotel && row('Distance', madinahHotel.distance)}
              {row('Nights', `${madinahNights} Nights`, true)}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div style={{ background: '#071426', color: 'white', borderRadius: '8px', padding: '14px 16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Package Amount</span>
            <span style={{ fontWeight: 600 }}>{pkr(calc.selling)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Advance Received</span>
            <span style={{ fontWeight: 600 }}>{pkr(advance)}</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#d4a84f', fontWeight: 700 }}>Total Payable</span>
            <span style={{ color: '#d4a84f', fontWeight: 800, fontSize: '16px' }}>{pkr(calc.remaining)}</span>
          </div>
        </div>

        {/* Terms */}
        <div style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '12px' }}>
          <p style={{ fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>Terms & Conditions:</p>
          <p>• Package rates are valid at time of booking. Changes in airline fares or visa fees may affect the final price.</p>
          <p>• Advance payment confirms the booking. Remaining balance due before departure.</p>
          <p>• We are not responsible for visa rejection or flight cancellations by the airline.</p>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
          <p style={{ fontSize: '10px', color: '#9ca3af' }}>Thank you for choosing {company.name}</p>
          <div style={{ textAlign: 'right', fontSize: '10px', color: '#6b7280' }}>
            <p style={{ borderTop: '1px solid #6b7280', paddingTop: '4px', width: '120px', marginLeft: 'auto' }}>Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  )
})

export default InvoicePrint
