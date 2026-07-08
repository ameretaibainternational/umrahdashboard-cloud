import { getBookings, getPayments, getStandaloneCustomInvoices } from '@/lib/db'
import { pkr } from '@/lib/formatters'
import KpiCard from '@/components/shared/KpiCard'
import KpiGrid, { PageContainer } from '@/components/shared/KpiGrid'
import DashboardCharts from '@/components/dashboard/DashboardCharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Users, TrendingUp, DollarSign, AlertCircle, Calculator, Settings } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ── helpers ──────────────────────────────────────────────────────────────────

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-PK', { month: 'short', year: '2-digit' })
}

export default async function DashboardPage() {
  const [rawBookings, payments, customInvoices] = await Promise.all([
    getBookings(),
    getPayments(),
    getStandaloneCustomInvoices(),
  ])

  const bookings = rawBookings.filter(b => b.source_invoice_id !== null)

  const bookingIds = new Set(bookings.map(b => b.id))
  const bookingPayments = payments.filter(p => bookingIds.has(p.booking_id))

  const customRevenue = customInvoices.reduce((s, inv) => s + inv.total, 0)
  const customProfit = customInvoices.reduce((s, inv) => s + (inv.profit_pkr ?? 0), 0)
  const customCost = customInvoices.reduce((s, inv) => s + Math.max(0, inv.total - (inv.profit_pkr ?? 0)), 0)

  // ── KPIs (package bookings + standalone custom invoices) ──
  const totalBookings   = bookings.length
  const customerNames   = new Set([
    ...bookings.map(b => b.customer_name.trim()).filter(name => name && name.toLowerCase() !== 'walk-in customer'),
    ...customInvoices.map(inv => inv.billed_to_name.trim()).filter(Boolean),
  ])
  const uniqueCustomers = customerNames.size
  const totalRevenue    = bookings.reduce((s, b) => s + b.total_pkr, 0) + customRevenue
  const totalCost       = bookings.reduce((s, b) => s + b.cost_pkr, 0) + customCost
  const totalProfit     = bookings.reduce((s, b) => s + b.profit_pkr, 0) + customProfit
  const totalDue        = bookings.reduce((s, b) => s + b.remaining_pkr, 0) + customInvoices.reduce((s, inv) => s + inv.remaining, 0)
  const recent          = bookings.slice(0, 5)

  // ── Monthly revenue data — always 6 months grid ──────────────────────────
  const monthMap: Record<string, { revenue: number; cost: number; profit: number }> = {}
  for (const b of bookings) {
    const k = monthKey(b.booking_date || b.created_at)
    if (!monthMap[k]) monthMap[k] = { revenue: 0, cost: 0, profit: 0 }
    monthMap[k].revenue += b.total_pkr
    monthMap[k].cost    += b.cost_pkr
    monthMap[k].profit  += b.profit_pkr
  }
  for (const inv of customInvoices) {
    const k = monthKey(inv.invoice_date || inv.created_at)
    if (!monthMap[k]) monthMap[k] = { revenue: 0, cost: 0, profit: 0 }
    monthMap[k].revenue += inv.total
    monthMap[k].cost    += Math.max(0, inv.total - (inv.profit_pkr ?? 0))
    monthMap[k].profit  += inv.profit_pkr ?? 0
  }
  // Build a guaranteed 6-month grid regardless of how many bookings exist
  const now = new Date()
  const revenueData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-PK', { month: 'short', year: '2-digit' })
    return { month: label, ...(monthMap[k] ?? { revenue: 0, cost: 0, profit: 0 }) }
  })

  // ── Airline data ──────────────────────────────────────────────────────────
  const airlineMap: Record<string, { revenue: number; bookings: number }> = {}
  for (const b of bookings) {
    if (!airlineMap[b.airline_name]) airlineMap[b.airline_name] = { revenue: 0, bookings: 0 }
    airlineMap[b.airline_name].revenue  += b.total_pkr
    airlineMap[b.airline_name].bookings += 1
  }
  const airlineData = Object.entries(airlineMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── Status data ───────────────────────────────────────────────────────────
  const paidCount = bookings.filter(b => b.remaining_pkr === 0).length
  const dueCount  = bookings.filter(b => b.remaining_pkr > 0).length
  const statusData = [
    { name: 'Fully Paid', value: paidCount },
    { name: 'Remaining', value: dueCount },
  ]

  // ── Payment method data ───────────────────────────────────────────────────
  const methodMap: Record<string, number> = {}
  for (const p of bookingPayments) {
    methodMap[p.method] = (methodMap[p.method] ?? 0) + p.amount_pkr
  }
  const paymentMethodData = Object.entries(methodMap).map(([method, amount]) => ({ method, amount }))

  return (
    <PageContainer>
      <KpiGrid columns={5}>
        <KpiCard label="Total Bookings"  value={String(totalBookings)}  icon={BookOpen}
          iconBg="bg-amber-50" iconColor="text-gold" href="/bookings" />
        <KpiCard label="Customers"       value={String(uniqueCustomers)} icon={Users}
          iconBg="bg-amber-50" iconColor="text-gold" href="/accounts" />
        <KpiCard label="Revenue"         value={pkr(totalRevenue)}       icon={DollarSign}
          iconBg="bg-emerald-50" iconColor="text-emerald-600" href="/accounts" />
        <KpiCard label="Your Profit (Earnings)"          value={pkr(totalProfit)}        icon={TrendingUp}
          iconBg="bg-sky-50" iconColor="text-sky-500" href="/accounts" />
        <KpiCard label="To receive from customers"     value={pkr(totalDue)}           icon={AlertCircle}
          iconBg="bg-rose-50" iconColor="text-rose-500" href="/accounts" />
      </KpiGrid>

      {/* Charts section */}
      <DashboardCharts
        revenueData={revenueData}
        airlineData={airlineData}
        statusData={statusData}
        paymentMethodData={paymentMethodData}
        totalRevenue={totalRevenue}
        totalCost={totalCost}
        totalProfit={totalProfit}
      />

      {/* Bottom row: recent bookings + quick links */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card className="shadow-sm border-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Bookings</CardTitle>
                <Link href="/bookings">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">View all</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recent.length === 0 ? (
                <div className="px-6 py-10 text-center text-muted-foreground text-sm">
                  No bookings yet. Create your first package!
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recent.map((b) => (
                    <div key={b.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gold">
                          {b.customer_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{b.airline_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">{pkr(b.total_pkr)}</p>
                        <Badge variant="outline"
                          className={b.remaining_pkr > 0
                            ? 'text-amber-600 border-amber-200 bg-amber-50 text-[10px] h-4'
                            : 'text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] h-4'}
                        >
                          {b.remaining_pkr > 0 ? 'Due' : 'Paid'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm border-0 bg-navy text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-5 relative z-10">
              <Calculator className="w-8 h-8 text-gold mb-3" />
              <h3 className="font-semibold mb-1">Create Package</h3>
              <p className="text-white/60 text-xs mb-4">Build and save a new Umrah package instantly</p>
              <Link href="/calculator">
                <Button size="sm" className="bg-gold-gradient hover:brightness-110 h-10 text-navy font-semibold w-full">
                  Open Calculator
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardContent className="p-5">
              <Settings className="w-8 h-8 text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">Configure Rates</h3>
              <p className="text-muted-foreground text-xs mb-4">Update visa, hotel, airline and currency rates</p>
              <Link href="/settings/visa">
                <Button size="sm" variant="outline" className="w-full">Go to Settings</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
