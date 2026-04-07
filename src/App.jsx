import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Download, Factory, CalendarDays, LogOut, ClipboardList, Archive, Sparkles } from 'lucide-react'

const PRODUCT_SEED = [
  { code: 'RAGI', name: 'Ragi Millet Batter' },
  { code: 'RB', name: 'Regular Millet Batter' },
  { code: 'LMB', name: 'Little Millet Batter' },
  { code: 'KMB', name: 'Kodo Millet Batter' },
  { code: 'BMB', name: 'Barnyard Millet Batter' },
]

const INVENTORY_SEED = [
  { item_name: '30 oz containers', item_type: 'packaging', unit: 'units', quantity_on_hand: 100, reorder_level: 20 },
  { item_name: '60 oz containers', item_type: 'packaging', unit: 'units', quantity_on_hand: 80, reorder_level: 15 },
  { item_name: '30 oz lids', item_type: 'packaging', unit: 'units', quantity_on_hand: 120, reorder_level: 30 },
  { item_name: '60 oz lids', item_type: 'packaging', unit: 'units', quantity_on_hand: 100, reorder_level: 25 },
  { item_name: 'Regular rice batter mix', item_type: 'raw material', unit: 'kg', quantity_on_hand: 80, reorder_level: 15 },
  { item_name: 'Barnyard millet', item_type: 'raw material', unit: 'kg', quantity_on_hand: 40, reorder_level: 8 },
  { item_name: 'Kodo millet', item_type: 'raw material', unit: 'kg', quantity_on_hand: 36, reorder_level: 8 },
  { item_name: 'Little millet', item_type: 'raw material', unit: 'kg', quantity_on_hand: 24, reorder_level: 6 },
  { item_name: 'Ragi millet', item_type: 'raw material', unit: 'kg', quantity_on_hand: 30, reorder_level: 6 },
  { item_name: 'Urad dal', item_type: 'raw material', unit: 'kg', quantity_on_hand: 22, reorder_level: 5 },
  { item_name: 'Fenugreek', item_type: 'raw material', unit: 'kg', quantity_on_hand: 12, reorder_level: 3 },
]

const COMPANY_DEFAULT = {
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
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return Number.isInteger(number) ? String(number) : number.toFixed(2)
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function StatusBadge({ status }) {
  if (status === 'completed') return <Badge variant="secondary">Completed</Badge>
  if (status === 'planned') return <Badge>Planned</Badge>
  if (status === 'in_production') return <Badge variant="default">In Production</Badge>
  return <Badge variant="outline">{status || 'unknown'}</Badge>
}

function AppHeader({ userEmail, onSignOut }) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3 text-2xl font-semibold text-foreground">
            <Factory className="h-6 w-6" /> Batters Production Control
          </div>
          <div className="text-sm text-muted-foreground">Professional multi-user production management with realtime Supabase sync.</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-border bg-muted px-4 py-2 text-sm text-foreground">{userEmail}</div>
          <Button variant="outline" onClick={onSignOut} className="whitespace-nowrap">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, subtitle, icon: Icon }) {
  return (
    <Card className="rounded-3xl border border-border shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-muted-foreground">{title}</div>
            <div className="mt-3 text-3xl font-semibold text-foreground">{value}</div>
            {subtitle ? <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div> : null}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-muted">
            <Icon className="h-6 w-6 text-foreground/70" />
          </div>
        </div>
      </CardContent>
    </Card>
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

  const [inventory, setInventory] = useState([])
  const [productionDays, setProductionDays] = useState([])
  const [transactions, setTransactions] = useState([])
  const [products, setProducts] = useState([])
  const [selectedDayId, setSelectedDayId] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [newItem, setNewItem] = useState({
    item_name: '',
    item_type: 'raw material',
    unit: 'kg',
    quantity_on_hand: '0',
    reorder_level: '0',
  })

  const [pendingQuantities, setPendingQuantities] = useState({})
  const [pendingOrderInputs, setPendingOrderInputs] = useState({})

  const selectedDay = useMemo(
    () => productionDays.find((day) => day.id === selectedDayId) || productionDays[0] || null,
    [productionDays, selectedDayId]
  )

  const lowStockCount = useMemo(
    () => inventory.filter((item) => toNumber(item.quantity_on_hand) <= toNumber(item.reorder_level)).length,
    [inventory]
  )

  const activeProductionDays = useMemo(
    () => productionDays.filter((day) => day.status !== 'completed').length,
    [productionDays]
  )

  const inventoryTotal = useMemo(
    () => inventory.reduce((sum, item) => sum + toNumber(item.quantity_on_hand), 0),
    [inventory]
  )

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true })
    if (error) {
      setError(error.message)
      return []
    }
    if (data?.length) {
      setProducts(data)
      return data
    }
    const seed = PRODUCT_SEED.map((product) => ({ code: product.code, name: product.name, active: true }))
    const { error: seedError } = await supabase.from('products').upsert(seed, { onConflict: 'code' })
    if (seedError) {
      setError(seedError.message)
      return []
    }
    const { data: seededProducts, error: seededError } = await supabase.from('products').select('*').order('name', { ascending: true })
    if (seededError) {
      setError(seededError.message)
      return []
    }
    setProducts(seededProducts || [])
    return seededProducts || []
  }, [])

  const fetchInventory = useCallback(async () => {
    const { data, error } = await supabase.from('inventory_items').select('*').order('item_name', { ascending: true })
    if (error) {
      setError(error.message)
      setInventory([])
      return []
    }
    setInventory(data || [])
    return data || []
  }, [])

  const fetchProductionDays = useCallback(async () => {
    const { data, error } = await supabase
      .from('production_days')
      .select('*, day_orders(*)')
      .order('production_date', { ascending: false })
    if (error) {
      setError(error.message)
      setProductionDays([])
      return []
    }
    setProductionDays(data || [])
    return data || []
  }, [])

  const fetchTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      setError(error.message)
      setTransactions([])
      return []
    }
    setTransactions(data || [])
    return data || []
  }, [])

  const seedInventory = useCallback(async () => {
    const { data } = await supabase.from('inventory_items').select('id').limit(1)
    if (!data?.length) {
      await supabase.from('inventory_items').insert(INVENTORY_SEED)
    }
  }, [])

  const loadAppData = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError('')
    await fetchProducts()
    await seedInventory()
    await Promise.all([fetchInventory(), fetchProductionDays(), fetchTransactions()])
    setLoading(false)
  }, [fetchInventory, fetchProducts, fetchProductionDays, fetchTransactions, seedInventory, session])

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
      if (event === 'SIGNED_IN' && session?.user) {
        createProfile(session.user)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const createProfile = useCallback(async (currentUser) => {
    if (!currentUser?.id) return
    await supabase.from('profiles').upsert({ id: currentUser.id, full_name: currentUser.email, role: 'worker' }, { onConflict: 'id' })
  }, [])

  useEffect(() => {
    loadAppData()
  }, [loadAppData])

  useEffect(() => {
    if (!selectedDay && productionDays[0]?.id) {
      setSelectedDayId(productionDays[0].id)
    }
  }, [productionDays, selectedDay])

  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel('production-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => fetchInventory())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_days' }, () => fetchProductionDays())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_orders' }, () => fetchProductionDays())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transactions' }, () => fetchTransactions())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInventory, fetchProductionDays, fetchTransactions, session])

  const logInventoryTransaction = useCallback(
    async ({ transaction_type, inventory_item_id, item_name, quantity, unit, notes }) => {
      if (!session?.user?.id) return
      await supabase.from('inventory_transactions').insert({
        inventory_item_id,
        transaction_type,
        item_name,
        quantity: toNumber(quantity),
        unit,
        notes,
        created_by: session.user.id,
      })
    },
    [session]
  )

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
      if (data?.session) {
        setSession(data.session)
        setUser(data.user ?? null)
      }
      return
    }

    const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword })
    setAuthLoading(false)
    if (error) {
      setAuthMessage(error.message)
      return
    }
    setAuthMessage('Registration successful. Confirm your email and then login.')
    if (data?.user) {
      await createProfile(data.user)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
  }

  const handleAddItem = async () => {
    if (!newItem.item_name.trim()) {
      setError('Item name is required.')
      return
    }
    setError('')
    const payload = {
      item_name: newItem.item_name.trim(),
      item_type: newItem.item_type,
      unit: newItem.unit,
      quantity_on_hand: toNumber(newItem.quantity_on_hand),
      reorder_level: toNumber(newItem.reorder_level),
      active: true,
    }
    const { data, error } = await supabase.from('inventory_items').insert(payload).select().single()
    if (error) {
      setError(error.message)
      return
    }
    await logInventoryTransaction({
      transaction_type: 'stock_added',
      inventory_item_id: data.id,
      item_name: data.item_name,
      quantity: data.quantity_on_hand,
      unit: data.unit,
      notes: 'Initial stock added',
    })
    setNewItem({ item_name: '', item_type: 'raw material', unit: 'kg', quantity_on_hand: '0', reorder_level: '0' })
    await fetchInventory()
  }

  const handleSaveQuantity = async (item) => {
    const pending = pendingQuantities[item.id]
    if (pending == null) return
    const quantity = toNumber(pending)
    const { error } = await supabase.from('inventory_items').update({ quantity_on_hand: quantity }).eq('id', item.id)
    if (error) {
      setError(error.message)
      return
    }
    await logInventoryTransaction({
      transaction_type: 'quantity_adjusted',
      inventory_item_id: item.id,
      item_name: item.item_name,
      quantity: quantity - toNumber(item.quantity_on_hand),
      unit: item.unit,
      notes: 'Manual stock adjustment',
    })
    setPendingQuantities((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    await fetchInventory()
  }

  const createProductionDay = async () => {
    setError('')
    const today = new Date().toISOString().slice(0, 10)
    const { data: existingDay, error: existingError } = await supabase.from('production_days').select('*').eq('production_date', today).maybeSingle()
    if (existingError) {
      setError(existingError.message)
      return
    }
    if (existingDay) {
      setSelectedDayId(existingDay.id)
      setActiveTab('orders')
      return
    }

    const { data: newDay, error: dayError } = await supabase
      .from('production_days')
      .insert({ production_date: today, status: 'planned' })
      .select()
      .single()
    if (dayError) {
      setError(dayError.message)
      return
    }

    const orderRows = (products.length ? products : PRODUCT_SEED).map((product) => ({
      production_day_id: newDay.id,
      product_id: product.id,
      order_30_oz: 0,
      order_60_oz: 0,
      actual_30_oz: 0,
      actual_60_oz: 0,
      notes: '',
    }))

    const { error: orderError } = await supabase.from('day_orders').insert(orderRows)
    if (orderError) {
      setError(orderError.message)
      return
    }

    await fetchProductionDays()
    setSelectedDayId(newDay.id)
    setActiveTab('orders')
  }

  const updateOrder = async (orderId, field, value) => {
    const payload = { [field]: field.includes('30') || field.includes('60') ? toNumber(value) : value }
    const { error } = await supabase.from('day_orders').update(payload).eq('id', orderId)
    if (error) {
      setError(error.message)
      return
    }
    await fetchProductionDays()
  }

  const productionMetrics = useMemo(() => {
    if (!selectedDay) return null
    const total30 = selectedDay.day_orders?.reduce((sum, order) => sum + toNumber(order.order_30_oz), 0) || 0
    const total60 = selectedDay.day_orders?.reduce((sum, order) => sum + toNumber(order.order_60_oz), 0) || 0
    const liters = total30 * 0.887205 + total60 * 1.77441
    const batches = Math.ceil(liters / COMPANY_DEFAULT.litersPerBatch)
    return { total30, total60, liters: formatNumber(liters), batches }
  }, [selectedDay])

  if (!session) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 rounded-3xl border border-border bg-muted p-5 text-center">
            <div className="flex items-center justify-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Production Access
            </div>
          </div>
          <div className="mb-8 space-y-4 text-center">
            <h1 className="text-4xl font-semibold">Login or Register</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Use a secure email/password account to sign in. Once authenticated, your team can manage inventory, production days, and realtime orders in Supabase.
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
            <Button type="submit" disabled={authLoading}>{authLoading ? (authMode === 'login' ? 'Signing in…' : 'Registering…') : authMode === 'login' ? 'Login' : 'Register'}</Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader userEmail={user?.email || 'Unknown user'} onSignOut={signOut} />
      <div className="mx-auto max-w-7xl px-4 py-6">
        {error ? (
          <div className="mb-6 rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        ) : null}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-2 rounded-3xl border border-border bg-white p-2 shadow-sm">
            <TabsTrigger value="dashboard" className="rounded-2xl">Dashboard</TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-2xl">Inventory</TabsTrigger>
            <TabsTrigger value="orders" className="rounded-2xl">Orders</TabsTrigger>
            <TabsTrigger value="production" className="rounded-2xl">Production</TabsTrigger>
            <TabsTrigger value="transactions" className="rounded-2xl">Transactions</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-2xl">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard title="Inventory items" value={inventory.length} subtitle="Live stock list" icon={Archive} />
                  <MetricCard title="Low stock items" value={lowStockCount} subtitle="Reorder alerts" icon={ClipboardList} />
                  <MetricCard title="Active days" value={activeProductionDays} subtitle="Production plans" icon={CalendarDays} />
                </div>
                <Card className="rounded-3xl border border-border shadow-sm">
                  <CardHeader>
                    <CardTitle>Today’s status</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-border bg-muted p-4">
                      <div className="text-sm text-muted-foreground">Total stock units</div>
                      <div className="mt-3 text-3xl font-semibold">{formatNumber(inventoryTotal)}</div>
                    </div>
                    <div className="rounded-3xl border border-border bg-muted p-4">
                      <div className="text-sm text-muted-foreground">Latest production day</div>
                      <div className="mt-3 text-3xl font-semibold">{selectedDay ? formatDate(selectedDay.production_date) : 'No day yet'}</div>
                    </div>
                    <div className="rounded-3xl border border-border bg-muted p-4">
                      <div className="text-sm text-muted-foreground">Realtime sync</div>
                      <div className="mt-3 text-3xl font-semibold">Connected</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Card className="rounded-3xl border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-border bg-muted p-4">
                    <div className="text-sm text-muted-foreground">Create a live production day for your team to update orders and status in realtime.</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button onClick={() => { setActiveTab('orders'); createProductionDay() }}>
                      <Plus className="mr-2 h-4 w-4" /> Create today’s production day
                    </Button>
                    <Button variant="outline" onClick={loadAppData}>
                      <Download className="mr-2 h-4 w-4" /> Refresh all data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <div className="grid gap-6 xl:grid-cols-[2fr_0.9fr]">
              <Card className="rounded-3xl border border-border shadow-sm">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Inventory management</CardTitle>
                    <p className="text-sm text-muted-foreground">Edit stock, track low inventory, and keep the ledger in Supabase.</p>
                  </div>
                  <Badge variant="default">{inventory.length} items</Badge>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="min-w-full">
                      <TableHead>
                        <TableRow>
                          <TableHeader>Name</TableHeader>
                          <TableHeader>Type</TableHeader>
                          <TableHeader>Unit</TableHeader>
                          <TableHeader>Quantity</TableHeader>
                          <TableHeader>Reorder</TableHeader>
                          <TableHeader>Status</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inventory.map((item) => {
                          const pending = pendingQuantities[item.id] ?? formatNumber(item.quantity_on_hand)
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="max-w-[220px] truncate text-sm font-medium text-foreground">{item.item_name}</TableCell>
                              <TableCell>{item.item_type}</TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={pending}
                                    className="w-24"
                                    onChange={(event) => setPendingQuantities((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                    onBlur={() => handleSaveQuantity(item)}
                                    onKeyDown={(event) => event.key === 'Enter' && handleSaveQuantity(item)}
                                  />
                                  <Button variant="outline" size="icon" onClick={() => handleSaveQuantity(item)}>Save</Button>
                                </div>
                              </TableCell>
                              <TableCell>{formatNumber(item.reorder_level)}</TableCell>
                              <TableCell>
                                {toNumber(item.quantity_on_hand) <= toNumber(item.reorder_level) ? (
                                  <Badge variant="destructive">Low stock</Badge>
                                ) : (
                                  <Badge variant="secondary">Healthy</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {!inventory.length && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                              No inventory items available. Add a new item to get started.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Add inventory item</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="item-name">Item name</Label>
                    <Input id="item-name" value={newItem.item_name} onChange={(event) => setNewItem((prev) => ({ ...prev, item_name: event.target.value }))} placeholder="Regular batter mix" />
                  </div>
                  <div>
                    <Label htmlFor="item-type">Item type</Label>
                    <Input id="item-type" value={newItem.item_type} onChange={(event) => setNewItem((prev) => ({ ...prev, item_type: event.target.value }))} placeholder="raw material" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="unit">Unit</Label>
                      <Input id="unit" value={newItem.unit} onChange={(event) => setNewItem((prev) => ({ ...prev, unit: event.target.value }))} placeholder="kg" />
                    </div>
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input id="quantity" type="number" min="0" step="0.01" value={newItem.quantity_on_hand} onChange={(event) => setNewItem((prev) => ({ ...prev, quantity_on_hand: event.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reorder-level">Reorder level</Label>
                    <Input id="reorder-level" type="number" min="0" step="0.01" value={newItem.reorder_level} onChange={(event) => setNewItem((prev) => ({ ...prev, reorder_level: event.target.value }))} />
                  </div>
                  <Button onClick={handleAddItem}>
                    <Plus className="mr-2 h-4 w-4" /> Add item
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="space-y-6">
              <Card className="rounded-3xl border border-border shadow-sm">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Orders & Planning</CardTitle>
                    <p className="text-sm text-muted-foreground">Create production days and manage batch orders with realtime sharing.</p>
                  </div>
                  <Button onClick={createProductionDay}>
                    <Plus className="mr-2 h-4 w-4" /> New production day
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-[280px_1fr]">
                    <div className="space-y-3 rounded-3xl border border-border bg-muted p-4">
                      <div className="text-sm text-muted-foreground">Production days</div>
                      {productionDays.map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => setSelectedDayId(day.id)}
                          className={`block w-full rounded-2xl px-4 py-3 text-left text-sm transition ${selectedDay?.id === day.id ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}
                        >
                          <div className="font-medium">{formatDate(day.production_date)}</div>
                          <div className="text-xs text-muted-foreground">{day.status}</div>
                        </button>
                      ))}
                      {!productionDays.length && <div className="text-sm text-muted-foreground">Create a production day to begin orders.</div>}
                    </div>
                    <div className="rounded-3xl border border-border bg-background p-4">
                      {selectedDay ? (
                        <>
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground">Selected date</div>
                              <div className="mt-2 text-lg font-semibold">{formatDate(selectedDay.production_date)}</div>
                            </div>
                            <StatusBadge status={selectedDay.status} />
                          </div>
                          <div className="mt-6 overflow-x-auto">
                            <Table className="min-w-full">
                              <TableHead>
                                <TableRow>
                                  <TableHeader>Product</TableHeader>
                                  <TableHeader>Order 30 oz</TableHeader>
                                  <TableHeader>Order 60 oz</TableHeader>
                                  <TableHeader>Actual 30 oz</TableHeader>
                                  <TableHeader>Actual 60 oz</TableHeader>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {selectedDay.day_orders?.map((order) => (
                                  <TableRow key={order.id}>
                                    <TableCell>{products.find((p) => p.id === order.product_id)?.name ?? 'Product'}</TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={pendingOrderInputs[order.id]?.order_30_oz ?? order.order_30_oz}
                                        onChange={(event) => setPendingOrderInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], order_30_oz: event.target.value } }))}
                                        onBlur={() => updateOrder(order.id, 'order_30_oz', pendingOrderInputs[order.id]?.order_30_oz ?? order.order_30_oz)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={pendingOrderInputs[order.id]?.order_60_oz ?? order.order_60_oz}
                                        onChange={(event) => setPendingOrderInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], order_60_oz: event.target.value } }))}
                                        onBlur={() => updateOrder(order.id, 'order_60_oz', pendingOrderInputs[order.id]?.order_60_oz ?? order.order_60_oz)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={pendingOrderInputs[order.id]?.actual_30_oz ?? order.actual_30_oz}
                                        onChange={(event) => setPendingOrderInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], actual_30_oz: event.target.value } }))}
                                        onBlur={() => updateOrder(order.id, 'actual_30_oz', pendingOrderInputs[order.id]?.actual_30_oz ?? order.actual_30_oz)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={pendingOrderInputs[order.id]?.actual_60_oz ?? order.actual_60_oz}
                                        onChange={(event) => setPendingOrderInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], actual_60_oz: event.target.value } }))}
                                        onBlur={() => updateOrder(order.id, 'actual_60_oz', pendingOrderInputs[order.id]?.actual_60_oz ?? order.actual_60_oz)}
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {!selectedDay?.day_orders?.length && (
                                  <TableRow>
                                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No orders for this production day.</TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-3xl border border-border bg-muted p-6 text-sm text-muted-foreground">Select or create a production day to manage orders.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="production">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <Card className="rounded-3xl border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Production log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {productionDays.map((day) => (
                    <div key={day.id} className="rounded-3xl border border-border bg-muted p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground">{formatDate(day.production_date)}</div>
                          <div className="mt-1 text-lg font-semibold">{day.status}</div>
                        </div>
                        <StatusBadge status={day.status} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl border border-border bg-background p-3">
                          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Orders</div>
                          <div className="mt-2 text-xl font-semibold">{day.day_orders?.length || 0}</div>
                        </div>
                        <div className="rounded-3xl border border-border bg-background p-3">
                          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">30 oz total</div>
                          <div className="mt-2 text-xl font-semibold">{formatNumber(day.day_orders?.reduce((sum, order) => sum + toNumber(order.order_30_oz), 0) || 0)}</div>
                        </div>
                        <div className="rounded-3xl border border-border bg-background p-3">
                          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">60 oz total</div>
                          <div className="mt-2 text-xl font-semibold">{formatNumber(day.day_orders?.reduce((sum, order) => sum + toNumber(order.order_60_oz), 0) || 0)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!productionDays.length && (
                    <div className="rounded-3xl border border-border bg-background p-6 text-center text-sm text-muted-foreground">No production history yet. Start by creating a production day.</div>
                  )}
                </CardContent>
              </Card>
              <Card className="rounded-3xl border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Selected day summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedDay ? (
                    <div className="space-y-3">
                      <div className="rounded-3xl border border-border bg-muted p-4">
                        <div className="text-sm text-muted-foreground">Active day</div>
                        <div className="mt-2 text-lg font-semibold">{formatDate(selectedDay.production_date)}</div>
                      </div>
                      <div className="rounded-3xl border border-border bg-muted p-4">
                        <div className="text-sm text-muted-foreground">Total 30 oz</div>
                        <div className="mt-2 text-xl font-semibold">{productionMetrics?.total30 ?? 0}</div>
                      </div>
                      <div className="rounded-3xl border border-border bg-muted p-4">
                        <div className="text-sm text-muted-foreground">Total 60 oz</div>
                        <div className="mt-2 text-xl font-semibold">{productionMetrics?.total60 ?? 0}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-border bg-muted p-6 text-sm text-muted-foreground">Select a production day in the Orders tab to view its summary.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            <Card className="rounded-3xl border border-border shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Inventory transactions</CardTitle>
                  <p className="text-sm text-muted-foreground">Logged activity stored in Supabase for stock changes and updates.</p>
                </div>
                <Badge variant="secondary">{transactions.length} entries</Badge>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHead>
                    <TableRow>
                      <TableHeader>Item</TableHeader>
                      <TableHeader>Type</TableHeader>
                      <TableHeader>Qty</TableHeader>
                      <TableHeader>Unit</TableHeader>
                      <TableHeader>Notes</TableHeader>
                      <TableHeader>Date</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{tx.item_name}</TableCell>
                        <TableCell>{tx.transaction_type}</TableCell>
                        <TableCell>{formatNumber(tx.quantity)}</TableCell>
                        <TableCell>{tx.unit}</TableCell>
                        <TableCell>{tx.notes || '-'}</TableCell>
                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {!transactions.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No transaction logs yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <Card className="rounded-3xl border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Profile & settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-border bg-muted p-4">
                    <div className="text-sm text-muted-foreground">Signed in as</div>
                    <div className="mt-2 text-base font-semibold">{user?.email}</div>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted p-4">
                    <div className="text-sm text-muted-foreground">Realtime status</div>
                    <div className="mt-2 text-base font-semibold">Connected</div>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted p-4">
                    <div className="text-sm text-muted-foreground">Supabase project</div>
                    <div className="mt-2 text-base font-semibold">{import.meta.env.VITE_SUPABASE_URL || 'Not configured'}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Company overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-border bg-muted p-4">
                    <div className="text-sm text-muted-foreground">Brand</div>
                    <div className="mt-2 text-base font-semibold">{COMPANY_DEFAULT.brand}</div>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted p-4">
                    <div className="text-sm text-muted-foreground">Grinders</div>
                    <div className="mt-2 text-base font-semibold">{COMPANY_DEFAULT.grinders}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
