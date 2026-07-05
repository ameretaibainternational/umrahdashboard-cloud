'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateFlightCities } from '@/app/actions/settings'
import type { Company } from '@/lib/types'
import {
  citiesToFormValue,
  DEFAULT_PK_FLIGHT_CITIES,
  DEFAULT_SA_FLIGHT_CITIES,
} from '@/lib/flight-cities'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'

export default function FlightCitiesForm({ company }: { company: Company }) {
  const [isPending, startTransition] = useTransition()

  const pkValue = citiesToFormValue(company.pk_flight_cities ?? DEFAULT_PK_FLIGHT_CITIES)
  const saValue = citiesToFormValue(company.sa_flight_cities ?? DEFAULT_SA_FLIGHT_CITIES)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateFlightCities(formData)
      toast.success('Flight cities saved!')
    })
  }

  return (
    <Card className="shadow-sm border-0 max-w-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Flight Cities</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          One city per line. Used in the package calculator route dropdowns.
        </p>
      </CardHeader>
      <CardContent>
        <form key={`${pkValue}-${saValue}`} action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Pakistan Cities</Label>
            <textarea
              name="pk_flight_cities"
              defaultValue={pkValue}
              rows={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Saudi Arabia Cities</Label>
            <textarea
              name="sa_flight_cities"
              defaultValue={saValue}
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
            />
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
