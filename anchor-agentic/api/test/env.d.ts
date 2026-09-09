import type { Bindings } from '../src/types'

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Bindings {
    RLS_TEST_USER_A_EMAIL?: string
    RLS_TEST_USER_A_PASSWORD?: string
    RLS_TEST_USER_B_EMAIL?: string
    RLS_TEST_USER_B_PASSWORD?: string
    RLS_TEST_MODERATOR_EMAIL?: string
    RLS_TEST_MODERATOR_PASSWORD?: string
  }
}
