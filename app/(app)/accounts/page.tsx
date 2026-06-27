import { getBookings, getPayments, getExpenses, getCompany } from '@/lib/db'
import { pkr, formatDate } from '@/lib/formatters'
import KpiCard from '@/components/shared/KpiCard'
import AddPaymentForm from '@/components/accounts/AddPaymentForm'
import AddExpenseForm from '@/components/accounts/AddExpenseForm'
import ClientLedger from '@/components/accounts/ClientLedger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Wallet, TrendingDown, AlertCircle, DollarSign } from 'lucide-react'

export default async function AccountsPage() {
  const [bookings, payments, expenses, company] = await Promise.all([
    getBookings(),
    getPayments(),
    getExpenses(),
    getCompany(),
  ])

  // ── KPI Calculations ───────────────────────────────────────────────────────
  // Total cash received from customers (sum of all individual payment records)
  const totalReceived = payments.reduce((sum, p) => sum + p.amount_pkr, 0)

  // Total cash paid out to suppliers / expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount_pkr, 0)

  // Outstanding = total still owed by customers across all bookings
  // This is maintained correctly as payments are added (booking.remaining_pkr is decremented)
  const totalOutstanding = bookings.reduce((sum, b) => sum + b.remaining_pkr, 0)

  // Estimated cash profit = what came in minus what went out to suppliers
  // (Different from booking profit which is selling price − cost price)
  const estimatedCashProfit = totalReceived - totalExpenses

  // Bookings with a remaining balance (for the "Record Payment" form)
  const unpaidBookings = bookings.filter(b => b.remaining_pkr > 0)

  // Cash Book: net balance = received − expenses
  const cashBookBalance = totalReceived - totalExpenses

  return (
    <div className="space-y-6">

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
          label="Outstanding"
          value={pkr(totalOutstanding)}
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
      </div>

      {/* ── Record Customer Payment ── */}
      {unpaidBookings.length > 0 && <AddPaymentForm bookings={unpaidBookings} />}

      {/* ── Record Supplier Expense ── */}
      <AddExpenseForm />

      {/* ── Client Ledger (per-customer filter + print + copy) ── */}
      <ClientLedger
        payments={payments}
        bookings={bookings}
        companyName={company.name}
      />

      {/* ── Supplier / Expense Ledger ── */}
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Supplier / Expense Ledger</CardTitle>
          <p className="text-xs text-muted-foreground">All recorded supplier and Umrah expense payments.</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Supplier / Description</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="text-xs">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                    No expense records yet. Use the form above to add supplier payments.
                  </TableCell>
                </TableRow>
              ) : expenses.map(e => (
                <TableRow key={e.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.expense_date)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.expense_type}</Badge></TableCell>
                  <TableCell className="text-sm font-medium">{e.supplier}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{e.method}</Badge></TableCell>
                  <TableCell className="text-right text-sm font-semibold text-rose-600">{pkr(e.amount_pkr)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.note || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

    </div>
  )
}
