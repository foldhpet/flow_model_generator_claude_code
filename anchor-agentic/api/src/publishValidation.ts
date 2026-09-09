// US-024: publish-time completeness checks are structural only (no
// content/quality gate) — pure functions so they're unit-testable without a
// database. The publish route (routes/publish.ts) fetches whatever data
// these need and calls them.
// Epic J / US-043 extends this file with further structural checks
// (hasAssignedTask, isSkillStructurallySound); US-042's content/quality
// checks live in the sibling contentEvaluation.ts instead — this file stays
// structure-only.

import type { QualityIssue } from './contentEvaluation'

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
// deleted (missing from statusById), Archived/Removed, or UnderReview (just
// pulled from the marketplace by a report — a Workflow must not stay
// publishable while pointing at it).
export function findDanglingSteps(steps: StepRef[], statusById: Map<string, string>): StepRef[] {
  return steps.filter((step) => {
    const status = statusById.get(step.ref_id)
    return !status || status === 'Archived' || status === 'Removed' || status === 'UnderReview'
  })
}

// US-043 AC2: an Agent needs at least one assigned Task beyond a non-empty
// prompt.
export function hasAssignedTask(taskCount: number): boolean {
  return taskCount > 0
}

export interface SkillFile {
  path: string
  content: string
}

// US-043 AC3, reinterpreted pragmatically: the actual export pipeline
// (exportMapping.ts's buildSkillExport) has no enforced "SKILL.md
// convention" — it writes every skill_files entry byte-for-byte at its own
// path. So "structurally sound" here means each file is well-formed and the
// set is internally consistent, not that a specific filename exists.
export function isSkillStructurallySound(skillFiles: SkillFile[]): QualityIssue[] {
  const issues: QualityIssue[] = []
  const seenPaths = new Set<string>()

  for (const file of skillFiles) {
    const path = typeof file.path === 'string' ? file.path.trim() : ''
    if (path === '') {
      issues.push({ code: 'skill_file_missing_path', message: 'A skill file is missing a path.' })
      continue
    }
    if (path.includes('..') || path.startsWith('/')) {
      issues.push({ code: 'skill_file_unsafe_path', message: `Skill file path "${path}" is not a safe relative path.` })
      continue
    }
    if (seenPaths.has(path)) {
      issues.push({ code: 'skill_file_duplicate_path', message: `Skill file path "${path}" is duplicated.` })
      continue
    }
    seenPaths.add(path)
    if (typeof file.content !== 'string' || file.content.trim() === '') {
      issues.push({ code: 'skill_file_empty_content', message: `Skill file "${path}" has no content.` })
    }
  }

  return issues
}
