'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createStaffUser, updateStaffUser, deleteStaffUser } from '@/app/actions/users'
import type { StaffUser, StaffRole, StaffActivityStats } from '@/lib/types'
import { formatDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Plus, Loader2, UserCog, BarChart3 } from 'lucide-react'

const ROLES: StaffRole[] = ['Admin', 'Moderator', 'Viewer']

interface Props {
  staff: StaffUser[]
  activityStats: StaffActivityStats[]
}

type EditState = Partial<StaffUser & { email: string; password: string }> | null

export default function StaffForm({ staff, activityStats }: Props) {
  const [editing, setEditing] = useState<EditState>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isNew = !editing?.id

  function handleUpsert(formData: FormData) {
    startTransition(async () => {
      const result = isNew
        ? await createStaffUser(formData)
        : await updateStaffUser(formData)

      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success(isNew ? 'Staff user created!' : 'Staff user updated!')
        setEditing(null)
      }
    })
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      await deleteStaffUser(deleteId)
      toast.success('Staff user deleted')
      setDeleteId(null)
    })
  }

  return (
    <>
      {activityStats.length > 0 && (
        <Card className="shadow-sm border-0 mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Staff Activity</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Records created by each staff member. Moderators only see their own data; admins see everything.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Staff Member</TableHead>
                  <TableHead className="text-xs text-right">Bookings</TableHead>
                  <TableHead className="text-xs text-right">Custom Invoices</TableHead>
                  <TableHead className="text-xs text-right">Hotel Vouchers</TableHead>
                  <TableHead className="text-xs text-right">Payments</TableHead>
                  <TableHead className="text-xs text-right">Expenses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityStats.map(row => (
                  <TableRow key={row.staff_id}>
                    <TableCell className="text-sm font-medium">{row.staff_name}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{row.bookings}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{row.custom_invoices}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{row.hotel_vouchers}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{row.payments}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{row.expenses}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Users & Staff</CardTitle>
          </div>
          <Button size="sm" onClick={() => setEditing({ role: 'Moderator' })} className="bg-navy hover:bg-navy-2 text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Staff
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Username</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                    No staff users yet.
                  </TableCell>
                </TableRow>
              ) : staff.map(s => (
                <TableRow key={s.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{s.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] border-navy/20 text-navy">{s.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={s.status === 'Active'
                        ? 'text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]'
                        : 'text-red-500 border-red-200 bg-red-50 text-[10px]'
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(s)} className="text-muted-foreground hover:text-navy p-1">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(s.id)} className="text-muted-foreground hover:text-red-500 p-1">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Add Staff User' : 'Edit Staff User'}</DialogTitle>
          </DialogHeader>
          <form action={handleUpsert} className="space-y-4">
            {editing?.id && <input type="hidden" name="id" value={editing.id} />}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name</Label>
                <Input name="name" defaultValue={editing?.name ?? ''} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Username</Label>
                <Input name="username" defaultValue={editing?.username ?? ''} required />
              </div>
            </div>

            {isNew && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input name="email" type="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Password</Label>
                  <Input name="password" type="password" required minLength={6} />
                </div>
              </div>
            )}

            {!isNew && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">New Email (optional)</Label>
                  <Input name="email" type="email" placeholder="Leave blank to keep" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">New Password (optional)</Label>
                  <Input name="password" type="password" placeholder="Leave blank to keep" minLength={6} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select name="role" defaultValue={editing?.role ?? 'Moderator'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r} value={r}>
                      {r === 'Admin'
                        ? 'Admin — full access'
                        : r === 'Moderator'
                          ? 'Moderator — own records only'
                          : 'Viewer — package calculator only'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Moderators can use calculator, bookings, invoices, custom invoices, hotel vouchers, and accounts.
                Viewers can only use the Umrah package calculator. Neither can change rates or settings.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select name="status" defaultValue={editing?.status ?? 'Active'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isNew ? 'Create User' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Staff User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the user account and revoke access. This cannot be undone.
          </p>
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
