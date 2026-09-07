import { env } from 'cloudflare:test'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Proves RLS blocks a non-owner write on its own — this suite talks to
// supabase-js directly, bypassing the Hono app entirely, so a bug in the
// Worker's own ownership check (sandbox.ts) can never make this pass by
// accident (US-004 AC3).
//
// Requires the linked cloud project's real credentials, which aren't
// committed. Populate SUPABASE_URL/SUPABASE_ANON_KEY as real secrets in
// .dev.vars (see .dev.vars.example) once `supabase link` has run, plus two
// already-registered test accounts' emails/passwords below. Skips itself
// otherwise so `npm test` stays green before that setup exists.
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_USER_B_EMAIL &&
  !!env.RLS_TEST_USER_B_PASSWORD

describe.skipIf(!canRun)('sandbox_items RLS policies', () => {
  it("blocks user B from updating user A's item even with a valid, unrelated JWT", async () => {
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
      .from('sandbox_items')
      .insert({ title: 'RLS probe item', owner_id: sessionA.user.id })
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
    const { data: updated, error: updateError } = await clientB
      .from('sandbox_items')
      .update({ title: 'hijacked' })
      .eq('id', created!.id)
      .select('id')

    // RLS silently filters the row out rather than erroring — zero rows
    // affected is the signal, not a thrown error.
    expect(updateError).toBeNull()
    expect(updated).toEqual([])

    await clientA.from('sandbox_items').delete().eq('id', created!.id)
  })
})
