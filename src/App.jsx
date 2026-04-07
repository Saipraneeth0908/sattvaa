import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Download, Factory, Boxes, CheckCircle2, Package, Clock } from 'lucide-react'

const DEFAULT_PRODUCTS = [
  { code: 'RAGI', name: 'Ragi Millet Batter' },
  { code: 'RB', name: 'Regular Millet Batter' },
  { code: 'LMB', name: 'Little Millet Batter' },
  { code: 'KMB', name: 'Kodo Millet Batter' },
  { code: 'BMB', name: 'Barnyard Millet Batter' },
]

const DEFAULT_INVENTORY_SEED = [
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

const DEFAULT_COMPANY = {
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
  const [products, setProducts] = useState([])
  const [productionDays, setProductionDays] = useState([])
  const [selectedDayId, setSelectedDayId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')

  const [newItem, setNewItem] = useState({
    item_name: '',
    item_type: 'raw material',
    unit: 'kg',
    quantity_on_hand: '0',
    reorder_level: '0',
  })

  const [pendingQuantities, setPendingQuantities] = useState({})
  const [pendingOrderValues, setPendingOrderValues] = useState({})

  const selectedDay = useMemo(() => {
    return productionDays.find((day) => day.id === selectedDayId) || productionDays[0] || null
  }, [productionDays, selectedDayId])

  const productMap = useMemo(() => {
    const map = new Map()
    products.forEach((product) => map.set(product.id, product))
    return map
  }, [products])

  const lowStockCount = useMemo(
    () => inventory.filter((item) => toNumber(item.quantity_on_hand) <= toNumber(item.reorder_level)).length,
    [inventory]
  )

  const activeProductionDays = useMemo(
    () => productionDays.filter((day) => day.status !== 'completed').length,
    [productionDays]
  )

  const totalInventory = useMemo(
    () => inventory.reduce((sum, item) => sum + toNumber(item.quantity_on_hand), 0),
    [inventory]
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
      if (event === 'SIGNED_IN' && session?.user) {
        createProfile(session.user)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const createProfile = useCallback(async (user) => {
    if (!user?.id) return
    await supabase.from('profiles').upsert({ id: user.id, full_name: user.email, role: 'worker' }, { onConflict: 'id' })
  }, [])

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

    const seed = DEFAULT_PRODUCTS.map((product) => ({ code: product.code, name: product.name, active: true }))
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

  const seedInventory = useCallback(async () => {
    const { data } = await supabase.from('inventory_items').select('id').limit(1)
    if (!data?.length) {
      await supabase.from('inventory_items').insert(DEFAULT_INVENTORY_SEED)
    }
  }, [])

  const loadAppData = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError('')
    await fetchProducts()
    await seedInventory()
    await Promise.all([fetchInventory(), fetchProductionDays()])
    setLoading(false)
  }, [fetchInventory, fetchProducts, fetchProductionDays, seedInventory, session])

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
      .channel('realtime-app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        fetchInventory()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_days' }, () => {
        fetchProductionDays()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_orders' }, () => {
        fetchProductionDays()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInventory, fetchProductionDays, session])

  const signIn = async (event) => {
    event.preventDefault()
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
    setAuthMessage('')

    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
      setAuthLoading(false)
      if (error) {
        setAuthMessage(error.message)
        return
      }
      if (data?.session) {
        setSession(data.session)
        setUser(data.user ?? null)
        createProfile(data.user)
        return
      }
      setAuthMessage('Login successful. Reloading app...')
      return
    }

    const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword })
    setAuthLoading(false)
    if (error) {
      setAuthMessage(error.message)
      return
    }
    if (data?.session) {
      setSession(data.session)
      setUser(data.user ?? null)
      createProfile(data.user)
      return
    }
    setAuthMessage('Registration successful. Check your inbox to confirm your email, then log in.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
  }

  const handleAddItem = async () => {
    if (!newItem.item_name.trim()) {
      setError('Item name is required to add inventory.')
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
    const { error } = await supabase.from('inventory_items').insert(payload)
    if (error) {
      setError(error.message)
      return
    }
    setNewItem({ item_name: '', item_type: 'raw material', unit: 'kg', quantity_on_hand: '0', reorder_level: '0' })
    fetchInventory()
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
    setPendingQuantities((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    fetchInventory()
  }

  const updateOrder = async (orderId, field, value) => {
    const payload = { [field]: field.includes('30') || field.includes('60') ? toNumber(value) : value }
    const { error } = await supabase.from('day_orders').update(payload).eq('id', orderId)
    if (error) {
      setError(error.message)
      return
    }
    fetchProductionDays()
  }

  const createProductionDay = async () => {
    setError('')
    const nextDate = new Date().toISOString().slice(0, 10)
    const existing = productionDays.find((day) => day.production_date === nextDate)
    if (existing) {
      setSelectedDayId(existing.id)
      setActiveTab('orders')
      return
    }

    const { data: newDay, error: dayError } = await supabase
      .from('production_days')
      .insert({ production_date: nextDate, status: 'planned' })
      .select()
      .single()

    if (dayError) {
      setError(dayError.message)
      return
    }

    const orderRows = (products.length ? products : DEFAULT_PRODUCTS).map((product) => ({
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

    fetchProductionDays()
    setSelectedDayId(newDay.id)
    setActiveTab('orders')
  }

  const sessionExpired = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

  if (sessionExpired) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-3xl rounded-3xl border border-destructive/20 bg-card p-8 shadow-sm">
          <h1 className="text-3xl font-semibold">Supabase configuration is missing</h1>
          <p className="mt-4 text-sm text-muted-foreground">Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `web/.env` or your deployment environment.</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="space-y-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground/70">
              <Factory size={16} /> Production Control Access
            </div>
            <h1 className="text-4xl font-semibold">{authMode === 'login' ? 'Login to your account' : 'Register a new account'}</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              {authMode === 'login'
                ? 'Sign in with your email and password so your team can update inventory and production plans in real time.'
                : 'Create a new user account to collaborate with your team and manage the batter production workflow.'}
            </p>
          </div>

          <div className="flex gap-2 rounded-3xl border border-border bg-background p-1">
            <button
              type="button"
              className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium transition ${authMode === 'login' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 rounded-2xl px-4 py-2 text-sm font-medium transition ${authMode === 'register' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
          </div>

          <form className="grid gap-4" onSubmit={signIn}>
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter a strong password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </div>
            {authMode === 'register' ? (
              <div>
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter your password"
                  value={authConfirmPassword}
                  onChange={(event) => setAuthConfirmPassword(event.target.value)}
                />
              </div>
            ) : null}
            {authMessage ? (
              <div className="rounded-3xl border border-border bg-muted/70 p-4 text-sm text-foreground">{authMessage}</div>
            ) : null}
            <Button type="submit" disabled={authLoading}>
              {authLoading ? (authMode === 'login' ? 'Signing in...' : 'Registering...') : authMode === 'login' ? 'Login' : 'Register'}
            </Button>
          </form>

          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This app is built for realtime team use. Sign in to access inventory, production plans, and live sync for every user.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground/80">
                <Factory size={16} /> Production Process Control
              </div>
              <div>
                <h1 className="text-4xl font-semibold">Live Batter Production Dashboard</h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  Real-time inventory, production planning, and multi-user sync for your batter manufacturing operations.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[auto_auto]">
              <div className="rounded-3xl border border-border bg-muted/80 p-4 text-left">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Logged in as</p>
                <p className="mt-2 text-base font-medium">{user.email}</p>
              </div>
              <Button variant="outline" onClick={signOut}>Sign out</Button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-2 rounded-3xl bg-white p-2 border">
            <TabsTrigger value="dashboard" className="rounded-2xl">Dashboard</TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-2xl">Inventory</TabsTrigger>
            <TabsTrigger value="orders" className="rounded-2xl">Orders</TabsTrigger>
            <TabsTrigger value="production" className="rounded-2xl">Production</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-2xl">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
              <Card>
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <CardTitle>Dashboard</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Realtime sync enabled</Badge>
                    <Badge variant="default">{productionDays.length} production days</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-border bg-muted/80 p-4">
                      <p className="text-sm text-muted-foreground">Inventory items</p>
                      <p className="mt-3 text-3xl font-semibold">{inventory.length}</p>
                    </div>
                    <div className="rounded-3xl border border-border bg-muted/80 p-4">
                      <p className="text-sm text-muted-foreground">Low stock alerts</p>
                      <p className="mt-3 text-3xl font-semibold">{lowStockCount}</p>
                    </div>
                    <div className="rounded-3xl border border-border bg-muted/80 p-4">
                      <p className="text-sm text-muted-foreground">Active production days</p>
                      <p className="mt-3 text-3xl font-semibold">{activeProductionDays}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Total stock quantity</p>
                      <p className="mt-3 text-3xl font-semibold">{formatNumber(totalInventory)}</p>
                    </div>
                    <div className="rounded-3xl border border-border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Latest production day</p>
                      <p className="mt-3 text-2xl font-semibold">{selectedDay ? formatDate(selectedDay.production_date) : 'No production day'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader className="flex items-center justify-between gap-4">
                    <CardTitle>Realtime data sync</CardTitle>
                    <Badge variant="secondary">Live updates</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Everyone using the app sees inventory and production changes instantly.
                    </p>
                    <Button variant="outline" onClick={loadAppData}>Refresh now</Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex items-center justify-between gap-4">
                    <CardTitle>Quick actions</CardTitle>
                    <Button size="sm" onClick={createProductionDay}>
                      <Plus size={16} /> New production day
                    </Button>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="rounded-3xl border border-border bg-muted/80 p-4">
                      <p className="text-sm text-muted-foreground">Create a new day plan and add orders from the Orders tab.</p>
                    </div>
                    <div className="rounded-3xl border border-border bg-muted/80 p-4">
                      <p className="text-sm text-muted-foreground">If your team is already signed in, changes appear instantly across users.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <div className="grid gap-6 xl:grid-cols-[2.2fr_0.8fr]">
              <Card>
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Inventory</CardTitle>
                    <p className="text-sm text-muted-foreground">View and update raw materials, packaging, and batter stock.</p>
                  </div>
                  <Badge variant="default">{inventory.length} items</Badge>
                </CardHeader>
                <CardContent>
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-full">
                      <TableHead>
                        <TableRow>
                          <TableHeader>Name</TableHeader>
                          <TableHeader>Type</TableHeader>
                          <TableHeader>Unit</TableHeader>
                          <TableHeader>Quantity</TableHeader>
                          <TableHeader>Reorder</TableHeader>
                          <TableHeader>Updated</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inventory.map((item) => {
                          const currentQty = pendingQuantities[item.id] ?? formatNumber(item.quantity_on_hand)
                          const updatedAt = item.updated_at ? formatDate(item.updated_at) : '-'
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="max-w-[220px] truncate text-sm font-medium text-foreground">{item.item_name}</TableCell>
                              <TableCell>{item.item_type}</TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Input
                                    className="w-24"
                                    value={currentQty}
                                    onChange={(event) => setPendingQuantities((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                    onBlur={() => handleSaveQuantity(item)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') handleSaveQuantity(item)
                                    }}
                                  />
                                  <Button variant="outline" size="icon" onClick={() => handleSaveQuantity(item)}>
                                    Save
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>{formatNumber(item.reorder_level)}</TableCell>
                              <TableCell>{updatedAt}</TableCell>
                            </TableRow>
                          )
                        })}
                        {!inventory.length && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                              No inventory items found. Add a new item on the right.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Add inventory item</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="item-name">Item name</Label>
                      <Input id="item-name" value={newItem.item_name} onChange={(event) => setNewItem((prev) => ({ ...prev, item_name: event.target.value }))} placeholder="Regular batter mix" />
                    </div>
                    <div>
                      <Label htmlFor="item-type">Item type</Label>
                      <Input id="item-type" value={newItem.item_type} onChange={(event) => setNewItem((prev) => ({ ...prev, item_type: event.target.value }))} placeholder="raw material" />
                    </div>
                    <div>
                      <Label htmlFor="unit">Unit</Label>
                      <Input id="unit" value={newItem.unit} onChange={(event) => setNewItem((prev) => ({ ...prev, unit: event.target.value }))} placeholder="kg" />
                    </div>
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input id="quantity" type="number" min="0" step="0.01" value={newItem.quantity_on_hand} onChange={(event) => setNewItem((prev) => ({ ...prev, quantity_on_hand: event.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="reorder">Reorder level</Label>
                      <Input id="reorder" type="number" min="0" step="0.01" value={newItem.reorder_level} onChange={(event) => setNewItem((prev) => ({ ...prev, reorder_level: event.target.value }))} />
                    </div>
                    <Button type="button" onClick={handleAddItem}>
                      <Plus size={16} /> Add item
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              <Card>
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Orders & planning</CardTitle>
                    <p className="text-sm text-muted-foreground">Create production days and enter customer orders with real-time sharing.</p>
                  </div>
                  <Button variant="outline" onClick={createProductionDay}>
                    <Plus size={16} /> Create today
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[250px_1fr]">
                    <div className="space-y-3 rounded-3xl border border-border bg-muted/70 p-4">
                      <p className="text-sm text-muted-foreground">Production days</p>
                      {productionDays.map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => setSelectedDayId(day.id)}
                          className={`block w-full rounded-2xl px-3 py-2 text-left text-sm transition ${selectedDay?.id === day.id ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}
                        >
                          {formatDate(day.production_date)}
                          <div className="text-xs text-muted-foreground">{day.status}</div>
                        </button>
                      ))}
                      {!productionDays.length && <div className="text-sm text-muted-foreground">No production days yet.</div>}
                    </div>
                    <div className="rounded-3xl border border-border bg-background p-4">
                      {selectedDay ? (
                        <>
                          <p className="text-sm text-muted-foreground">Selected day</p>
                          <h2 className="mt-2 text-xl font-semibold">{formatDate(selectedDay.production_date)}</h2>
                          <p className="mt-2 text-sm text-muted-foreground">Status: {selectedDay.status}</p>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">Choose a production day to manage orders.</div>
                      )}
                    </div>
                  </div>
                  {selectedDay ? (
                    <div className="overflow-x-auto">
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
                          {selectedDay.day_orders?.map((order) => {
                            const product = productMap.get(order.product_id)
                            const name = product?.name ?? `Product ${order.product_id}`
                            return (
                              <TableRow key={order.id}>
                                <TableCell>{name}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={pendingOrderValues[order.id]?.order_30_oz ?? order.order_30_oz}
                                    onChange={(event) => setPendingOrderValues((prev) => ({
                                      ...prev,
                                      [order.id]: { ...prev[order.id], order_30_oz: event.target.value },
                                    }))}
                                    onBlur={() => updateOrder(order.id, 'order_30_oz', pendingOrderValues[order.id]?.order_30_oz ?? order.order_30_oz)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={pendingOrderValues[order.id]?.order_60_oz ?? order.order_60_oz}
                                    onChange={(event) => setPendingOrderValues((prev) => ({
                                      ...prev,
                                      [order.id]: { ...prev[order.id], order_60_oz: event.target.value },
                                    }))}
                                    onBlur={() => updateOrder(order.id, 'order_60_oz', pendingOrderValues[order.id]?.order_60_oz ?? order.order_60_oz)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={pendingOrderValues[order.id]?.actual_30_oz ?? order.actual_30_oz}
                                    onChange={(event) => setPendingOrderValues((prev) => ({
                                      ...prev,
                                      [order.id]: { ...prev[order.id], actual_30_oz: event.target.value },
                                    }))}
                                    onBlur={() => updateOrder(order.id, 'actual_30_oz', pendingOrderValues[order.id]?.actual_30_oz ?? order.actual_30_oz)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={pendingOrderValues[order.id]?.actual_60_oz ?? order.actual_60_oz}
                                    onChange={(event) => setPendingOrderValues((prev) => ({
                                      ...prev,
                                      [order.id]: { ...prev[order.id], actual_60_oz: event.target.value },
                                    }))}
                                    onBlur={() => updateOrder(order.id, 'actual_60_oz', pendingOrderValues[order.id]?.actual_60_oz ?? order.actual_60_oz)}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                          {!selectedDay.day_orders?.length && (
                            <TableRow>
                              <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                                No orders are available for this production day.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="production">
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Production log</CardTitle>
                  <p className="text-sm text-muted-foreground">Track production days and status for your team.</p>
                </div>
                <Button variant="outline" onClick={loadAppData}>
                  <Download size={16} /> Refresh data
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {productionDays.map((day) => (
                    <div key={day.id} className="rounded-3xl border border-border bg-muted/80 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{formatDate(day.production_date)}</p>
                          <p className="text-lg font-semibold">{day.status}</p>
                        </div>
                        <Badge variant={day.status === 'completed' ? 'default' : 'secondary'}>{day.status}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-2xl border border-border bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Orders</p>
                          <p className="mt-2 text-xl font-semibold">{day.day_orders?.length ?? 0}</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total 30 oz</p>
                          <p className="mt-2 text-xl font-semibold">
                            {formatNumber(day.day_orders?.reduce((sum, order) => sum + toNumber(order.order_30_oz), 0) || 0)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total 60 oz</p>
                          <p className="mt-2 text-xl font-semibold">
                            {formatNumber(day.day_orders?.reduce((sum, order) => sum + toNumber(order.order_60_oz), 0) || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!productionDays.length && (
                    <div className="rounded-3xl border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                      No production days created yet. Use the Dashboard or Orders tab to create one.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Account & settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="rounded-3xl border border-border bg-muted/80 p-4">
                      <p className="text-sm text-muted-foreground">Signed in as</p>
                      <p className="mt-2 text-base font-medium">{user.email}</p>
                    </div>
                    <div className="rounded-3xl border border-border bg-muted/80 p-4">
                      <p className="text-sm text-muted-foreground">Realtime status</p>
                      <p className="mt-2 text-base font-medium">Connected</p>
                    </div>
                    <div className="rounded-3xl border border-border bg-muted/80 p-4">
                      <p className="text-sm text-muted-foreground">Supabase project</p>
                      <p className="mt-2 text-base font-medium">{import.meta.env.VITE_SUPABASE_URL || 'Not configured'}</p>
                    </div>
                    <Button variant="destructive" onClick={signOut}>Sign out</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Company details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-border bg-muted/80 p-4">
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="mt-2 text-base font-medium">{DEFAULT_COMPANY.name}</p>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted/80 p-4">
                    <p className="text-sm text-muted-foreground">Brand</p>
                    <p className="mt-2 text-base font-medium">{DEFAULT_COMPANY.brand}</p>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted/80 p-4">
                    <p className="text-sm text-muted-foreground">Grinders</p>
                    <p className="mt-2 text-base font-medium">{DEFAULT_COMPANY.grinders}</p>
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
