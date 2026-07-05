'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { upsertAirline, deleteAirline } from '@/app/actions/settings'
import type { Airline } from '@/lib/types'
import { pkr } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

interface Props { airlines: Airline[] }

const empty: Partial<Airline> = { name: '', adult_pkr: 0, child_pkr: 0, infant_pkr: 0 }

export default function AirlinesForm({ airlines }: Props) {
  const [editing, setEditing] = useState<Partial<Airline> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUpsert(formData: FormData) {
    startTransition(async () => {
      await upsertAirline(formData)
      toast.success(editing?.id ? 'Airline updated!' : 'Airline added!')
      setEditing(null)
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      await deleteAirline(deleteId)
      toast.success('Airline deleted')
      setDeleteId(null)
    })
  }

  return (
    <>
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Airlines & Ticket Rates</CardTitle>
          <Button size="sm" onClick={() => setEditing(empty)} className="bg-navy hover:bg-navy-2 text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Airline
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Airline</TableHead>
                <TableHead className="text-xs text-right">Adult (PKR)</TableHead>
                <TableHead className="text-xs text-right">Child (PKR)</TableHead>
                <TableHead className="text-xs text-right">Infant (PKR)</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {airlines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">No airlines added</TableCell>
                </TableRow>
              ) : airlines.map(a => (
                <TableRow key={a.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-sm">{a.name}</TableCell>
                  <TableCell className="text-right text-sm">{pkr(a.adult_pkr)}</TableCell>
                  <TableCell className="text-right text-sm">{pkr(a.child_pkr)}</TableCell>
                  <TableCell className="text-right text-sm">{pkr(a.infant_pkr)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(a)} className="text-muted-foreground hover:text-navy transition-colors p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(a.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
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

      {/* Add/Edit dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Airline' : 'Add Airline'}</DialogTitle>
          </DialogHeader>
          <form action={handleUpsert} className="space-y-4">
            {editing?.id && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-1.5">
              <Label className="text-xs">Airline Name</Label>
              <Input name="name" defaultValue={editing?.name ?? ''} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: 'adult_pkr', label: 'Adult (PKR)', value: editing?.adult_pkr },
                { name: 'child_pkr', label: 'Child (PKR)', value: editing?.child_pkr },
                { name: 'infant_pkr', label: 'Infant (PKR)', value: editing?.infant_pkr },
              ].map(f => (
                <div key={f.name} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input type="number" name={f.name} defaultValue={f.value ?? 0} min={0} required />
                </div>
              ))}
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

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Airline</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this airline?</p>
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
