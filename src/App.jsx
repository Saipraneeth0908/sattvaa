import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { useRealtimeInventory } from './hooks/useRealtimeInventory'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const ITEM_TYPES = ['raw material', 'packaging', 'batter', 'other']
const UNITS = ['kg', 'g', 'lb', 'oz', 'L', 'ml', 'units']

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatQuantity(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return Number.isInteger(number) ? String(number) : number.toFixed(2)
}

const DEFAULT_NEW_ITEM = {
  item_name: '',
  item_type: 'raw material',
  unit: 'kg',
  quantity_on_hand: '0',
  reorder_level: '0',
}

export default function App() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingQty, setPendingQty] = useState({})
  const [newItem, setNewItem] = useState(DEFAULT_NEW_ITEM)
  const [savingItemId, setSavingItemId] = useState(null)
  const [creating, setCreating] = useState(false)

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) {
      setError(error.message)
      setInventory([])
    } else {
      setInventory(data || [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  useRealtimeInventory(() => {
    fetchInventory()
  })

  const handleQuantityChange = useCallback((id, value) => {
    setPendingQty((prev) => ({ ...prev, [id]: value }))
  }, [])

  const saveQuantity = useCallback(
    async (itemId, quantity) => {
      setSavingItemId(itemId)
      const { error } = await supabase
        .from('inventory_items')
        .update({ quantity_on_hand: quantity })
        .eq('id', itemId)

      setSavingItemId(null)
      if (error) {
        setError(error.message)
        return
      }

      setPendingQty((prev) => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      fetchInventory()
    },
    [fetchInventory]
  )

  const handleSaveQuantity = useCallback(
    async (item) => {
      const nextValue = pendingQty[item.id]
      if (nextValue == null) return

      const quantity = toNumber(nextValue)
      const currentQuantity = Number(item.quantity_on_hand || 0)
      if (quantity === currentQuantity) {
        setPendingQty((prev) => {
          const next = { ...prev }
          delete next[item.id]
          return next
        })
        return
      }

      await saveQuantity(item.id, quantity)
    },
    [pendingQty, saveQuantity]
  )

  const handleQtyKeyDown = useCallback(
    (event, item) => {
      if (event.key === 'Enter') {
        event.currentTarget.blur()
        handleSaveQuantity(item)
      }
    },
    [handleSaveQuantity]
  )

  const handleCreateItem = async () => {
    if (!newItem.item_name.trim()) {
      setError('Item name is required.')
      return
    }

    setCreating(true)
    setError('')

    const payload = {
      item_name: newItem.item_name.trim(),
      item_type: newItem.item_type,
      unit: newItem.unit,
      quantity_on_hand: toNumber(newItem.quantity_on_hand),
      reorder_level: toNumber(newItem.reorder_level),
      active: true,
    }

    const { error } = await supabase.from('inventory_items').insert(payload)
    setCreating(false)

    if (error) {
      setError(error.message)
      return
    }

    setNewItem(DEFAULT_NEW_ITEM)
    fetchInventory()
  }

  const totalQuantity = useMemo(
    () => inventory.reduce((sum, item) => sum + Number(item.quantity_on_hand || 0), 0),
    [inventory]
  )

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="space-y-3 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">Production Process Control</p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight text-foreground">Live Batter Inventory</h1>
              <p className="mt-3 text-base leading-7 text-muted-foreground">
                Real-time inventory tracking for ingredients, packaging, and batter stock. Edit quantities inline and watch changes sync instantly across users.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-right">
              <Badge variant="secondary">{loading ? 'Refreshing…' : `${inventory.length} items`}</Badge>
              <div className="rounded-3xl border border-border bg-muted/80 px-4 py-3 text-left text-sm text-foreground">
                <p className="font-medium">Total inventory items</p>
                <p className="mt-1 text-3xl font-semibold">{inventory.length}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Inventory table</CardTitle>
                  <p className="text-sm text-muted-foreground">Inline editing is enabled for quantity. Save on blur or press Enter.</p>
                </div>
                <Badge variant="secondary">Last sync: {loading ? 'Loading' : 'Live'}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {error ? (
                  <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-full">
                    <TableHead>
                      <TableRow>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Type</TableHeader>
                        <TableHeader>Unit</TableHeader>
                        <TableHeader>Quantity</TableHeader>
                        <TableHeader>Reorder</TableHeader>
                        <TableHeader>Created at</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inventory.map((item) => {
                        const pendingValue = pendingQty[item.id]
                        const quantityValue = pendingValue ?? formatQuantity(item.quantity_on_hand)
                        const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : '-'
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="max-w-[220px] truncate text-sm font-medium text-foreground">
                              {item.item_name}
                            </TableCell>
                            <TableCell>{item.item_type}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => saveQuantity(item.id, Math.max(0, toNumber(quantityValue) - 1))}
                                >
                                  -
                                </Button>
                                <Input
                                  value={quantityValue}
                                  className="w-20"
                                  onChange={(event) => handleQuantityChange(item.id, event.target.value)}
                                  onBlur={() => handleSaveQuantity(item)}
                                  onKeyDown={(event) => handleQtyKeyDown(event, item)}
                                  disabled={savingItemId === item.id}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => saveQuantity(item.id, toNumber(quantityValue) + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>{formatQuantity(item.reorder_level)}</TableCell>
                            <TableCell>{createdAt}</TableCell>
                          </TableRow>
                        )
                      })}
                      {!loading && inventory.length === 0 ? (
                        <TableRow>
                          <TableCell className="py-6 text-center" colSpan={6}>
                            No inventory items found. Add your first item using the form on the right.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add a new inventory item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="item-name">Item name</Label>
                    <Input
                      id="item-name"
                      placeholder="e.g. Regular batter mix"
                      value={newItem.item_name}
                      onChange={(event) => setNewItem((prev) => ({ ...prev, item_name: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="item-type">Item type</Label>
                    <Input
                      id="item-type"
                      placeholder="raw material, packaging, batter"
                      value={newItem.item_type}
                      onChange={(event) => setNewItem((prev) => ({ ...prev, item_type: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      placeholder="kg, L, units"
                      value={newItem.unit}
                      onChange={(event) => setNewItem((prev) => ({ ...prev, unit: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="starting-quantity">Starting quantity</Label>
                    <Input
                      id="starting-quantity"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.quantity_on_hand}
                      onChange={(event) => setNewItem((prev) => ({ ...prev, quantity_on_hand: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reorder-level">Reorder level</Label>
                    <Input
                      id="reorder-level"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.reorder_level}
                      onChange={(event) => setNewItem((prev) => ({ ...prev, reorder_level: event.target.value }))}
                    />
                  </div>
                  <Button type="button" onClick={handleCreateItem} disabled={creating}>
                    {creating ? 'Adding item…' : 'Add item'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick inventory summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-border bg-muted/70 p-4 text-sm">
                  <p className="text-muted-foreground">Total quantity values are shown in raw units and can be used for quick stock checks.</p>
                  <p className="mt-4 text-3xl font-semibold text-foreground">{formatQuantity(totalQuantity)}</p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-3xl border border-border bg-background p-4 text-sm">
                    <p className="font-medium">Tip</p>
                    <p className="mt-2 text-muted-foreground">Use inline edits to update stock quickly, then verify changes across all devices using Supabase realtime sync.</p>
                  </div>
                  <div className="rounded-3xl border border-border bg-background p-4 text-sm">
                    <p className="font-medium">Next step</p>
                    <p className="mt-2 text-muted-foreground">Deploy to Vercel and provide your Supabase env vars in the project settings.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </main>
      </div>
    </div>
  )
}
