'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateCurrency } from '@/app/actions/settings'
import type { CurrencySettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'

export default function CurrencyForm({ currency }: { currency: CurrencySettings }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Card className="shadow-sm border-0 max-w-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Currency Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={async (fd) => {
          startTransition(async () => {
            await updateCurrency(fd)
            toast.success('Currency rate saved!')
          })
        }} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">1 SAR = ? PKR</Label>
            <Input type="number" name="sar_to_pkr" defaultValue={currency.sar_to_pkr} min={1} step={0.01} required />
          </div>
          <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Rate
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
