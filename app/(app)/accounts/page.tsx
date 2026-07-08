import { getBookings, getPayments, getExpenses, getCompany } from '@/lib/db'
import { pkr } from '@/lib/formatters'
import KpiCard from '@/components/shared/KpiCard'
import KpiGrid, { PageContainer } from '@/components/shared/KpiGrid'
import AddPaymentForm from '@/components/accounts/AddPaymentForm'
import ClientLedger from '@/components/accounts/ClientLedger'
import ExpenseLedger from '@/components/accounts/ExpenseLedger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, TrendingDown, AlertCircle, DollarSign } from 'lucide-react'

export default async function AccountsPage() {
  const [rawBookings, payments, expenses, company] = await Promise.all([
    getBookings(),
    getPayments(),
    getExpenses(),
    getCompany(),
  ])

  const bookings = rawBookings.filter(b => b.source_invoice_id !== null)

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
