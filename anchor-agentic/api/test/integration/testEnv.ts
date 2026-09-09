import type { Bindings } from '../../src/types'

export const testEnv: Bindings = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  ALLOWED_ORIGIN: 'http://localhost:5173',
  GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret',
  GITHUB_OAUTH_REDIRECT_URI: 'http://localhost:8787/api/v1/github/callback',
  GITHUB_TOKEN_ENCRYPTION_KEY: 'kbVFaZeZPaWMePPbUsmMW27D24FcHLHZzdyWfDKVJlk=',
  WORKER_SIGNING_SECRET: 'RBtXvS4qL2JnP8K1Y9mZ3eW6fD7oA0xC5bU2vJ4wT3s=',
}

type ChainResult = { data: unknown; error: unknown; count?: number | null }

// Mimics the subset of the supabase-js query builder our routes call:
// every chained method returns the same thenable, which resolves to the
// configured result regardless of which terminal method ends the chain.
export function chain(result: ChainResult) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    range: () => Promise.resolve(result),
    upsert: () => Promise.resolve(result),
    textSearch: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (onFulfilled: (value: ChainResult) => unknown) => onFulfilled(result),
  }
  return builder
}
