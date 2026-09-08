// US-024: publish-time completeness checks are structural only (no
// content/quality gate) — pure functions so they're unit-testable without a
// database. The publish route (routes/publish.ts) fetches whatever data
// these need and calls them.

export function isAgentPublishReady(agent: { system_prompt: string | null | undefined }): boolean {
  return typeof agent.system_prompt === 'string' && agent.system_prompt.trim() !== ''
}

export function isSkillPublishReady(skill: { skill_files: unknown }): boolean {
  return Array.isArray(skill.skill_files) && skill.skill_files.length > 0
}

export interface StepRef {
  order_index: number
  ref_id: string
}

// A step is dangling if its referenced Task/Agent/Skill has since been
// deleted (missing from statusById) or Archived/Removed.
export function findDanglingSteps(steps: StepRef[], statusById: Map<string, string>): StepRef[] {
  return steps.filter((step) => {
    const status = statusById.get(step.ref_id)
    return !status || status === 'Archived' || status === 'Removed'
  })
}
