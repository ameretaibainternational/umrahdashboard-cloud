'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateCompany } from '@/app/actions/settings'
import type { Company } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'

export default function CompanyForm({ company }: { company: Company }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Card className="shadow-sm border-0 max-w-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Company Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={async (fd) => {
          startTransition(async () => {
            await updateCompany(fd)
            toast.success('Company info saved!')
          })
        }} className="space-y-4">
          {[
            { name: 'name', label: 'Company Name', value: company.name },
            { name: 'license', label: 'License / Registration', value: company.license },
            { name: 'phone', label: 'Phone', value: company.phone },
            { name: 'website', label: 'Website', value: company.website },
            { name: 'address', label: 'Address', value: company.address },
          ].map(f => (
            <div key={f.name} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              <Input name={f.name} defaultValue={f.value} />
            </div>
          ))}
          <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
