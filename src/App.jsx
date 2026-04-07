import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { useRealtimeInventory } from './hooks/useRealtimeInventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Camera,
  Download,
  Plus,
  Trash2,
  Package,
  Clock,
  Thermometer,
  FileText,
  Boxes,
  Droplets,
  CheckCircle2,
  Factory,
} from 'lucide-react';

const STORAGE_KEY = 'batters-procuction-llc-app-v1';

const PRODUCTS = [
  { code: 'RAGI', name: 'Ragi Millet Batter' },
  { code: 'RB', name: 'Regular Millet Batter' },
  { code: 'LMB', name: 'Little Millet Batter' },
  { code: 'KMB', name: 'Kodo Millet Batter' },
  { code: 'BMB', name: 'Barnyard Millet Batter' },
];

const GRAIN_TYPES = [
  'Regular rice batter mix',
  'Barnyard millet',
  'Kodo millet',
  'Little millet',
  'Ragi millet',
  'Urad dal',
  'Fenugreek',
];

const PACKAGING_ITEM_MAP = {
  '30 oz containers': 'containers30',
  '60 oz containers': 'containers60',
  '30 oz lids': 'lids30',
  '60 oz lids': 'lids60',
  '30 oz cases': 'cases30',
  '60 oz cases': 'cases60',
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function mapSupabaseInventoryToAppInventory(rows) {
  const inventory = {
    containers30: 0,
    containers60: 0,
    cases30: 0,
    cases60: 0,
    lids30: 0,
    lids60: 0,
    grains: [],
  };

  for (const row of rows || []) {
    const key = PACKAGING_ITEM_MAP[(row.item_name || '').toLowerCase()];
    if (key) {
      inventory[key] = Number(row.quantity_on_hand || 0);
    } else {
      inventory.grains.push({
        id: row.id,
        name: row.item_name,
        unit: row.unit,
        onHand: Number(row.quantity_on_hand || 0),
        reorderLevel: Number(row.reorder_level || 0),
        itemType: row.item_type,
      });
    }
  }

  return inventory;
}

const DEFAULT_DATA = {
  company: {
    name: 'Batters Production LLC',
    brand: 'Sattva Idly & Dosa Batter',
    grinders: 3,
    litersPerBatch: 20,
    defaultRoundsPerDay: 4,
    litersPerRound: 60,
    litersPerDay: 240,
    waterPerBatchLiters: 6,
    icePerBatchLb: 1.5,
    casePack30: 12,
    casePack60: 6,
  },
  inventory: {
    containers30: 0,
    containers60: 0,
    cases30: 0,
    cases60: 0,
    lids30: 0,
    lids60: 0,
    grains: GRAIN_TYPES.map((name) => ({ name, unit: 'kg', onHand: 0, reorderLevel: 0 })),
  },
  inventoryTransactions: [],
  recipes: [
    {
      id: uid(),
      productCode: 'RAGI',
      productName: 'Ragi Millet Batter',
      yieldLiters: 20,
      ingredients: [
        { id: uid(), itemName: 'Ragi millet', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'Urad dal', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'RO water', qty: 6, unit: 'L' },
        { id: uid(), itemName: 'Ice', qty: 1.5, unit: 'lb' },
      ],
    },
    {
      id: uid(),
      productCode: 'RB',
      productName: 'Regular Millet Batter',
      yieldLiters: 20,
      ingredients: [
        { id: uid(), itemName: 'Regular batter grain mix', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'Urad dal', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'RO water', qty: 6, unit: 'L' },
        { id: uid(), itemName: 'Ice', qty: 1.5, unit: 'lb' },
      ],
    },
    {
      id: uid(),
      productCode: 'LMB',
      productName: 'Little Millet Batter',
      yieldLiters: 20,
      ingredients: [
        { id: uid(), itemName: 'Little millet', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'Urad dal', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'RO water', qty: 6, unit: 'L' },
        { id: uid(), itemName: 'Ice', qty: 1.5, unit: 'lb' },
      ],
    },
    {
      id: uid(),
      productCode: 'KMB',
      productName: 'Kodo Millet Batter',
      yieldLiters: 20,
      ingredients: [
        { id: uid(), itemName: 'Kodo millet', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'Urad dal', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'RO water', qty: 6, unit: 'L' },
        { id: uid(), itemName: 'Ice', qty: 1.5, unit: 'lb' },
      ],
    },
    {
      id: uid(),
      productCode: 'BMB',
      productName: 'Barnyard Millet Batter',
      yieldLiters: 20,
      ingredients: [
        { id: uid(), itemName: 'Barnyard millet', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'Urad dal', qty: 0, unit: 'kg' },
        { id: uid(), itemName: 'RO water', qty: 6, unit: 'L' },
        { id: uid(), itemName: 'Ice', qty: 1.5, unit: 'lb' },
      ],
    },
  ],
  productionDays: [],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DATA,
      ...parsed,
      company: { ...DEFAULT_DATA.company, ...(parsed.company || {}) },
      inventory: {
        ...DEFAULT_DATA.inventory,
        ...(parsed.inventory || {}),
        grains: parsed.inventory?.grains?.length ? parsed.inventory.grains : DEFAULT_DATA.inventory.grains,
      },
      recipes: parsed.recipes?.length ? parsed.recipes : DEFAULT_DATA.recipes,
      inventoryTransactions: parsed.inventoryTransactions || [],
      productionDays: parsed.productionDays || [],
    };
  } catch {
    return DEFAULT_DATA;
  }
}

function saveData(data) {
  const safeData = {
    ...data,
    inventory: {
      containers30: 0,
      containers60: 0,
      cases30: 0,
      cases60: 0,
      lids30: 0,
      lids60: 0,
      grains: [],
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData));
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function litersFromOrders(order30, order60) {
  return order30 * 0.887205 + order60 * 1.77441;
}

function casesNeeded(units, perCase) {
  return Math.ceil((toNumber(units) || 0) / perCase);
}

function normalizeUnit(unit) {
  return (unit || '').trim().toLowerCase();
}

function convertToInventoryUnit(quantity, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to) return null;
  if (from === to) return quantity;

  const mass = { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 };
  const volume = { l: 1, ml: 0.001, cups: 0.236588 };

  if (mass[from] && mass[to]) return quantity * (mass[from] / mass[to]);
  if (volume[from] && volume[to]) return quantity * (volume[from] / volume[to]);
  return null;
}

function getRecipeForProduct(recipes, productCode) {
  return recipes.find((r) => r.productCode === productCode);
}

function countCompletedBatchesForProduct(day, productCode) {
  return day.rounds
    .flatMap((round) => round.grinders)
    .filter((g) => g.productCode === productCode && g.startedAt && g.endedAt).length;
}

function buildAutoDeductionPreview(day, recipes, inventory, company) {
  const ingredientTotals = {};
  const recipeWarnings = [];

  PRODUCTS.forEach((product) => {
    const recipe = getRecipeForProduct(recipes, product.code);
    const completedBatches = countCompletedBatchesForProduct(day, product.code);
    if (!completedBatches) return;
    if (!recipe) {
      recipeWarnings.push(`No recipe found for ${product.name}`);
      return;
    }

    recipe.ingredients.forEach((ingredient) => {
      const matchedInventory = inventory.grains.find(
        (g) => g.name.toLowerCase() === (ingredient.itemName || '').toLowerCase()
      );
      if (!matchedInventory) {
        recipeWarnings.push(`${product.code}: ${ingredient.itemName || 'Unnamed ingredient'} is not linked to inventory`);
        return;
      }
      const convertedQty = convertToInventoryUnit(toNumber(ingredient.qty), ingredient.unit, matchedInventory.unit);
      if (convertedQty === null) {
        recipeWarnings.push(
          `${product.code}: unit mismatch for ${ingredient.itemName} (${ingredient.unit} to ${matchedInventory.unit})`
        );
        return;
      }
      ingredientTotals[matchedInventory.name] =
        (ingredientTotals[matchedInventory.name] || 0) + convertedQty * completedBatches;
    });
  });

  const actual30 = day.orders.reduce((sum, o) => sum + toNumber(o.actual30), 0);
  const actual60 = day.orders.reduce((sum, o) => sum + toNumber(o.actual60), 0);

  return {
    ingredientTotals,
    packagingTotals: {
      containers30: actual30,
      containers60: actual60,
      lids30: actual30,
      lids60: actual60,
      cases30: casesNeeded(actual30, company.casePack30),
      cases60: casesNeeded(actual60, company.casePack60),
    },
    recipeWarnings,
  };
}

function applyAutoDeductionToInventory(data, productionDayId) {
  const day = data.productionDays.find((d) => d.id === productionDayId);
  if (!day || day.inventoryDeducted) return data;

  const preview = buildAutoDeductionPreview(day, data.recipes, data.inventory, data.company);
  const previousInventorySnapshot = JSON.parse(JSON.stringify(data.inventory));
  const timestamp = new Date().toISOString();

  const updatedGrains = data.inventory.grains.map((grain) => {
    const deduction = preview.ingredientTotals[grain.name] || 0;
    return {
      ...grain,
      onHand: Math.max(0, toNumber(grain.onHand) - deduction),
    };
  });

  const transactionRows = [
    ...Object.entries(preview.ingredientTotals).map(([name, qty]) => {
      const matched = data.inventory.grains.find((g) => g.name === name);
      return {
        id: uid(),
        productionDayId,
        type: 'ingredient_used',
        itemName: name,
        quantity: qty,
        unit: matched?.unit || '',
        createdAt: timestamp,
      };
    }),
    { id: uid(), productionDayId, type: 'packaging_used', itemName: '30 oz containers', quantity: preview.packagingTotals.containers30, unit: 'units', createdAt: timestamp },
    { id: uid(), productionDayId, type: 'packaging_used', itemName: '60 oz containers', quantity: preview.packagingTotals.containers60, unit: 'units', createdAt: timestamp },
    { id: uid(), productionDayId, type: 'packaging_used', itemName: '30 oz lids', quantity: preview.packagingTotals.lids30, unit: 'units', createdAt: timestamp },
    { id: uid(), productionDayId, type: 'packaging_used', itemName: '60 oz lids', quantity: preview.packagingTotals.lids60, unit: 'units', createdAt: timestamp },
    { id: uid(), productionDayId, type: 'packaging_used', itemName: '30 oz cases', quantity: preview.packagingTotals.cases30, unit: 'units', createdAt: timestamp },
    { id: uid(), productionDayId, type: 'packaging_used', itemName: '60 oz cases', quantity: preview.packagingTotals.cases60, unit: 'units', createdAt: timestamp },
  ];

  return {
    ...data,
    inventory: {
      ...data.inventory,
      grains: updatedGrains,
      containers30: Math.max(0, toNumber(data.inventory.containers30) - preview.packagingTotals.containers30),
      containers60: Math.max(0, toNumber(data.inventory.containers60) - preview.packagingTotals.containers60),
      lids30: Math.max(0, toNumber(data.inventory.lids30) - preview.packagingTotals.lids30),
      lids60: Math.max(0, toNumber(data.inventory.lids60) - preview.packagingTotals.lids60),
      cases30: Math.max(0, toNumber(data.inventory.cases30) - preview.packagingTotals.cases30),
      cases60: Math.max(0, toNumber(data.inventory.cases60) - preview.packagingTotals.cases60),
    },
    inventoryTransactions: [...(data.inventoryTransactions || []), ...transactionRows],
    productionDays: data.productionDays.map((d) =>
      d.id === productionDayId
        ? {
            ...d,
            inventoryDeducted: true,
            inventoryDeductedAt: timestamp,
            deductionSummary: preview,
            inventorySnapshotBeforeDeduction: previousInventorySnapshot,
            status: 'completed',
          }
        : d
    ),
  };
}

function undoAutoDeductionFromInventory(data, productionDayId) {
  const day = data.productionDays.find((d) => d.id === productionDayId);
  if (!day || !day.inventoryDeducted || !day.inventorySnapshotBeforeDeduction) return data;

  return {
    ...data,
    inventory: day.inventorySnapshotBeforeDeduction,
    inventoryTransactions: (data.inventoryTransactions || []).filter((tx) => tx.productionDayId !== productionDayId),
    productionDays: data.productionDays.map((d) =>
      d.id === productionDayId
        ? {
            ...d,
            inventoryDeducted: false,
            inventoryDeductedAt: '',
            status: 'packaging',
            deductionSummary: null,
            inventorySnapshotBeforeDeduction: null,
          }
        : d
    ),
  };
}

function formatQty(value) {
  const num = Number(value || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function addMinutesToTime(timeStr, minutesToAdd) {
  if (!timeStr || !timeStr.includes(':')) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const base = new Date();
  base.setHours(h || 0, m || 0, 0, 0);
  base.setMinutes(base.getMinutes() + minutesToAdd);
  const hh = String(base.getHours()).padStart(2, '0');
  const mm = String(base.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildWaterIceStepsFromStart(startTime) {
  const offsets = [10, 15, 20, 25, 27];
  const actions = [
    'Add 500 ml water + ice',
    'Add 500 ml water + ice',
    'Add 500 ml water + ice',
    'Add 500 ml water',
    'Add all remaining water',
  ];
  return offsets.map((offset, idx) => ({
    time: addMinutesToTime(startTime, offset),
    action: actions[idx],
  }));
}

function createProductionDay(company) {
  return {
    id: uid(),
    date: new Date().toISOString().slice(0, 10),
    status: 'planned',
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
      grains: [],
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
    inventoryDeducted: false,
    inventoryDeductedAt: '',
    deductionSummary: null,
  };
}

function exportJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'batters-production-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')]
    .concat(rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AppHeader({ companyName, onExport, onSignOut, userEmail }) {
  return (
    <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6" /> {companyName}
          </div>
          <div className="text-sm text-slate-600">
            Mobile-friendly production, QC, packaging, inventory, and batch tracking for 5 millet batter types
          </div>
          {userEmail ? <div className="text-xs text-slate-500 mt-1">Signed in as {userEmail}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onExport} className="rounded-2xl">
            <Download className="w-4 h-4 mr-2" /> Export Data
          </Button>
          <Button variant="outline" onClick={onSignOut} className="rounded-2xl">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
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
  );
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
  );
}

function CompanySettings({ data, setData }) {
  const company = data.company;

  const setField = (field, value) => {
    setData((prev) => ({
      ...prev,
      company: { ...prev.company, [field]: value },
    }));
  };

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
  );
}

function InventoryTab({ data, setData }) {
  const inv = data.inventory;

  const setInventory = async (field, value) => {
    const numericValue = toNumber(value);

    setData((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        [field]: numericValue,
      },
    }));


    const itemNameMap = {
      containers30: '30 oz containers',
      containers60: '60 oz containers',
      lids30: '30 oz lids',
      lids60: '60 oz lids',
      cases30: '30 oz cases',
      cases60: '60 oz cases',
    };

    const itemName = itemNameMap[field];
    if (!itemName) return;

    const { error } = await supabase
      .from('inventory_items')
      .update({ quantity_on_hand: numericValue })
      .eq('item_name', itemName);

    if (error) console.error('Packaging inventory update failed:', error.message);
  };

  const updateGrain = async (idx, field, value) => {
    const grain = inv.grains[idx];
    if (!grain?.id) return;

    const updatePayload = {};
    if (field === 'name') updatePayload.item_name = value;
    if (field === 'unit') updatePayload.unit = value;
    if (field === 'onHand') updatePayload.quantity_on_hand = toNumber(value);
    if (field === 'reorderLevel') updatePayload.reorder_level = toNumber(value);

    const { error } = await supabase.from('inventory_items').update(updatePayload).eq('id', grain.id);
    if (error) console.error('Ingredient inventory update failed:', error.message);
  };

  const addGrain = async () => {
    const { error } = await supabase.from('inventory_items').insert({
      item_name: 'New Ingredient',
      item_type: 'ingredient',
      unit: 'kg',
      quantity_on_hand: 0,
      reorder_level: 0,
    });

    if (error) console.error('Add ingredient failed:', error.message);
  };

  const removeGrain = async (idx) => {
    const grain = inv.grains[idx];
    if (!grain?.id) return;

    const { error } = await supabase.from('inventory_items').delete().eq('id', grain.id);
    if (error) console.error('Delete ingredient failed:', error.message);
  };

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
                onChange={(e) => setInventory(field, e.target.value)}
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
            <Plus className="w-4 h-4 mr-2" />Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-500 mb-4">
            This inventory is linked to Recipes, Planning, Dashboard, and automatic consumption tracking.
          </div>
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
                  <TableRow key={g.id || idx}>
                    <TableCell>
                      <Input
                        defaultValue={g.name}
                        onBlur={(e) => updateGrain(idx, 'name', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={g.unit}
                        onBlur={(e) => updateGrain(idx, 'unit', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={g.onHand}
                        onBlur={(e) => updateGrain(idx, 'onHand', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        defaultValue={g.reorderLevel}
                        onBlur={(e) => updateGrain(idx, 'reorderLevel', e.target.value)}
                      />
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
  );
}

function RecipesTab({ data, setData }) {
  const unitOptions = ['kg', 'g', 'L', 'ml', 'lb', 'oz', 'cups', 'units'];

  const updateRecipe = (recipeId, updater) => {
    setData((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) => (r.id === recipeId ? updater(r) : r)),
    }));
  };

  const addIngredient = (recipeId) => {
    updateRecipe(recipeId, (recipe) => ({
      ...recipe,
      ingredients: [...recipe.ingredients, { id: uid(), itemName: '', qty: 0, unit: 'kg' }],
    }));
  };

  const removeIngredient = (recipeId, ingredientId) => {
    updateRecipe(recipeId, (recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.filter((i) => i.id !== ingredientId),
    }));
  };

  const allInventoryItems = data.inventory.grains.map((g) => g.name).filter(Boolean);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Recipe Master"
        subtitle="Separate recipe page linked to inventory, planning, and future automatic ingredient deduction"
      />
      <Card className="rounded-2xl">
        <CardContent className="p-4 text-sm text-slate-600">
          Use this page to define exactly what goes into one batch of each batter. The units are flexible.
        </CardContent>
      </Card>
      {data.recipes.map((recipe) => (
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
                <Plus className="w-4 h-4 mr-2" />Add Ingredient
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
                    const matched = data.inventory.grains.find(
                      (g) => g.name.toLowerCase() === (ingredient.itemName || '').toLowerCase()
                    );
                    return (
                      <TableRow key={ingredient.id}>
                        <TableCell>
                          <Input
                            list={`ingredients-${recipe.id}`}
                            value={ingredient.itemName}
                            onChange={(e) =>
                              updateRecipe(recipe.id, (r) => ({
                                ...r,
                                ingredients: r.ingredients.map((i) =>
                                  i.id === ingredient.id ? { ...i, itemName: e.target.value } : i
                                ),
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
                                ingredients: r.ingredients.map((i) =>
                                  i.id === ingredient.id ? { ...i, qty: toNumber(e.target.value) } : i
                                ),
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
                                ingredients: r.ingredients.map((i) =>
                                  i.id === ingredient.id ? { ...i, unit: value } : i
                                ),
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrdersAndPlanning({ data, setData, selectedDayId, setSelectedDayId }) {
  const selectedDay = data.productionDays.find((d) => d.id === selectedDayId) || null;

  const addDay = () => {
    const newDay = createProductionDay(data.company);
    setData((prev) => ({ ...prev, productionDays: [newDay, ...prev.productionDays] }));
    setSelectedDayId(newDay.id);
  };

  const removeDay = (id) => {
    const remaining = data.productionDays.filter((d) => d.id !== id);
    setData((prev) => ({ ...prev, productionDays: remaining }));
    setSelectedDayId(remaining[0]?.id || null);
  };

  const updateDay = (updater) => {
    setData((prev) => ({
      ...prev,
      productionDays: prev.productionDays.map((day) => (day.id === selectedDayId ? updater(day) : day)),
    }));
  };

  const totals = useMemo(() => {
    if (!selectedDay) return null;
    const total30 = selectedDay.orders.reduce((a, o) => a + toNumber(o.order30), 0);
    const total60 = selectedDay.orders.reduce((a, o) => a + toNumber(o.order60), 0);
    const liters = selectedDay.orders.reduce((a, o) => a + litersFromOrders(toNumber(o.order30), toNumber(o.order60)), 0);
    const batches = Math.ceil(liters / data.company.litersPerBatch);
    const roundCapacity = data.company.grinders * data.company.litersPerBatch;
    const roundsNeeded = Math.ceil(liters / roundCapacity);
    return {
      total30,
      total60,
      liters: liters.toFixed(1),
      batches,
      roundsNeeded,
      cases30: casesNeeded(total30, data.company.casePack30),
      cases60: casesNeeded(total60, data.company.casePack60),
    };
  }, [selectedDay, data.company]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={addDay} className="rounded-2xl">
          <Plus className="w-4 h-4 mr-2" />New Production Day
        </Button>
        <div className="flex flex-wrap gap-2">
          {data.productionDays.map((day) => (
            <Button
              key={day.id}
              variant={selectedDayId === day.id ? 'default' : 'outline'}
              className="rounded-2xl"
              onClick={() => setSelectedDayId(day.id)}
            >
              {day.date}
            </Button>
          ))}
        </div>
      </div>

      {!selectedDay ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-slate-500">Create a production day to begin planning.</CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Production Day Plan</CardTitle>
              <div className="flex items-center gap-2">
                <Input type="date" value={selectedDay.date} onChange={(e) => updateDay((day) => ({ ...day, date: e.target.value }))} className="w-[180px]" />
                <Button variant="destructive" onClick={() => removeDay(selectedDay.id)}>Delete Day</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-4 gap-4">
                <MetricCard title="30 oz Orders" value={totals?.total30 || 0} icon={Boxes} />
                <MetricCard title="60 oz Orders" value={totals?.total60 || 0} icon={Boxes} />
                <MetricCard title="Estimated Liters" value={totals?.liters || 0} subtitle="Based on order size mix" icon={Droplets} />
                <MetricCard title="Rounds Needed" value={totals?.roundsNeeded || 0} subtitle={`~${totals?.batches || 0} grinder batches`} icon={Clock} />
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <MetricCard title="30 oz Cases Needed" value={totals?.cases30 || 0} icon={Package} />
                <MetricCard title="60 oz Cases Needed" value={totals?.cases60 || 0} icon={Package} />
                <MetricCard title="30 oz Container Gap" value={(totals?.total30 || 0) - toNumber(data.inventory.containers30)} subtitle="Positive means shortage" icon={Boxes} />
                <MetricCard title="60 oz Container Gap" value={(totals?.total60 || 0) - toNumber(data.inventory.containers60)} subtitle="Positive means shortage" icon={Boxes} />
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Code</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>30 oz Orders</TableHead>
                      <TableHead>60 oz Orders</TableHead>
                      <TableHead>Actual 30 oz</TableHead>
                      <TableHead>Actual 60 oz</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDay.orders.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.productCode}</TableCell>
                        <TableCell>{row.productName}</TableCell>
                        <TableCell><Input type="number" value={row.order30} onChange={(e) => updateDay((day) => ({ ...day, orders: day.orders.map((o) => (o.id === row.id ? { ...o, order30: toNumber(e.target.value) } : o)) }))} /></TableCell>
                        <TableCell><Input type="number" value={row.order60} onChange={(e) => updateDay((day) => ({ ...day, orders: day.orders.map((o) => (o.id === row.id ? { ...o, order60: toNumber(e.target.value) } : o)) }))} /></TableCell>
                        <TableCell><Input type="number" value={row.actual30} onChange={(e) => updateDay((day) => ({ ...day, orders: day.orders.map((o) => (o.id === row.id ? { ...o, actual30: toNumber(e.target.value) } : o)) }))} /></TableCell>
                        <TableCell><Input type="number" value={row.actual60} onChange={(e) => updateDay((day) => ({ ...day, orders: day.orders.map((o) => (o.id === row.id ? { ...o, actual60: toNumber(e.target.value) } : o)) }))} /></TableCell>
                        <TableCell><Input value={row.notes} onChange={(e) => updateDay((day) => ({ ...day, orders: day.orders.map((o) => (o.id === row.id ? { ...o, notes: e.target.value } : o)) }))} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Pre-Production Soak & Readiness Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-5 gap-4">
                {[
                  ['done', 'Soak plan completed'],
                  ['roWaterReady', 'RO water ready'],
                  ['containersReady', 'Containers ready in garage'],
                  ['casesReady', 'Cardboard cases ready'],
                  ['grainsWashed3Times', 'Grains washed 3 times'],
                ].map(([field, label]) => (
                  <div key={field} className="flex items-center gap-2 rounded-2xl border p-4">
                    <Checkbox
                      checked={!!selectedDay.soakPlan[field]}
                      onCheckedChange={(checked) =>
                        updateDay((day) => ({
                          ...day,
                          soakPlan: { ...day.soakPlan, [field]: !!checked },
                        }))
                      }
                    />
                    <Label>{label}</Label>
                  </div>
                ))}
              </div>
              <div>
                <Label>Soak / planning notes</Label>
                <Textarea
                  value={selectedDay.soakPlan.notes}
                  onChange={(e) => updateDay((day) => ({ ...day, soakPlan: { ...day.soakPlan, notes: e.target.value } }))}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PhotoInput({ photos = [], onChange }) {
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    const converted = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ id: uid(), name: file.name, dataUrl: reader.result });
            reader.readAsDataURL(file);
          })
      )
    );
    onChange([...(photos || []), ...converted]);
  };

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
              <button className="absolute top-2 right-2 bg-white/90 rounded-full p-1" onClick={() => onChange(photos.filter((x) => x.id !== p.id))}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductionTab({ data, setData, selectedDayId }) {
  const selectedDay = data.productionDays.find((d) => d.id === selectedDayId) || null;

  const updateDay = (updater) => {
    setData((prev) => ({
      ...prev,
      productionDays: prev.productionDays.map((day) => (day.id === selectedDayId ? updater(day) : day)),
    }));
  };

  if (!selectedDay) {
    return <Card className="rounded-2xl"><CardContent className="p-6 text-slate-500">Create or select a production day first.</CardContent></Card>;
  }

  const addRound = () => {
    updateDay((day) => ({
      ...day,
      rounds: [
        ...day.rounds,
        {
          id: uid(),
          roundNo: day.rounds.length + 1,
          grinders: Array.from({ length: data.company.grinders }).map((__, gi) => ({
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
            expectedYieldLiters: data.company.litersPerBatch,
            actualYieldLiters: '',
            wastageLiters: '',
            photos: [],
          })),
        },
      ],
    }));
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Daily Production Log" subtitle="Standard format for rounds, batch timing, water and ice additions, transfer timing, QC, and photos" action={<Button onClick={addRound}><Plus className="w-4 h-4 mr-2" />Add Round</Button>} />
      {selectedDay.rounds.map((round) => (
        <Card key={round.id} className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Round {round.roundNo}</span>
              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{data.company.grinders} grinders</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              {round.grinders.map((grinder) => (
                <div key={grinder.id} className="rounded-2xl border p-4 space-y-4">
                  <div className="text-base font-semibold">Grinder {grinder.grinderNo}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Product</Label>
                      <Select
                        value={grinder.productCode || 'none'}
                        onValueChange={(value) => {
                          const product = PRODUCTS.find((p) => p.code === value);
                          updateDay((day) => ({
                            ...day,
                            rounds: day.rounds.map((r) =>
                              r.id === round.id
                                ? {
                                    ...r,
                                    grinders: r.grinders.map((g) =>
                                      g.id === grinder.id
                                        ? { ...g, productCode: value === 'none' ? '' : value, productName: product?.name || '' }
                                        : g
                                    ),
                                  }
                                : r
                            ),
                          }));
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select</SelectItem>
                          {PRODUCTS.map((p) => <SelectItem key={p.code} value={p.code}>{p.code} - {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Batch Label</Label>
                      <Input
                        value={grinder.batchLabel}
                        onChange={(e) =>
                          updateDay((day) => ({
                            ...day,
                            rounds: day.rounds.map((r) =>
                              r.id === round.id
                                ? { ...r, grinders: r.grinders.map((g) => (g.id === grinder.id ? { ...g, batchLabel: e.target.value } : g)) }
                                : r
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={grinder.startedAt}
                        onChange={(e) =>
                          updateDay((day) => ({
                            ...day,
                            rounds: day.rounds.map((r) =>
                              r.id === round.id
                                ? {
                                    ...r,
                                    grinders: r.grinders.map((g) =>
                                      g.id === grinder.id
                                        ? { ...g, startedAt: e.target.value, endedAt: addMinutesToTime(e.target.value, 30), waterIceSteps: buildWaterIceStepsFromStart(e.target.value) }
                                        : g
                                    ),
                                  }
                                : r
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={grinder.endedAt}
                        onChange={(e) =>
                          updateDay((day) => ({
                            ...day,
                            rounds: day.rounds.map((r) =>
                              r.id === round.id
                                ? { ...r, grinders: r.grinders.map((g) => (g.id === grinder.id ? { ...g, endedAt: e.target.value } : g)) }
                                : r
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Water and Ice Addition Timeline</div>
                    <div className="space-y-2">
                      {grinder.waterIceSteps.map((step, stepIdx) => (
                        <div key={stepIdx} className="grid grid-cols-[110px_1fr] gap-2">
                          <Input
                            type="time"
                            value={step.time}
                            onChange={(e) =>
                              updateDay((day) => ({
                                ...day,
                                rounds: day.rounds.map((r) =>
                                  r.id === round.id
                                    ? {
                                        ...r,
                                        grinders: r.grinders.map((g) =>
                                          g.id === grinder.id
                                            ? { ...g, waterIceSteps: g.waterIceSteps.map((s, i) => (i === stepIdx ? { ...s, time: e.target.value } : s)) }
                                            : g
                                        ),
                                      }
                                    : r
                                ),
                              }))
                            }
                          />
                          <Input
                            value={step.action}
                            onChange={(e) =>
                              updateDay((day) => ({
                                ...day,
                                rounds: day.rounds.map((r) =>
                                  r.id === round.id
                                    ? {
                                        ...r,
                                        grinders: r.grinders.map((g) =>
                                          g.id === grinder.id
                                            ? { ...g, waterIceSteps: g.waterIceSteps.map((s, i) => (i === stepIdx ? { ...s, action: e.target.value } : s)) }
                                            : g
                                        ),
                                      }
                                    : r
                                ),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>


                  <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>QC Time</Label>
                    <Input
                      type="time"
                      value={grinder.qcTime}
                      onChange={(e) =>
                        updateDay((day) => ({
                          ...day,
                          rounds: day.rounds.map((r) =>
                            r.id === round.id
                              ? {
                                  ...r,
                                  grinders: r.grinders.map((g) =>
                                    g.id === grinder.id ? { ...g, qcTime: e.target.value } : g
                                  ),
                                }
                              : r
                          ),
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Batter Temp</Label>
                    <Input
                      value={grinder.batterTemp}
                      onChange={(e) =>
                        updateDay((day) => ({
                          ...day,
                          rounds: day.rounds.map((r) =>
                            r.id === round.id
                              ? {
                                  ...r,
                                  grinders: r.grinders.map((g) =>
                                    g.id === grinder.id ? { ...g, batterTemp: e.target.value } : g
                                  ),
                                }
                              : r
                          ),
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label>pH</Label>
                    <Input
                      value={grinder.ph}
                      onChange={(e) =>
                        updateDay((day) => ({
                          ...day,
                          rounds: day.rounds.map((r) =>
                            r.id === round.id
                              ? {
                                  ...r,
                                  grinders: r.grinders.map((g) =>
                                    g.id === grinder.id ? { ...g, ph: e.target.value } : g
                                  ),
                                }
                              : r
                          ),
                        }))
                      }
                    />
                  </div>
                </div>

                  <div>
                    <Label>QC Notes</Label>
                    <Textarea
                      value={grinder.qcNotes}
                      onChange={(e) =>
                        updateDay((day) => ({
                          ...day,
                          rounds: day.rounds.map((r) =>
                            r.id === round.id
                              ? { ...r, grinders: r.grinders.map((g) => (g.id === grinder.id ? { ...g, qcNotes: e.target.value } : g)) }
                              : r
                          ),
                        }))
                      }
                    />
                  </div>

                  <PhotoInput
                    photos={grinder.photos}
                    onChange={(photos) =>
                      updateDay((day) => ({
                        ...day,
                        rounds: day.rounds.map((r) =>
                          r.id === round.id
                            ? { ...r, grinders: r.grinders.map((g) => (g.id === grinder.id ? { ...g, photos } : g)) }
                            : r
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PackagingTab({ data, setData, selectedDayId }) {
  const selectedDay = data.productionDays.find((d) => d.id === selectedDayId) || null;

  const updateDay = (updater) => {
    setData((prev) => ({
      ...prev,
      productionDays: prev.productionDays.map((day) => (day.id === selectedDayId ? updater(day) : day)),
    }));
  };

  if (!selectedDay) {
    return <Card className="rounded-2xl"><CardContent className="p-6 text-slate-500">Create or select a production day first.</CardContent></Card>;
  }

  const packaging = selectedDay.packaging;
  const deductionPreview = buildAutoDeductionPreview(selectedDay, data.recipes, data.inventory, data.company);
  const hasActualOutput = selectedDay.orders.some(
    (o) => toNumber(o.actual30) > 0 || toNumber(o.actual60) > 0
  );
  return (
    <div className="space-y-6">
      <SectionTitle title="Packaging, Dispatch, and Production Output" subtitle="Capture actual packed units, machine issues, shortages, and packaging readiness" />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Packaging Machine and Process Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Setup Start</Label>
              <Input type="time" value={packaging.setupStart} onChange={(e) => updateDay((day) => ({ ...day, packaging: { ...day.packaging, setupStart: e.target.value } }))} />
            </div>
            <div>
              <Label>Setup End</Label>
              <Input type="time" value={packaging.setupEnd} onChange={(e) => updateDay((day) => ({ ...day, packaging: { ...day.packaging, setupEnd: e.target.value } }))} />
            </div>
          </div>

          <div>
            <Label>Machine issues / notes</Label>
            <Textarea value={packaging.machineIssues} onChange={(e) => updateDay((day) => ({ ...day, packaging: { ...day.packaging, machineIssues: e.target.value } }))} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Automatic Inventory Deduction Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border p-4">
              <div className="font-medium mb-3">Ingredient usage preview</div>
              <div className="space-y-2 text-sm">
                {Object.keys(deductionPreview.ingredientTotals).length ? (
                  Object.entries(deductionPreview.ingredientTotals).map(([name, qty]) => {
                    const matched = data.inventory.grains.find((g) => g.name === name);
                    return (
                      <div key={name} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <span>{name}</span>
                        <span>{formatQty(qty)} {matched?.unit || ''}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500">No completed batches yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="font-medium mb-3">Packaging usage preview</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span>30 oz containers</span><span>{deductionPreview.packagingTotals.containers30}</span></div>
                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span>60 oz containers</span><span>{deductionPreview.packagingTotals.containers60}</span></div>
                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span>30 oz lids</span><span>{deductionPreview.packagingTotals.lids30}</span></div>
                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span>60 oz lids</span><span>{deductionPreview.packagingTotals.lids60}</span></div>
                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span>30 oz cases</span><span>{deductionPreview.packagingTotals.cases30}</span></div>
                <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span>60 oz cases</span><span>{deductionPreview.packagingTotals.cases60}</span></div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setData((prev) => applyAutoDeductionToInventory(prev, selectedDay.id))}
              disabled={selectedDay.inventoryDeducted || !hasActualOutput}
            >
              {selectedDay.inventoryDeducted
                ? 'Inventory Already Deducted'
                : !hasActualOutput
                ? 'Enter Actual Output First'
                : 'Apply Auto Deduction'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionsTab({ data, setData, selectedDayId }) {
  const selectedDay = data.productionDays.find((d) => d.id === selectedDayId) || null;
  const relatedTransactions = selectedDay
    ? (data.inventoryTransactions || []).filter((tx) => tx.productionDayId === selectedDay.id)
    : (data.inventoryTransactions || []);

  return (
    <div className="space-y-6">
      <SectionTitle title="Inventory Transaction History" subtitle="Every automatic deduction is logged here. Undo restores the selected day's previous inventory snapshot." />
      {selectedDay ? (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Selected Day: {selectedDay.date}</CardTitle>
            <Button variant="outline" onClick={() => setData((prev) => undoAutoDeductionFromInventory(prev, selectedDay.id))} disabled={!selectedDay.inventoryDeducted}>
              Undo Deduction
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {selectedDay.inventoryDeducted
              ? 'Undo will restore inventory and delete transaction rows created by this production day.'
              : 'No deduction has been applied yet for this production day.'}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Transaction Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Production Day</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedTransactions.length ? relatedTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell>{tx.itemName}</TableCell>
                    <TableCell>{formatQty(tx.quantity)} {tx.unit}</TableCell>
                    <TableCell>{selectedDay?.date || tx.productionDayId}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-slate-500">No transactions yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardTab({ data, selectedDayId }) {
  const selectedDay = data.productionDays.find((d) => d.id === selectedDayId) || data.productionDays[0] || null;

  const recipeAlerts = useMemo(() => {
    return data.recipes.flatMap((recipe) =>
      recipe.ingredients
        .filter((i) => !data.inventory.grains.find((g) => g.name.toLowerCase() === (i.itemName || '').toLowerCase()))
        .map((i) => `${recipe.productCode}: ${i.itemName || 'Unnamed ingredient'} not linked to inventory`)
    );
  }, [data.recipes, data.inventory.grains]);

  const totals = useMemo(() => {
    if (!selectedDay) return null;
    const order30 = selectedDay.orders.reduce((a, o) => a + toNumber(o.order30), 0);
    const order60 = selectedDay.orders.reduce((a, o) => a + toNumber(o.order60), 0);
    const actual30 = selectedDay.orders.reduce((a, o) => a + toNumber(o.actual30), 0);
    const actual60 = selectedDay.orders.reduce((a, o) => a + toNumber(o.actual60), 0);
    const plannedLiters = selectedDay.orders.reduce((a, o) => a + litersFromOrders(o.order30, o.order60), 0);
    const completedQC = selectedDay.rounds.flatMap((r) => r.grinders).filter((g) => g.qcTime).length;
    const totalBatchSlots = selectedDay.rounds.flatMap((r) => r.grinders).length;
    return {
      order30,
      order60,
      actual30,
      actual60,
      plannedLiters: plannedLiters.toFixed(1),
      completedQC,
      totalBatchSlots,
    };
  }, [selectedDay]);

  return (
    <div className="space-y-6">
      {!selectedDay ? (
        <Card className="rounded-2xl"><CardContent className="p-6 text-slate-500">No production day created yet. Start with Orders & Planning.</CardContent></Card>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Selected Production Day" value={selectedDay.date} subtitle="Current working sheet" icon={FileText} />
            <MetricCard title="Planned Volume" value={`${totals?.plannedLiters || 0} L`} subtitle="Estimated from store orders" icon={Droplets} />
            <MetricCard title="QC Completed" value={`${totals?.completedQC || 0}/${totals?.totalBatchSlots || 0}`} subtitle="Batch QC records entered" icon={Thermometer} />
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
                    <div className="text-xl font-bold mt-1">{totals?.actual30 || 0} / {totals?.order30 || 0}</div>
                    <Progress className="mt-3" value={totals?.order30 ? Math.min(100, ((totals.actual30 || 0) / totals.order30) * 100) : 0} />
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-slate-500">60 oz Fulfillment</div>
                    <div className="text-xl font-bold mt-1">{totals?.actual60 || 0} / {totals?.order60 || 0}</div>
                    <Progress className="mt-3" value={totals?.order60 ? Math.min(100, ((totals.actual60 || 0) / totals.order60) * 100) : 0} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Inventory Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span>30 oz containers</span><span className="font-medium">{data.inventory.containers30}</span></div>
                <div className="flex justify-between"><span>60 oz containers</span><span className="font-medium">{data.inventory.containers60}</span></div>
                <div className="flex justify-between"><span>30 oz cases</span><span className="font-medium">{data.inventory.cases30}</span></div>
                <div className="flex justify-between"><span>60 oz cases</span><span className="font-medium">{data.inventory.cases60}</span></div>
                <div className="flex justify-between"><span>30 oz lids</span><span className="font-medium">{data.inventory.lids30}</span></div>
                <div className="flex justify-between"><span>60 oz lids</span><span className="font-medium">{data.inventory.lids60}</span></div>
                {recipeAlerts.length ? (
                  <div className="border-t pt-3">
                    <div className="font-medium mb-2">Recipe linking alerts</div>
                    <div className="space-y-2">
                      {recipeAlerts.slice(0, 5).map((alert, idx) => (
                        <div key={idx} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-700">{alert}</div>
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
  );
}

function AuthScreen() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignUp(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        role: 'worker',
      });
      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }
    }

    setMessage('Signup successful. You can now sign in.');
    setLoading(false);
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage('Signed in successfully.');
    setLoading(false);
  }

  if (session) return null;

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Batters Production LLC</h1>
      <p>Shared worker access</p>

      <div style={{ display: 'grid', gap: 24 }}>
        <form onSubmit={handleSignUp} style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid #ccc', borderRadius: 12 }}>
          <h2>Sign Up</h2>
          <input type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Create account'}</button>
        </form>

        <form onSubmit={handleSignIn} style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid #ccc', borderRadius: 12 }}>
          <h2>Sign In</h2>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Sign in'}</button>
        </form>
      </div>

      {message && <p style={{ marginTop: 20, color: '#0a5' }}>{message}</p>}
    </div>
  );
}

export default function BattersProductionApp() {
  const [session, setSession] = useState(null);
  const [data, setData] = useState(loadData);
  const [selectedDayId, setSelectedDayId] = useState(data.productionDays[0]?.id || null);

  const loadInventoryFromSupabase = useCallback(async () => {
    const { data: rows, error } = await supabase.from('inventory_items').select('*').order('item_name', { ascending: true });
    if (error) {
      console.error('Inventory load failed:', error.message);
      return;
    }
    const mappedInventory = mapSupabaseInventoryToAppInventory(rows);
    setData((prev) => ({ ...prev, inventory: mappedInventory }));
  }, []);

  useRealtimeInventory(() => {
    if (session) loadInventoryFromSupabase();
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: authData }) => setSession(authData.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadInventoryFromSupabase();
  }, [session, loadInventoryFromSupabase]);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (!selectedDayId && data.productionDays[0]?.id) setSelectedDayId(data.productionDays[0].id);
  }, [data.productionDays, selectedDayId]);

  const selectedDay = data.productionDays.find((d) => d.id === selectedDayId) || null;

  const handleExport = () => {
    exportJson(data);
    if (selectedDay) {
      const rows = selectedDay.orders.map((o) => ({
        date: selectedDay.date,
        product_code: o.productCode,
        product_name: o.productName,
        ordered_30_oz: o.order30,
        ordered_60_oz: o.order60,
        actual_30_oz: o.actual30,
        actual_60_oz: o.actual60,
        note: o.notes,
      }));
      exportCsv(rows, `production-orders-${selectedDay.date}.csv`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (!session) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader companyName={data.company.name} onExport={handleExport} onSignOut={handleSignOut} userEmail={session.user.email} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-2 rounded-2xl bg-white p-2 border w-full justify-start overflow-x-auto">
            <TabsTrigger value="dashboard" className="rounded-xl">Dashboard</TabsTrigger>
            <TabsTrigger value="planning" className="rounded-xl">Orders & Planning</TabsTrigger>
            <TabsTrigger value="production" className="rounded-xl">Production Log</TabsTrigger>
            <TabsTrigger value="packaging" className="rounded-xl">Packaging & Output</TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-xl">Inventory</TabsTrigger>
            <TabsTrigger value="recipes" className="rounded-xl">Recipes</TabsTrigger>
            <TabsTrigger value="transactions" className="rounded-xl">Transactions</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab data={data} selectedDayId={selectedDayId} /></TabsContent>
          <TabsContent value="planning"><OrdersAndPlanning data={data} setData={setData} selectedDayId={selectedDayId} setSelectedDayId={setSelectedDayId} /></TabsContent>
          <TabsContent value="production"><ProductionTab data={data} setData={setData} selectedDayId={selectedDayId} /></TabsContent>
          <TabsContent value="packaging"><PackagingTab data={data} setData={setData} selectedDayId={selectedDayId} /></TabsContent>
          <TabsContent value="inventory"><InventoryTab data={data} setData={setData} /></TabsContent>
          <TabsContent value="recipes"><RecipesTab data={data} setData={setData} /></TabsContent>
          <TabsContent value="transactions"><TransactionsTab data={data} setData={setData} selectedDayId={selectedDayId} /></TabsContent>
          <TabsContent value="settings"><CompanySettings data={data} setData={setData} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}