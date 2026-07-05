'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateTransport } from '@/app/actions/settings'
import CustomTransportsForm from '@/components/settings/CustomTransportsForm'
import type { TransportRate, CustomTransport } from '@/lib/types'
import { TRANSPORT_VEHICLES } from '@/lib/transport'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Save } from 'lucide-react'

function getRateDefault(rates: TransportRate[], type: string, pax: number) {
  return rates.find(r => r.type === type && r.pax_count === pax)?.rate_sar ?? 0
}

export default function TransportForm({ rates, customTransports }: { rates: TransportRate[]; customTransports: CustomTransport[] }) {
  const [isPending, startTransition] = useTransition()

  return (
    <>
    <Card className="shadow-sm border-0 max-w-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Transport Rates (SAR)</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={async (fd) => {
          startTransition(async () => {
            await updateTransport(fd)
            toast.success('Transport rates saved!')
          })
        }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Vehicle</TableHead>
                {[1, 2, 3, 4].map(n => <TableHead key={n} className="text-xs text-center">{n} Pax</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {TRANSPORT_VEHICLES.map(type => (
                <TableRow key={type}>
                  <TableCell className="font-medium text-sm">{type}</TableCell>
                  {[1, 2, 3, 4].map(pax => (
                    <TableCell key={pax} className="p-1">
                      <Input
                        type="number"
                        name={`${type}_${pax}`}
                        defaultValue={getRateDefault(rates, type, pax)}
                        min={0}
                        className="text-center h-8 text-sm"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button type="submit" disabled={isPending} className="mt-4 bg-navy hover:bg-navy-2 text-white">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Rates
          </Button>
        </form>
      </CardContent>
    </Card>
    <CustomTransportsForm customTransports={customTransports} />
    </>
  )
}
