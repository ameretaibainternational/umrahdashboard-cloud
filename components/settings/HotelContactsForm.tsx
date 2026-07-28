'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { upsertHotelContact, deleteHotelContact } from '@/app/actions/settings'
import type { Hotel, HotelContact } from '@/lib/types'
import { HOTEL_CONTACT_CITIES } from '@/lib/hotel-contacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

interface Props { contacts: HotelContact[]; hotels: Hotel[] }

const empty: Partial<HotelContact> = { name: '', city: 'Makkah', contact_number: '' }

export default function HotelContactsForm({ contacts, hotels }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<Partial<HotelContact> | null>(null)
  const [editCity, setEditCity] = useState('Makkah')
  const [editHotelName, setEditHotelName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hotelsForCity = hotels.filter(h => h.city === editCity)

  function openEditor(contact: Partial<HotelContact>) {
    setEditCity(contact.city ?? 'Makkah')
    setEditHotelName(contact.name ?? '')
    setEditing(contact)
  }

  function handleCityChange(city: string) {
    setEditCity(city)
    if (editHotelName && !hotels.some(h => h.city === city && h.name === editHotelName)) {
      setEditHotelName('')
    }
  }

  function handleUpsert(formData: FormData) {
    startTransition(async () => {
      const result = await upsertHotelContact(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(editing?.id ? 'Contact updated!' : 'Contact added!')
      setEditing(null)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      const result = await deleteHotelContact(deleteId)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Contact deleted')
      setDeleteId(null)
      router.refresh()
    })
  }

  return (
    <>
      <Card className="shadow-sm border-0 max-w-3xl">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Hotel Contacts</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Used on hotel vouchers — select by hotel name and city; only the contact number prints on the voucher.
            </p>
          </div>
          <Button size="sm" onClick={() => openEditor(empty)} className="bg-navy hover:bg-navy-2 text-white gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add Contact
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Hotel Name</TableHead>
                <TableHead className="text-xs">City</TableHead>
                <TableHead className="text-xs">Contact Number</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                    No hotel contacts yet — click Add Contact to create one.
                  </TableCell>
                </TableRow>
              ) : contacts.map(c => (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-sm">{c.name}</TableCell>
                  <TableCell className="text-sm">{c.city}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.contact_number || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <button type="button" onClick={() => openEditor(c)} className="text-muted-foreground hover:text-navy transition-colors p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteId(c.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
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
            <DialogTitle>{editing?.id ? 'Edit Hotel Contact' : 'Add Hotel Contact'}</DialogTitle>
          </DialogHeader>
          <form action={handleUpsert} className="space-y-4">
            {editing?.id && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="city" value={editCity} />
            <input type="hidden" name="name" value={editHotelName} />
            <div className="space-y-1.5">
              <Label className="text-xs">Hotel Name *</Label>
              {hotelsForCity.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No hotels in {editCity} yet — add hotels in Settings → Hotels first.
                </p>
              ) : (
                <Select value={editHotelName || null} onValueChange={v => v && setEditHotelName(v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select hotel" /></SelectTrigger>
                  <SelectContent>
                    {hotelsForCity.map(h => (
                      <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">City *</Label>
              <Select value={editCity} onValueChange={v => v && handleCityChange(v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>
                  {HOTEL_CONTACT_CITIES.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact Number</Label>
              <Input name="contact_number" defaultValue={editing?.contact_number ?? ''} placeholder="+966 12 000 0000" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={isPending || !editHotelName} className="bg-navy hover:bg-navy-2 text-white">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing?.id ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
 
      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Hotel Contact</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Remove this contact from settings? Existing vouchers are not affected.</p>
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
