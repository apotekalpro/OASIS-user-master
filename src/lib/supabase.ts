import { createClient } from '@supabase/supabase-js'

export interface SupabaseEnv {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_KEY: string
}

// Client for public operations (login, password change)
export function getSupabaseClient(env: SupabaseEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
}

// Admin client for creating users, managing auth
export function getSupabaseAdmin(env: SupabaseEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Employee interface matching Google Sheet structure
export interface Employee {
  employee_id: string     // Column B (Login user)
  name: string            // Column A
  position: string        // Column C
  email: string           // Column D
  phone?: string          // Column E
  outlet: string          // Column F
  is_active: boolean
  is_superadmin: boolean  // Superadmin flag for special access
  auth_user_id?: string
  created_at?: string
  updated_at?: string
}
