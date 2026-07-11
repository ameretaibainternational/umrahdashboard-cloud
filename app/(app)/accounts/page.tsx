import { getBookings, getPayments, getExpenses, getCompany, getStandaloneCustomInvoices, getCurrency } from '@/lib/db'
import { pkr } from '@/lib/formatters'
import KpiCard from '@/components/shared/KpiCard'
import KpiGrid, { PageContainer } from '@/components/shared/KpiGrid'
import AddPaymentForm from '@/components/accounts/AddPaymentForm'
import ClientLedger from '@/components/accounts/ClientLedger'
import ExpenseLedger from '@/components/accounts/ExpenseLedger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, TrendingDown, AlertCircle, DollarSign } from 'lucide-react'

export default async function AccountsPage() {
  const [rawBookings, payments, expenses, company, standaloneCustomInvoices, currency] = await Promise.all([
    getBookings(),
    getPayments(),
    getExpenses(),
    getCompany(),
    getStandaloneCustomInvoices(),
    getCurrency(),
  ])

  const customBookings = standaloneCustomInvoices.map(inv => ({
    id: `invoice-${inv.id}`,
    created_at: inv.created_at,
    booking_date: inv.invoice_date,
    customer_name: `${inv.billed_to_name} (Invoice: ${inv.invoice_number})`,
    airline_name: '',
    total_pkr: inv.total,
    cost_pkr: Math.max(0, inv.total - (inv.profit_pkr ?? 0)),
    profit_pkr: inv.profit_pkr ?? 0,
    advance_pkr: inv.received,
    paid_pkr: inv.received,
    remaining_pkr: inv.remaining,
    adult_count: 0,
    child_count: 0,
    infant_count: 0,
    makkah_hotel_name: null,
    makkah_hotel_location: null,
    makkah_hotel_distance: null,
    makkah_room_type: null,
    makkah_nights: null,
    madinah_hotel_name: null,
    madinah_hotel_location: null,
    madinah_hotel_distance: null,
    madinah_room_type: null,
    madinah_nights: null,
    source_invoice_id: inv.id,
    invoice_number: inv.invoice_number,
  }))

  const bookings = [
    ...rawBookings.filter(b => b.source_invoice_id !== null),
    ...customBookings,
  ]

  // ── KPI Calculations ───────────────────────────────────────────────────────
  // Total cash received from customers (sum of all individual payment records)
  const totalReceived = payments.reduce((sum, p) => sum + p.amount_pkr, 0)

  // Total cash paid out to suppliers / expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount_pkr, 0)

  // Remaining = total still owed by customers across all bookings
  // This is maintained correctly as payments are added (booking.remaining_pkr is decremented)
  const totalRemaining = bookings.reduce((sum, b) => sum + b.remaining_pkr, 0)

  // Estimated cash profit = what came in minus what went out to suppliers
  // (Different from booking profit which is selling price − cost price)
  const estimatedCashProfit = totalReceived - totalExpenses

  // Bookings with a remaining balance (for the "Record Payment" form)
  const unpaidBookings = bookings.filter(b => b.remaining_pkr > 0)

  // Cash Book: net balance = received − expenses
  const cashBookBalance = totalReceived - totalExpenses

  return (
    <PageContainer>

      <KpiGrid columns={4}>
        <KpiCard
          label="Total Received"
          value={pkr(totalReceived)}
          icon={Wallet}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <KpiCard
          label="Total Expenses"
          value={pkr(totalExpenses)}
          icon={TrendingDown}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
        <KpiCard
          label="Remaining"
          value={pkr(totalRemaining)}
          icon={AlertCircle}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KpiCard
          label="Est. Cash Profit"
          value={pkr(estimatedCashProfit)}
          icon={DollarSign}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
      </KpiGrid>

      {/* ── Record Customer Payment ── */}
      <AddPaymentForm bookings={unpaidBookings} />

      <Card className="shadow-sm border-0 bg-slate-50/80">
        <CardContent className="py-4 px-5">
          <p className="text-sm text-muted-foreground">
            Package expenses are recorded automatically when you save a booking from the Package Calculator.
            The expense amount equals the package cost (selling price minus profit).
          </p>
        </CardContent>
      </Card>

      {/* ── Client Ledger (per-customer filter + print + copy) ── */}
      <ClientLedger
        payments={payments}
        bookings={bookings}
        companyName={company.name}
        sarToPkrRate={currency?.sar_to_pkr ?? 75}
      />

      {/* ── Supplier / Expense Ledger ── */}
      <ExpenseLedger expenses={expenses} companyName={company.name} />

      {/* ── Cash Book Summary ── */}
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Cash Book Summary</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cash received from customers minus supplier expenses = estimated balance in hand.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-navy text-white p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/70">Total Received from Customers</span>
              <span className="text-sm font-semibold text-emerald-400">{pkr(totalReceived)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/70">Total Paid to Suppliers</span>
              <span className="text-sm font-semibold text-rose-400">− {pkr(totalExpenses)}</span>
            </div>
            <div className="border-t border-white/20 pt-3 flex justify-between items-center">
              <span className="text-base font-bold">Estimated Balance in Hand</span>
              <span className={`text-xl font-bold ${cashBookBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pkr(cashBookBalance)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

    </PageContainer>
  )
}
