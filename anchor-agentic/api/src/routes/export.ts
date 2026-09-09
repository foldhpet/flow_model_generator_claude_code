import { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { logRejection } from '../middleware/errorHandler'
import { findDanglingSteps } from '../publishValidation'
import { buildAgentExport, buildSkillExport, buildWorkflowExport } from '../exportMapping'
import { decryptToken, signState, verifyState } from '../crypto'
import { pushExport } from '../github/client'
import { shouldUseR2, estimateSize } from '../exportThreshold'
import { zip } from 'fflate'

export const exportRouter = new Hono<AppEnv>()

exportRouter.use('*', requireAuth)

type ExportItemType = 'AGENT' | 'SKILL' | 'WORKFLOW'

const EXPORT_ITEM_TYPES: ExportItemType[] = ['AGENT', 'SKILL', 'WORKFLOW']
const EXPORT_TARGETS: string[] = ['zip', 'github']

const TABLE: Record<ExportItemType, string> = {
  AGENT: 'agents',
  SKILL: 'skills',
  WORKFLOW: 'workflows',
}

const ITEM_COLUMNS: Record<ExportItemType, string> = {
  AGENT: 'id, owner_id, role_id, system_prompt, status',
  SKILL: 'id, owner_id, name, skill_files, status',
  WORKFLOW: 'id, owner_id, name, status',
}

const STEP_COLUMNS = 'id, workflow_id, order_index, step_type, task_id, agent_id, skill_id'

// Mirrors canReference in workflows.ts: an owner may export their own item
// in any status; a non-owner may only export it once it's Published. Export
// is a personal/local-testing tool for in-progress work rather than a
// Marketplace-gated action, so this is deliberately looser than clone.ts's
// "must be Published even for the owner" rule.
async function loadExportableItem(supabase: SupabaseClient, userId: string, itemType: ExportItemType, id: string) {
  const { data, error } = await supabase
    .from(TABLE[itemType])
    .select(ITEM_COLUMNS[itemType])
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return { result: 'not_found' as const, item: null }
  if (data.owner_id !== userId && data.status !== 'Published') return { result: 'forbidden' as const, item: null }
  return { result: 'ok' as const, item: data }
}

// US-033/034/035/037/039: converts a live Agent/Skill/Workflow row into the
// `.claude` file(s) the browser zips up for download, or into the manifest
// an API caller gets directly with target: "zip" (US-039 API parity).
// target: "github" (US-036/US-040) needs a real GitHub OAuth App
// Client ID/Secret only the user can provision — deferred to a later
// session and surfaced here as a concrete 501, not a silent absence.
exportRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const itemType = body?.item_type as ExportItemType
  const itemId = typeof body?.item_id === 'string' ? body.item_id : ''
  const target = typeof body?.target === 'string' ? body.target : 'zip'
  const github_repo = typeof body?.github_repo === 'string' ? body.github_repo : ''
  const github_branch = typeof body?.github_branch === 'string' ? body.github_branch : 'main'

  if (!EXPORT_ITEM_TYPES.includes(itemType)) {
    return c.json({ error: 'invalid_item_type', requestId: c.get('requestId') }, 400)
  }
  if (!itemId) {
    return c.json({ error: 'item_id_required', requestId: c.get('requestId') }, 400)
  }
  if (!EXPORT_TARGETS.includes(target)) {
    return c.json({ error: 'invalid_target', requestId: c.get('requestId') }, 400)
  }

  const supabase = c.get('supabase')
  const userId = c.get('userId')!

  // GitHub target requires authentication check early
  if (target === 'github') {
    if (!github_repo) {
      return c.json({ error: 'github_repo_required', requestId: c.get('requestId') }, 400)
    }
    // Validate repo format (owner/repo)
    if (!github_repo.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/)) {
      return c.json({ error: 'invalid_github_repo_format', requestId: c.get('requestId') }, 400)
    }

    // Check if user has GitHub credentials
    const { data: creds, error: credsError } = await supabase
      .from('github_credentials')
      .select('encrypted_token, token_iv')
      .eq('user_id', userId)
      .maybeSingle()
    if (credsError) throw credsError

    if (!creds) {
      return c.json({ error: 'github_not_connected', requestId: c.get('requestId') }, 409)
    }

    try {
      // Decrypt the GitHub token
      const token = await decryptToken(creds.encrypted_token as string, creds.token_iv as string, c.env.GITHUB_TOKEN_ENCRYPTION_KEY)

      // All logic below (load item, build files) is the same for both targets
      const access = await loadExportableItem(supabase, userId, itemType, itemId)
      if (access.result === 'not_found') return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
      if (access.result === 'forbidden') {
        logRejection(c, 403, 'not_owner_or_not_published')
        return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
      }
      const item = access.item as Record<string, unknown>

      // Build the files (using shared logic with zip target)
      let files: ReturnType<typeof buildAgentExport>['files'] = []

      if (itemType === 'AGENT') {
        const { data: role, error: roleError } = await supabase
          .from('roles')
          .select('name, description')
          .eq('id', item.role_id)
          .maybeSingle()
        if (roleError) throw roleError
        if (!role) return c.json({ error: 'role_not_found', requestId: c.get('requestId') }, 404)

        const { data: assignments, error: tasksError } = await supabase
          .from('agent_tasks')
          .select('tasks(name, instructions)')
          .eq('agent_id', itemId)
        if (tasksError) throw tasksError
        const tasks = (assignments ?? [])
          .map((a: { tasks: { name: string; instructions: string | null } | null }) => a.tasks)
          .filter((t): t is { name: string; instructions: string | null } => !!t)

        const result = buildAgentExport({
          agent: { id: item.id as string, system_prompt: item.system_prompt as string | null },
          role,
          tasks,
        })
        files = result.files
      } else if (itemType === 'SKILL') {
        const result = buildSkillExport({
          skill: { id: item.id as string, name: item.name as string, skill_files: (item.skill_files as never[]) ?? [] },
        })
        files = result.files
      } else {
        // WORKFLOW: need to load steps and check for dangling references
        const { data: steps, error: stepsError } = await supabase
          .from('workflow_steps')
          .select(STEP_COLUMNS)
          .eq('workflow_id', itemId)
          .order('order_index', { ascending: true })
        if (stepsError) throw stepsError

        const idsByTable: Record<'tasks' | 'agents' | 'skills', string[]> = { tasks: [], agents: [], skills: [] }
        for (const step of steps ?? []) {
          if (step.step_type === 'TASK' && step.task_id) idsByTable.tasks.push(step.task_id)
          if (step.step_type === 'AGENT' && step.agent_id) idsByTable.agents.push(step.agent_id)
          if (step.step_type === 'SKILL' && step.skill_id) idsByTable.skills.push(step.skill_id)
        }

        const statusById = new Map<string, string>()
        const taskById = new Map<string, { name: string; instructions: string | null }>()
        const agentById = new Map<string, { id: string; role_name: string }>()
        const skillById = new Map<string, { id: string; name: string }>()

        if (idsByTable.tasks.length > 0) {
          const { data, error } = await supabase
            .from('tasks')
            .select('id, name, instructions, status')
            .in('id', idsByTable.tasks)
          if (error) throw error
          for (const row of data ?? []) {
            statusById.set(row.id, row.status)
            taskById.set(row.id, { name: row.name, instructions: row.instructions })
          }
        }
        if (idsByTable.agents.length > 0) {
          const { data, error } = await supabase.from('agents').select('id, role_id, status').in('id', idsByTable.agents)
          if (error) throw error
          const roleIds = (data ?? []).map((a) => a.role_id).filter((id): id is string => !!id)
          const { data: roles, error: rolesError } =
            roleIds.length > 0 ? await supabase.from('roles').select('id, name').in('id', roleIds) : { data: [], error: null }
          if (rolesError) throw rolesError
          const roleNameById = new Map((roles ?? []).map((r) => [r.id, r.name]))
          for (const row of data ?? []) {
            statusById.set(row.id, row.status)
            agentById.set(row.id, { id: row.id, role_name: roleNameById.get(row.role_id) ?? 'Unknown Role' })
          }
        }
        if (idsByTable.skills.length > 0) {
          const { data, error } = await supabase.from('skills').select('id, name, status').in('id', idsByTable.skills)
          if (error) throw error
          for (const row of data ?? []) {
            statusById.set(row.id, row.status)
            skillById.set(row.id, { id: row.id, name: row.name })
          }
        }

        const refs = (steps ?? []).map((s) => ({
          order_index: s.order_index,
          ref_id: (s.task_id ?? s.agent_id ?? s.skill_id) as string,
        }))
        const dangling = findDanglingSteps(refs, statusById)
        if (dangling.length > 0) {
          return c.json(
            { error: 'dangling_step_reference', requestId: c.get('requestId'), steps: dangling.map((d) => d.order_index) },
            400,
          )
        }

        // Same bundling logic as zip target
        let bundledFiles: typeof buildAgentExport['files'] = []
        for (const step of steps ?? []) {
          if (step.step_type === 'AGENT' && step.agent_id) {
            const agentStatus = statusById.get(step.agent_id)
            if (agentStatus) {
              const isOwner = (item as Record<string, unknown>).owner_id === userId
              const canExport = isOwner || agentStatus === 'Published'

              if (canExport) {
                const { data: agent, error: agentError } = await supabase
                  .from('agents')
                  .select('id, owner_id, role_id, system_prompt, status')
                  .eq('id', step.agent_id)
                  .maybeSingle()
                if (agentError) throw agentError

                if (agent) {
                  const { data: role, error: roleError } = await supabase
                    .from('roles')
                    .select('name, description')
                    .eq('id', agent.role_id)
                    .maybeSingle()
                  if (roleError) throw roleError
                  if (role) {
                    const { data: assignments, error: tasksError } = await supabase
                      .from('agent_tasks')
                      .select('tasks(name, instructions)')
                      .eq('agent_id', step.agent_id)
                    if (tasksError) throw tasksError

                    const agentTasks = (assignments ?? [])
                      .map((a: { tasks: { name: string; instructions: string | null } | null }) => a.tasks)
                      .filter((t): t is { name: string; instructions: string | null } => !!t)

                    const { files: agentFiles } = buildAgentExport({
                      agent: { id: agent.id as string, system_prompt: agent.system_prompt as string | null },
                      role,
                      tasks: agentTasks,
                    })
                    bundledFiles.push(...agentFiles)
                  }
                }
              }
            }
          } else if (step.step_type === 'SKILL' && step.skill_id) {
            const skillStatus = statusById.get(step.skill_id)
            if (skillStatus) {
              const isOwner = (item as Record<string, unknown>).owner_id === userId
              const canExport = isOwner || skillStatus === 'Published'

              if (canExport) {
                const { data: skill, error: skillError } = await supabase
                  .from('skills')
                  .select('id, name, skill_files')
                  .eq('id', step.skill_id)
                  .maybeSingle()
                if (skillError) throw skillError

                if (skill) {
                  const { files: skillFiles } = buildSkillExport({
                    skill: { id: skill.id as string, name: skill.name as string, skill_files: (skill.skill_files as never[]) ?? [] },
                  })
                  bundledFiles.push(...skillFiles)
                }
              }
            }
          }
        }

        const workflowSteps = (steps ?? []).map((s) => {
          if (s.step_type === 'TASK') {
            return { order_index: s.order_index, step_type: 'TASK' as const, task: taskById.get(s.task_id as string)! }
          }
          if (s.step_type === 'AGENT') {
            return {
              order_index: s.order_index,
              step_type: 'AGENT' as const,
              agent: agentById.get(s.agent_id as string)!,
              agentExported: bundledFiles.some((f) => f.path.includes(`agents/${agentById.get(s.agent_id as string)?.id.slice(0, 8)}`)),
            }
          }
          return {
            order_index: s.order_index,
            step_type: 'SKILL' as const,
            skill: skillById.get(s.skill_id as string)!,
            skillExported: bundledFiles.some((f) => f.path.includes(`skills/${skillById.get(s.skill_id as string)?.id.slice(0, 8)}`)),
          }
        })

        const { files: workflowFiles } = buildWorkflowExport({
          workflow: { id: item.id as string, name: item.name as string },
          steps: workflowSteps,
        })

        files = [...workflowFiles, ...bundledFiles]
      }

      // Now push to GitHub
      const [repoOwner, repoName] = github_repo.split('/')
      try {
        const result = await pushExport({
          owner: repoOwner,
          repo: repoName,
          branch: github_branch,
          files: files.map((f) => ({ path: f.path, content: f.content })),
          message: `Export: ${item.name as string}`,
          token,
        })

        return c.json({
          commit_sha: result.commit_sha,
          commit_url: result.commit_url,
          no_changes: result.no_changes,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown_error'

        // Map GitHub errors to specific error codes
        if (msg.includes('github_branch_not_found')) {
          return c.json({ error: 'github_branch_not_found', requestId: c.get('requestId') }, 404)
        }
        if (msg.includes('github_reauth_required') || msg.includes('401')) {
          return c.json({ error: 'github_reauth_required', requestId: c.get('requestId') }, 401)
        }

        logRejection(c, 500, msg)
        return c.json({ error: 'github_push_failed', requestId: c.get('requestId') }, 500)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('state_expired')) {
        logRejection(c, 401, 'github_token_expired')
        return c.json({ error: 'github_token_expired', requestId: c.get('requestId') }, 401)
      }
      throw err
    }
  }

  // ZIP target (existing logic below)
  const access = await loadExportableItem(supabase, userId, itemType, itemId)
  if (access.result === 'not_found') return c.json({ error: 'not_found', requestId: c.get('requestId') }, 404)
  if (access.result === 'forbidden') {
    logRejection(c, 403, 'not_owner_or_not_published')
    return c.json({ error: 'forbidden', requestId: c.get('requestId') }, 403)
  }
  const item = access.item as Record<string, unknown>

  if (itemType === 'AGENT') {
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('name, description')
      .eq('id', item.role_id)
      .maybeSingle()
    if (roleError) throw roleError
    if (!role) return c.json({ error: 'role_not_found', requestId: c.get('requestId') }, 404)

    const { data: assignments, error: tasksError } = await supabase
      .from('agent_tasks')
      .select('tasks(name, instructions)')
      .eq('agent_id', itemId)
    if (tasksError) throw tasksError
    const tasks = (assignments ?? [])
      .map((a: { tasks: { name: string; instructions: string | null } | null }) => a.tasks)
      .filter((t): t is { name: string; instructions: string | null } => !!t)

    const { files } = buildAgentExport({
      agent: { id: item.id as string, system_prompt: item.system_prompt as string | null },
      role,
      tasks,
    })
    return c.json({ files })
  }

  if (itemType === 'SKILL') {
    const { files } = buildSkillExport({
      skill: { id: item.id as string, name: item.name as string, skill_files: (item.skill_files as never[]) ?? [] },
    })
    return c.json({ files })
  }

  // WORKFLOW
  const { data: steps, error: stepsError } = await supabase
    .from('workflow_steps')
    .select(STEP_COLUMNS)
    .eq('workflow_id', itemId)
    .order('order_index', { ascending: true })
  if (stepsError) throw stepsError

  const idsByTable: Record<'tasks' | 'agents' | 'skills', string[]> = { tasks: [], agents: [], skills: [] }
  for (const step of steps ?? []) {
    if (step.step_type === 'TASK' && step.task_id) idsByTable.tasks.push(step.task_id)
    if (step.step_type === 'AGENT' && step.agent_id) idsByTable.agents.push(step.agent_id)
    if (step.step_type === 'SKILL' && step.skill_id) idsByTable.skills.push(step.skill_id)
  }

  const statusById = new Map<string, string>()
  const taskById = new Map<string, { name: string; instructions: string | null }>()
  const agentById = new Map<string, { id: string; role_name: string }>()
  const skillById = new Map<string, { id: string; name: string }>()

  if (idsByTable.tasks.length > 0) {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, name, instructions, status')
      .in('id', idsByTable.tasks)
    if (error) throw error
    for (const row of data ?? []) {
      statusById.set(row.id, row.status)
      taskById.set(row.id, { name: row.name, instructions: row.instructions })
    }
  }
  if (idsByTable.agents.length > 0) {
    const { data, error } = await supabase.from('agents').select('id, role_id, status').in('id', idsByTable.agents)
    if (error) throw error
    const roleIds = (data ?? []).map((a) => a.role_id).filter((id): id is string => !!id)
    const { data: roles, error: rolesError } =
      roleIds.length > 0 ? await supabase.from('roles').select('id, name').in('id', roleIds) : { data: [], error: null }
    if (rolesError) throw rolesError
    const roleNameById = new Map((roles ?? []).map((r) => [r.id, r.name]))
    for (const row of data ?? []) {
      statusById.set(row.id, row.status)
      agentById.set(row.id, { id: row.id, role_name: roleNameById.get(row.role_id) ?? 'Unknown Role' })
    }
  }
  if (idsByTable.skills.length > 0) {
    const { data, error } = await supabase.from('skills').select('id, name, status').in('id', idsByTable.skills)
    if (error) throw error
    for (const row of data ?? []) {
      statusById.set(row.id, row.status)
      skillById.set(row.id, { id: row.id, name: row.name })
    }
  }

  const refs = (steps ?? []).map((s) => ({
    order_index: s.order_index,
    ref_id: (s.task_id ?? s.agent_id ?? s.skill_id) as string,
  }))
  const dangling = findDanglingSteps(refs, statusById)
  if (dangling.length > 0) {
    return c.json(
      { error: 'dangling_step_reference', requestId: c.get('requestId'), steps: dangling.map((d) => d.order_index) },
      400,
    )
  }

  // Collect files from bundled Agent/Skill exports for this Workflow
  let bundledFiles: typeof import('../exportMapping').ExportFile[] = []

  for (const step of steps ?? []) {
    if (step.step_type === 'AGENT' && step.agent_id) {
      // Check if this Agent is exportable by the current user (owner-any-status or Published)
      const agentStatus = statusById.get(step.agent_id)
      if (agentStatus) {
        const isOwner = (item as Record<string, unknown>).owner_id === userId
        const canExport = isOwner || agentStatus === 'Published'

        if (canExport) {
          // Fetch the Agent's role and tasks to build the export
          const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, owner_id, role_id, system_prompt, status')
            .eq('id', step.agent_id)
            .maybeSingle()
          if (agentError) throw agentError

          if (agent) {
            const { data: role, error: roleError } = await supabase
              .from('roles')
              .select('name, description')
              .eq('id', agent.role_id)
              .maybeSingle()
            if (roleError) throw roleError
            if (role) {
              const { data: assignments, error: tasksError } = await supabase
                .from('agent_tasks')
                .select('tasks(name, instructions)')
                .eq('agent_id', step.agent_id)
              if (tasksError) throw tasksError

              const agentTasks = (assignments ?? [])
                .map((a: { tasks: { name: string; instructions: string | null } | null }) => a.tasks)
                .filter((t): t is { name: string; instructions: string | null } => !!t)

              const { files: agentFiles } = buildAgentExport({
                agent: { id: agent.id as string, system_prompt: agent.system_prompt as string | null },
                role,
                tasks: agentTasks,
              })
              bundledFiles.push(...agentFiles)
            }
          }
        }
      }
    } else if (step.step_type === 'SKILL' && step.skill_id) {
      // Check if this Skill is exportable
      const skillStatus = statusById.get(step.skill_id)
      if (skillStatus) {
        const isOwner = (item as Record<string, unknown>).owner_id === userId
        const canExport = isOwner || skillStatus === 'Published'

        if (canExport) {
          const { data: skill, error: skillError } = await supabase
            .from('skills')
            .select('id, name, skill_files')
            .eq('id', step.skill_id)
            .maybeSingle()
          if (skillError) throw skillError

          if (skill) {
            const { files: skillFiles } = buildSkillExport({
              skill: { id: skill.id as string, name: skill.name as string, skill_files: (skill.skill_files as never[]) ?? [] },
            })
            bundledFiles.push(...skillFiles)
          }
        }
      }
    }
  }

  const workflowSteps = (steps ?? []).map((s) => {
    if (s.step_type === 'TASK') {
      return { order_index: s.order_index, step_type: 'TASK' as const, task: taskById.get(s.task_id as string)! }
    }
    if (s.step_type === 'AGENT') {
      return {
        order_index: s.order_index,
        step_type: 'AGENT' as const,
        agent: agentById.get(s.agent_id as string)!,
        agentExported: bundledFiles.some((f) => f.path.includes(`agents/${agentById.get(s.agent_id as string)?.id.slice(0, 8)}`)),
      }
    }
    return {
      order_index: s.order_index,
      step_type: 'SKILL' as const,
      skill: skillById.get(s.skill_id as string)!,
      skillExported: bundledFiles.some((f) => f.path.includes(`skills/${skillById.get(s.skill_id as string)?.id.slice(0, 8)}`)),
    }
  })

  const { files: workflowFiles } = buildWorkflowExport({
    workflow: { id: item.id as string, name: item.name as string },
    steps: workflowSteps,
  })

  const allFiles = [...workflowFiles, ...bundledFiles]

  // US-037 AC3: R2 fallback for large exports
  if (shouldUseR2(allFiles)) {
    if (!c.env.EXPORT_BUCKET) {
      // R2 not configured, fall back to client-side zipping (browser may struggle with large size)
      return c.json({ files: allFiles })
    }

    try {
      // Build the zip server-side using fflate
      const fileMap: Record<string, Uint8Array> = {}
      for (const file of allFiles) {
        fileMap[file.path] = new TextEncoder().encode(file.content)
      }

      const zipped = await new Promise<Uint8Array>((resolve, reject) => {
        zip(fileMap, (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
      })

      // Upload to R2 with a random key
      const key = `exports/${crypto.randomUUID()}.zip`
      await c.env.EXPORT_BUCKET.put(key, zipped, {
        httpMetadata: { contentType: 'application/zip' },
      })

      // Sign a download token (10-minute TTL)
      const downloadToken = await signState({ key }, c.env.WORKER_SIGNING_SECRET, 600)
      const downloadUrl = `${c.env.ALLOWED_ORIGIN}/api/v1/export/download?key=${encodeURIComponent(key)}&token=${encodeURIComponent(downloadToken)}`

      return c.json({ download_url: downloadUrl })
    } catch (err) {
      logRejection(c, 500, 'r2_upload_failed')
      return c.json({ error: 'r2_upload_failed', requestId: c.get('requestId') }, 500)
    }
  }

  return c.json({ files: allFiles })
})

// US-037 AC3 / US-039: GET /download — fetch a pre-staged zip from R2 using a signed URL token
// The token proves we created this URL and it hasn't expired (10-minute TTL)
exportRouter.get('/download', async (c) => {
  const token = c.req.query('token')
  const key = c.req.query('key')

  if (!token || !key) {
    return c.json({ error: 'invalid_request', requestId: c.get('requestId') }, 400)
  }

  // Verify the token (it encodes {key, exp} HMAC'd with WORKER_SIGNING_SECRET)
  try {
    const data = await verifyState(token, c.env.WORKER_SIGNING_SECRET)
    if (data.key !== key) {
      return c.json({ error: 'invalid_token', requestId: c.get('requestId') }, 403)
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('state_expired')) {
      return c.json({ error: 'download_url_expired', requestId: c.get('requestId') }, 410)
    }
    return c.json({ error: 'invalid_token', requestId: c.get('requestId') }, 403)
  }

  // Fetch the zip from R2
  if (!c.env.EXPORT_BUCKET) {
    return c.json({ error: 'r2_not_configured', requestId: c.get('requestId') }, 500)
  }

  try {
    const obj = await c.env.EXPORT_BUCKET.get(key)
    if (!obj) {
      return c.json({ error: 'export_not_found', requestId: c.get('requestId') }, 404)
    }

    const buffer = await obj.arrayBuffer()
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="export.zip"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    logRejection(c, 500, 'r2_get_failed')
    return c.json({ error: 'r2_error', requestId: c.get('requestId') }, 500)
  }
})
