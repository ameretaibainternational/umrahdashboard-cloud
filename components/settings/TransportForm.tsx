'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  upsertTransportRoute,
  deleteTransportRoute,
  upsertTransportVehicle,
  deleteTransportVehicle,
  updateRouteVehicleRates
} from '@/app/actions/settings'
import type { TransportRoute, TransportVehicle, RouteVehicleRate } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, Plus, Trash2, Edit2, Save } from 'lucide-react'

interface Props {
  rates: RouteVehicleRate[]
  routes: TransportRoute[]
  vehicles: TransportVehicle[]
}

export default function TransportForm({
  rates = [],
  routes = [],
  vehicles = []
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Matrix rates state
  const [gridRates, setGridRates] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const r of rates) {
      map[`${r.route_id}_${r.vehicle_id}`] = r.rate_sar
    }
    return map
  })

  // Modals state
  const [routeModalOpen, setRouteModalOpen] = useState(false)
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null)

  const [deleteConfirmType, setDeleteConfirmType] = useState<'route' | 'vehicle' | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function getRate(routeId: string, vehicleId: string): number {
    return gridRates[`${routeId}_${vehicleId}`] ?? 0
  }

  function handleRateChange(routeId: string, vehicleId: string, value: string) {
    const numeric = Number(value) || 0
    setGridRates(prev => ({
      ...prev,
      [`${routeId}_${vehicleId}`]: numeric
    }))
  }

  async function handleSaveRates() {
    startTransition(async () => {
      const payload = Object.entries(gridRates).map(([key, val]) => {
        const [route_id, vehicle_id] = key.split('_')
        return { route_id, vehicle_id, rate_sar: val }
      })
      const res = await updateRouteVehicleRates(payload)
      if ('error' in res && res.error) {
        toast.error(res.error)
      } else {
        toast.success('Matrix rates saved successfully!')
        router.refresh()
      }
    })
  }

  async function handleSaveRoute(fd: FormData) {
    startTransition(async () => {
      const res = await upsertTransportRoute(fd)
      if ('error' in res && res.error) {
        toast.error(res.error)
      } else {
        toast.success(editingRoute ? 'Route updated!' : 'Route added!')
        setRouteModalOpen(false)
        setEditingRoute(null)
        router.refresh()
      }
    })
  }

  async function handleSaveVehicle(fd: FormData) {
    startTransition(async () => {
      const res = await upsertTransportVehicle(fd)
      if ('error' in res && res.error) {
        toast.error(res.error)
      } else {
        toast.success(editingVehicle ? 'Vehicle updated!' : 'Vehicle added!')
        setVehicleModalOpen(false)
        setEditingVehicle(null)
        router.refresh()
      }
    })
  }

  async function handleDeleteConfirm() {
    if (!deleteId || !deleteConfirmType) return
    startTransition(async () => {
      const res = deleteConfirmType === 'route'
        ? await deleteTransportRoute(deleteId)
        : await deleteTransportVehicle(deleteId)
      if ('error' in res && res.error) {
        toast.error(res.error)
      } else {
        toast.success(deleteConfirmType === 'route' ? 'Route deleted!' : 'Vehicle deleted!')
        setDeleteId(null)
        setDeleteConfirmType(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Dynamic Rates Grid matrix */}
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-navy">Transport Pricing Matrix (SAR)</CardTitle>
          <CardDescription>Edit rates directly in the cells and click Save. Added routes and vehicles will automatically display in the grid.</CardDescription>
        </CardHeader>
        <CardContent>
          {routes.length === 0 || vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Please add at least one route and one vehicle to view the matrix.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold">Route</TableHead>
                    {vehicles.map(v => (
                      <TableHead key={v.id} className="text-xs text-center font-semibold">{v.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold text-sm text-navy">{r.name}</TableCell>
                      {vehicles.map(v => (
                        <TableCell key={v.id} className="p-1 min-w-[100px]">
                          <Input
                            type="number"
                            min={0}
                            value={getRate(r.id, v.id) || ''}
                            placeholder="0"
                            onChange={e => handleRateChange(r.id, v.id, e.target.value)}
                            className="text-center h-8 text-sm focus-visible:ring-gold"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {routes.length > 0 && vehicles.length > 0 && (
            <Button
              onClick={handleSaveRates}
              disabled={isPending}
              className="mt-4 bg-navy hover:bg-navy/90 text-white font-medium"
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Rates Matrix
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Routes & Vehicles List grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Routes management list */}
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-navy">Routes</CardTitle>
              <CardDescription>Manage your transport routes.</CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditingRoute(null)
                setRouteModalOpen(true)
              }}
              size="sm"
              className="bg-navy hover:bg-navy/90 text-white h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Route
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Sort</TableHead>
                  <TableHead className="text-xs">Route Name</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">No routes added.</TableCell>
                  </TableRow>
                ) : (
                  routes.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-medium text-slate-500">{r.sort_order}</TableCell>
                      <TableCell className="text-sm font-medium text-navy">{r.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingRoute(r)
                              setRouteModalOpen(true)
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => {
                              setDeleteConfirmType('route')
                              setDeleteId(r.id)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Vehicles management list */}
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-navy">Vehicles (Transports)</CardTitle>
              <CardDescription>Manage available transport types.</CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditingVehicle(null)
                setVehicleModalOpen(true)
              }}
              size="sm"
              className="bg-navy hover:bg-navy/90 text-white h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Vehicle
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Sort</TableHead>
                  <TableHead className="text-xs">Vehicle Name</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">No vehicles added.</TableCell>
                  </TableRow>
                ) : (
                  vehicles.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="text-sm font-medium text-slate-500">{v.sort_order}</TableCell>
                      <TableCell className="text-sm font-medium text-navy">{v.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingVehicle(v)
                              setVehicleModalOpen(true)
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => {
                              setDeleteConfirmType('vehicle')
                              setDeleteId(v.id)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Route modal dialog */}
      <Dialog open={routeModalOpen} onOpenChange={setRouteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form action={handleSaveRoute}>
            <DialogHeader>
              <DialogTitle>{editingRoute ? 'Edit Route' : 'Add Route'}</DialogTitle>
              <DialogDescription>
                Provide the transport route details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingRoute?.id && <input type="hidden" name="id" value={editingRoute.id} />}
              <div className="space-y-1.5">
                <Label htmlFor="route-name">Route Name</Label>
                <Input
                  id="route-name"
                  name="name"
                  defaultValue={editingRoute?.name ?? ''}
                  placeholder="e.g. JED TO MAK"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="route-sort">Sort Order</Label>
                <Input
                  id="route-sort"
                  name="sort_order"
                  type="number"
                  defaultValue={editingRoute?.sort_order ?? 0}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRouteModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy/90 text-white">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Route
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vehicle modal dialog */}
      <Dialog open={vehicleModalOpen} onOpenChange={setVehicleModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form action={handleSaveVehicle}>
            <DialogHeader>
              <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
              <DialogDescription>
                Provide the transport vehicle details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingVehicle?.id && <input type="hidden" name="id" value={editingVehicle.id} />}
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-name">Vehicle Name</Label>
                <Input
                  id="vehicle-name"
                  name="name"
                  defaultValue={editingVehicle?.name ?? ''}
                  placeholder="e.g. STARIA"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-sort">Sort Order</Label>
                <Input
                  id="vehicle-sort"
                  name="sort_order"
                  type="number"
                  defaultValue={editingVehicle?.sort_order ?? 0}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVehicleModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy/90 text-white">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Vehicle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(deleteId)} onOpenChange={() => { setDeleteId(null); setDeleteConfirmType(null) }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Confirmation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {deleteConfirmType}? This action cannot be undone and will also clear any rates associated with it in the pricing matrix.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteConfirmType(null) }}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
