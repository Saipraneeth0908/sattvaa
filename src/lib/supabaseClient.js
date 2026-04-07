import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
let hostname = ''
try {
  hostname = supabaseUrl ? new URL(supabaseUrl).hostname : ''
} catch {
  hostname = ''
}
const isLocalSupabaseHost = ['127.0.0.1', 'localhost'].includes(hostname)

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.'
    : isLocalSupabaseHost && typeof window !== 'undefined' && window.location.hostname !== hostname
      ? 'This deployment is pointing to a local Supabase URL. Use a hosted Supabase project URL for Vercel.'
    : !/^https?:\/\//i.test(supabaseUrl)
      ? 'VITE_SUPABASE_URL is not a valid URL.'
      : ''

export const supabase = supabaseConfigError ? null : createClient(supabaseUrl, supabaseAnonKey)
