import { env } from 'cloudflare:test'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Proves RLS enforces ratings' public-read / self-attributed-write policies
// independently of the Worker's own logic (ratings.ts always sets user_id
// from the verified JWT) — Architecture Decision 6: RLS is an independent
// second layer.
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_USER_B_EMAIL &&
  !!env.RLS_TEST_USER_B_PASSWORD

const FAKE_ITEM_ID_RESUBMIT = '00000000-0000-0000-0000-000000000010'
const FAKE_ITEM_ID_ANON_READ = '00000000-0000-0000-0000-000000000011'
const FAKE_ITEM_ID_HIJACK = '00000000-0000-0000-0000-000000000012'

describe.skipIf(!canRun)('ratings RLS policies', () => {
  it('lets user A upsert their own rating, and a resubmit updates the row in place rather than duplicating it', async () => {
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

    const { error: firstError } = await clientA
      .from('ratings')
      .upsert(
        { item_type: 'AGENT', item_id: FAKE_ITEM_ID_RESUBMIT, user_id: sessionA.user.id, score: 3 },
        { onConflict: 'item_type,item_id,user_id' },
      )
    expect(firstError).toBeNull()

    const { error: resubmitError } = await clientA
      .from('ratings')
      .upsert(
        { item_type: 'AGENT', item_id: FAKE_ITEM_ID_RESUBMIT, user_id: sessionA.user.id, score: 5 },
        { onConflict: 'item_type,item_id,user_id' },
      )
    expect(resubmitError).toBeNull()

    const { data: rows, error: readError } = await clientA
      .from('ratings')
      .select('score')
      .eq('item_type', 'AGENT')
      .eq('item_id', FAKE_ITEM_ID_RESUBMIT)
      .eq('user_id', sessionA.user.id)

    expect(readError).toBeNull()
    // Exactly one row, holding the resubmitted score — the upsert updated
    // it in place instead of creating a second one (US-030 AC1/AC2).
    expect(rows).toEqual([{ score: 5 }])

    // No cleanup: ratings has no delete policy (0017's migration defines
    // none), same append-only tradeoff as clone_records/version_snapshots.
  })

  it('lets a truly anonymous (unauthenticated) client read ratings (US-031 AC1)', async () => {
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
    const { error: upsertError } = await clientA
      .from('ratings')
      .upsert(
        { item_type: 'AGENT', item_id: FAKE_ITEM_ID_ANON_READ, user_id: sessionA.user.id, score: 4 },
        { onConflict: 'item_type,item_id,user_id' },
      )
    expect(upsertError).toBeNull()

    // No Authorization header at all — genuinely anonymous, not just a
    // second signed-in user.
    const anonReader = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const { data: rows, error: readError } = await anonReader
      .from('ratings')
      .select('score')
      .eq('item_type', 'AGENT')
      .eq('item_id', FAKE_ITEM_ID_ANON_READ)

    expect(readError).toBeNull()
    expect(rows).toEqual([{ score: 4 }])
  })

  it("blocks user B from writing a rating attributed to user A", async () => {
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
    const { error: seedError } = await clientA
      .from('ratings')
      .upsert(
        { item_type: 'AGENT', item_id: FAKE_ITEM_ID_HIJACK, user_id: sessionA.user.id, score: 3 },
        { onConflict: 'item_type,item_id,user_id' },
      )
    expect(seedError).toBeNull()

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

    // An INSERT `with check` violation is a hard error, not a filtered
    // result (same shape as clone_records' creator_insert policy) — user B
    // rating a *different* item as user A.
    const { data: inserted, error: insertError } = await clientB
      .from('ratings')
      .insert({ item_type: 'SKILL', item_id: FAKE_ITEM_ID_HIJACK, user_id: sessionA.user.id, score: 1 })
      .select('id')
    expect(insertError).not.toBeNull()
    expect(inserted).toBeNull()

    // An UPDATE `using` violation silently filters to zero rows affected —
    // user A's seeded row above is left untouched.
    const { data: updated, error: updateError } = await clientB
      .from('ratings')
      .update({ score: 1 })
      .eq('item_type', 'AGENT')
      .eq('item_id', FAKE_ITEM_ID_HIJACK)
      .eq('user_id', sessionA.user.id)
      .select('id')
    expect(updateError).toBeNull()
    expect(updated).toEqual([])
  })
})
