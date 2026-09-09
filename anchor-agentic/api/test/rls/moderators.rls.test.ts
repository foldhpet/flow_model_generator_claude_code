import { env } from 'cloudflare:test'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Proves two independent DB-level invariants around the moderator role:
//   1. 0020_moderators.sql's rewritten profiles_self_write policy — a normal
//      user can still edit their own unrelated fields, but a self-PATCH
//      that tries to flip is_moderator is rejected outright by the policy's
//      with check, even though the row is their own.
//   2. 0022_moderator_update_policies.sql's moderator_update policy on
//      agents/skills/workflows — lets a moderator update an item they don't
//      own, same shape the moderation.ts routes rely on, while a
//      non-moderator, non-owner caller is still blocked.
//
// Requires the linked cloud project's real credentials, plus a third test
// identity (RLS_TEST_MODERATOR_EMAIL/PASSWORD) whose is_moderator flag was
// manually set true directly in the test project — a one-time manual
// fixture step, consistent with "no self-service elevation."
const canRun =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.RLS_TEST_USER_A_EMAIL &&
  !!env.RLS_TEST_USER_A_PASSWORD &&
  !!env.RLS_TEST_USER_B_EMAIL &&
  !!env.RLS_TEST_USER_B_PASSWORD &&
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

describe.skipIf(!canRun)('moderator role RLS', () => {
  it("still allows a user to update their own profile's non-moderator fields", async () => {
    const clientA = await signIn(env.RLS_TEST_USER_A_EMAIL!, env.RLS_TEST_USER_A_PASSWORD!)
    const {
      data: { user },
    } = await clientA.auth.getUser()

    const { data: before } = await clientA.from('profiles').select('username').eq('id', user!.id).single()

    const { data, error } = await clientA
      .from('profiles')
      .update({ username: before!.username })
      .eq('id', user!.id)
      .select('id, is_moderator')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].is_moderator).toBe(false)
  })

  it('blocks a user from self-promoting is_moderator via a direct update', async () => {
    const clientA = await signIn(env.RLS_TEST_USER_A_EMAIL!, env.RLS_TEST_USER_A_PASSWORD!)
    const {
      data: { user },
    } = await clientA.auth.getUser()

    const { data, error } = await clientA.from('profiles').update({ is_moderator: true }).eq('id', user!.id).select('id')

    expect(data).toBeNull()
    expect(error).not.toBeNull()

    const { data: after } = await clientA.from('profiles').select('is_moderator').eq('id', user!.id).single()
    expect(after?.is_moderator).toBe(false)
  })

  it('confirms the manually-provisioned moderator test identity has is_moderator = true', async () => {
    const moderatorClient = await signIn(env.RLS_TEST_MODERATOR_EMAIL!, env.RLS_TEST_MODERATOR_PASSWORD!)
    const {
      data: { user: moderator },
    } = await moderatorClient.auth.getUser()

    const { data, error } = await moderatorClient.from('profiles').select('is_moderator').eq('id', moderator!.id).single()

    expect(error).toBeNull()
    expect(data?.is_moderator).toBe(true)
  })

  it("blocks a non-moderator, non-owner from updating another user's skill", async () => {
    const clientA = await signIn(env.RLS_TEST_USER_A_EMAIL!, env.RLS_TEST_USER_A_PASSWORD!)
    const {
      data: { user: userA },
    } = await clientA.auth.getUser()

    const { data: skill, error: skillError } = await clientA
      .from('skills')
      .insert({ owner_id: userA!.id, name: 'RLS probe skill for moderator boundary' })
      .select('id')
      .single()
    expect(skillError).toBeNull()

    const clientB = await signIn(env.RLS_TEST_USER_B_EMAIL!, env.RLS_TEST_USER_B_PASSWORD!)
    const { data: updated, error: updateError } = await clientB
      .from('skills')
      .update({ status: 'Draft' })
      .eq('id', skill!.id)
      .select('id')

    expect(updateError).toBeNull()
    expect(updated).toEqual([])

    await clientA.from('skills').delete().eq('id', skill!.id)
  })

  it("lets a moderator update another user's skill via moderator_update", async () => {
    const clientA = await signIn(env.RLS_TEST_USER_A_EMAIL!, env.RLS_TEST_USER_A_PASSWORD!)
    const {
      data: { user: userA },
    } = await clientA.auth.getUser()

    const { data: skill, error: skillError } = await clientA
      .from('skills')
      .insert({ owner_id: userA!.id, name: 'RLS probe skill for moderator update', status: 'UnderReview' })
      .select('id')
      .single()
    expect(skillError).toBeNull()

    const moderatorClient = await signIn(env.RLS_TEST_MODERATOR_EMAIL!, env.RLS_TEST_MODERATOR_PASSWORD!)

    const { data: updated, error: updateError } = await moderatorClient
      .from('skills')
      .update({ status: 'Draft' })
      .eq('id', skill!.id)
      .select('id, status')

    expect(updateError).toBeNull()
    expect(updated).toHaveLength(1)
    expect(updated![0].status).toBe('Draft')

    await clientA.from('skills').delete().eq('id', skill!.id)
  })
})
