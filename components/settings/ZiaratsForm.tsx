'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateZiarats } from '@/app/actions/settings'
import type { VisaSettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'

export default function ZiaratsForm({ visa }: { visa: VisaSettings }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateZiarats(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Ziarat rates saved!')
      router.refresh()
    })
  }

  return (
    <Card className="shadow-sm border-0 max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ziarat Rates (SAR)</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Flat group rate added to the package cost when selected in the calculator.
        </p>
      </CardHeader>
      <CardContent>
        <form key={`${visa.makkah_ziarat_rate}-${visa.madina_ziarat_rate}-${visa.badr_ziarat_rate}-${visa.taif_ziarat_rate}`} action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Makkah Ziarat (SAR)</Label>
              <Input
                type="number"
                name="makkah_ziarat_rate"
                defaultValue={visa.makkah_ziarat_rate}
                min={0}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Madinah Ziarat (SAR)</Label>
              <Input
                type="number"
                name="madina_ziarat_rate"
                defaultValue={visa.madina_ziarat_rate}
                min={0}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Badr Ziarat (SAR)</Label>
              <Input
                type="number"
                name="badr_ziarat_rate"
                defaultValue={visa.badr_ziarat_rate}
                min={0}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Taif Ziarat (SAR)</Label>
              <Input
                type="number"
                name="taif_ziarat_rate"
                defaultValue={visa.taif_ziarat_rate}
                min={0}
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
            {isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
