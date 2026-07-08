import { getBookings } from '@/lib/db'
import { pkr } from '@/lib/formatters'
import KpiCard from '@/components/shared/KpiCard'
import KpiGrid, { PageContainer } from '@/components/shared/KpiGrid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react'

export default async function ReportsPage() {
  const rawBookings = await getBookings()
  const bookings = rawBookings.filter(b => b.source_invoice_id !== null)

  const revenue = bookings.reduce((s, b) => s + b.total_pkr, 0)
  const cost = bookings.reduce((s, b) => s + b.cost_pkr, 0)
  const profit = bookings.reduce((s, b) => s + b.profit_pkr, 0)
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0'

  const byAirline: Record<string, { count: number; revenue: number; profit: number }> = {}
  for (const b of bookings) {
    if (!byAirline[b.airline_name]) byAirline[b.airline_name] = { count: 0, revenue: 0, profit: 0 }
    byAirline[b.airline_name].count++
    byAirline[b.airline_name].revenue += b.total_pkr
    byAirline[b.airline_name].profit += b.profit_pkr
  }

  return (
    <PageContainer>
      <KpiGrid columns={3}>
        <KpiCard label="Total Revenue" value={pkr(revenue)} icon={DollarSign}
          iconBg="bg-blue-50" iconColor="text-blue-600" trend={`${bookings.length} bookings`} />
        <KpiCard label="Total Cost" value={pkr(cost)} icon={TrendingDown}
          iconBg="bg-red-50" iconColor="text-red-500" />
        <KpiCard label="Total Profit" value={pkr(profit)} icon={TrendingUp}
          iconBg="bg-emerald-50" iconColor="text-emerald-600"
          trend={`${margin}% margin`} trendUp={profit > 0} />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Financial Summary</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {[
                  { label: 'Total Bookings', value: bookings.length },
                  { label: 'Total Revenue', value: pkr(revenue) },
                  { label: 'Total Cost', value: pkr(cost) },
                  { label: 'Gross Profit', value: pkr(profit) },
                  { label: 'Profit Margin', value: `${margin}%` },
                  { label: 'Avg. per Booking', value: bookings.length ? pkr(revenue / bookings.length) : '—' },
                ].map(row => (
                  <TableRow key={row.label} className="hover:bg-muted/20">
                    <TableCell className="text-sm text-muted-foreground">{row.label}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-navy">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Revenue by Airline</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Airline</TableHead>
                  <TableHead className="text-xs text-right">Bookings</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                  <TableHead className="text-xs text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys(byAirline).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">No data</TableCell></TableRow>
                ) : Object.entries(byAirline)
                    .sort((a, b) => b[1].revenue - a[1].revenue)
                    .map(([name, data]) => (
                      <TableRow key={name} className="hover:bg-muted/20">
                        <TableCell className="text-sm font-medium">{name}</TableCell>
                        <TableCell className="text-right text-sm">{data.count}</TableCell>
                        <TableCell className="text-right text-sm">{pkr(data.revenue)}</TableCell>
                        <TableCell className="text-right text-sm text-emerald-600">{pkr(data.profit)}</TableCell>
                      </TableRow>
                    ))
                }
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
