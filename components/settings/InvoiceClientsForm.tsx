'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { upsertInvoiceClient, deleteInvoiceClient } from '@/app/actions/settings'
import type { InvoiceClient } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

interface Props { clients: InvoiceClient[] }

const empty: Partial<InvoiceClient> = { name: '', address: '', client_number: '' }

export default function InvoiceClientsForm({ clients }: Props) {
  const [editing, setEditing] = useState<Partial<InvoiceClient> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUpsert(formData: FormData) {
    startTransition(async () => {
      const result = await upsertInvoiceClient(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(editing?.id ? 'Client updated!' : 'Client added!')
      setEditing(null)
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      await deleteInvoiceClient(deleteId)
      toast.success('Client deleted')
      setDeleteId(null)
    })
  }

  return (
    <>
      <Card className="shadow-sm border-0 max-w-3xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Saved Invoice Clients</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Recurring agencies and customers — they appear in the Billed To dropdown on custom invoices.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditing(empty)} className="bg-navy hover:bg-navy-2 text-white gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add Client
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Address</TableHead>
                <TableHead className="text-xs">Client Number</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                    No saved clients — add agencies you bill regularly
                  </TableCell>
                </TableRow>
              ) : clients.map(c => (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-sm">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.address || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.client_number || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(c)} className="text-muted-foreground hover:text-navy transition-colors p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(c.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
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
            <DialogTitle>{editing?.id ? 'Edit Client' : 'Add Client'}</DialogTitle>
          </DialogHeader>
          <form action={handleUpsert} className="space-y-4">
            {editing?.id && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input name="name" defaultValue={editing?.name ?? ''} required placeholder="ATIQ TRAVEL & TOURS" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Input name="address" defaultValue={editing?.address ?? ''} placeholder="DUBAI" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Number</Label>
              <Input name="client_number" defaultValue={editing?.client_number ?? ''} placeholder="+971 50 000 0000" />
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
          <DialogHeader><DialogTitle>Delete Client</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remove this client from the saved list? Existing invoices are not affected.</p>
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
