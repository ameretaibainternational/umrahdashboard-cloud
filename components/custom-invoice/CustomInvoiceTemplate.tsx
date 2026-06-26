import { forwardRef } from 'react'
import type { CustomInvoice, CustomInvoiceLineItem } from '@/lib/types'
import {
  type InvoiceBranding,
  resolveLogoRect,
  SIGNATURE_IMAGE_H,
  SIGNATURE_IMAGE_W,
  SIGNATURE_IMAGE_X,
  SIGNATURE_IMAGE_Y,
  SIGNATURE_NAME_FONT_SIZE,
  SIGNATURE_NAME_X,
  SIGNATURE_NAME_Y,
  scaleFontSize,
  scaleRect,
} from '@/lib/custom-invoice-branding-layout'

// ─── Canvas constants ─────────────────────────────────────────────────────────
const W = 595.5
const ROW_H = 41.4

// Max rows that fit per page (≤9 rows always end before y=530 where terms begin)
const ROWS_P1 = 5   // page 1 (has full header, so less vertical room)
const ROWS_PC = 9   // continuation pages (compact header, more room)

// Page 1 row start positions — single Y for all columns (split Y values misalign in html2canvas PDF)
const P1_ROW_Y0 = 337.6

// Continuation page row start positions — large top padding keeps rows lower on the page
const C_HDR_Y   = 160
const C_HR_Y    = 188
const C_ROW_Y0  = 203.1

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd} /${mm}/ ${yyyy}`
}

function fmtNum(n: number, unit?: string) {
  const s = new Intl.NumberFormat('en-US').format(n)
  return unit ? `${s} ${unit}` : s
}

// ─── Absolutely-positioned text node ─────────────────────────────────────────
function T({
  x, y, right: r, bold, size = 12, color = '#fefefe', children, nowrap, maxW, href,
  invoiceRow, invoiceHdr,
}: {
  x?: number; y: number; right?: number
  bold?: boolean; size?: number; color?: string
  children: React.ReactNode; nowrap?: boolean; maxW?: number
  href?: string
  invoiceRow?: boolean
  invoiceHdr?: boolean
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${y}px`,
    ...(r !== undefined ? { right: `${W - r}px` } : { left: `${x}px` }),
    fontWeight: bold ? 700 : 400,
    fontSize: `${size}px`,
    color,
    lineHeight: invoiceRow || invoiceHdr ? `${size}px` : `${size * 1.2}px`,
    whiteSpace: nowrap ? 'nowrap' : undefined,
    maxWidth: maxW ? `${maxW}px` : undefined,
    ...(invoiceRow || invoiceHdr ? { fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: 0 } : {}),
  }
  const dataProps = invoiceRow
    ? { 'data-invoice-row-text': '1' as const }
    : invoiceHdr
      ? { 'data-invoice-hdr-text': '1' as const }
      : {}
  if (href) return <a href={href} style={{ ...style, textDecoration: 'none' }} {...dataProps}>{children}</a>
  return <div style={style} {...dataProps}>{children}</div>
}

// ─── Horizontal rule ─────────────────────────────────────────────────────────
function HR({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <div style={{
      position: 'absolute',
      left: `${x1}px`, top: `${y}px`,
      width: `${x2 - x1}px`, height: '0.75px',
      backgroundColor: '#ffffff',
    }} />
  )
}

// ─── Shared page background style ────────────────────────────────────────────
// Height is 842px (not 842.25) to prevent a 0.3px overflow that causes a blank extra page.
const PAGE_BG: React.CSSProperties = {
  position: 'relative',
  width: `${W}px`,
  height: '842px',
  backgroundImage: 'url(/invoice-empty.jpg)',
  backgroundSize: 'cover',
  backgroundPosition: 'center top',
  backgroundColor: '#121117',
  fontFamily: "'Poppins', 'Segoe UI', sans-serif",
  overflow: 'hidden',
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact',
  colorAdjust: 'exact',
} as React.CSSProperties

// ─── Shared table header row ──────────────────────────────────────────────────
function TableHeader({
  unitPriceLabel, qtyLabel, hdrY, hrY,
}: {
  unitPriceLabel: string | null  // null = column hidden
  qtyLabel: string               // 'Total Pax' | 'Total Nights' | 'Total Pax'
  hdrY: number
  hrY: number
}) {
  return (
    <>
      <T x={35.9}  y={hdrY} bold invoiceHdr>No</T>
      <T x={76.5}  y={hdrY} bold invoiceHdr>Service</T>
      {unitPriceLabel && <T x={215.7} y={hdrY} bold invoiceHdr>{unitPriceLabel}</T>}
      <T x={318.6} y={hdrY} bold invoiceHdr>{qtyLabel}</T>
      <T x={439.7} y={hdrY} bold invoiceHdr>Total</T>
      <T x={493.3} y={hdrY} bold invoiceHdr>Recieved</T>
      <HR x1={26} x2={547} y={hrY} />
    </>
  )
}

// ─── Table rows ───────────────────────────────────────────────────────────────
function TableRows({
  items, rowOffset, unitPriceLabel, rowY0,
}: {
  items: CustomInvoiceLineItem[]
  rowOffset: number
  unitPriceLabel: string | null
  rowY0: number
}) {
  return (
    <>
      {items.map((item, i) => {
        const y = rowY0 + i * ROW_H
        // Show pax_price OR night_price in the unit-price column (only one is ever set per row)
        const unitVal = item.pax_price != null
          ? fmtNum(item.pax_price, item.pax_price_unit || undefined)
          : item.night_price != null
            ? fmtNum(item.night_price, item.night_price_unit || undefined)
            : null
        return (
          <div key={i}>
            <T x={30.6} y={y} invoiceRow>{rowOffset + i + 1}</T>
            <T x={69.7} y={y} maxW={140} invoiceRow>
              <span style={{ lineHeight: '12px', display: 'block' }}>{item.service}</span>
            </T>
            {unitPriceLabel && unitVal && (
              <T x={214.5} y={y} nowrap invoiceRow>{unitVal}</T>
            )}
            <T x={324.6} y={y} invoiceRow>{item.total_pax}</T>
            <T right={479.6} y={y} nowrap invoiceRow>
              {fmtNum(item.total, item.total_unit || undefined)}
            </T>
            <T right={557.0} y={y} nowrap invoiceRow>{fmtNum(item.received)}</T>
          </div>
        )
      })}
    </>
  )
}

// ─── Terms + Totals + Footer section ─────────────────────────────────────────
// Always rendered at fixed Y positions (all ≤9 rows end before y=530).
function TermsSection({ invoice, invoiceCurrency }: { invoice: CustomInvoice; invoiceCurrency: string }) {
  return (
    <>
      <HR x1={26} x2={547} y={530.3} />
      <T x={35.9} y={547.0} bold color="#ffffff">Terms and Condition</T>
      <T x={35.9} y={562.4} size={7.7} color="#a7a7a7" maxW={268}>
        <span style={{ lineHeight: '10.5px', display: 'block' }}>{invoice.terms_text}</span>
      </T>
      <T x={35.9} y={614.3} size={7.7} color="#a7a7a7" maxW={268}>
        <span style={{ lineHeight: '10.5px' }}>Note: </span>
        <span style={{ fontWeight: 700, lineHeight: '10.5px' }}>
          All bookings are non-changeable and non refundable.
        </span>
      </T>

      <T x={376.1} y={547.0} bold>Total</T>
      <T x={463.9} y={547.0}>{fmtNum(invoice.total, invoiceCurrency || undefined)}</T>
      <T x={376.1} y={572.8}>Recieved</T>
      <T x={463.9} y={572.8}>{fmtNum(invoice.received, invoiceCurrency || undefined)}</T>
      <T x={376.1} y={599.7} bold>Remaining</T>
      <T x={463.9} y={599.7}>{fmtNum(invoice.remaining, invoiceCurrency || undefined)}</T>

      <HR x1={48.5} x2={547} y={638.6} />
      <T x={35.9} y={695.4} bold color="#ffffff">Contact Us:</T>
      <T x={35.9} y={714.8} size={10} color="#ffffff">{invoice.contact_phone}</T>
      <T x={35.9} y={733.3} size={10} color="#ffffff" href={`mailto:${invoice.contact_email}`}>
        {invoice.contact_email}
      </T>
      <T x={35.9} y={751.6} size={10} color="#ffffff">{invoice.contact_location}</T>
    </>
  )
}

function BrandingLogo({ branding }: { branding: InvoiceBranding }) {
  if (!branding.logoUrl) return null
  const { x, y, w, h } = resolveLogoRect(branding)
  const rect = scaleRect(x, y, w, h)
  return (
    <img
      src={branding.logoUrl}
      alt=""
      data-invoice-branding-logo="1"
      style={{
        position: 'absolute',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        objectFit: 'contain',
        objectPosition: 'left top',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}

function BrandingSignature({ branding }: { branding: InvoiceBranding }) {
  const signatureRect = scaleRect(
    SIGNATURE_IMAGE_X,
    SIGNATURE_IMAGE_Y,
    SIGNATURE_IMAGE_W,
    SIGNATURE_IMAGE_H,
  )
  const nameLeft = scaleRect(SIGNATURE_NAME_X, SIGNATURE_NAME_Y, 0, 0).left
  const nameTop = scaleRect(SIGNATURE_NAME_X, SIGNATURE_NAME_Y, 0, 0).top
  const nameSize = scaleFontSize(SIGNATURE_NAME_FONT_SIZE)

  return (
    <>
      {branding.signatureUrl && (
        <img
          src={branding.signatureUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: 'absolute',
            left: `${signatureRect.left}px`,
            top: `${signatureRect.top}px`,
            width: `${signatureRect.width}px`,
            height: `${signatureRect.height}px`,
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      )}
      {branding.signaturePersonName && (
        <div
          style={{
            position: 'absolute',
            left: `${nameLeft}px`,
            top: `${nameTop}px`,
            fontWeight: 700,
            fontSize: `${nameSize}px`,
            color: '#ffffff',
            lineHeight: 1.2,
            fontFamily: "'Poppins', 'Segoe UI', sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          {branding.signaturePersonName}
        </div>
      )}
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  invoice: CustomInvoice
  branding?: InvoiceBranding
}

const CustomInvoiceTemplate = forwardRef<HTMLDivElement, Props>(
  function CustomInvoiceTemplate({ invoice, branding }, ref) {
    const items = invoice.line_items
    const hasPaxPrice   = items.some(i => i.pax_price   != null && i.pax_price   > 0)
    const hasNightPrice = items.some(i => i.night_price != null && i.night_price > 0)
    // Column header for the unit-price column
    const unitPriceLabel: string | null = hasPaxPrice && hasNightPrice
      ? 'Unit Price'
      : hasPaxPrice
        ? '1 Pax Price'
        : hasNightPrice
          ? 'Per Night'
          : null
    // Qty column label — "Total Nights" only when ALL rows use night price
    const qtyLabel = !hasPaxPrice && hasNightPrice ? 'Total Nights' : 'Total Pax'
    const invoiceCurrency =
      items.find(i => i.pax_price   != null && i.pax_price_unit)?.pax_price_unit ||
      items.find(i => i.night_price != null && i.night_price_unit)?.night_price_unit ||
      items.find(i => i.total_unit)?.total_unit || ''

    // ── Split items across pages ──────────────────────────────────────────────
    const page1Items = items.slice(0, ROWS_P1)
    const contItems  = items.slice(ROWS_P1)

    const contPages: CustomInvoiceLineItem[][] = []
    for (let i = 0; i < contItems.length; i += ROWS_PC) {
      contPages.push(contItems.slice(i, i + ROWS_PC))
    }

    const totalPages   = 1 + contPages.length
    const isMultiPage  = contPages.length > 0
    const page1IsLast  = !isMultiPage

    return (
      // data-invoice-wrapper: flex gap visible in preview; collapsed to block in print CSS
      <div ref={ref} data-invoice-wrapper style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* ── PAGE 1 ─────────────────────────────────────────────────── */}
        <div data-invoice-root style={PAGE_BG}>

          {branding?.logoUrl && <BrandingLogo branding={branding} />}

          {/* INVOICE title */}
          <div style={{
            position: 'absolute', top: '58.5px', left: 0, width: '100%',
            textAlign: 'center', fontWeight: 700, fontSize: '54px',
            color: '#ffffff', lineHeight: 1, fontFamily: "'Poppins', 'Segoe UI', sans-serif",
          }}>
            INVOICE
          </div>

          <T x={253.3} y={124.9} nowrap>
            <span style={{ fontWeight: 700 }}>Invoice ID: </span>
            <span style={{ fontWeight: 400 }}>{invoice.invoice_number}</span>
          </T>
          <T x={424.9} y={122.3} nowrap>
            <span style={{ fontWeight: 700 }}>Date: </span>
            <span style={{ fontWeight: 400 }}>{fmtDate(invoice.invoice_date)}</span>
          </T>

          {/* Billed To */}
          <T x={59.5} y={176.0} bold>Billed To</T>
          <T x={59.5} y={195.3}><span style={{ fontWeight: 500 }}>Name: </span>{invoice.billed_to_name}</T>
          <T x={59.8} y={214.9}><span style={{ fontWeight: 500 }}>Address: </span>{invoice.billed_to_address}</T>
          <T x={59.8} y={237.7}><span style={{ fontWeight: 500 }}>Client Number: </span>{invoice.billed_to_client_number}</T>

          {/* Payment Method */}
          <T x={439.9} y={178.6} bold>Payment Method</T>
          <T right={547} y={199.5} nowrap>{invoice.payment_bank_name}:</T>
          <T right={547} y={220.1} nowrap>{invoice.payment_account_number}</T>

          {/* Table */}
          <TableHeader unitPriceLabel={unitPriceLabel} qtyLabel={qtyLabel} hdrY={294.1} hrY={322.8} />
          <TableRows
            items={page1Items}
            rowOffset={0}
            unitPriceLabel={unitPriceLabel}
            rowY0={P1_ROW_Y0}
          />

          {/* "Continued" note on page 1 when there are more pages */}
          {isMultiPage && (
            <>
              <T x={35.9}  y={557} size={9} color="#a7a7a7">— Continued on next page —</T>
              <T right={559} y={557} size={9} color="#a7a7a7" nowrap>Page 1 of {totalPages}</T>
            </>
          )}

          {/* Terms section only on page 1 if this IS the last page */}
          {page1IsLast && (
            <>
              <TermsSection invoice={invoice} invoiceCurrency={invoiceCurrency} />
              {branding && (branding.signatureUrl || branding.signaturePersonName) && (
                <BrandingSignature branding={branding} />
              )}
            </>
          )}
        </div>

        {/* ── CONTINUATION PAGES ─────────────────────────────────────── */}
        {contPages.map((pageItems, pi) => {
          const pageNum  = pi + 2
          const isLast   = pi === contPages.length - 1
          const rowOffset = ROWS_P1 + pi * ROWS_PC

          return (
            <div key={pi} data-invoice-root style={PAGE_BG}>

              {/* Compact page indicator */}
              
              <T right={559} y={28} size={9} color="#a7a7a7" nowrap>
                Page {pageNum} of {totalPages}
              </T>

              {/* Table header repeated for context */}
              <TableHeader unitPriceLabel={unitPriceLabel} qtyLabel={qtyLabel} hdrY={C_HDR_Y} hrY={C_HR_Y} />

              {/* Rows for this page */}
              <TableRows
                items={pageItems}
                rowOffset={rowOffset}
                unitPriceLabel={unitPriceLabel}
                rowY0={C_ROW_Y0}
              />

              {/* Terms + totals + footer only on the last page */}
              {isLast && (
                <>
                  <TermsSection invoice={invoice} invoiceCurrency={invoiceCurrency} />
                  {branding && (branding.signatureUrl || branding.signaturePersonName) && (
                    <BrandingSignature branding={branding} />
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }
)

export default CustomInvoiceTemplate
