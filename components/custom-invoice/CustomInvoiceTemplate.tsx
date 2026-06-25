import { forwardRef } from 'react'
import type { CustomInvoice, CustomInvoiceLineItem } from '@/lib/types'

// ─── Canvas constants ─────────────────────────────────────────────────────────
const W = 595.5
const ROW_H = 41.4

// Max rows that fit per page (≤9 rows always end before y=530 where terms begin)
const ROWS_P1 = 5   // page 1 (has full header, so less vertical room)
const ROWS_PC = 9   // continuation pages (compact header, more room)

// Page 1 row start positions
const P1_ROW_NO_Y0  = 335.5
const P1_ROW_DAT_Y0 = 339.7

// Continuation page row start positions — large top padding keeps rows lower on the page
const C_HDR_Y      = 160
const C_HR_Y       = 188
const C_ROW_NO_Y0  = 201
const C_ROW_DAT_Y0 = 205.2

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
}: {
  x?: number; y: number; right?: number
  bold?: boolean; size?: number; color?: string
  children: React.ReactNode; nowrap?: boolean; maxW?: number
  href?: string
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${y}px`,
    ...(r !== undefined ? { right: `${W - r}px` } : { left: `${x}px` }),
    fontWeight: bold ? 700 : 400,
    fontSize: `${size}px`,
    color,
    lineHeight: `${size * 1.2}px`,
    whiteSpace: nowrap ? 'nowrap' : undefined,
    maxWidth: maxW ? `${maxW}px` : undefined,
  }
  if (href) return <a href={href} style={{ ...style, textDecoration: 'none' }}>{children}</a>
  return <div style={style}>{children}</div>
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
function TableHeader({ hasPaxPrice, hdrY, hrY }: { hasPaxPrice: boolean; hdrY: number; hrY: number }) {
  return (
    <>
      <T x={35.9}  y={hdrY} bold>No</T>
      <T x={76.5}  y={hdrY} bold>Service</T>
      {hasPaxPrice && <T x={215.7} y={hdrY} bold>1 Pax Price</T>}
      <T x={318.6} y={hdrY} bold>Total Pax</T>
      <T x={439.7} y={hdrY} bold>Total</T>
      <T x={493.3} y={hdrY} bold>Recieved</T>
      <HR x1={26} x2={547} y={hrY} />
    </>
  )
}

// ─── Table rows ───────────────────────────────────────────────────────────────
function TableRows({
  items, rowOffset, hasPaxPrice, rowNoY0, rowDatY0,
}: {
  items: CustomInvoiceLineItem[]
  rowOffset: number
  hasPaxPrice: boolean
  rowNoY0: number
  rowDatY0: number
}) {
  return (
    <>
      {items.map((item, i) => {
        const yNo   = rowNoY0  + i * ROW_H
        const yData = rowDatY0 + i * ROW_H
        return (
          <div key={i}>
            <T x={30.6} y={yNo}>{rowOffset + i + 1}</T>
            <T x={69.7} y={yNo} maxW={140}>
              <span style={{ lineHeight: '10.5px', display: 'block' }}>{item.service}</span>
            </T>
            {hasPaxPrice && item.pax_price != null && (
              <T x={214.5} y={yData} nowrap>
                {fmtNum(item.pax_price, item.pax_price_unit || undefined)}
              </T>
            )}
            <T x={324.6} y={yData}>{item.total_pax}</T>
            <T right={479.6} y={yData} nowrap>
              {fmtNum(item.total, item.total_unit || undefined)}
            </T>
            <T right={557.0} y={yData} nowrap>{fmtNum(item.received)}</T>
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

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { invoice: CustomInvoice }

const CustomInvoiceTemplate = forwardRef<HTMLDivElement, Props>(
  function CustomInvoiceTemplate({ invoice }, ref) {
    const items = invoice.line_items
    const hasPaxPrice = items.some(i => i.pax_price != null && i.pax_price > 0)
    const invoiceCurrency =
      items.find(i => i.pax_price != null && i.pax_price_unit)?.pax_price_unit ||
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
          <T right={559} y={199.5} nowrap>{invoice.payment_bank_name}:</T>
          <T x={448.9} y={220.1}>{invoice.payment_account_number}</T>

          {/* Table */}
          <TableHeader hasPaxPrice={hasPaxPrice} hdrY={294.1} hrY={322.8} />
          <TableRows
            items={page1Items}
            rowOffset={0}
            hasPaxPrice={hasPaxPrice}
            rowNoY0={P1_ROW_NO_Y0}
            rowDatY0={P1_ROW_DAT_Y0}
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
            <TermsSection invoice={invoice} invoiceCurrency={invoiceCurrency} />
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
              <TableHeader hasPaxPrice={hasPaxPrice} hdrY={C_HDR_Y} hrY={C_HR_Y} />

              {/* Rows for this page */}
              <TableRows
                items={pageItems}
                rowOffset={rowOffset}
                hasPaxPrice={hasPaxPrice}
                rowNoY0={C_ROW_NO_Y0}
                rowDatY0={C_ROW_DAT_Y0}
              />

              {/* Terms + totals + footer only on the last page */}
              {isLast && (
                <TermsSection invoice={invoice} invoiceCurrency={invoiceCurrency} />
              )}
            </div>
          )
        })}
      </div>
    )
  }
)

export default CustomInvoiceTemplate
