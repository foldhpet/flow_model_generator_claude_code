// US-033/034/035: the Export Mapping Service (Architecture Decision 1) —
// pure, transport-agnostic functions that compress the platform's domain
// model into the `.claude` folder conventions Claude Code understands.
// The route (routes/export.ts) does all the Supabase I/O and calls these
// with plain data.

export interface ExportFile {
  path: string
  content: string
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

// Appending the id's first 8 chars makes every slug collision-safe (US-033
// AC4) without having to check sibling filenames — two items with the same
// name still get distinct paths.
export function exportSlug(name: string, id: string): string {
  return `${slugify(name)}-${id.slice(0, 8)}`
}

interface AgentExportInput {
  agent: { id: string; system_prompt: string | null }
  role: { name: string; description: string | null }
  tasks: { name: string; instructions: string | null }[]
}

// US-033: one file, YAML frontmatter from the Role (an Agent has no name of
// its own — it fulfils exactly one Role), body = system_prompt + an
// "Abilities" section inlining every assigned Task (Tasks have no exported
// file of their own).
export function buildAgentExport({ agent, role, tasks }: AgentExportInput): { files: ExportFile[] } {
  const slug = exportSlug(role.name, agent.id)
  const description = role.description?.trim() || role.name
  const lines = [
    '---',
    `name: ${JSON.stringify(slug)}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    agent.system_prompt ?? '',
  ]
  if (tasks.length > 0) {
    lines.push('', '## Abilities', '')
    for (const task of tasks) {
      lines.push(`### ${task.name}`, '', task.instructions ?? '', '')
    }
  }
  return { files: [{ path: `.claude/agents/${slug}.md`, content: lines.join('\n') }] }
}

interface SkillExportInput {
  skill: { id: string; name: string; skill_files: { path: string; content: string }[] }
}

// US-034: every skill_files entry, byte-for-byte, at its own relative path
// under the skill's folder — no synthesized SKILL.md, no placeholder files.
export function buildSkillExport({ skill }: SkillExportInput): { files: ExportFile[] } {
  const slug = exportSlug(skill.name, skill.id)
  return {
    files: skill.skill_files.map((f) => ({
      path: `.claude/skills/${slug}/${f.path}`,
      content: f.content,
    })),
  }
}

type WorkflowStepRef =
  | { order_index: number; step_type: 'TASK'; task: { name: string; instructions: string | null } }
  | { order_index: number; step_type: 'AGENT'; agent: { id: string; role_name: string }; agentExported: boolean }
  | { order_index: number; step_type: 'SKILL'; skill: { id: string; name: string }; skillExported: boolean }

interface WorkflowExportInput {
  workflow: { id: string; name: string }
  steps: WorkflowStepRef[]
}

// US-035: one command file listing steps in order. A TASK step inlines the
// Task's instructions directly (Tasks have no exported file). An
// AGENT/SKILL step references that item's own export slug — with a note
// that it must be exported separately when it wasn't exported alongside
// this Workflow (AC3; always true in this pass's single-item export scope).
export function buildWorkflowExport({ workflow, steps }: WorkflowExportInput): { files: ExportFile[] } {
  const slug = exportSlug(workflow.name, workflow.id)
  const lines = [
    '---',
    `description: ${JSON.stringify(workflow.name)}`,
    '---',
    '',
    `# ${workflow.name}`,
    '',
    'Ordered steps:',
    '',
  ]

  const ordered = [...steps].sort((a, b) => a.order_index - b.order_index)
  ordered.forEach((step, i) => {
    const n = i + 1
    if (step.step_type === 'TASK') {
      lines.push(`${n}. **Task: ${step.task.name}**`, '', step.task.instructions ?? '', '')
    } else if (step.step_type === 'AGENT') {
      const agentSlug = exportSlug(step.agent.role_name, step.agent.id)
      const note = step.agentExported ? '' : ' (must be exported separately)'
      lines.push(`${n}. **Agent for ${step.agent.role_name}** — see \`.claude/agents/${agentSlug}.md\`${note}.`, '')
    } else {
      const skillSlug = exportSlug(step.skill.name, step.skill.id)
      const note = step.skillExported ? '' : ' (must be exported separately)'
      lines.push(`${n}. **Skill: ${step.skill.name}** — see \`.claude/skills/${skillSlug}/\`${note}.`, '')
    }
  })

  return { files: [{ path: `.claude/commands/${slug}.md`, content: lines.join('\n') }] }
}
