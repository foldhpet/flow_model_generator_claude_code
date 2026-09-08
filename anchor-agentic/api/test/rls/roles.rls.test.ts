import { env } from 'cloudflare:test'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Proves RLS blocks a non-owner write on a Role on its own — this suite
// talks to supabase-js directly, bypassing the Hono app entirely, so a bug
// in the Worker's own ownership check (roles.ts) can never make this pass
// by accident (Architecture Decision 6: RLS is an independent second layer).
//
// Requires the linked cloud project's real credentials — see
// sandboxItems.rls.test.ts for the .dev.vars setup this shares.
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_USER_B_EMAIL &&
  !!env.RLS_TEST_USER_B_PASSWORD

describe.skipIf(!canRun)('roles RLS policies', () => {
  it("blocks user B from updating user A's role even with a valid, unrelated JWT", async () => {
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
      .from('roles')
      .insert({ name: 'RLS probe role', owner_id: sessionA.user.id })
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
      .from('roles')
      .update({ name: 'hijacked' })
      .eq('id', created!.id)
      .select('id')

    // RLS silently filters the row out rather than erroring — zero rows
    // affected is the signal, not a thrown error.
    expect(updateError).toBeNull()
    expect(updated).toEqual([])

    await clientA.from('roles').delete().eq('id', created!.id)
  })

  it('lets any authenticated user read a role regardless of owner (Sandbox items are never private)', async () => {
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
      .from('roles')
      .insert({ name: 'RLS read probe role', owner_id: sessionA.user.id, status: 'Draft' })
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
      .from('roles')
      .select('id')
      .eq('id', created!.id)
      .maybeSingle()

    expect(readError).toBeNull()
    expect(readByB?.id).toBe(created!.id)

    await clientA.from('roles').delete().eq('id', created!.id)
  })
})
