'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { upsertHotel, deleteHotel } from '@/app/actions/settings'
import type { Hotel } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

interface Props { hotels: Hotel[] }

const empty: Partial<Hotel> = { name: '', city: 'Makkah', location: '', distance: '', contact_number: '', sharing_sar: 0, quad_sar: 0, triple_sar: 0, double_sar: 0, room_sar: 0 }

export default function HotelsForm({ hotels }: Props) {
  const router = useRouter()
  const [cityFilter, setCityFilter] = useState<'Makkah' | 'Madinah'>('Makkah')
  const [editing, setEditing] = useState<Partial<Hotel> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = hotels.filter(h => h.city === cityFilter)

  function openEditor(hotel: Partial<Hotel>) {
    setEditing({
      ...empty,
      ...hotel,
      contact_number: hotel.contact_number ?? '',
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await upsertHotel(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(editing?.id ? 'Hotel updated!' : 'Hotel added!')
      setEditing(null)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      await deleteHotel(deleteId)
      toast.success('Hotel deleted')
      setDeleteId(null)
      router.refresh()
    })
  }

  return (
    <>
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Hotels</CardTitle>
          <Button size="sm" onClick={() => openEditor({ ...empty, city: cityFilter })} className="bg-navy hover:bg-navy-2 text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Hotel
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={cityFilter} onValueChange={v => setCityFilter(v as 'Makkah' | 'Madinah')} className="mb-4">
            <TabsList>
              <TabsTrigger value="Makkah">Makkah ({hotels.filter(h => h.city === 'Makkah').length})</TabsTrigger>
              <TabsTrigger value="Madinah">Madinah ({hotels.filter(h => h.city === 'Madinah').length})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Hotel</TableHead>
                  <TableHead className="text-xs">Location</TableHead>
                  <TableHead className="text-xs">Distance</TableHead>
                  <TableHead className="text-xs">Contact</TableHead>
                  <TableHead className="text-xs text-right">Room</TableHead>
                  <TableHead className="text-xs text-right">Sharing</TableHead>
                  <TableHead className="text-xs text-right">Quad</TableHead>
                  <TableHead className="text-xs text-right">Triple</TableHead>
                  <TableHead className="text-xs text-right">Double</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8 text-sm">No hotels in {cityFilter}</TableCell>
                  </TableRow>
                ) : filtered.map(h => (
                  <TableRow key={h.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium text-xs">{h.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{h.location}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{h.distance}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{h.contact_number || '—'}</TableCell>
                    <TableCell className="text-right text-xs">{h.room_sar ?? 0}</TableCell>
                    <TableCell className="text-right text-xs">{h.sharing_sar}</TableCell>
                    <TableCell className="text-right text-xs">{h.quad_sar}</TableCell>
                    <TableCell className="text-right text-xs">{h.triple_sar}</TableCell>
                    <TableCell className="text-right text-xs">{h.double_sar}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEditor(h)} className="text-muted-foreground hover:text-navy p-1">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(h.id)} className="text-muted-foreground hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Hotel' : 'Add Hotel'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form key={editing.id ?? `new-${editing.city}`} onSubmit={handleSubmit} className="space-y-4">
              {editing.id && <input type="hidden" name="id" value={editing.id} />}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <select
                    name="city"
                    defaultValue={editing.city ?? 'Makkah'}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="Makkah">Makkah</option>
                    <option value="Madinah">Madinah</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hotel Name</Label>
                  <Input name="name" defaultValue={editing.name ?? ''} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Location</Label>
                  <Input name="location" defaultValue={editing.location ?? ''} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Distance</Label>
                  <Input name="distance" defaultValue={editing.distance ?? ''} placeholder="e.g. 200 MTR" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Contact Number</Label>
                  <Input
                    name="contact_number"
                    defaultValue={editing.contact_number ?? ''}
                    placeholder="+966 12 000 0000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {(['room', 'sharing', 'quad', 'triple', 'double'] as const).map(r => (
                  <div key={r} className="space-y-1.5">
                    <Label className="text-xs capitalize">{r} SAR</Label>
                    <Input
                      type="number" name={`${r}_sar`} min={0}
                      defaultValue={Number(editing[`${r}_sar`] ?? 0)}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing.id ? 'Update' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Hotel</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this hotel?</p>
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
