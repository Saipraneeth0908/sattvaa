import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, supabaseConfigError } from './lib/supabaseClient'
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
import ProductionLogTab from '@/components/ProductionLogTab'
import { Camera, Download, Plus, Trash2, Package, Clock, Thermometer, FileText, Boxes, Droplets, CheckCircle2, Factory, LogOut, Sparkles, X } from 'lucide-react'

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

const ROUND_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]
const SLOT_OPTIONS = [1, 2, 3, 4, 5, 6]

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

function diffMinutes(startTime, endTime) {
  if (!startTime || !endTime) return ''
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return ''
  const startTotal = startHour * 60 + startMinute
  const endTotal = endHour * 60 + endMinute
  const delta = endTotal - startTotal
  return delta >= 0 ? delta : ''
}

function calculateOrderBatches(order, litersPerBatch) {
  const liters = litersFromOrders(order?.order30, order?.order60)
  if (liters <= 0 || litersPerBatch <= 0) return 0
  return Math.ceil(liters / litersPerBatch)
}

function createGrinderEntry(grinderNo, company) {
  return {
    id: uid(),
    grinderNo,
    productCode: '',
    productName: '',
    batchLabel: '',
    startedAt: '',
    endedAt: '',
    waterIceSteps: buildWaterIceStepsFromStart(''),
    grainTransferStart: '',
    grainTransferEnd: '',
    batterTransferStart: '',
    batterTransferEnd: '',
    batterTemp: '',
    roomTemp: '',
    ph: '',
    qcTime: '',
    qcNotes: '',
    qcRecordedAt: '',
    expectedYieldLiters: company.litersPerBatch,
    actualYieldLiters: '',
    wastageLiters: '',
    photos: [],
  }
}

function createRoundEntry(roundNo, company, slotCount = company.grinders) {
  return {
    id: uid(),
    roundNo,
    startedAt: '',
    endedAt: '',
    grinders: Array.from({ length: slotCount }).map((__, index) => createGrinderEntry(index + 1, company)),
  }
}

function getPlannedBatches(order, litersPerBatch) {
  const manualValue = Number(order?.plannedBatches)
  if (Number.isFinite(manualValue) && manualValue > 0) return manualValue
  return calculateOrderBatches(order, litersPerBatch)
}

function isMissingProductionDaysTable(error) {
  const message = String(error?.message || '')
  return message.includes("public.production_days") || message.includes('schema cache')
}

function createProductionDayTemplate(company, overrides = {}) {
  return {
    id: overrides.id || uid(),
    date: overrides.date || new Date().toISOString().slice(0, 10),
    status: overrides.status || 'planned',
    inventoryDeducted: Boolean(overrides.inventoryDeducted),
    orders: PRODUCTS.map((p) => ({
      id: uid(),
      productCode: p.code,
      productName: p.name,
      order30: 0,
      order60: 0,
      plannedBatches: 0,
      actual30: 0,
      actual60: 0,
      notes: '',
    })),
    soakPlan: {
      done: false,
      roWaterReady: false,
      containersReady: false,
      lidsReady: false,
      casesReady: false,
      boxesReady: false,
      iceReady: false,
      measuringJarsReady: false,
      fermentationRoomReady: false,
      grainsWashed3Times: false,
      liveGrainsWashed: false,
      notes: '',
    },
    rounds: Array.from({ length: company.defaultRoundsPerDay }).map((_, roundIndex) => ({
      ...createRoundEntry(roundIndex + 1, company, company.grinders),
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

function normalizeProductionDay(day, company) {
  const template = createProductionDayTemplate(company, day)
  const sourceOrders = Array.isArray(day?.orders) ? day.orders : []
  const sourceRounds = Array.isArray(day?.rounds) ? day.rounds : []

  return {
    ...template,
    ...day,
    orders: template.orders.map((orderTemplate) => {
      const matched = sourceOrders.find((order) => order?.productCode === orderTemplate.productCode)
      return {
        ...orderTemplate,
        ...(matched || {}),
      }
    }),
    soakPlan: {
      ...template.soakPlan,
      ...(day?.soakPlan || {}),
    },
    rounds: template.rounds.map((roundTemplate, roundIndex) => {
      const round = sourceRounds[roundIndex] || sourceRounds.find((item) => item?.roundNo === roundTemplate.roundNo) || {}
      const sourceGrinders = Array.isArray(round.grinders) ? round.grinders : []
      return {
        ...roundTemplate,
        ...round,
        startedAt: round?.startedAt || roundTemplate.startedAt || '',
        endedAt: round?.endedAt || roundTemplate.endedAt || '',
        grinders: roundTemplate.grinders.map((grinderTemplate, grinderIndex) => {
          const grinder = sourceGrinders[grinderIndex] || sourceGrinders.find((item) => item?.grinderNo === grinderTemplate.grinderNo) || {}
          return {
            ...grinderTemplate,
            ...grinder,
            waterIceSteps: Array.isArray(grinder.waterIceSteps) && grinder.waterIceSteps.length
              ? grinder.waterIceSteps.map((step, stepIndex) => ({
                  ...(grinderTemplate.waterIceSteps[stepIndex] || { time: '', action: '' }),
                  ...step,
                }))
              : grinderTemplate.waterIceSteps,
            photos: Array.isArray(grinder.photos) ? grinder.photos : [],
          }
        }),
      }
    }),
    packaging: {
      ...template.packaging,
      ...(day?.packaging || {}),
      photos: Array.isArray(day?.packaging?.photos) ? day.packaging.photos : [],
    },
  }
}

function resizeRoundGrinders(round, slotCount, company) {
  const existing = Array.isArray(round.grinders) ? round.grinders : []
  return {
    ...round,
    grinders: Array.from({ length: slotCount }).map((__, index) => {
      const grinder = existing[index] || existing.find((item) => item?.grinderNo === index + 1)
      return grinder
        ? {
            ...createGrinderEntry(index + 1, company),
            ...grinder,
            grinderNo: index + 1,
            waterIceSteps: Array.isArray(grinder.waterIceSteps) && grinder.waterIceSteps.length
              ? grinder.waterIceSteps
              : buildWaterIceStepsFromStart(round.startedAt || ''),
          }
        : createGrinderEntry(index + 1, company)
    }),
  }
}

function resizeProductionRounds(day, roundCount, slotCount, company) {
  const existingRounds = Array.isArray(day.rounds) ? day.rounds : []
  return {
    ...day,
    rounds: Array.from({ length: roundCount }).map((__, index) => {
      const existingRound = existingRounds[index] || existingRounds.find((item) => item?.roundNo === index + 1)
      const baseRound = existingRound
        ? {
            ...createRoundEntry(index + 1, company, slotCount),
            ...existingRound,
            roundNo: index + 1,
          }
        : createRoundEntry(index + 1, company, slotCount)
      return resizeRoundGrinders(baseRound, slotCount, company)
    }),
  }
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function exportProductionLogsXls(days, buildWaterIceSteps) {
  const normalizedDays = (days || []).filter(Boolean)
  const rows = []

  normalizedDays.forEach((day) => {
    rows.push(`<tr><th colspan="8" style="background:#111827;color:#ffffff;font-size:16px;">Production Day ${escapeHtml(day.date)}</th></tr>`)
    rows.push(`<tr><th colspan="8" style="background:#e5e7eb;">Summary</th></tr>`)
    rows.push(`<tr><td>Date</td><td>${escapeHtml(day.date)}</td><td>Rounds</td><td>${escapeHtml(day.rounds?.length || 0)}</td><td>Batch Slots</td><td>${escapeHtml(day.rounds?.[0]?.grinders?.length || 0)}</td><td>Status</td><td>${escapeHtml(day.status || 'planned')}</td></tr>`)

    ;(day.rounds || []).forEach((round) => {
      const machineList = (round.grinders || []).map((batch) => batch.batchLabel || `${batch.productCode || 'Batch'}${batch.grinderNo}`).join(', ')
      rows.push(`<tr><th colspan="8" style="background:#dbeafe;">Round ${escapeHtml(round.roundNo)}</th></tr>`)
      rows.push(`<tr><td>Machines</td><td colspan="7">${escapeHtml(machineList)}</td></tr>`)
      rows.push(`<tr><td>Start Time</td><td>${escapeHtml(round.startedAt || '')}</td><td>Stop Time</td><td>${escapeHtml(round.endedAt || '')}</td><td colspan="4"></td></tr>`)

      rows.push(`<tr><th colspan="8" style="background:#f3f4f6;">Water Addition Timeline</th></tr>`)
      rows.push(`<tr><th>Time</th><th colspan="7">Action</th></tr>`)
      buildWaterIceSteps(round.startedAt || '').forEach((step) => {
        rows.push(`<tr><td>${escapeHtml(step.time)}</td><td colspan="7">${escapeHtml(step.action)}</td></tr>`)
      })
      rows.push(`<tr><td>${escapeHtml(round.endedAt || '')}</td><td colspan="7">Stop</td></tr>`)

      rows.push(`<tr><th colspan="8" style="background:#f3f4f6;">Transfer to Grinder</th></tr>`)
      rows.push(`<tr><th>Machine</th><th>Start</th><th>Stop</th><th colspan="5"></th></tr>`)
      ;(round.grinders || []).forEach((batch) => {
        rows.push(`<tr><td>${escapeHtml(batch.batchLabel || `${batch.productCode || 'Batch'}${batch.grinderNo}`)}</td><td>${escapeHtml(batch.grainTransferStart)}</td><td>${escapeHtml(batch.grainTransferEnd)}</td><td colspan="5"></td></tr>`)
      })

      rows.push(`<tr><th colspan="8" style="background:#f3f4f6;">Transfer to Fermenter</th></tr>`)
      rows.push(`<tr><th>Machine</th><th>Start</th><th>Stop</th><th colspan="5"></th></tr>`)
      ;(round.grinders || []).forEach((batch) => {
        rows.push(`<tr><td>${escapeHtml(batch.batchLabel || `${batch.productCode || 'Batch'}${batch.grinderNo}`)}</td><td>${escapeHtml(batch.batterTransferStart)}</td><td>${escapeHtml(batch.batterTransferEnd)}</td><td colspan="5"></td></tr>`)
      })

      rows.push(`<tr><th colspan="8" style="background:#f3f4f6;">Batch Observation Table</th></tr>`)
      rows.push('<tr><th>Batter Type</th><th>Batter Temp</th><th>Room Temp</th><th>pH</th><th>Time</th><th>Notes</th><th>Actual Yield</th><th>Wastage</th></tr>')
      ;(round.grinders || []).forEach((batch) => {
        rows.push(
          `<tr><td>${escapeHtml(batch.batchLabel || batch.productCode || `Machine ${batch.grinderNo}`)}</td><td>${escapeHtml(batch.batterTemp)}</td><td>${escapeHtml(batch.roomTemp)}</td><td>${escapeHtml(batch.ph)}</td><td>${escapeHtml(batch.qcRecordedAt || batch.qcTime)}</td><td>${escapeHtml(batch.qcNotes)}</td><td>${escapeHtml(batch.actualYieldLiters)}</td><td>${escapeHtml(batch.wastageLiters)}</td></tr>`
        )
      })
    })

    rows.push('<tr><td colspan="8" style="height:24px;background:#ffffff;"></td></tr>')
  })

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { font-weight: 700; }
        </style>
      </head>
      <body>
        <table>${rows.join('')}</table>
      </body>
    </html>
  `

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `production-logs-${new Date().toISOString().slice(0, 10)}.xls`
  link.click()
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
    <Card className="metric-glow rounded-[1.6rem] border-white/55 bg-white/80">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-500">{title}</div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-900">{value}</div>
            {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/90 p-2.5 text-emerald-800 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background px-4 py-10 text-foreground">
          <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="text-2xl font-semibold text-red-700">Something broke in the app</div>
            <p className="mt-3 text-sm text-slate-600">
              The page hit a runtime error. The message is shown here so we can fix it instead of showing a blank screen.
            </p>
            <pre className="mt-6 overflow-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">
              {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-lg font-semibold tracking-[-0.02em] text-slate-900">{title}</div>
        {subtitle ? <div className="text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  )
}

function AppHeader({ userEmail, onSignOut, companyName }) {
  return (
    <div className="sticky top-0 z-20 border-b border-white/40 bg-[#f8f4ec]/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <div>
          <div className="flex items-center gap-3 text-xl font-bold tracking-[-0.03em] text-slate-900 md:text-3xl">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-2 text-emerald-800 shadow-sm">
              <Factory className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div>{companyName}</div>
          </div>
          <div className="mt-1 text-sm text-slate-600">Production planning, QC, packaging, inventory, and daily log tracking in one calm workspace.</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-white/60 bg-white/65 px-4 py-2 text-sm text-slate-600 shadow-sm md:block">{userEmail}</div>
          <Button variant="outline" onClick={onSignOut} className="rounded-2xl border-white/70 bg-white/80">
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

function CompanySettings({ company, updateCompany, onSave, saveLoading }) {
  const setField = (field, value) => {
    updateCompany({ ...company, [field]: value })
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>Company Settings</CardTitle>
        <Button onClick={onSave} disabled={saveLoading} className="rounded-2xl">
          {saveLoading ? 'Saving…' : 'Save Settings'}
        </Button>
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

function InventoryTab({ appState, setAppState, onSave, saveLoading, saveMessage }) {
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
      <SectionTitle
        title="Packaging Inventory"
        subtitle="Track containers, lids, and cardboard cases"
        action={
          <Button onClick={onSave} disabled={saveLoading} className="rounded-2xl">
            {saveLoading ? 'Saving…' : 'Save Inventory'}
          </Button>
        }
      />
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
      {saveMessage ? <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{saveMessage}</div> : null}
    </div>
  )
}

function RecipesTab({ appState, setAppState, onSave, saveLoading, saveMessage }) {
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
      <SectionTitle
        title="Recipe Master"
        subtitle="Separate recipe page linked to inventory, planning, and future automatic ingredient deduction"
        action={
          <Button onClick={onSave} disabled={saveLoading} className="rounded-2xl">
            {saveLoading ? 'Saving…' : 'Save Recipes'}
          </Button>
        }
      />
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
      {saveMessage ? <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{saveMessage}</div> : null}
    </div>
  )
}

function DashboardTab({ appState, selectedDayId }) {
  const selectedDaySource = appState.productionDays.find((d) => d.id === selectedDayId) || appState.productionDays[0] || null
  const selectedDay = selectedDaySource ? normalizeProductionDay(selectedDaySource, appState.company) : null

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
    <div className="flex rounded-3xl border border-white/60 bg-white/60 p-1 shadow-sm">
      <button
        type="button"
        className={`flex-1 rounded-3xl py-2 text-sm font-semibold transition ${authMode === 'login' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/80'}`}
        onClick={() => setAuthMode('login')}
      >
        Login
      </button>
      <button
        type="button"
        className={`flex-1 rounded-3xl py-2 text-sm font-semibold transition ${authMode === 'register' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/80'}`}
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
      name: 'Sattva production app',
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
  const initialLoadRef = useRef(false)

  if (!supabase) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-4 text-2xl font-semibold">Supabase configuration needed</div>
          <p className="text-sm leading-7 text-muted-foreground">
            The app could not start because the Supabase environment variables are missing or invalid in this deployment.
          </p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {supabaseConfigError}
          </div>
          <div className="mt-6 space-y-2 text-sm text-slate-600">
            <div>Set these variables in Vercel for the `web` project:</div>
            <div>`VITE_SUPABASE_URL`</div>
            <div>`VITE_SUPABASE_ANON_KEY`</div>
          </div>
        </div>
      </div>
    )
  }

  const buildProfilePayload = useCallback(
    (state = appState) => ({
      company: state.company,
      inventory: state.inventory,
      recipes: state.recipes,
      productionDays: state.productionDays,
    }),
    [appState]
  )

  const selectedDay = appState.productionDays.find((d) => d.id === selectedDayId) || appState.productionDays[0] || null

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

  const fetchProductionDays = useCallback(async () => {
    const { data, error } = await supabase
      .from('production_days')
      .select('id, production_date, status, inventory_deducted, notes')
      .order('production_date', { ascending: false })

    if (error) {
      console.error('Failed to load production days', error)
      if (isMissingProductionDaysTable(error)) {
        return
      }
      return
    }

    setAppState((prev) => {
      const productionDays = (data || []).map((row) => {
        const parsed = parseJson(row.notes) || {}
        return normalizeProductionDay(
          {
            id: row.id,
            date: row.production_date,
            status: row.status || 'planned',
            inventoryDeducted: row.inventory_deducted || false,
            ...parsed,
          },
          prev.company
        )
      })

      setSelectedDayId((current) => current || productionDays[0]?.id || null)
      return { ...prev, productionDays }
    })
  }, [])

  const loadProfileState = useCallback(async () => {
    if (!user?.id) return

    const { data, error } = await supabase.from('profiles').select('app_state').eq('id', user.id).maybeSingle()
    if (error) {
      console.error('Failed to load profile state', error)
      return
    }

    const profileState = data?.app_state
    if (!profileState) return

    setAppState((prev) => ({
      ...prev,
      company: profileState.company || prev.company,
      inventory: profileState.inventory || prev.inventory,
      recipes: profileState.recipes || prev.recipes,
      productionDays: Array.isArray(profileState.productionDays)
        ? profileState.productionDays.map((day) => normalizeProductionDay(day, profileState.company || prev.company))
        : prev.productionDays,
    }))
  }, [user?.id])

  const saveProfileState = useCallback(
    async (message = 'Saved to Supabase.', stateOverride = null) => {
      if (!user?.id) return

      setSaveLoading(true)
      setSaveMessage('')

      const stateToSave = stateOverride || appState
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.email || null,
        app_state: buildProfilePayload(stateToSave),
      })

      if (error) {
        setSaveMessage(`Save failed: ${error.message}`)
        setSaveLoading(false)
        return
      }

      setSaveMessage(message)
      setSaveLoading(false)
    },
    [appState, buildProfilePayload, user?.email, user?.id]
  )

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
        orders: nextDay.orders,
        soakPlan: nextDay.soakPlan,
        rounds: nextDay.rounds.map((round) => ({
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
            qcRecordedAt: g.qcRecordedAt,
            expectedYieldLiters: g.expectedYieldLiters,
            actualYieldLiters: g.actualYieldLiters,
            wastageLiters: g.wastageLiters,
            photos: g.photos,
          })),
        })),
        packaging: nextDay.packaging,
      }),
    }

    const localStateAfterSave = {
      ...appState,
      inventory: nextInventory,
      productionDays: appState.productionDays.map((day) => (day.id === selectedDay.id ? nextDay : day)),
    }

    const { data, error } = await supabase.from('production_days').upsert(payload, { onConflict: 'production_date' }).select()
    if (error) {
      if (isMissingProductionDaysTable(error)) {
        await saveProfileState(`Saved ${nextDay.date} to Supabase profile storage.`, localStateAfterSave)
        return
      }
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

    await saveProfileState(`Saved ${nextDay.date} to Supabase.`, {
      ...localStateAfterSave,
      productionDays: localStateAfterSave.productionDays.map((day) =>
        day.id === selectedDay.id ? { ...day, id: insertedId } : day
      ),
    })
  }, [selectedDay, appState, applyInventoryDeduction, saveProfileState])

  const deleteProductionDay = useCallback(
    async (dayId) => {
      const day = appState.productionDays.find((d) => d.id === dayId)
      if (!day) return

      const remainingProductionDays = appState.productionDays.filter((d) => d.id !== dayId)
      const nextSelectedDayId = selectedDayId === dayId ? (remainingProductionDays[0]?.id || null) : selectedDayId

      setAppState((prev) => ({
        ...prev,
        productionDays: remainingProductionDays,
      }))
      setSelectedDayId(nextSelectedDayId)

      const { error } = await supabase.from('production_days').delete().eq('id', dayId)
      if (error) {
        if (!isMissingProductionDaysTable(error)) {
          console.error('Delete failed', error)
        }
      }

      await saveProfileState(`Deleted ${day.date}.`, {
        ...appState,
        productionDays: remainingProductionDays,
      })
    },
    [appState, saveProfileState, selectedDayId]
  )

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
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

  useEffect(() => {
    if (!session || !user?.id || initialLoadRef.current) return
    initialLoadRef.current = true

    const loadInitialData = async () => {
      await loadProfileState()
      await fetchProductionDays()
    }

    loadInitialData()
  }, [fetchProductionDays, loadProfileState, session, user?.id])

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
    return createProductionDayTemplate(company)
  }

  if (!session) {
    return (
      <div className="app-shell min-h-screen px-4 py-10 text-foreground">
        <div className="glass-panel mx-auto max-w-2xl rounded-[2rem] p-8">
          <div className="soft-panel mb-6 rounded-[1.75rem] p-5 text-center">
            <div className="flex items-center justify-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Sattva production app
            </div>
          </div>
          <div className="mb-8 space-y-4 text-center">
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-900">Sattva production app</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Professional daily production management for batter planning, batch timing, QC, packaging, inventory, and records that stay easy to read under pressure.
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
    <AppErrorBoundary>
      <div className="app-shell min-h-screen text-slate-900">
        <AppHeader userEmail={user?.email || 'Unknown'} onSignOut={signOut} companyName={appState.company.name} />

        <div className="mx-auto max-w-7xl px-4 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="section-grid space-y-6">
          <TabsList className="glass-panel flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-[1.6rem] p-2">
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
                  onClick={async () => {
                    try {
                      const newDay = normalizeProductionDay(createProductionDay(appState.company), appState.company)
                      const nextState = {
                        ...appState,
                        productionDays: [newDay, ...appState.productionDays],
                      }
                      setAppState(nextState)
                      setSelectedDayId(newDay.id)
                      setSaveMessage('')
                      await saveProfileState(`Created ${newDay.date}.`, nextState)
                    } catch (error) {
                      console.error('Failed to create production day', error)
                      setSaveMessage(`Failed to create production day: ${error.message}`)
                    }
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
                        className="rounded-r-2xl border-l border-border bg-white px-2 text-slate-600 transition hover:bg-red-50 hover:text-red-700"
                        onClick={() => deleteProductionDay(day.id)}
                        title="Delete production day"
                      >
                        <X className="w-4 h-4" />
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
                            <TableHead>No. of batches</TableHead>
                            <TableHead>Containers required</TableHead>
                            <TableHead>Cases required</TableHead>
                            <TableHead>Actual 30 oz</TableHead>
                            <TableHead>Actual 60 oz</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDay.orders.map((order) => {
                            const batches = calculateOrderBatches(order, appState.company.litersPerBatch)
                            const plannedBatches = getPlannedBatches(order, appState.company.litersPerBatch)
                            const required30 = toNumber(order.order30)
                            const required60 = toNumber(order.order60)
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
                                <TableCell>
                                  <div className="space-y-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={order.plannedBatches ?? ''}
                                      onChange={(e) =>
                                        updateSelectedDay((day) => ({
                                          ...day,
                                          orders: day.orders.map((o) =>
                                            o.id === order.id
                                              ? { ...o, plannedBatches: e.target.value === '' ? '' : toNumber(e.target.value) }
                                              : o
                                          ),
                                        }))
                                      }
                                      placeholder={String(batches)}
                                    />
                                    <div className="text-xs text-slate-500">Auto: {batches}</div>
                                  </div>
                                </TableCell>
                                <TableCell>{`${required30} x 30 oz, ${required60} x 60 oz`}</TableCell>
                                <TableCell>{`${casesNeeded(required30, appState.company.casePack30)} x 30 oz, ${casesNeeded(required60, appState.company.casePack60)} x 60 oz`}</TableCell>
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
                                checked={selectedDay.soakPlan.iceReady}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, iceReady: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Ice measured and ready</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedDay.soakPlan.measuringJarsReady}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, measuringJarsReady: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Measuring jars ready</span>
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
                                checked={selectedDay.soakPlan.lidsReady}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, lidsReady: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Lids available</span>
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
                                checked={selectedDay.soakPlan.boxesReady}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, boxesReady: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Extra boxes available</span>
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
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedDay.soakPlan.liveGrainsWashed}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, liveGrainsWashed: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Live grains washed</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedDay.soakPlan.fermentationRoomReady}
                                onCheckedChange={(checked) =>
                                  updateSelectedDay((day) => ({
                                    ...day,
                                    soakPlan: { ...day.soakPlan, fermentationRoomReady: Boolean(checked) },
                                  }))
                                }
                              />
                              <span>Fermentation room ready</span>
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
                            <span>Total planned batches</span>
                            <span className="font-semibold">{selectedDay.orders.reduce((sum, order) => sum + getPlannedBatches(order, appState.company.litersPerBatch), 0)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <span>Estimated containers</span>
                            <span className="font-semibold">{`${selectedDay.orders.reduce((sum, order) => sum + toNumber(order.order30), 0)} x 30 oz, ${selectedDay.orders.reduce((sum, order) => sum + toNumber(order.order60), 0)} x 60 oz`}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <span>Estimated cases</span>
                            <span className="font-semibold">{`${casesNeeded(selectedDay.orders.reduce((sum, order) => sum + toNumber(order.order30), 0), appState.company.casePack30)} x 30 oz, ${casesNeeded(selectedDay.orders.reduce((sum, order) => sum + toNumber(order.order60), 0), appState.company.casePack60)} x 60 oz`}</span>
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
            <ProductionLogTab
              selectedDay={selectedDay}
              saveProductionDay={saveProductionDay}
              saveLoading={saveLoading}
              saveMessage={saveMessage}
              onExport={() =>
                exportProductionLogsXls(
                  appState.productionDays.map((day) => normalizeProductionDay(day, appState.company)),
                  buildWaterIceStepsFromStart
                )
              }
              updateSelectedDay={updateSelectedDay}
              appState={appState}
              products={PRODUCTS}
              roundOptions={ROUND_OPTIONS}
              slotOptions={SLOT_OPTIONS}
              resizeProductionRounds={resizeProductionRounds}
              buildWaterIceStepsFromStart={buildWaterIceStepsFromStart}
            />
            {false && (
            !selectedDay ? (
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
                      <div className="rounded-2xl border bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Round No.</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Batter Types</TableHead>
                              <TableHead>Batch Count</TableHead>
                              <TableHead>Round Window</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>{round.roundNo}</TableCell>
                              <TableCell>{selectedDay.date}</TableCell>
                              <TableCell>{round.grinders.map((batch) => batch.productCode || 'Pending').join(', ')}</TableCell>
                              <TableCell>{round.grinders.filter((batch) => batch.productCode).length}</TableCell>
                              <TableCell>
                                {round.grinders.map((batch) => `${batch.startedAt || '--'}-${batch.endedAt || '--'}`).join(', ')}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
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

                              <div className="rounded-2xl border bg-white">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Round No.</TableHead>
                                      <TableHead>Batch type</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Start time</TableHead>
                                      <TableHead>End time</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow>
                                      <TableCell>{round.roundNo}</TableCell>
                                      <TableCell>{batch.productCode || 'Pending'}</TableCell>
                                      <TableCell>{selectedDay.date}</TableCell>
                                      <TableCell>{batch.startedAt || '--'}</TableCell>
                                      <TableCell>{batch.endedAt || '--'}</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>

                              <div className="rounded-2xl border bg-white p-3">
                                <div className="text-sm font-semibold mb-3">Water & ice additions</div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Time</TableHead>
                                      <TableHead>Action</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {batch.waterIceSteps.map((step, index) => (
                                      <TableRow key={index}>
                                        <TableCell className="w-32">
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
                                        </TableCell>
                                        <TableCell>{step.action}</TableCell>
                                      </TableRow>
                                    ))}
                                    <TableRow>
                                      <TableCell>{batch.endedAt || '--'}</TableCell>
                                      <TableCell>Stop time</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                                <div className="mt-3 text-xs text-slate-500">
                                  Target per batch: {appState.company.waterPerBatchLiters} L water and {appState.company.icePerBatchLb} lb ice.
                                </div>
                              </div>

                              <div className="rounded-2xl border bg-white p-3">
                                <div className="text-sm font-semibold mb-3">Time taken to transfer grains to grinder</div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Batch</TableHead>
                                      <TableHead>Start time</TableHead>
                                      <TableHead>End time</TableHead>
                                      <TableHead>No. of min</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow>
                                      <TableCell>{batch.batchLabel || `Grinder ${batch.grinderNo}`}</TableCell>
                                      <TableCell className="w-36">
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
                                      </TableCell>
                                      <TableCell className="w-36">
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
                                      </TableCell>
                                      <TableCell>{diffMinutes(batch.grainTransferStart, batch.grainTransferEnd) || '--'}</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>

                              <div className="rounded-2xl border bg-white p-3">
                                <div className="text-sm font-semibold mb-3">Time taken to transfer batter to fermentation room</div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Batch</TableHead>
                                      <TableHead>Start time</TableHead>
                                      <TableHead>End time</TableHead>
                                      <TableHead>No. of min</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow>
                                      <TableCell>{batch.batchLabel || `Grinder ${batch.grinderNo}`}</TableCell>
                                      <TableCell className="w-36">
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
                                      </TableCell>
                                      <TableCell className="w-36">
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
                                      </TableCell>
                                      <TableCell>{diffMinutes(batch.batterTransferStart, batch.batterTransferEnd) || '--'}</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
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

                              <div className="rounded-2xl border bg-white p-3">
                                <div className="text-sm font-semibold mb-3">QC readings</div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Batter type</TableHead>
                                      <TableHead>Batter temp</TableHead>
                                      <TableHead>Room temp</TableHead>
                                      <TableHead>pH</TableHead>
                                      <TableHead>Time</TableHead>
                                      <TableHead>Notes</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow>
                                      <TableCell>{batch.productCode || 'Pending'}</TableCell>
                                      <TableCell className="w-32">
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
                                      </TableCell>
                                      <TableCell className="w-32">
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
                                      </TableCell>
                                      <TableCell className="w-28">
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
                                      </TableCell>
                                      <TableCell className="w-32">
                                        <Input
                                          type="time"
                                          value={batch.qcRecordedAt || batch.qcTime}
                                          onChange={(e) =>
                                            updateSelectedDay((day) => ({
                                              ...day,
                                              rounds: day.rounds.map((r) =>
                                                r.id === round.id
                                                  ? {
                                                      ...r,
                                                      grinders: r.grinders.map((g) =>
                                                        g.id === batch.id ? { ...g, qcRecordedAt: e.target.value, qcTime: e.target.value } : g
                                                      ),
                                                    }
                                                  : r
                                              ),
                                            }))
                                          }
                                        />
                                      </TableCell>
                                      <TableCell className="min-w-48">
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
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
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
            )
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
            <InventoryTab appState={appState} setAppState={setAppState} onSave={() => saveProfileState('Inventory saved to Supabase.')} saveLoading={saveLoading} saveMessage={saveMessage} />
          </TabsContent>

          <TabsContent value="recipes">
            <RecipesTab appState={appState} setAppState={setAppState} onSave={() => saveProfileState('Recipes saved to Supabase.')} saveLoading={saveLoading} saveMessage={saveMessage} />
          </TabsContent>

          <TabsContent value="settings">
            <CompanySettings company={appState.company} updateCompany={updateCompany} onSave={() => saveProfileState('Settings saved to Supabase.')} saveLoading={saveLoading} />
            {saveMessage ? <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{saveMessage}</div> : null}
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppErrorBoundary>
  )
}

