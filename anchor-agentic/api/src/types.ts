import type { SupabaseClient } from '@supabase/supabase-js'

export type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ALLOWED_ORIGIN: string
}

export type Variables = {
  requestId: string
  supabase: SupabaseClient
  userId: string | null
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
