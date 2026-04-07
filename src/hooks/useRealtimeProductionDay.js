import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useRealtimeProductionDay(productionDayId, onChange) {
  useEffect(() => {
    if (!productionDayId) return

    const channel = supabase
      .channel(`production-day-${productionDayId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_days', filter: `id=eq.${productionDayId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_orders', filter: `production_day_id=eq.${productionDayId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grinder_batches' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_ice_logs' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packaging_logs', filter: `production_day_id=eq.${productionDayId}` }, onChange)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [productionDayId, onChange])
}