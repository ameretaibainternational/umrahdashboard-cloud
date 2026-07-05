import { forwardRef } from 'react'
import {
  resolveVoucherLogoRect,
  scaleVoucherRect,
  type VoucherBranding,
} from '@/lib/hotel-voucher-branding-layout'

// ─── Data types ───────────────────────────────────────────────────────────────
export interface Pilgrim {
  id: string
  name: string
  passportNo: string
  pax: string
  beds: string
  visaNumber: string
}

export interface Accommodation {
  id: string
  hotelName: string
  confirmNo: string
  city: string
  roomType: string
  mealPlan: string
  checkIn: string
  checkOut: string
  nights: string
}

export interface VoucherData {
  voucherNo: string
  referenceNo: string
  date: string        // ISO "YYYY-MM-DD"
  packageInfo: string
  familyHead: string
  companyName: string
  pilgrims: Pilgrim[]
  accommodations: Accommodation[]
  makkahHotelContact: string
  madinaHotelContact: string
  makkahHotelContactId?: string
  madinaHotelContactId?: string
  makkahTransportContact: string
  madinaTransportContact: string
  jeddahTransportContact: string
  makkahTransportContactId?: string
  madinaTransportContactId?: string
  jeddahTransportContactId?: string
  checkInTime: string
  checkOutTime: string
  showVisaNumber: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── Grid table (div-based — absolute text avoids html2canvas baseline bugs) ─
const GRID_BORDER = '1px solid rgba(255, 255, 255, 0.35)'
const GLASS_CELL = 'rgba(255, 255, 255, 0.08)'
const GLASS_CELL_ALT = 'rgba(255, 255, 255, 0.04)'
const GLASS_HDR = 'rgba(255, 255, 255, 0.14)'
const GLASS_BLUR: React.CSSProperties = {
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
}
const GLASS_BOX: React.CSSProperties = {
  backgroundColor: GLASS_CELL,
  border: '1px solid rgba(255, 255, 255, 0.35)',
  borderRadius: '6px',
  boxSizing: 'border-box',
  height: '100%',
  ...GLASS_BLUR,
}

const META_H = 32
const META_VALUE_FONT = 16
const META_LABEL_FONT = 14
// Identical strategy to GridCell — absolute line inside a fixed-height box
const META_TOP = Math.round((META_H - META_VALUE_FONT) / 2)

function MetaField({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div
      data-meta-field
      style={{
        position: 'relative',
        height: `${META_H}px`,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: 0,
        backgroundColor: GLASS_CELL,
        border: '1px solid rgba(255, 255, 255, 0.35)',
        borderRadius: '6px',
        overflow: 'visible',
        ...GLASS_BLUR,
      }}
    >
      <span
        data-meta-field-text
        style={{
          position: 'absolute',
          top: `${META_TOP}px`,
          left: '12px',
          right: '12px',
          fontSize: `${META_VALUE_FONT}px`,
          lineHeight: `${META_VALUE_FONT}px`,
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#ffffff',
          whiteSpace: 'nowrap',
          margin: 0,
          padding: 0,
        }}
      >
        <span style={{ fontSize: `${META_LABEL_FONT}px`, fontWeight: 600 }}>
          {label}:{' '}
        </span>
        <span style={{
          fontWeight: accent ? 700 : 500,
          color: accent ? '#ffc633' : '#ffffff',
        }}>
          {value}
        </span>
      </span>
    </div>
  )
}
const CELL_H = 24
const CELL_FONT = 11
// Optically centered in browser; html2canvas renders ~4px lower so PDF uses PDF_CELL_TOP in onclone
const CELL_TOP = Math.round((CELL_H - CELL_FONT) / 2) // 7px

function GridCell({
  isHeader,
  align = 'left',
  bg = GLASS_CELL,
  children,
}: {
  isHeader: boolean
  align?: 'left' | 'center'
  bg?: string
  children: React.ReactNode
}) {
  const textStyle: React.CSSProperties = {
    position: 'absolute',
    top: isHeader ? `${CELL_TOP}px` : `${CELL_TOP - 2}px`,
    left: align === 'center' ? '50%' : '6px',
    transform: align === 'center' ? 'translateX(-50%)' : undefined,
    fontSize: `${CELL_FONT}px`,
    lineHeight: `${CELL_FONT}px`,
    fontWeight: isHeader ? 700 : 400,
    color: '#ffffff',
    fontFamily: 'Arial, Helvetica, sans-serif',
    whiteSpace: 'nowrap',
    margin: 0,
    padding: 0,
  }

  return (
    <div
      data-grid-cell
      style={{
        position: 'relative',
        height: `${CELL_H}px`,
        backgroundColor: isHeader ? GLASS_HDR : bg,
        borderRight: GRID_BORDER,
        borderBottom: GRID_BORDER,
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...GLASS_BLUR,
      }}
    >
      <span data-grid-cell-text data-cell-header={isHeader ? '1' : '0'} style={textStyle}>{children}</span>
    </div>
  )
}

function GridTable({
  columns,
  rows,
}: {
  columns: { label: string; width?: string; align?: 'left' | 'center' }[]
  rows: { id: string; cells: React.ReactNode[] }[]
}) {
  const gridCols = columns.map(c => c.width ?? '1fr').join(' ')
  return (
    <div style={{ borderLeft: GRID_BORDER, borderTop: GRID_BORDER, ...GLASS_BLUR }}>
      <div style={{ display: 'grid', gridTemplateColumns: gridCols }}>
        {columns.map((col, i) => (
          <GridCell key={`h-${i}`} isHeader align={col.align}>{col.label}</GridCell>
        ))}
        {rows.map((row, ri) =>
          row.cells.map((cell, ci) => (
            <GridCell
              key={`${row.id}-${ci}`}
              isHeader={false}
              align={columns[ci].align}
              bg={ri % 2 === 0 ? GLASS_CELL : GLASS_CELL_ALT}
            >
              {cell}
            </GridCell>
          ))
        )}
      </div>
    </div>
  )
}

const SECTION_HDR_H = 28
const SECTION_HDR_FONT = 13
const SECTION_HDR_TOP = Math.round((SECTION_HDR_H - SECTION_HDR_FONT) / 2)

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-section-header
      style={{
        position: 'relative',
        height: `${SECTION_HDR_H}px`,
        backgroundColor: GLASS_HDR,
        borderRadius: '8px 8px 0 0',
        marginBottom: '6px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderBottom: 'none',
        ...GLASS_BLUR,
      }}
    >
      <span
        data-section-header-text
        style={{
          position: 'absolute',
          top: `${SECTION_HDR_TOP}px`,
          left: '10px',
          fontSize: `${SECTION_HDR_FONT}px`,
          lineHeight: `${SECTION_HDR_FONT}px`,
          fontWeight: 500,
          letterSpacing: 'normal',
          wordSpacing: 'normal',
          color: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        {children}
      </span>
    </div>
  )
}

// ─── Urdu typography (Page 2) ────────────────────────────────────────────────
export const URDU_FONT = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif"
export const JAMEEL_WOFF = 'https://cdn.jsdelivr.net/gh/tariq-abdullah/urdu-web-font-CDN/JameelNooriNastaleeq.woff'

export function VoucherBrandingLogo({ branding }: { branding: VoucherBranding }) {
  if (!branding.logoUrl) return null
  const { x, y, w, h } = resolveVoucherLogoRect(branding)
  const rect = scaleVoucherRect(x, y, w, h)
  return (
    <img
      src={branding.logoUrl}
      alt=""
      data-voucher-branding-logo="1"
      style={{
        position: 'absolute',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        objectFit: 'contain',
        objectPosition: 'left top',
        pointerEvents: 'none',
        zIndex: 15,
      }}
    />
  )
}
const URDU_TEXT: React.CSSProperties = {
  fontFamily: URDU_FONT,
  fontWeight: 'normal',
  fontSize: '16px',
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  fontVariantLigatures: 'normal',
  wordBreak: 'normal',
  overflowWrap: 'normal',
}

// ─── PAGE 1 ───────────────────────────────────────────────────────────────────
export const VoucherPage1 = forwardRef<HTMLDivElement, { data: VoucherData; branding?: VoucherBranding }>(
  function VoucherPage1({ data, branding }, ref) {
    const showVisa = data.showVisaNumber !== false
    const pilgrimColumns = [
      { label: 'Mutamer Name' },
      { label: 'Passport No' },
      { label: 'Pax', width: '40px', align: 'center' as const },
      { label: 'Beds', width: '40px', align: 'center' as const },
      ...(showVisa ? [{ label: 'Visa Number' }] : []),
    ]
    const pilgrimRows = data.pilgrims.map(p => ({
      id: p.id,
      cells: showVisa
        ? [p.name, p.passportNo, p.pax, p.beds, p.visaNumber]
        : [p.name, p.passportNo, p.pax, p.beds],
    }))
    const hasContactNotes =
      data.makkahHotelContact ||
      data.madinaHotelContact ||
      data.makkahTransportContact ||
      data.madinaTransportContact ||
      data.jeddahTransportContact ||
      data.checkInTime ||
      data.checkOutTime

    return (
      <div
        ref={ref}
        data-voucher-p1
        style={{
          position: 'relative',
          width: '794px',
          height: '1123px',
          overflow: 'hidden',
          fontFamily: "Arial, Helvetica, sans-serif",
          letterSpacing: 'normal',
          wordSpacing: 'normal',
          backgroundColor: '#ffffff',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        } as React.CSSProperties}
      >
        {/* Background image — stripped in onclone during PDF capture */}
        <img
          data-bg
          src="/Empty-Hotel-Voucher.jpg"
          alt=""
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', zIndex: 0,
          }}
        />

        {/* All content sits above the background */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}>
          {branding?.logoUrl && <VoucherBrandingLogo branding={branding} />}

          {/* A ── Header (centered) */}
          <div style={{ position: 'absolute', top: '40px', left: 0, right: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '34px', fontWeight: 700, color: '#ffffff' }}>
              {data.companyName?.trim() || 'Amere Taiba International'}
            </div>
          </div>

          {/* HOTEL VOUCHER — centered, slightly below header */}
          <div style={{
            position: 'absolute',
            top: '140px',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: '28px',
            fontWeight: 700,
            textTransform: 'uppercase',
            
            letterSpacing: 'normal',
            color: '#ffffff',
          }}>
            HOTEL VOUCHER
          </div>

          {/* B + C + D + E ── Meta fields & tables (single flowing column — no overlap) */}
          <div style={{
            position: 'absolute',
            top: '210px',
            left: '40px',
            right: '40px',
            bottom: '100px',
            overflowX: 'visible',
            overflowY: 'hidden',
          }}>

            {/* B ── Voucher meta */}
            <div style={{ marginBottom: '20px', overflow: 'visible' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: '8px 12px',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                  <MetaField label="Company" value="AMERE TAIBA INTERNATIONAL" />
                  <MetaField label="Voucher No" value={data.voucherNo || '—'}   accent  />
                  <MetaField label="Family Head" value={data.familyHead ? data.familyHead.toUpperCase() : '—'} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                  <MetaField label="Reference No" value={data.referenceNo || '—'} />
                  <MetaField label="Date" value={data.date ? fmtDate(data.date) : '—'} />
                  <MetaField label="Package" value={data.packageInfo || '—'} />
                </div>
              </div>
            </div>

            {/* C ── Pilgrims Details */}
            <div>
              <SectionHeader>Pilgrims Details</SectionHeader>
              <GridTable
                columns={pilgrimColumns}
                rows={pilgrimRows}
              />
            </div>

            {/* D ── Accommodation Details */}
            <div style={{ marginTop: '30px' }}>
              <SectionHeader>Accommodation Details</SectionHeader>
              <GridTable
                columns={[
                  { label: 'Hotel Name', width: 'minmax(100px, 2.4fr)' },
                  { label: 'Confirm No', width: '100px' },
                  { label: 'City', width: '56px' },
                  { label: 'Room Type', width: '75px' },
                  { label: 'Meal', width: '44px', align: 'center' },
                  { label: 'Check In', width: '75px' },
                  { label: 'Check Out', width: '75px' },
                  { label: 'Nights', width: '45px', align: 'center' },
                ]}
                rows={data.accommodations.map(a => ({
                  id: a.id,
                  cells: [
                    a.hotelName, a.confirmNo, a.city, a.roomType, a.mealPlan,
                    fmtDate(a.checkIn), fmtDate(a.checkOut), a.nights,
                  ],
                }))}
              />
            </div>

            {/* E ── Contact & Timing Notes */}
            {hasContactNotes && (
              <div style={{ marginTop: '30px', fontSize: '12px', lineHeight: 1.7, fontWeight: 400, color: '#ffffff' }}>
                {data.makkahHotelContact && (
                  <div>
                    <span style={{ fontWeight: 500 }}>Makkah Hotel Contact: </span>
                    {data.makkahHotelContact}
                  </div>
                )}
                {data.madinaHotelContact && (
                  <div>
                    <span style={{ fontWeight: 500 }}>Madina Hotel Contact: </span>
                    {data.madinaHotelContact}
                  </div>
                )}
                {data.makkahTransportContact && (
                  <div>
                    <span style={{ fontWeight: 500 }}>Makkah Transport Contact: </span>
                    {data.makkahTransportContact}
                  </div>
                )}
                {data.madinaTransportContact && (
                  <div>
                    <span style={{ fontWeight: 500 }}>Madina Transport Contact: </span>
                    {data.madinaTransportContact}
                  </div>
                )}
                {data.jeddahTransportContact && (
                  <div>
                    <span style={{ fontWeight: 500 }}>Jeddah Transport Contact: </span>
                    {data.jeddahTransportContact}
                  </div>
                )}
                {(data.checkInTime || data.checkOutTime) && (
                  <div>
                    {data.checkInTime && (
                      <span><span style={{ fontWeight: 600 }}>Check-In Time: </span>{data.checkInTime}</span>
                    )}
                    {data.checkInTime && data.checkOutTime && <span>  &nbsp;|&nbsp;  </span>}
                    {data.checkOutTime && (
                      <span><span style={{ fontWeight: 600 }}>Check-Out Time: </span>{data.checkOutTime}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* F ── Footer note (absolute bottom) */}
          <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, textAlign: 'center' }}>
            <div style={{
              display: 'inline-block',
              borderTop: '2px solid #ffffff',
              paddingTop: '10px',
              width: '80%',
              fontSize: '14px',
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: 'normal',
              wordSpacing: 'normal',
            }}>
              NOTE: THIS BOOKING WILL NOT REFUND, NOT CHANGE
            </div>
          </div>
        </div>
      </div>
    )
  }
)

// ─── PAGE 2 (Urdu Instructions) ───────────────────────────────────────────────
export interface VoucherPage2Props {
  urduLines: string[]
  urduFooter: string
  branding?: VoucherBranding
}

export const VoucherPage2 = forwardRef<HTMLDivElement, VoucherPage2Props>(
  function VoucherPage2({ urduLines, urduFooter, branding }, ref) {
    return (
      <div
        ref={ref}
        data-voucher-p2
        style={{
          position: 'relative',
          width: '794px',
          height: '1123px',
          overflow: 'hidden',
          backgroundColor: '#121117',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        } as React.CSSProperties}
      >
        <img
          data-bg
          src="/Empty-Hotel-Voucher.jpg"
          alt=""
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', zIndex: 0,
          }}
        />

        {branding?.logoUrl && <VoucherBrandingLogo branding={branding} />}

        <div
          dir="rtl"
          style={{
            position: 'absolute', top: 20, left: 0,
            width: '100%', height: '100%', zIndex: 10,
            padding: '40px 50px',
            boxSizing: 'border-box',
            ...URDU_TEXT,
          }}
        >
          <h1
            data-urdu-text
            style={{
              ...URDU_TEXT,
              fontSize: '48px',
              lineHeight: 1.4,
              fontWeight: 'normal',
              textAlign: 'center',
              marginBottom: '24px',
              
              color: '#ffffff',
              marginTop: 0,
            }}
          >
            ضروری ہدایات
          </h1>

          <div style={{ margin: 0, padding: 0 }}>
            {urduLines.map((line, i) => (
              <div
                key={i}
                dir="rtl"
                data-urdu-text
                style={{
                  ...URDU_TEXT,
                  marginBottom: '4px',
                  fontSize: '16px',
                  lineHeight: 2.2,
                  color: '#ffffff',
                  textAlign: 'justify',
                }}
              >
                {`${i + 1}. ${line}`}
              </div>
            ))}
          </div>

          <p
            data-urdu-text
            style={{
              ...URDU_TEXT,
              fontSize: '20px',
              fontWeight: 'normal',
              marginTop: '24px',
              textAlign: 'center',
              color: '#ffffff',
            }}
          >
            {urduFooter}
          </p>

          <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'flex-end' }}>
            <div
              data-urdu-text
              style={{
                ...URDU_TEXT,
                borderTop: '1px solid #ffffff',
                width: '160px',
                paddingTop: '6px',
                fontSize: '18px',
                textAlign: 'center',
                color: '#ffffff',
              }}
            >
              دستخط / SIGN
            </div>
          </div>
        </div>
      </div>
    )
  }
)
