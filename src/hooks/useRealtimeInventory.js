import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useRealtimeInventory(onChange) {
  useEffect(() => {
    const channel = supabase
      .channel('inventory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transactions' }, onChange)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onChange])
}