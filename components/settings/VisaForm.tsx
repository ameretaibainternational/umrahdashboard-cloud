'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateVisa } from '@/app/actions/settings'
import type { VisaSettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, Save } from 'lucide-react'

const ADULT_TIERS = [
  { name: 'visa_rate_1_pax',    label: '1 PAX' },
  { name: 'visa_rate_2_pax',    label: '2 PAX' },
  { name: 'visa_rate_3_pax',    label: '3 PAX' },
  { name: 'visa_rate_4_pax',    label: '4 PAX' },
  { name: 'visa_rate_group_pax', label: '5 – 49 PAX' },
] as const

export default function VisaForm({ visa }: { visa: VisaSettings }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateVisa(formData)
      toast.success('Visa settings saved!')
    })
  }

  return (
    <Card className="shadow-sm border-0 max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Visa Rates (SAR)</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-5">

          {/* Adult tier rates */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Adult Visa Rate — by PAX Count
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {ADULT_TIERS.map(f => (
                <div key={f.name} className="space-y-1.5">
                  <Label className="text-xs">{f.label} (SAR)</Label>
                  <Input
                    type="number"
                    name={f.name}
                    defaultValue={visa[f.name]}
                    min={0}
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Child & infant */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Standard Rates
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              {[
                { name: 'child_sar',  label: 'Child',  defaultValue: visa.child_sar },
                { name: 'infant_sar', label: 'Infant', defaultValue: visa.infant_sar },
              ].map(f => (
                <div key={f.name} className="space-y-1.5">
                  <Label className="text-xs">{f.label} (SAR)</Label>
                  <Input type="number" name={f.name} defaultValue={f.defaultValue} min={0} required />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Transport mode */}
          <div className="space-y-1.5 max-w-sm">
            <Label className="text-xs">Transport Mode</Label>
            <Select name="transport_mode" defaultValue={visa.transport_mode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="included">Included in package (no separate transport cost)</SelectItem>
                <SelectItem value="separate">Separate (added to package cost)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
