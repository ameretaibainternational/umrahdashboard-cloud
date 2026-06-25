import { forwardRef } from 'react'
import type { CustomInvoice } from '@/lib/types'

// ─── Canvas constants (1pt = 1px) ────────────────────────────────────────────
const W = 595.5
const ROW_H = 41.4   // pt per table row

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

// Helper: absolutely-positioned text node
function T({
  x, y, right: r, bold, size = 12, color = '#fefefe', children, nowrap, maxW,
  href,
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

  if (href) {
    return (
      <a href={href} style={{ ...style, textDecoration: 'none' }}>
        {children}
      </a>
    )
  }
  return <div style={style}>{children}</div>
}

// Helper: horizontal rule
function HR({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <div style={{
      position: 'absolute',
      left: `${x1}px`,
      top: `${y}px`,
      width: `${x2 - x1}px`,
      height: '0.75px',
      backgroundColor: '#ffffff',
    }} />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { invoice: CustomInvoice }

const CustomInvoiceTemplate = forwardRef<HTMLDivElement, Props>(
  function CustomInvoiceTemplate({ invoice }, ref) {
    const hasPaxPrice = invoice.line_items.some(
      item => item.pax_price != null && item.pax_price > 0
    )

    return (
      <div
        ref={ref}
        style={{
          position: 'relative',
          width: `${W}px`,
          height: '842.25px',
          backgroundImage: 'url(/invoice-empty.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundColor: '#121117',
          fontFamily: "'Poppins', 'Segoe UI', sans-serif",
          overflow: 'hidden',
          // Force browsers to print background image and colors
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          colorAdjust: 'exact',
        } as React.CSSProperties}
      >
        {/* ── HEADER ──────────────────────────────────────────────────── */}

        {/* "INVOICE" title — centered */}
        <div style={{
          position: 'absolute',
          top: '58.5px',
          left: 0,
          width: '100%',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '54px',
          color: '#ffffff',
          lineHeight: 1,
          fontFamily: "'Poppins', 'Segoe UI', sans-serif",
        }}>
          INVOICE
        </div>

        {/* Invoice ID — bold label + regular value inline */}
        <T x={253.3} y={124.9} nowrap>
          <span style={{ fontWeight: 700 }}>Invoice ID: </span>
          <span style={{ fontWeight: 400 }}>{invoice.invoice_number}</span>
        </T>

        {/* Date — bold label + regular value inline */}
        <T x={424.9} y={122.3} nowrap>
          <span style={{ fontWeight: 700 }}>Date: </span>
          <span style={{ fontWeight: 400 }}>{fmtDate(invoice.invoice_date)}</span>
        </T>

        {/* ── BILLED TO / PAYMENT METHOD ──────────────────────────────── */}

        <T x={59.5} y={176.0} bold>Billed To</T>

        <T x={59.5} y={195.3}>
          <span style={{ fontWeight: 700 }}>Name: </span>{invoice.billed_to_name}
        </T>

        <T x={59.8} y={214.9}>
          <span style={{ fontWeight: 700 }}>Address: </span>{invoice.billed_to_address}
        </T>

        <T x={59.8} y={237.7}>
          <span style={{ fontWeight: 700 }}>Client Number: </span>{invoice.billed_to_client_number}
        </T>

        <T x={429.9} y={178.6} bold>Payment Method</T>

        {/* Bank name on its own line with trailing colon */}
        <T x={475.2} y={199.5}>{invoice.payment_bank_name}:</T>

        {/* Account number on its own line */}
        <T x={448.9} y={220.1}>{invoice.payment_account_number}</T>

        {/* ── TABLE HEADERS ───────────────────────────────────────────── */}

        <T x={35.9}  y={294.1} bold>No</T>
        <T x={76.5}  y={294.1} bold>Service</T>
        {hasPaxPrice && <T x={215.7} y={294.1} bold>1 Pax Price</T>}
        <T x={318.6} y={294.1} bold>Total Pax</T>
        <T x={439.7} y={294.1} bold>Total</T>
        {/* "Recieved" — replicate original misspelling exactly */}
        <T x={493.3} y={294.1} bold>Recieved</T>

        <HR x1={26} x2={547} y={322.8} />

        {/* ── TABLE ROWS ──────────────────────────────────────────────── */}

        {invoice.line_items.map((item, i) => {
          const yNo   = 335.5 + i * ROW_H
          const yData = 339.7 + i * ROW_H

          return (
            <div key={i}>
              {/* Row number */}
              <T x={30.6} y={yNo}>{i + 1}</T>

              {/* Service (max ~140pt, multi-line at ~10.5pt line-height) */}
              <T x={69.7} y={yNo} maxW={140}>
                <span style={{ lineHeight: '10.5px', display: 'block' }}>
                  {item.service}
                </span>
              </T>

              {/* Pax Price (conditional) */}
              {hasPaxPrice && item.pax_price != null && (
                <T x={214.5} y={yData} nowrap>
                  {fmtNum(item.pax_price, item.pax_price_unit || undefined)}
                </T>
              )}

              {/* Total Pax */}
              <T x={324.6} y={yData}>{item.total_pax}</T>

              {/* Total — RIGHT-aligned, right edge at 479.6 */}
              <T right={479.6} y={yData} nowrap>
                {fmtNum(item.total, item.total_unit || undefined)}
              </T>

              {/* Received — RIGHT-aligned, right edge at 557.0 */}
              <T right={557.0} y={yData} nowrap>
                {fmtNum(item.received)}
              </T>
            </div>
          )
        })}

        {/* ── TERMS & TOTALS SECTION ──────────────────────────────────── */}

        <HR x1={26} x2={547} y={530.3} />

        {/* "Terms and Condition" — singular, replicate exactly */}
        <T x={35.9} y={547.0} bold color="#ffffff">Terms and Condition</T>

        {/* Terms body paragraph */}
        <T x={35.9} y={562.4} size={7.7} color="#a7a7a7" maxW={268}>
          <span style={{ lineHeight: '10.5px', display: 'block' }}>
            {invoice.terms_text}
          </span>
        </T>

        {/* Note line */}
        <T x={35.9} y={614.3} size={7.7} color="#a7a7a7" maxW={268}>
          <span style={{ lineHeight: '10.5px' }}>Note: </span>
          <span style={{ fontWeight: 700, lineHeight: '10.5px' }}>
            All bookings are non-changeable and non refundable.
          </span>
        </T>

        {/* Summary column — LEFT-aligned (different rule from table data) */}
        <T x={376.1} y={547.0} bold>Total</T>
        <T x={463.9} y={547.0}>{fmtNum(invoice.total)}</T>

        {/* "Recieved" summary label — Regular (not bold, per spec) */}
        <T x={376.1} y={572.8}>Recieved</T>
        <T x={463.9} y={572.8}>{fmtNum(invoice.received)}</T>

        <T x={376.1} y={599.7} bold>Remaining</T>
        <T x={463.9} y={599.7}>{fmtNum(invoice.remaining)}</T>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}

        <HR x1={48.5} x2={547} y={638.6} />

        <T x={35.9} y={695.4} bold color="#ffffff">Contact Us:</T>

        <T x={35.9} y={714.8} size={10} color="#ffffff">
          {invoice.contact_phone}
        </T>

        {/* Email as clickable mailto link */}
        <T
          x={35.9} y={733.3} size={10} color="#ffffff"
          href={`mailto:${invoice.contact_email}`}
        >
          {invoice.contact_email}
        </T>

        <T x={35.9} y={751.6} size={10} color="#ffffff">
          {invoice.contact_location}
        </T>
      </div>
    )
  }
)

export default CustomInvoiceTemplate
