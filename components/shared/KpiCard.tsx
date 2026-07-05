import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: string
  trendUp?: boolean
  href?: string
}

export default function KpiCard({
  label, value, icon: Icon, iconColor = 'text-navy', iconBg = 'bg-navy/10',
  trend, trendUp, href,
}: KpiCardProps) {
  const displayValue = value.replace(/^PKR /, 'PKR\u00A0')

  const card = (
    <div
      className={cn(
        'h-full min-w-0 rounded-xl bg-white p-4',
        'ring-1 ring-foreground/10 shadow-sm',
        'flex flex-col gap-3',
        href && 'transition-shadow hover:shadow-md hover:bg-slate-50/80',
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
        <p className="min-w-0 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground leading-snug line-clamp-2">
          {label}
        </p>
      </div>

      <div className="min-w-0">
        <p
          className="text-[clamp(0.8125rem,2.1vw,1.125rem)] font-bold text-navy tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
          title={value}
        >
          {displayValue}
        </p>
        {trend && (
          <p className={cn('text-xs mt-1 truncate', trendUp ? 'text-emerald-600' : 'text-muted-foreground')}>
            {trend}
          </p>
        )}
      </div>
    </div>
  )

  if (!href) return card

  return (
    <Link href={href} className="block h-full min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl">
      {card}
    </Link>
  )
}
