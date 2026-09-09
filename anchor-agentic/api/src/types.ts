import type { SupabaseClient } from '@supabase/supabase-js'

export type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ALLOWED_ORIGIN: string
  GITHUB_OAUTH_CLIENT_ID: string
  GITHUB_OAUTH_CLIENT_SECRET: string
  GITHUB_OAUTH_REDIRECT_URI: string
  GITHUB_TOKEN_ENCRYPTION_KEY: string
  WORKER_SIGNING_SECRET: string
  EXPORT_BUCKET?: R2Bucket
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
