import { env } from 'cloudflare:test'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Proves RLS enforces clone_records' append-only, self-attributed-insert
// policy independently of the Worker's own logic (clone.ts always sets
// cloned_by from the verified JWT) — Architecture Decision 6: RLS is an
// independent second layer.
//
// Unlike an UPDATE `using` clause, an INSERT `with check` violation is a
// hard error rather than a silently-filtered zero-row result — see
// 0014_clone_records.sql's `creator_insert` policy.
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_USER_B_EMAIL &&
  !!env.RLS_TEST_USER_B_PASSWORD

const FAKE_SOURCE_ID = '00000000-0000-0000-0000-000000000001'
const FAKE_CLONED_ID = '00000000-0000-0000-0000-000000000002'

describe.skipIf(!canRun)('clone_records RLS policies', () => {
  it("blocks user B from inserting a clone_records row attributed to user A", async () => {
    const anonClientA = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const {
      data: { session: sessionA },
    } = await anonClientA.auth.signInWithPassword({
      email: env.RLS_TEST_USER_A_EMAIL,
      password: env.RLS_TEST_USER_A_PASSWORD,
    })
    if (!sessionA) throw new Error('could not sign in as RLS_TEST_USER_A')

    const anonClientB = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const {
      data: { session: sessionB },
    } = await anonClientB.auth.signInWithPassword({
      email: env.RLS_TEST_USER_B_EMAIL,
      password: env.RLS_TEST_USER_B_PASSWORD,
    })
    if (!sessionB) throw new Error('could not sign in as RLS_TEST_USER_B')

    const clientB = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sessionB.access_token}` } },
    })
    const { data: inserted, error: insertError } = await clientB
      .from('clone_records')
      .insert({
        source_item_type: 'SKILL',
        source_item_id: FAKE_SOURCE_ID,
        cloned_item_id: FAKE_CLONED_ID,
        cloned_by: sessionA.user.id,
      })
      .select('id')

    // An INSERT `with check` violation is a hard error, not a filtered result.
    expect(insertError).not.toBeNull()
    expect(inserted).toBeNull()
  })

  it('lets any authenticated user read a clone_records row they do not own (needed for cloneCount)', async () => {
    const anonClientA = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const {
      data: { session: sessionA },
    } = await anonClientA.auth.signInWithPassword({
      email: env.RLS_TEST_USER_A_EMAIL,
      password: env.RLS_TEST_USER_A_PASSWORD,
    })
    if (!sessionA) throw new Error('could not sign in as RLS_TEST_USER_A')

    const clientA = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sessionA.access_token}` } },
    })
    const { data: created, error: insertError } = await clientA
      .from('clone_records')
      .insert({
        source_item_type: 'SKILL',
        source_item_id: FAKE_SOURCE_ID,
        cloned_item_id: FAKE_CLONED_ID,
        cloned_by: sessionA.user.id,
      })
      .select('id')
      .single()
    expect(insertError).toBeNull()

    const anonClientB = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const {
      data: { session: sessionB },
    } = await anonClientB.auth.signInWithPassword({
      email: env.RLS_TEST_USER_B_EMAIL,
      password: env.RLS_TEST_USER_B_PASSWORD,
    })
    if (!sessionB) throw new Error('could not sign in as RLS_TEST_USER_B')

    const clientB = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sessionB.access_token}` } },
    })
    const { data: readByB, error: readError } = await clientB
      .from('clone_records')
      .select('id')
      .eq('id', created!.id)
      .maybeSingle()

    expect(readError).toBeNull()
    expect(readByB?.id).toBe(created!.id)

    // No cleanup: clone_records is append-only by design (0014's migration
    // defines no delete policy), same tradeoff as version_snapshots.
  })
})
