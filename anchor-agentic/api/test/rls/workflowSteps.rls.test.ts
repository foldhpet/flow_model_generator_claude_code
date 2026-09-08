import { env } from 'cloudflare:test'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// workflow_steps has no owner_id of its own (see 0012_rls_policies_epic_b.sql)
// — ownership is derived via a subquery to the parent Workflow's owner_id.
// This proves that derived-ownership policy actually holds at the DB level,
// independent of workflows.ts's own Archived/ownership guards in the Worker.
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

describe.skipIf(!canRun)('workflow_steps RLS (ownership derived from parent Workflow)', () => {
  it("blocks user B from inserting, updating, or deleting a step on user A's workflow", async () => {
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

    const { data: role, error: roleError } = await clientA
      .from('roles')
      .insert({ name: 'RLS probe role for workflow_steps boundary', owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(roleError).toBeNull()

    const { data: task, error: taskError } = await clientA
      .from('tasks')
      .insert({ name: 'RLS probe task for workflow_steps boundary', role_id: role!.id, owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(taskError).toBeNull()

    const { data: workflow, error: workflowError } = await clientA
      .from('workflows')
      .insert({ name: 'RLS probe workflow', owner_id: sessionA.user.id })
      .select('id')
      .single()
    expect(workflowError).toBeNull()

    const { data: step, error: stepError } = await clientA
      .from('workflow_steps')
      .insert({ workflow_id: workflow!.id, order_index: 0, step_type: 'TASK', task_id: task!.id })
      .select('id')
      .single()
    expect(stepError).toBeNull()

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

    const { data: insertedByB, error: insertErrorByB } = await clientB
      .from('workflow_steps')
      .insert({ workflow_id: workflow!.id, order_index: 1, step_type: 'TASK', task_id: task!.id })
      .select('id')
    expect(insertedByB).toBeNull()
    expect(insertErrorByB).not.toBeNull()

    const { data: updatedByB, error: updateErrorByB } = await clientB
      .from('workflow_steps')
      .update({ order_index: 5 })
      .eq('id', step!.id)
      .select('id')
    expect(updateErrorByB).toBeNull()
    expect(updatedByB).toEqual([])

    const { data: deletedByB, error: deleteErrorByB } = await clientB
      .from('workflow_steps')
      .delete()
      .eq('id', step!.id)
      .select('id')
    expect(deleteErrorByB).toBeNull()
    expect(deletedByB).toEqual([])

    const { data: stillThere } = await clientA.from('workflow_steps').select('id').eq('id', step!.id).maybeSingle()
    expect(stillThere?.id).toBe(step!.id)

    await clientA.from('workflow_steps').delete().eq('id', step!.id)
    await clientA.from('workflows').delete().eq('id', workflow!.id)
    await clientA.from('tasks').delete().eq('id', task!.id)
    await clientA.from('roles').delete().eq('id', role!.id)
  })
})
