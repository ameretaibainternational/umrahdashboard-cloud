'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ── Palette ──────────────────────────────────────────────────────────────────
const GOLD     = '#d7ab52'
const NAVY     = '#0b1e36'
const EMERALD  = '#10b981'
const AMBER    = '#f59e0b'
const ROSE     = '#f43f5e'
const SLATE    = '#94a3b8'

const PIE_COLORS = [GOLD, EMERALD, AMBER, ROSE, NAVY, SLATE]

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, prefix = 'PKR ' }: {
  active?: boolean; payload?: {value: number; name: string; color: string}[]; label?: string; prefix?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg px-4 py-3 text-xs">
      {label && <p className="font-semibold text-foreground mb-1.5">{label}</p>}
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">
            {prefix}{Math.round(p.value).toLocaleString('en-PK')}
          </span>
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: {value: number; name: string}[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold">{payload[0].name}</p>
      <p className="text-muted-foreground mt-0.5">{payload[0].value} booking{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface RevenuePoint { month: string; revenue: number; cost: number; profit: number }
interface AirlinePoint { name: string; revenue: number; bookings: number }
interface StatusPoint  { name: string; value: number }
interface PaymentPoint { method: string; amount: number }

interface Props {
  revenueData: RevenuePoint[]
  airlineData: AirlinePoint[]
  statusData: StatusPoint[]
  paymentMethodData: PaymentPoint[]
  totalRevenue: number
  totalCost: number
  totalProfit: number
}

// ── Revenue vs Cost Area Chart ────────────────────────────────────────────────
function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Revenue vs Cost vs Profit</CardTitle>
        <p className="text-xs text-muted-foreground">Monthly breakdown across all bookings</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={GOLD}     stopOpacity={0.20} />
                <stop offset="95%" stopColor={GOLD}     stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={EMERALD}  stopOpacity={0.18} />
                <stop offset="95%" stopColor={EMERALD}  stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={ROSE}     stopOpacity={0.12} />
                <stop offset="95%" stopColor={ROSE}     stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke={GOLD}    strokeWidth={2.5} fill="url(#gRevenue)" dot={{ r: 3, fill: GOLD,    strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="cost"    name="Cost"    stroke={ROSE}    strokeWidth={2.5} fill="url(#gCost)"    dot={{ r: 3, fill: ROSE,    strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="profit"  name="Profit"  stroke={EMERALD} strokeWidth={2.5} fill="url(#gProfit)"  dot={{ r: 3, fill: EMERALD, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Booking Status Donut ──────────────────────────────────────────────────────
function StatusDonut({ data, total }: { data: StatusPoint[]; total: number }) {
  const COLORS = [EMERALD, AMBER]
  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Booking Status</CardTitle>
        <p className="text-xs text-muted-foreground">Paid vs remaining</p>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={72}
                dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-foreground">{total}</span>
            <span className="text-[10px] text-muted-foreground">bookings</span>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {data.map((d, i) => (
            <div key={d.name}>
              <div className="flex justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-semibold">{d.value}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: total ? `${(d.value / total) * 100}%` : '0%', background: COLORS[i] }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Airline Revenue Bar Chart ─────────────────────────────────────────────────
function AirlineBar({ data }: { data: AirlinePoint[] }) {
  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Revenue by Airline</CardTitle>
        <p className="text-xs text-muted-foreground">Total PKR collected per carrier</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No booking data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={88} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]} maxBarSize={20}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ── Payment Method Bar Chart ──────────────────────────────────────────────────
function PaymentMethodBar({ data }: { data: PaymentPoint[] }) {
  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Payments by Method</CardTitle>
        <p className="text-xs text-muted-foreground">Total received per channel</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[150px] flex items-center justify-center text-sm text-muted-foreground">No payments yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="method" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {data.map((_, i) => (
                  <Cell key={i} fill={[GOLD, EMERALD, AMBER, NAVY][i % 4]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ── Profit Margin Visual ──────────────────────────────────────────────────────
function ProfitMargin({ revenue, cost, profit }: { revenue: number; cost: number; profit: number }) {
  const margin = revenue > 0 ? ((profit / revenue) * 100) : 0
  const costPct = revenue > 0 ? ((cost / revenue) * 100) : 0

  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Financial Breakdown</CardTitle>
        <p className="text-xs text-muted-foreground">Cost vs profit distribution of total revenue</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stacked bar */}
        <div>
          <div className="flex h-5 rounded-lg overflow-hidden gap-px">
            <div className="h-full bg-rose-400 transition-all" style={{ width: `${costPct}%` }} title="Cost" />
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${margin}%` }} title="Profit" />
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
              <span className="text-muted-foreground">Cost {costPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              <span className="text-muted-foreground">Profit {margin.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Three metrics */}
        {[
          { label: 'Revenue', value: revenue, color: GOLD,   pct: 100 },
          { label: 'Cost',    value: cost,    color: ROSE,   pct: costPct },
          { label: 'Profit',  value: profit,  color: EMERALD, pct: margin },
        ].map(r => (
          <div key={r.label}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold">PKR {Math.round(r.value).toLocaleString('en-PK')}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color, opacity: 0.8 }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DashboardCharts({
  revenueData, airlineData, statusData, paymentMethodData,
  totalRevenue, totalCost, totalProfit,
}: Props) {
  const total = statusData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-4">
      {/* Full-width area chart */}
      <RevenueChart data={revenueData} />

      {/* Three-column row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatusDonut data={statusData} total={total} />
        <AirlineBar data={airlineData} />
        <ProfitMargin revenue={totalRevenue} cost={totalCost} profit={totalProfit} />
      </div>

      {/* Payment methods — full width on mobile, half on large */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentMethodBar data={paymentMethodData} />

        {/* Top customers mini-list */}
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Bookings by Value</CardTitle>
            <p className="text-xs text-muted-foreground">Highest-value packages</p>
          </CardHeader>
          <CardContent className="p-0">
            {airlineData.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground text-center">No bookings yet</p>
            ) : (
              <div className="divide-y divide-border">
                {airlineData.slice(0, 5).map((a, i) => (
                  <div key={a.name} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.bookings} booking{a.bookings !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-semibold text-gold flex-shrink-0">
                      PKR {Math.round(a.revenue).toLocaleString('en-PK')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
