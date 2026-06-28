'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { upsertInvoicePaymentMethod, deleteInvoicePaymentMethod } from '@/app/actions/settings'
import type { InvoicePaymentMethod } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

interface Props { methods: InvoicePaymentMethod[] }

const empty: Partial<InvoicePaymentMethod> = { label: '', bank_name: '', account_number: '' }

export default function InvoicePaymentMethodsForm({ methods }: Props) {
  const [editing, setEditing] = useState<Partial<InvoicePaymentMethod> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUpsert(formData: FormData) {
    startTransition(async () => {
      const result = await upsertInvoicePaymentMethod(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(editing?.id ? 'Payment method updated!' : 'Payment method added!')
      setEditing(null)
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      await deleteInvoicePaymentMethod(deleteId)
      toast.success('Payment method deleted')
      setDeleteId(null)
    })
  }

  return (
    <>
      <Card className="shadow-sm border-0 max-w-3xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Payment Methods</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Saved bank accounts — they appear in the Payment Method dropdown on custom invoices.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditing(empty)} className="bg-navy hover:bg-navy-2 text-white gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add Method
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Label</TableHead>
                <TableHead className="text-xs">Bank Name</TableHead>
                <TableHead className="text-xs">Account Number</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                    No saved payment methods
                  </TableCell>
                </TableRow>
              ) : methods.map(m => (
                <TableRow key={m.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-sm">{m.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.bank_name || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.account_number || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(m)} className="text-muted-foreground hover:text-navy transition-colors p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(m.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Payment Method' : 'Add Payment Method'}</DialogTitle>
          </DialogHeader>
          <form action={handleUpsert} className="space-y-4">
            {editing?.id && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-1.5">
              <Label className="text-xs">Label *</Label>
              <Input name="label" defaultValue={editing?.label ?? ''} required placeholder="Meezan Bank" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bank Name</Label>
              <Input name="bank_name" defaultValue={editing?.bank_name ?? ''} placeholder="Meezan Bank" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account Number</Label>
              <Input name="account_number" defaultValue={editing?.account_number ?? ''} placeholder="01234567890123" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing?.id ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Payment Method</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remove this payment method from the saved list? Existing invoices are not affected.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
