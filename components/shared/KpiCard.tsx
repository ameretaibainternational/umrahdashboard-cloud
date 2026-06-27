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
      'p-5 flex items-start gap-4 shadow-sm border-0 bg-white transition-shadow',
      href ? 'hover:shadow-md cursor-pointer hover:bg-slate-50/80' : 'hover:shadow-md',
    )}>
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon className={cn('w-5 h-5', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl font-bold text-navy truncate">{value}</p>
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
