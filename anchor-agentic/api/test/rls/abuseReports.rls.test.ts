import { env } from 'cloudflare:test'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Proves the three abuse_reports policies (0021_abuse_reports.sql) directly
// against Postgres, bypassing the Hono app (reports.ts / moderation.ts)
// entirely:
//   1. anyone_insert — anonymous inserts must carry reporter_id: null;
//      authenticated inserts must carry reporter_id = own uid.
//   2. moderator_read — only a moderator can select rows back out.
//   3. moderator_resolve — only a moderator can update (resolve) a row.
//
// Requires the linked cloud project's real credentials, plus a third test
// identity whose is_moderator flag was manually set true directly in the
// test project (no self-service elevation, by design) — see
// moderators.rls.test.ts's header for the same requirement.
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_MODERATOR_EMAIL &&
  !!env.RLS_TEST_MODERATOR_PASSWORD

async function signIn(email: string, password: string) {
  const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  const {
    data: { session },
  } = await anonClient.auth.signInWithPassword({ email, password })
  if (!session) throw new Error(`could not sign in as ${email}`)
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  })
}

describe.skipIf(!canRun)('abuse_reports RLS', () => {
  it('allows an anonymous insert with a null reporter_id', async () => {
    const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

    const { data, error } = await anonClient
      .from('abuse_reports')
      .insert({
        item_type: 'AGENT',
        item_id: '11111111-1111-1111-1111-111111111111',
        reporter_id: null,
        reason: 'SPAM',
      })
      .select('id')
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
  })

  it('blocks an anonymous insert that carries a non-null reporter_id', async () => {
    const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

    const { data, error } = await anonClient
      .from('abuse_reports')
      .insert({
        item_type: 'AGENT',
        item_id: '22222222-2222-2222-2222-222222222222',
        reporter_id: '33333333-3333-3333-3333-333333333333',
        reason: 'SPAM',
      })
      .select('id')

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('allows an authenticated insert whose reporter_id matches the caller', async () => {
    const clientA = await signIn(env.RLS_TEST_USER_A_EMAIL!, env.RLS_TEST_USER_A_PASSWORD!)
    const {
      data: { user },
    } = await clientA.auth.getUser()

    const { data, error } = await clientA
      .from('abuse_reports')
      .insert({
        item_type: 'SKILL',
        item_id: '44444444-4444-4444-4444-444444444444',
        reporter_id: user!.id,
        reason: 'BROKEN',
        detail: 'exports an empty file',
      })
      .select('id')
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
  })

  it("blocks an authenticated insert whose reporter_id doesn't match the caller", async () => {
    const clientA = await signIn(env.RLS_TEST_USER_A_EMAIL!, env.RLS_TEST_USER_A_PASSWORD!)

    const { data, error } = await clientA
      .from('abuse_reports')
      .insert({
        item_type: 'SKILL',
        item_id: '55555555-5555-5555-5555-555555555555',
        reporter_id: '66666666-6666-6666-6666-666666666666',
        reason: 'BROKEN',
      })
      .select('id')

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('blocks a non-moderator from reading abuse_reports back', async () => {
    const clientA = await signIn(env.RLS_TEST_USER_A_EMAIL!, env.RLS_TEST_USER_A_PASSWORD!)

    const { data, error } = await clientA
      .from('abuse_reports')
      .select('id')
      .eq('item_id', '11111111-1111-1111-1111-111111111111')

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('allows a moderator to read abuse_reports', async () => {
    const moderatorClient = await signIn(env.RLS_TEST_MODERATOR_EMAIL!, env.RLS_TEST_MODERATOR_PASSWORD!)

    const { data, error } = await moderatorClient
      .from('abuse_reports')
      .select('id, item_type, item_id')
      .eq('item_id', '11111111-1111-1111-1111-111111111111')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('blocks a non-moderator from resolving (updating) an abuse_report', async () => {
    const clientA = await signIn(env.RLS_TEST_USER_A_EMAIL!, env.RLS_TEST_USER_A_PASSWORD!)

    const { data, error } = await clientA
      .from('abuse_reports')
      .update({ status: 'RESOLVED_DISMISSED' })
      .eq('item_id', '11111111-1111-1111-1111-111111111111')
      .select('id')

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('allows a moderator to resolve an abuse_report', async () => {
    const moderatorClient = await signIn(env.RLS_TEST_MODERATOR_EMAIL!, env.RLS_TEST_MODERATOR_PASSWORD!)
    const {
      data: { user: moderator },
    } = await moderatorClient.auth.getUser()

    const { data, error } = await moderatorClient
      .from('abuse_reports')
      .update({ status: 'RESOLVED_DISMISSED', resolved_by: moderator!.id, resolved_at: new Date().toISOString() })
      .eq('item_id', '11111111-1111-1111-1111-111111111111')
      .select('id, status')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    expect(data![0].status).toBe('RESOLVED_DISMISSED')

    // No delete policy exists on abuse_reports (moderator or otherwise) — the
    // rows inserted by this file are left in place, same as
    // sandboxItems.rls.test.ts's un-cleanable cases.
  })
})
