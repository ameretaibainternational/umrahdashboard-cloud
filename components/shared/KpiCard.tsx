import Link from 'next/link'
import { Card } from '@/components/ui/card'
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
  const card = (
    <Card className={cn(
      'p-3 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-4 shadow-sm border-0 bg-white transition-shadow min-w-0',
      href ? 'hover:shadow-md cursor-pointer hover:bg-slate-50/80' : 'hover:shadow-md',
    )}>
      <div className={cn('w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', iconColor)} />
      </div>
      <div className="min-w-0 flex-1 w-full">
        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5 sm:mb-1 leading-snug">{label}</p>
        <p className="text-sm sm:text-lg lg:text-xl font-bold text-navy tabular-nums leading-tight break-words">{value}</p>
        {trend && (
          <p className={cn('text-xs mt-0.5', trendUp ? 'text-emerald-600' : 'text-muted-foreground')}>
            {trend}
          </p>
        )}
      </div>
    </Card>
  )

  if (!href) return card

  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl">
      {card}
    </Link>
  )
}
