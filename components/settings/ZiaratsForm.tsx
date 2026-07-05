'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { upsertZiarat, deleteZiarat } from '@/app/actions/settings'
import type { ZiaratOption } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

interface Props { ziarats: ZiaratOption[] }

const empty: Partial<ZiaratOption> = { name: '', rate_sar: 0 }

export default function ZiaratsForm({ ziarats }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<Partial<ZiaratOption> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUpsert(formData: FormData) {
    startTransition(async () => {
      const result = await upsertZiarat(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(editing?.id ? 'Ziarat updated!' : 'Ziarat added!')
      setEditing(null)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      const result = await deleteZiarat(deleteId)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Ziarat deleted')
      setDeleteId(null)
      router.refresh()
    })
  }

  return (
    <>
      <Card className="shadow-sm border-0 max-w-3xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Ziarat Rates (SAR)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Flat group rates added to the package cost when selected in the calculator.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditing(empty)} className="bg-navy hover:bg-navy-2 text-white gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add Ziarat
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Ziarat Name</TableHead>
                <TableHead className="text-xs w-32">Rate (SAR)</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ziarats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8 text-sm">
                    No ziarats yet — click Add Ziarat to create one.
                  </TableCell>
                </TableRow>
              ) : ziarats.map(z => (
                <TableRow key={z.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-sm">{z.name}</TableCell>
                  <TableCell className="text-sm">{z.rate_sar}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <button type="button" onClick={() => setEditing(z)} className="text-muted-foreground hover:text-navy transition-colors p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteId(z.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
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
            <DialogTitle>{editing?.id ? 'Edit Ziarat' : 'Add Ziarat'}</DialogTitle>
          </DialogHeader>
          <form action={handleUpsert} className="space-y-4">
            {editing?.id && <input type="hidden" name="id" value={editing.id} />}
            {editing?.sort_order != null && <input type="hidden" name="sort_order" value={editing.sort_order} />}
            <div className="space-y-1.5">
              <Label className="text-xs">Ziarat Name *</Label>
              <Input name="name" defaultValue={editing?.name ?? ''} required placeholder="e.g. Jeddah City Tour" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Flat Group Rate (SAR)</Label>
              <Input type="number" name="rate_sar" defaultValue={editing?.rate_sar ?? 0} min={0} />
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
          <DialogHeader><DialogTitle>Delete Ziarat</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remove this ziarat from settings? Existing saved invoices are not affected.</p>
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
