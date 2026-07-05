'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { saveInvoiceSettings } from '@/app/actions/custom-invoices'
import type { InvoiceSettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'

export default function InvoiceSettingsForm({ settings }: { settings: InvoiceSettings }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      payment_bank_name: String(fd.get('payment_bank_name') ?? ''),
      payment_account_number: String(fd.get('payment_account_number') ?? ''),
      terms_text: String(fd.get('terms_text') ?? ''),
      contact_phone: String(fd.get('contact_phone') ?? ''),
      contact_email: String(fd.get('contact_email') ?? ''),
      contact_location: String(fd.get('contact_location') ?? ''),
    }

    startTransition(async () => {
      const result = await saveInvoiceSettings(payload)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Invoice defaults saved.')
    })
  }

  return (
    <Card className="shadow-sm border-0 max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Custom Invoice Defaults</CardTitle>
        <p className="text-xs text-muted-foreground">
          These values pre-fill payment and contact fields whenever you open or start a new custom invoice.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-navy mb-3 uppercase tracking-wide">Payment Method</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Bank Name</Label>
                <Input name="payment_bank_name" defaultValue={settings.payment_bank_name} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Account Number</Label>
                <Input name="payment_account_number" defaultValue={settings.payment_account_number} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-navy mb-3 uppercase tracking-wide">Contact Us</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input name="contact_phone" defaultValue={settings.contact_phone} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input name="contact_email" type="email" defaultValue={settings.contact_email} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input name="contact_location" defaultValue={settings.contact_location} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Terms &amp; Conditions</Label>
            <textarea
              name="terms_text"
              defaultValue={settings.terms_text}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Defaults
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
