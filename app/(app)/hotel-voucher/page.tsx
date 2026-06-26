import HotelVoucherForm from '@/components/hotel-voucher/HotelVoucherForm'
import { getHotelVoucherSettings, getHotelVouchers, getCurrentStaff } from '@/lib/db'
import { isAdminPermission } from '@/lib/permissions'
import { BedDouble } from 'lucide-react'

export default async function HotelVoucherPage() {
  const [settings, vouchers, staff] = await Promise.all([
    getHotelVoucherSettings(),
    getHotelVouchers(),
    getCurrentStaff(),
  ])

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-navy flex items-center justify-center">
          <BedDouble className="w-4 h-4 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy">Hotel Voucher</h1>
          <p className="text-xs text-muted-foreground">Generate print-ready hotel vouchers for pilgrims</p>
        </div>
      </div>

      <HotelVoucherForm
        initialSettings={{
          urdu_guidelines: settings.urdu_guidelines,
          urdu_footer: settings.urdu_footer,
        }}
        existingVouchers={vouchers}
        canEditGuidelines={!!staff && isAdminPermission(staff.permission)}
      />
    </div>
  )
}
