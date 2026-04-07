import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Camera, Download, Plus, Trash2, Package, Clock, Thermometer, FileText, Boxes, Droplets, CheckCircle2, Factory, LogOut, Sparkles } from 'lucide-react'

const PRODUCTS = [
  { code: 'RAGI', name: 'Ragi Millet Batter' },
  { code: 'RB', name: 'Regular Millet Batter' },
  { code: 'LMB', name: 'Little Millet Batter' },
  { code: 'KMB', name: 'Kodo Millet Batter' },
  { code: 'BMB', name: 'Barnyard Millet Batter' },
]

const GRAIN_TYPES = [
  'Regular rice batter mix',
  'Barnyard millet',
  'Kodo millet',
  'Little millet',
  'Ragi millet',
  'Urad dal',
  'Fenugreek',
]

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

function toNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function litersFromOrders(order30, order60) {
  return toNumber(order30) * 0.887205 + toNumber(order60) * 1.77441
}

function casesNeeded(units, perCase) {
  return Math.ceil((toNumber(units) || 0) / toNumber(perCase))
}

function normalizeUnit(unit) {
  return (unit || '').trim().toLowerCase()
}

function convertToInventoryUnit(quantity, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  if (!from || !to) return null
  if (from === to) return quantity

  const mass = { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 }
  const volume = { l: 1, ml: 0.001, cups: 0.236588 }

  if (mass[from] && mass[to]) return quantity * (mass[from] / mass[to])
  if (volume[from] && volume[to]) return quantity * (volume[from] / volume[to])
  return null
}

function addMinutesToTime(timeStr, minutesToAdd) {
  if (!timeStr || !timeStr.includes(':')) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const base = new Date()
  base.setHours(h || 0, m || 0, 0, 0)
  base.setMinutes(base.getMinutes() + minutesToAdd)
  const hh = String(base.getHours()).padStart(2, '0')
  const mm = String(base.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function buildWaterIceStepsFromStart(startTime) {
  const offsets = [10, 15, 20, 25, 27]
  const actions = [
    'Add 500 ml water + ice',
    'Add 500 ml water + ice',
    'Add 500 ml water + ice',
    'Add 500 ml water',
    'Add all remaining water',
  ]
  return offsets.map((offset, idx) => ({
    time: addMinutesToTime(startTime, offset),
    action: actions[idx],
  }))
}

function formatQty(value) {
  const num = Number(value || 0)
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

function exportJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'batters-production-data.json'
  a.click()
  URL.revokeObjectURL(url)
}

function parseJson(value) {
  try {
    return JSON.parse(value || '')
  } catch {
    return null
  }
}

function MetricCard({ title, value, subtitle, icon: Icon }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">{title}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {subtitle ? <div className="text-xs text-slate-500 mt-1">{subtitle}</div> : null}
          </div>
          <div className="p-2 rounded-xl bg-slate-100">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <div className="text-lg font-semibold">{title}</div>
        {subtitle ? <div className="text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  )
}

function AppHeader({ userEmail, onSignOut, companyName }) {
  return (
    <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6" /> {companyName}
          </div>
          <div className="text-sm text-slate-600">Mobile-friendly production, QC, packaging, inventory, and batch tracking for 5 millet batter types</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-600">{userEmail}</div>
          <Button variant="outline" onClick={onSignOut} className="rounded-2xl">
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}

function PhotoInput({ photos = [], onChange }) {
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    const converted = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ id: uid(), name: file.name, dataUrl: reader.result })
            reader.readAsDataURL(file)
          })
      )
    )
    onChange([...(photos || []), ...converted])
  }

  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 cursor-pointer text-sm">
        <Camera className="w-4 h-4" /> Add Photos
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </label>
      {photos?.length ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-2xl overflow-hidden border">
              <img src={p.dataUrl} alt={p.name} className="h-28 w-full object-cover" />
              <button
                className="absolute top-2 right-2 bg-white/90 rounded-full p-1"
                onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CompanySettings({ company, updateCompany }) {
  const setField = (field, value) => {
    updateCompany({ ...company, [field]: value })
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Company Settings</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-4">
        <div>
          <Label>Company Name</Label>
          <Input value={company.name} onChange={(e) => setField('name', e.target.value)} />
        </div>
        <div>
          <Label>Brand Name</Label>
          <Input value={company.brand} onChange={(e) => setField('brand', e.target.value)} />
        </div>
        <div>
          <Label>Number of Grinders</Label>
          <Input type="number" value={company.grinders} onChange={(e) => setField('grinders', toNumber(e.target.value))} />
        </div>
        <div>
          <Label>Liters per Batch per Grinder</Label>
          <Input type="number" value={company.litersPerBatch} onChange={(e) => setField('litersPerBatch', toNumber(e.target.value))} />
        </div>
        <div>
          <Label>Default Rounds per Day</Label>
          <Input type="number" value={company.defaultRoundsPerDay} onChange={(e) => setField('defaultRoundsPerDay', toNumber(e.target.value))} />
        </div>
        <div>
          <Label>Water per Batch (L)</Label>
          <Input type="number" value={company.waterPerBatchLiters} onChange={(e) => setField('waterPerBatchLiters', toNumber(e.target.value))} />
        </div>
        <div>
          <Label>Ice per Batch (lb)</Label>
          <Input type="number" value={company.icePerBatchLb} onChange={(e) => setField('icePerBatchLb', toNumber(e.target.value))} />
        </div>
        <div>
          <Label>30 oz Units per Case</Label>
          <Input type="number" value={company.casePack30} onChange={(e) => setField('casePack30', toNumber(e.target.value))} />
        </div>
        <div>
          <Label>60 oz Units per Case</Label>
          <Input type="number" value={company.casePack60} onChange={(e) => setField('casePack60', toNumber(e.target.value))} />
        </div>
      </CardContent>
    </Card>
  )
}

function InventoryTab({ appState, setAppState }) {
  const inv = appState.inventory

  const updateGrain = (idx, field, value) => {
    setAppState((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        grains: prev.inventory.grains.map((g, i) => (i === idx ? { ...g, [field]: field === 'name' || field === 'unit' ? value : toNumber(value) } : g)),
      },
    }))
  }

  const addGrain = () => {
    setAppState((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        grains: [...prev.inventory.grains, { name: '', unit: 'kg', onHand: 0, reorderLevel: 0 }],
      },
    }))
  }

  const removeGrain = (idx) => {
    setAppState((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        grains: prev.inventory.grains.filter((_, i) => i !== idx),
      },
    }))
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Packaging Inventory" subtitle="Track containers, lids, and cardboard cases" />
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          ['containers30', '30 oz Containers'],
          ['containers60', '60 oz Containers'],
          ['lids30', '30 oz Lids'],
          ['lids60', '60 oz Lids'],
          ['cases30', '30 oz Cases'],
          ['cases60', '60 oz Cases'],
        ].map(([field, label]) => (
          <Card key={field} className="rounded-2xl">
            <CardContent className="p-4">
              <Label>{label}</Label>
              <Input
                type="number"
                value={inv[field]}
                onChange={(e) => {
                  setAppState((prev) => ({
                    ...prev,
                    inventory: { ...prev.inventory, [field]: toNumber(e.target.value) },
                  }))
                }}
                className="mt-2"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ingredient Inventory</CardTitle>
          <Button variant="outline" onClick={addGrain}>
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-500 mb-4">This inventory is linked to Recipes, Planning, Dashboard, and automatic consumption tracking.</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>On Hand</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inv.grains.map((g, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input value={g.name} onChange={(e) => updateGrain(idx, 'name', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input value={g.unit} onChange={(e) => updateGrain(idx, 'unit', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={g.onHand} onChange={(e) => updateGrain(idx, 'onHand', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={g.reorderLevel} onChange={(e) => updateGrain(idx, 'reorderLevel', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      {g.onHand <= g.reorderLevel ? (
                        <Badge variant="destructive">Low stock</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeGrain(idx)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function RecipesTab({ appState, setAppState }) {
  const unitOptions = ['kg', 'g', 'L', 'ml', 'lb', 'oz', 'cups', 'units']

  const updateRecipe = (recipeId, updater) => {
    setAppState((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) => (r.id === recipeId ? updater(r) : r)),
    }))
  }

  const addIngredient = (recipeId) => {
    updateRecipe(recipeId, (recipe) => ({
      ...recipe,
      ingredients: [...recipe.ingredients, { id: uid(), itemName: '', qty: 0, unit: 'kg' }],
    }))
  }

  const removeIngredient = (recipeId, ingredientId) => {
    updateRecipe(recipeId, (recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.filter((i) => i.id !== ingredientId),
    }))
  }

  const allInventoryItems = appState.inventory.grains.map((g) => g.name).filter(Boolean)

  return (
    <div className="space-y-6">
      <SectionTitle title="Recipe Master" subtitle="Separate recipe page linked to inventory, planning, and future automatic ingredient deduction" />
      <Card className="rounded-2xl">
        <CardContent className="p-4 text-sm text-slate-600">
          Use this page to define exactly what goes into one batch of each batter. The units are flexible. Once these recipes are finalized, production can automatically reduce ingredient inventory after each completed batch.
        </CardContent>
      </Card>
      {appState.recipes.map((recipe) => (
        <Card key={recipe.id} className="rounded-2xl">
          <CardHeader>
            <CardTitle>
              {recipe.productCode} - {recipe.productName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Product Code</Label>
                <Input value={recipe.productCode} readOnly />
              </div>
              <div>
                <Label>Product Name</Label>
                <Input value={recipe.productName} readOnly />
              </div>
              <div>
                <Label>Yield per Batch (Liters)</Label>
                <Input
                  type="number"
                  value={recipe.yieldLiters}
                  onChange={(e) => updateRecipe(recipe.id, (r) => ({ ...r, yieldLiters: toNumber(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="font-medium">Ingredients per Batch</div>
              <Button variant="outline" onClick={() => addIngredient(recipe.id)}>
                <Plus className="w-4 h-4 mr-2" /> Add Ingredient
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Linked Inventory Match</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipe.ingredients.map((ingredient) => {
                    const matched = appState.inventory.grains.find((g) => g.name.toLowerCase() === (ingredient.itemName || '').toLowerCase())
                    return (
                      <TableRow key={ingredient.id}>
                        <TableCell>
                          <Input
                            list={`ingredients-${recipe.id}`}
                            value={ingredient.itemName}
                            onChange={(e) =>
                              updateRecipe(recipe.id, (r) => ({
                                ...r,
                                ingredients: r.ingredients.map((i) => (i.id === ingredient.id ? { ...i, itemName: e.target.value } : i)),
                              }))
                            }
                            placeholder="Choose or type ingredient"
                          />
                          <datalist id={`ingredients-${recipe.id}`}>
                            {allInventoryItems.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={ingredient.qty}
                            onChange={(e) =>
                              updateRecipe(recipe.id, (r) => ({
                                ...r,
                                ingredients: r.ingredients.map((i) => (i.id === ingredient.id ? { ...i, qty: toNumber(e.target.value) } : i)),
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ingredient.unit}
                            onValueChange={(value) =>
                              updateRecipe(recipe.id, (r) => ({
                                ...r,
                                ingredients: r.ingredients.map((i) => (i.id === ingredient.id ? { ...i, unit: value } : i)),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {unitOptions.map((u) => (
                                <SelectItem key={u} value={u}>
                                  {u}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {matched ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Linked to inventory</Badge>
                          ) : (
                            <Badge variant="secondary">Not matched</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeIngredient(recipe.id, ingredient.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DashboardTab({ appState, selectedDayId }) {
  const selectedDay = appState.productionDays.find((d) => d.id === selectedDayId) || appState.productionDays[0] || null

  const totals = useMemo(() => {
    if (!selectedDay) return null
    const order30 = selectedDay.orders.reduce((a, o) => a + toNumber(o.order30), 0)
    const order60 = selectedDay.orders.reduce((a, o) => a + toNumber(o.order60), 0)
    const actual30 = selectedDay.orders.reduce((a, o) => a + toNumber(o.actual30), 0)
    const actual60 = selectedDay.orders.reduce((a, o) => a + toNumber(o.actual60), 0)
    const plannedLiters = selectedDay.orders.reduce((a, o) => a + litersFromOrders(o.order30, o.order60), 0)
    const completedQC = selectedDay.rounds.flatMap((r) => r.grinders).filter((g) => g.qcTime).length
    const totalBatchSlots = selectedDay.rounds.flatMap((r) => r.grinders).length
    return {
      order30,
      order60,
      actual30,
      actual60,
      plannedLiters: plannedLiters.toFixed(1),
      completedQC,
      totalBatchSlots,
    }
  }, [selectedDay])

  return (
    <div className="space-y-6">
      {!selectedDay ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-slate-500">No production day created yet. Start with Orders & Planning.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Selected Production Day" value={selectedDay.date} subtitle="Current working sheet" icon={FileText} />
            <MetricCard title="Planned Volume" value={`${totals?.plannedLiters || 0} L`} subtitle="Estimated from store orders" icon={Droplets} />
            <MetricCard
              title="QC Completed"
              value={`${totals?.completedQC || 0}/${totals?.totalBatchSlots || 0}`}
              subtitle="Batch QC records entered"
              icon={Thermometer}
            />
            <MetricCard title="Packaging Readiness" value={selectedDay.soakPlan.done ? 'Ready' : 'Pending'} subtitle="Pre-production checklist" icon={CheckCircle2} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="rounded-2xl lg:col-span-2">
              <CardHeader>
                <CardTitle>Today at a Glance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-slate-500">30 oz Fulfillment</div>
                    <div className="text-xl font-bold mt-1">
                      {totals?.actual30 || 0} / {totals?.order30 || 0}
                    </div>
                    <Progress className="mt-3" value={totals?.order30 ? Math.min(100, ((totals.actual30 || 0) / totals.order30) * 100) : 0} />
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-slate-500">60 oz Fulfillment</div>
                    <div className="text-xl font-bold mt-1">
                      {totals?.actual60 || 0} / {totals?.order60 || 0}
                    </div>
                    <Progress className="mt-3" value={totals?.order60 ? Math.min(100, ((totals.actual60 || 0) / totals.order60) * 100) : 0} />
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="font-medium mb-3">Round Plan</div>
                  <div className="space-y-3">
                    {selectedDay.rounds.map((r) => (
                      <div key={r.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="font-medium mb-2">Round {r.roundNo}</div>
                        <div className="grid md:grid-cols-3 gap-2 text-sm">
                          {r.grinders.map((g) => (
                            <div key={g.id} className="border rounded-xl p-3 bg-white">
                              <div className="font-medium">Grinder {g.grinderNo}</div>
                              <div className="text-slate-600">
                                {g.productCode || 'Not set'} {g.batchLabel ? `- ${g.batchLabel}` : ''}
                              </div>
                              <div className="text-slate-500 mt-1">
                                {g.startedAt || '--'} to {g.endedAt || '--'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Inventory Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>30 oz containers</span>
                  <span className="font-medium">{appState.inventory.containers30}</span>
                </div>
                <div className="flex justify-between">
                  <span>60 oz containers</span>
                  <span className="font-medium">{appState.inventory.containers60}</span>
                </div>
                <div className="flex justify-between">
                  <span>30 oz cases</span>
                  <span className="font-medium">{appState.inventory.cases30}</span>
                </div>
                <div className="flex justify-between">
                  <span>60 oz cases</span>
                  <span className="font-medium">{appState.inventory.cases60}</span>
                </div>
                <div className="flex justify-between">
                  <span>30 oz lids</span>
                  <span className="font-medium">{appState.inventory.lids30}</span>
                </div>
                <div className="flex justify-between">
                  <span>60 oz lids</span>
                  <span className="font-medium">{appState.inventory.lids60}</span>
                </div>
                {appState.inventory.grains.filter((g) => g.onHand <= g.reorderLevel).length ? (
                  <div className="border-t pt-3">
                    <div className="font-medium mb-2">Low stock items</div>
                    <div className="space-y-2">
                      {appState.inventory.grains
                        .filter((g) => g.onHand <= g.reorderLevel)
                        .map((g, i) => (
                          <div key={i} className="flex justify-between rounded-xl bg-red-50 px-3 py-2 text-red-700">
                            <span>{g.name}</span>
                            <span>
                              {g.onHand} {g.unit}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function AuthToggle({ authMode, setAuthMode }) {
  return (
    <div className="flex rounded-3xl border border-border bg-muted p-1">
      <button
        type="button"
        className={`flex-1 rounded-3xl py-2 text-sm font-semibold transition ${authMode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/80'}`}
        onClick={() => setAuthMode('login')}
      >
        Login
      </button>
      <button
        type="button"
        className={`flex-1 rounded-3xl py-2 text-sm font-semibold transition ${authMode === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/80'}`}
        onClick={() => setAuthMode('register')}
      >
        Register
      </button>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [appState, setAppState] = useState({
    company: {
      name: 'Batters Production LLC',
      brand: 'Sattva Idly & Dosa Batter',
      grinders: 3,
      litersPerBatch: 20,
      defaultRoundsPerDay: 4,
      waterPerBatchLiters: 6,
      icePerBatchLb: 1.5,
      casePack30: 12,
      casePack60: 6,
    },
    inventory: {
      containers30: 100,
      containers60: 80,
      cases30: 10,
      cases60: 8,
      lids30: 120,
      lids60: 100,
      grains: GRAIN_TYPES.map((name) => ({ name, unit: 'kg', onHand: 50, reorderLevel: 10 })),
    },
    productionDays: [],
    recipes: PRODUCTS.map((product) => ({
      id: uid(),
      productCode: product.code,
      productName: product.name,
      yieldLiters: 20,
      ingredients: [
        { id: uid(), itemName: product.name, qty: 2, unit: 'kg' },
        { id: uid(), itemName: 'Urad dal', qty: 0.5, unit: 'kg' },
        { id: uid(), itemName: 'RO water', qty: 6, unit: 'L' },
        { id: uid(), itemName: 'Ice', qty: 1.5, unit: 'lb' },
      ],
    })),
  })

  const [selectedDayId, setSelectedDayId] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  const selectedDay = appState.productionDays.find((d) => d.id === selectedDayId) || appState.productionDays[0] || null

  const packagingUsage = selectedDay ? getPackagingInventoryUsage(selectedDay) : null
  const inventoryAfterPackaging = packagingUsage
    ? {
        containers30: Math.max(0, appState.inventory.containers30 - packagingUsage.containers30),
        containers60: Math.max(0, appState.inventory.containers60 - packagingUsage.containers60),
        lids30: Math.max(0, appState.inventory.lids30 - packagingUsage.lids30),
        lids60: Math.max(0, appState.inventory.lids60 - packagingUsage.lids60),
        cases30: Math.max(0, appState.inventory.cases30 - packagingUsage.cases30),
        cases60: Math.max(0, appState.inventory.cases60 - packagingUsage.cases60),
      }
    : null

  const updateSelectedDay = useCallback(
    (updater) => {
      if (!selectedDay) return
      setAppState((prev) => ({
        ...prev,
        productionDays: prev.productionDays.map((day) => (day.id === selectedDay.id ? updater(day) : day)),
      }))
    },
    [selectedDay]
  )

  const getPackagingInventoryUsage = useCallback(
    (day) => {
      const total30 = day.orders.reduce((sum, order) => sum + toNumber(order.actual30), 0)
      const total60 = day.orders.reduce((sum, order) => sum + toNumber(order.actual60), 0)
      return {
        containers30: total30,
        containers60: total60,
        lids30: total30,
        lids60: total60,
        cases30: casesNeeded(total30, appState.company.casePack30),
        cases60: casesNeeded(total60, appState.company.casePack60),
      }
    },
    [appState.company.casePack30, appState.company.casePack60]
  )

  const applyInventoryDeduction = useCallback(
    (day, inventory) => {
      const usage = getPackagingInventoryUsage(day)
      const nextInventory = {
        ...inventory,
        containers30: Math.max(0, inventory.containers30 - usage.containers30),
        containers60: Math.max(0, inventory.containers60 - usage.containers60),
        cases30: Math.max(0, inventory.cases30 - usage.cases30),
        cases60: Math.max(0, inventory.cases60 - usage.cases60),
        lids30: Math.max(0, inventory.lids30 - usage.lids30),
        lids60: Math.max(0, inventory.lids60 - usage.lids60),
      }
      const transactions = []

      if (usage.containers30) {
        transactions.push({
          inventory_item_id: null,
          transaction_type: 'deduction',
          item_name: '30 oz container',
          quantity: -usage.containers30,
          unit: 'unit',
          notes: 'Packaged 30 oz output',
        })
      }
      if (usage.containers60) {
        transactions.push({
          inventory_item_id: null,
          transaction_type: 'deduction',
          item_name: '60 oz container',
          quantity: -usage.containers60,
          unit: 'unit',
          notes: 'Packaged 60 oz output',
        })
      }
      if (usage.lids30) {
        transactions.push({
          inventory_item_id: null,
          transaction_type: 'deduction',
          item_name: '30 oz lid',
          quantity: -usage.lids30,
          unit: 'unit',
          notes: 'Used for 30 oz packaging',
        })
      }
      if (usage.lids60) {
        transactions.push({
          inventory_item_id: null,
          transaction_type: 'deduction',
          item_name: '60 oz lid',
          quantity: -usage.lids60,
          unit: 'unit',
          notes: 'Used for 60 oz packaging',
        })
      }
      if (usage.cases30) {
        transactions.push({
          inventory_item_id: null,
          transaction_type: 'deduction',
          item_name: '30 oz case',
          quantity: -usage.cases30,
          unit: 'unit',
          notes: 'Packed 30 oz units into cases',
        })
      }
      if (usage.cases60) {
        transactions.push({
          inventory_item_id: null,
          transaction_type: 'deduction',
          item_name: '60 oz case',
          quantity: -usage.cases60,
          unit: 'unit',
          notes: 'Packed 60 oz units into cases',
        })
      }

      return { nextInventory, transactions }
    },
    [getPackagingInventoryUsage]
  )

  const fetchProductionDays = useCallback(async () => {
    const { data, error } = await supabase
      .from('production_days')
      .select('id, production_date, status, inventory_deducted, notes')
      .order('production_date', { ascending: false })

    if (error) {
      console.error('Failed to load production days', error)
      return
    }

    const productionDays = (data || []).map((row) => {
      const parsed = parseJson(row.notes) || {}
      return {
        ...createProductionDay(appState.company),
        ...parsed,
        id: row.id,
        date: row.production_date,
        status: row.status || 'planned',
        inventoryDeducted: row.inventory_deducted || false,
      }
    })

    setAppState((prev) => ({ ...prev, productionDays }))
    if (productionDays.length && !selectedDayId) {
      setSelectedDayId(productionDays[0].id)
    }
  }, [appState.company, selectedDayId])

  const saveProductionDay = useCallback(async ({ completeInventory = false } = {}) => {
    if (!selectedDay) {
      setSaveMessage('Select a production day first.')
      return
    }

    setSaveLoading(true)
    setSaveMessage('')

    let nextDay = selectedDay
    let nextInventory = appState.inventory
    let inventoryTransactions = []

    if (completeInventory && !selectedDay.inventoryDeducted) {
      const result = applyInventoryDeduction(selectedDay, appState.inventory)
      nextInventory = result.nextInventory
      inventoryTransactions = result.transactions
      nextDay = {
        ...selectedDay,
        status: 'completed',
        inventoryDeducted: true,
      }
      setAppState((prev) => ({
        ...prev,
        inventory: nextInventory,
        productionDays: prev.productionDays.map((day) => (day.id === selectedDay.id ? nextDay : day)),
      }))
    }

    const payload = {
      production_date: nextDay.date,
      status: nextDay.status || 'planned',
      inventory_deducted: nextDay.inventoryDeducted || false,
      notes: JSON.stringify({
        orders: selectedDay.orders,
        soakPlan: selectedDay.soakPlan,
        rounds: selectedDay.rounds.map((round) => ({
          roundNo: round.roundNo,
          grinders: round.grinders.map((g) => ({
            grinderNo: g.grinderNo,
            productCode: g.productCode,
            batchLabel: g.batchLabel,
            startedAt: g.startedAt,
            endedAt: g.endedAt,
            waterIceSteps: g.waterIceSteps,
            grainTransferStart: g.grainTransferStart,
            grainTransferEnd: g.grainTransferEnd,
            batterTransferStart: g.batterTransferStart,
            batterTransferEnd: g.batterTransferEnd,
            batterTemp: g.batterTemp,
            roomTemp: g.roomTemp,
            ph: g.ph,
            qcTime: g.qcTime,
            qcNotes: g.qcNotes,
            expectedYieldLiters: g.expectedYieldLiters,
            actualYieldLiters: g.actualYieldLiters,
            wastageLiters: g.wastageLiters,
            photos: g.photos,
          })),
        })),
        packaging: selectedDay.packaging,
      }),
    }

    const { data, error } = await supabase.from('production_days').upsert(payload, { onConflict: 'production_date' }).select()
    if (error) {
      setSaveMessage(`Save failed: ${error.message}`)
      setSaveLoading(false)
      return
    }

    let insertedId = selectedDay.id
    if (data?.[0]?.id) {
      insertedId = data[0].id
      setAppState((prev) => ({
        ...prev,
        productionDays: prev.productionDays.map((day) =>
          day.id === selectedDay.id ? { ...day, id: insertedId } : day
        ),
      }))
      setSelectedDayId(insertedId)
    }

    if (inventoryTransactions.length && insertedId) {
      await supabase.from('inventory_transactions').insert(
        inventoryTransactions.map((tx) => ({
          ...tx,
          production_day_id: insertedId,
        }))
      )
    }

    setSaveMessage(`Saved ${nextDay.date} to Supabase.`)
    setSaveLoading(false)
  }, [selectedDay, appState.inventory, applyInventoryDeduction])

  const deleteProductionDay = useCallback(
    async (dayId) => {
      const day = appState.productionDays.find((d) => d.id === dayId)
      if (!day) return

      const { error } = await supabase.from('production_days').delete().eq('production_date', day.date)
      if (error) {
        console.error('Delete failed', error)
      }

      setAppState((prev) => ({
        ...prev,
        productionDays: prev.productionDays.filter((d) => d.id !== dayId),
      }))
      setSelectedDayId((current) => {
        if (current === dayId) {
          const remaining = appState.productionDays.filter((d) => d.id !== dayId)
          return remaining.length ? remaining[0].id : null
        }
        return current
      })
    },
    [appState.productionDays]
  )

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      if (session) {
        await fetchProductionDays()
      }
    }

    getSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (event) => {
    event.preventDefault()
    setAuthMessage('')

    if (!authEmail.trim()) {
      setAuthMessage('Enter a valid email address.')
      return
    }
    if (!authPassword.trim()) {
      setAuthMessage('Enter your password.')
      return
    }
    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      setAuthMessage('Passwords do not match.')
      return
    }

    setAuthLoading(true)

    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
      setAuthLoading(false)
      if (error) {
        setAuthMessage(error.message)
        return
      }
      setAuthMessage('Login successful.')
      return
    }

    const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword })
    setAuthLoading(false)
    if (error) {
      setAuthMessage(error.message)
      return
    }
    setAuthMessage('Registration successful. Confirm your email and then login.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
  }

  const updateCompany = (company) => {
    setAppState((prev) => ({ ...prev, company }))
  }

  const createProductionDay = (company) => {
    return {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      status: 'planned',
      inventoryDeducted: false,
      orders: PRODUCTS.map((p) => ({
        id: uid(),
        productCode: p.code,
        productName: p.name,
        order30: 0,
        order60: 0,
        actual30: 0,
        actual60: 0,
        notes: '',
      })),
      soakPlan: {
        done: false,
        roWaterReady: false,
        containersReady: false,
        casesReady: false,
        grainsWashed3Times: false,
        notes: '',
      },
      rounds: Array.from({ length: company.defaultRoundsPerDay }).map((_, roundIndex) => ({
        id: uid(),
        roundNo: roundIndex + 1,
        grinders: Array.from({ length: company.grinders }).map((__, gi) => ({
          id: uid(),
          grinderNo: gi + 1,
          productCode: '',
          productName: '',
          batchLabel: '',
          startedAt: '',
          endedAt: '',
          waterIceSteps: [
            { time: '', action: 'Add 500 ml water + ice' },
            { time: '', action: 'Add 500 ml water + ice' },
            { time: '', action: 'Add 500 ml water + ice' },
            { time: '', action: 'Add 500 ml water' },
            { time: '', action: 'Add all remaining water' },
          ],
          grainTransferStart: '',
          grainTransferEnd: '',
          batterTransferStart: '',
          batterTransferEnd: '',
          batterTemp: '',
          roomTemp: '',
          ph: '',
          qcTime: '',
          qcNotes: '',
          expectedYieldLiters: company.litersPerBatch,
          actualYieldLiters: '',
          wastageLiters: '',
          photos: [],
        })),
      })),
      packaging: {
        setupStart: '',
        setupEnd: '',
        machineIssues: '',
        splashIssue: false,
        greaseApplied: false,
        washerChanged: false,
        washerCleaningDifficulty: false,
        capPainIssue: false,
        waterAccessIssue: false,
        photos: [],
        notes: '',
      },
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 rounded-3xl border border-border bg-muted p-5 text-center">
            <div className="flex items-center justify-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Batters Production
            </div>
          </div>
          <div className="mb-8 space-y-4 text-center">
            <h1 className="text-4xl font-semibold">Sattva Idly & Dosa Batter</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Professional production management system. Automated daily production sheets, batch tracking, QC, packaging, inventory, recipes, and multi-user realtime sync.
            </p>
          </div>
          <AuthToggle authMode={authMode} setAuthMode={setAuthMode} />
          <form className="mt-6 grid gap-4" onSubmit={signIn}>
            <div>
              <Label htmlFor="auth-email">Email address</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                placeholder="Enter password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </div>
            {authMode === 'register' ? (
              <div>
                <Label htmlFor="auth-confirm-password">Confirm password</Label>
                <Input
                  id="auth-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={authConfirmPassword}
                  onChange={(event) => setAuthConfirmPassword(event.target.value)}
                />
              </div>
            ) : null}
            {authMessage ? (
              <div className="rounded-3xl border border-border bg-muted/70 p-4 text-sm text-foreground">{authMessage}</div>
            ) : null}
            <Button type="submit" disabled={authLoading}>
              {authLoading ? (authMode === 'login' ? 'Signing in…' : 'Registering…') : authMode === 'login' ? 'Login' : 'Register'}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader userEmail={user?.email || 'Unknown'} onSignOut={signOut} companyName={appState.company.name} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-2 rounded-2xl bg-white p-2 border w-full justify-start overflow-x-auto">
            <TabsTrigger value="dashboard" className="rounded-xl">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="planning" className="rounded-xl">
              Orders & Planning
            </TabsTrigger>
            <TabsTrigger value="production" className="rounded-xl">
              Production Log
            </TabsTrigger>
            <TabsTrigger value="packaging" className="rounded-xl">
              Packaging & Output
            </TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-xl">
              Inventory
            </TabsTrigger>
            <TabsTrigger value="recipes" className="rounded-xl">
              Recipes
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab appState={appState} selectedDayId={selectedDayId} />
          </TabsContent>

          <TabsContent value="planning">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    const newDay = createProductionDay(appState.company)
                    setAppState((prev) => ({ ...prev, productionDays: [newDay, ...prev.productionDays] }))
                    setSelectedDayId(newDay.id)
                    setSaveMessage('')
                  }}
                  className="rounded-2xl"
                >
                  <Plus className="w-4 h-4 mr-2" /> New Production Day
                </Button>
                <div className="flex flex-wrap gap-2">
                  {appState.productionDays.map((day) => (
                    <div key={day.id} className="inline-flex items-center overflow-hidden rounded-2xl border bg-white shadow-sm">
                      <Button
                        variant={selectedDayId === day.id ? 'default' : 'outline'}
                        className="rounded-none rounded-l-2xl"
                        onClick={() => setSelectedDayId(day.id)}
                      >
                        {day.date}
                      </Button>
                      <button
                        type="button"
                        className="rounded-r-2xl border-l border-border bg-white px-2 text-slate-600 transition hover:text-red-700"
                        onClick={() => deleteProductionDay(day.id)}
                        title="Delete production day"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {!selectedDay ? (
                <Card className="rounded-2xl">
                  <CardContent className="p-6 text-slate-500">Create a new production day and capture orders, batch counts, and pre-production readiness.</CardContent>
                </Card>
              ) : (
                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Order Planning</CardTitle>
                      <p className="text-sm text-slate-500">
                        Place store orders, calculate batch counts and container requirements, and track pre-production readiness before starting rounds.
                      </p>
                    </div>
                    <Button onClick={saveProductionDay} disabled={saveLoading} className="rounded-2xl">
                      {saveLoading ? 'Saving…' : 'Save Orders & Planning'}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>30 oz Orders</TableHead>
                            <TableHead>60 oz Orders</TableHead>
                            <TableHead>Batches</TableHead>
                            <TableHead>Containers required</TableHead>
                            <TableHead>Actual 30 oz</TableHead>
                            <TableHead>Actual 60 oz</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDay.orders.map((order) => {
                            const batches = Math.max(1, Math.ceil(litersFromOrders(order.order30, order.order60) / appState.company.litersPerBatch))
                            return (
                              <TableRow key={order.id}>
                                <TableCell>
                                  {order.productCode} - {order.productName}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={order.order30}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        orders: day.orders.map((o) => (o.id === order.id ? { ...o, order30: toNumber(e.target.value) } : o)),
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={order.order60}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        orders: day.orders.map((o) => (o.id === order.id ? { ...o, order60: toNumber(e.target.value) } : o)),
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>{batches}</TableCell>
                                <TableCell>{`${order.order30 || 0} x 30 oz, ${order.order60 || 0} x 60 oz`}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={order.actual30}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        orders: day.orders.map((o) => (o.id === order.id ? { ...o, actual30: toNumber(e.target.value) } : o)),
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={order.actual60}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        orders: day.orders.map((o) => (o.id === order.id ? { ...o, actual60: toNumber(e.target.value) } : o)),
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={order.notes}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        orders: day.orders.map((o) => (o.id === order.id ? { ...o, notes: e.target.value } : o)),
                                      }))
                                    }
                                    placeholder="Notes"
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2 mt-6">
                      <Card className="rounded-2xl border p-4">
                        <CardHeader>
                          <CardTitle>Pre-production checklist</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedDay.soakPlan.roWaterReady}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, roWaterReady: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>RO water ready</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedDay.soakPlan.containersReady}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, containersReady: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Containers available</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedDay.soakPlan.casesReady}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, casesReady: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Cases / boxes available</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedDay.soakPlan.grainsWashed3Times}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, grainsWashed3Times: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Grains washed 3 times</span>
                            </div>
                          </div>
                          <div>
                            <Label>Checklist notes</Label>
                            <Textarea
                              value={selectedDay.soakPlan.notes}
                              onChange={(e) =>
                                updateSelectedDay((day) => ({
                                  ...day,
                                  soakPlan: { ...day.soakPlan, notes: e.target.value },
                                }))
                              }
                              placeholder="Capture extra preparation notes"
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border p-4">
                        <CardHeader>
                          <CardTitle>Planning summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-slate-600">
                          <div className="grid grid-cols-2 gap-3">
                            <span>Total 30 oz orders</span>
                            <span className="font-semibold">{selectedDay.orders.reduce((sum, order) => sum + toNumber(order.order30), 0)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <span>Total 60 oz orders</span>
                            <span className="font-semibold">{selectedDay.orders.reduce((sum, order) => sum + toNumber(order.order60), 0)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <span>Estimated batch volume</span>
                            <span className="font-semibold">{selectedDay.orders.reduce((sum, order) => sum + litersFromOrders(order.order30, order.order60), 0).toFixed(1)} L</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <span>Estimated containers</span>
                            <span className="font-semibold">{`${selectedDay.orders.reduce((sum, order) => sum + toNumber(order.order30), 0)} x 30 oz, ${selectedDay.orders.reduce((sum, order) => sum + toNumber(order.order60), 0)} x 60 oz`}</span>
                          </div>
                          {saveMessage ? <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{saveMessage}</div> : null}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="production">
            {!selectedDay ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6 text-slate-500">Select or create a production day in Orders & Planning to begin logging rounds, timing, QC, and transfer data.</CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Production Log - Daily Data Sheet</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border p-4 bg-slate-50">
                      <div className="text-sm text-slate-500">Date</div>
                      <div className="mt-2 text-lg font-semibold">{selectedDay.date}</div>
                    </div>
                    <div className="rounded-2xl border p-4 bg-slate-50">
                      <div className="text-sm text-slate-500">Rounds</div>
                      <div className="mt-2 text-lg font-semibold">{selectedDay.rounds.length}</div>
                    </div>
                    <div className="rounded-2xl border p-4 bg-slate-50">
                      <div className="text-sm text-slate-500">Batch slots</div>
                      <div className="mt-2 text-lg font-semibold">{selectedDay.rounds.flatMap((r) => r.grinders).length}</div>
                    </div>
                  </CardContent>
                </Card>

                {selectedDay.rounds.map((round) => (
                  <Card key={round.id} className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>Round {round.roundNo}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 lg:grid-cols-2">
                        {round.grinders.map((batch) => (
                          <Card key={batch.id} className="rounded-2xl border bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm text-slate-500">Grinder {batch.grinderNo}</div>
                                <div className="text-lg font-semibold">{batch.productCode || 'Batter type not selected'}</div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (!batch.startedAt) return
                                  const steps = buildWaterIceStepsFromStart(batch.startedAt)
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    rounds: day.rounds.map((r) =>
                                      r.id === round.id
                                        ? {
                                            ...r,
                                            grinders: r.grinders.map((g) =>
                                              g.id === batch.id ? { ...g, waterIceSteps: steps } : g
                                            ),
                                          }
                                        : r
                                    ),
                                  }))
                                }}
                              >
                                Auto-fill water steps
                              </Button>
                            </div>

                            <div className="grid gap-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <Label>Batter type</Label>
                                  <Select
                                    value={batch.productCode}
                                    onValueChange={(value) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, productCode: value, productName: PRODUCTS.find((p) => p.code === value)?.name || '' } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select batter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PRODUCTS.map((product) => (
                                        <SelectItem key={product.code} value={product.code}>
                                          {product.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Batch label</Label>
                                  <Input
                                    value={batch.batchLabel}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, batchLabel: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                    placeholder="e.g. RAGI batch 1"
                                  />
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <Label>Start time</Label>
                                  <Input
                                    type="time"
                                    value={batch.startedAt}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, startedAt: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>End time</Label>
                                  <Input
                                    type="time"
                                    value={batch.endedAt}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, endedAt: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                              </div>

                              <div className="rounded-2xl border bg-white p-3">
                                <div className="text-sm font-semibold mb-3">Water & ice additions</div>
                                <div className="space-y-3">
                                  {batch.waterIceSteps.map((step, index) => (
                                    <div key={index} className="grid gap-3 sm:grid-cols-[120px_1fr] items-center">
                                      <Input
                                        type="time"
                                        value={step.time}
                                        onChange={(e) =>
                                          updateSelectedDay((day) => ({
                                            ...day,
                                            rounds: day.rounds.map((r) =>
                                              r.id === round.id
                                                ? {
                                                    ...r,
                                                    grinders: r.grinders.map((g) =>
                                                      g.id === batch.id
                                                        ? {
                                                            ...g,
                                                            waterIceSteps: g.waterIceSteps.map((item, idx) =>
                                                              idx === index ? { ...item, time: e.target.value } : item
                                                            ),
                                                          }
                                                        : g
                                                    ),
                                                  }
                                                : r
                                            ),
                                          }))
                                        }
                                      />
                                      <div className="text-sm text-slate-600">{step.action}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <Label>Grain transfer start</Label>
                                  <Input
                                    type="time"
                                    value={batch.grainTransferStart}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, grainTransferStart: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Grain transfer end</Label>
                                  <Input
                                    type="time"
                                    value={batch.grainTransferEnd}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, grainTransferEnd: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <Label>Batter transfer start</Label>
                                  <Input
                                    type="time"
                                    value={batch.batterTransferStart}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, batterTransferStart: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Batter transfer end</Label>
                                  <Input
                                    type="time"
                                    value={batch.batterTransferEnd}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, batterTransferEnd: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                  <Label>Actual yield (L)</Label>
                                  <Input
                                    type="number"
                                    value={batch.actualYieldLiters}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, actualYieldLiters: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Wastage (L)</Label>
                                  <Input
                                    type="number"
                                    value={batch.wastageLiters}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, wastageLiters: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Expected yield (L)</Label>
                                  <Input value={batch.expectedYieldLiters} disabled />
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <Label>Batter temperature</Label>
                                  <Input
                                    value={batch.batterTemp}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, batterTemp: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>Room temperature</Label>
                                  <Input
                                    value={batch.roomTemp}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, roomTemp: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <Label>pH value</Label>
                                  <Input
                                    value={batch.ph}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, ph: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>QC notes</Label>
                                  <Textarea
                                    value={batch.qcNotes}
                                    onChange={(e) =>
                                      updateSelectedDay((day) => ({
                                        ...day,
                                        rounds: day.rounds.map((r) =>
                                          r.id === round.id
                                            ? {
                                                ...r,
                                                grinders: r.grinders.map((g) =>
                                                  g.id === batch.id ? { ...g, qcNotes: e.target.value } : g
                                                ),
                                              }
                                            : r
                                        ),
                                      }))
                                    }
                                    placeholder="QC observations"
                                  />
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button onClick={saveProductionDay} disabled={saveLoading} className="rounded-2xl">
                    {saveLoading ? 'Saving…' : 'Save Production Log'}
                  </Button>
                  {saveMessage ? <div className="text-sm text-slate-600">{saveMessage}</div> : null}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="packaging">
            {!selectedDay ? (
              <Card className="rounded-2xl">
                <CardContent className="p-6 text-slate-500">Select a production day in Orders & Planning to log packaging setup, issues, and output records.</CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl">
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Packaging, Dispatch & Production Output</CardTitle>
                    <p className="text-sm text-slate-500">
                      Track packaging setup times, machine issues, equipment checks, and output notes for the selected production day.
                    </p>
                  </div>
                  <Button onClick={() => saveProductionDay({ completeInventory: true })} disabled={saveLoading} className="rounded-2xl">
                    {saveLoading ? 'Saving…' : 'Save Packaging & Deduct Inventory'}
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <Label>Packaging setup start</Label>
                      <Input
                        type="time"
                        value={selectedDay.packaging.setupStart}
                        onChange={(e) =>
                          updateSelectedDay((day) => ({
                            ...day,
                            packaging: { ...day.packaging, setupStart: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Packaging setup end</Label>
                      <Input
                        type="time"
                        value={selectedDay.packaging.setupEnd}
                        onChange={(e) =>
                          updateSelectedDay((day) => ({
                            ...day,
                            packaging: { ...day.packaging, setupEnd: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedDay.packaging.splashIssue}
                          onCheckedChange={(checked) =>
                            updateSelectedDay((day) => ({
                              ...day,
                              packaging: { ...day.packaging, splashIssue: Boolean(checked) },
                            }))
                          }
                        />
                        <span>Splash issue observed</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedDay.packaging.greaseApplied}
                          onCheckedChange={(checked) =>
                            updateSelectedDay((day) => ({
                              ...day,
                              packaging: { ...day.packaging, greaseApplied: Boolean(checked) },
                            }))
                          }
                        />
                        <span>Grease applied correctly</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedDay.packaging.washerChanged}
                          onCheckedChange={(checked) =>
                            updateSelectedDay((day) => ({
                              ...day,
                              packaging: { ...day.packaging, washerChanged: Boolean(checked) },
                            }))
                          }
                        />
                        <span>Washer changed</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedDay.packaging.waterAccessIssue}
                          onCheckedChange={(checked) =>
                            updateSelectedDay((day) => ({
                              ...day,
                              packaging: { ...day.packaging, waterAccessIssue: Boolean(checked) },
                            }))
                          }
                        />
                        <span>Water access issue</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Machine issues</Label>
                      <Textarea
                        value={selectedDay.packaging.machineIssues}
                        onChange={(e) =>
                          updateSelectedDay((day) => ({
                            ...day,
                            packaging: { ...day.packaging, machineIssues: e.target.value },
                          }))
                        }
                        placeholder="Describe any machine issues during packaging"
                      />
                    </div>
                    <div>
                      <Label>General packaging notes</Label>
                      <Textarea
                        value={selectedDay.packaging.notes}
                        onChange={(e) =>
                          updateSelectedDay((day) => ({
                            ...day,
                            packaging: { ...day.packaging, notes: e.target.value },
                          }))
                        }
                        placeholder="Notes for dispatch, pack counts, or cleanup"
                      />
                    </div>
                    {saveMessage ? <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{saveMessage}</div> : null}
                  </div>
                </CardContent>

                <CardContent className="grid gap-4 lg:grid-cols-3 mt-4">
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Packaging deduction preview</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between"><span>30 oz containers</span><span className="font-semibold">{packagingUsage?.containers30 ?? 0}</span></div>
                      <div className="flex justify-between"><span>60 oz containers</span><span className="font-semibold">{packagingUsage?.containers60 ?? 0}</span></div>
                      <div className="flex justify-between"><span>30 oz lids</span><span className="font-semibold">{packagingUsage?.lids30 ?? 0}</span></div>
                      <div className="flex justify-between"><span>60 oz lids</span><span className="font-semibold">{packagingUsage?.lids60 ?? 0}</span></div>
                      <div className="flex justify-between"><span>30 oz cases</span><span className="font-semibold">{packagingUsage?.cases30 ?? 0}</span></div>
                      <div className="flex justify-between"><span>60 oz cases</span><span className="font-semibold">{packagingUsage?.cases60 ?? 0}</span></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Inventory after deduction</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between"><span>30 oz containers left</span><span className="font-semibold">{inventoryAfterPackaging?.containers30 ?? appState.inventory.containers30}</span></div>
                      <div className="flex justify-between"><span>60 oz containers left</span><span className="font-semibold">{inventoryAfterPackaging?.containers60 ?? appState.inventory.containers60}</span></div>
                      <div className="flex justify-between"><span>30 oz lids left</span><span className="font-semibold">{inventoryAfterPackaging?.lids30 ?? appState.inventory.lids30}</span></div>
                      <div className="flex justify-between"><span>60 oz lids left</span><span className="font-semibold">{inventoryAfterPackaging?.lids60 ?? appState.inventory.lids60}</span></div>
                      <div className="flex justify-between"><span>30 oz cases left</span><span className="font-semibold">{inventoryAfterPackaging?.cases30 ?? appState.inventory.cases30}</span></div>
                      <div className="flex justify-between"><span>60 oz cases left</span><span className="font-semibold">{inventoryAfterPackaging?.cases60 ?? appState.inventory.cases60}</span></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Inventory deduction notes</div>
                    <div className="mt-3 text-sm text-slate-700 space-y-3">
                      <p>This preview shows the inventory that will be deducted when packaging is saved.</p>
                      <p>Inventory deduction only applies once per production day.</p>
                      {selectedDay.inventoryDeducted ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Already deducted for this day.</div> : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryTab appState={appState} setAppState={setAppState} />
          </TabsContent>

          <TabsContent value="recipes">
            <RecipesTab appState={appState} setAppState={setAppState} />
          </TabsContent>

          <TabsContent value="settings">
            <CompanySettings company={appState.company} updateCompany={updateCompany} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
