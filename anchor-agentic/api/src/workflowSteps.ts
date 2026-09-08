export type StepType = 'TASK' | 'AGENT' | 'SKILL'

export interface StepReference {
  step_type: StepType | string
  task_id?: string | null
  agent_id?: string | null
  skill_id?: string | null
}

// US-010/US-012: exactly one of task_id/agent_id/skill_id must be
// populated, and it must match step_type. Pure so it can be unit tested
// without a database.
export function hasExactlyOneReference(ref: StepReference): boolean {
  const populated = [ref.task_id, ref.agent_id, ref.skill_id].filter((v) => v != null && v !== '')
  if (populated.length !== 1) return false
  if (ref.step_type === 'TASK') return !!ref.task_id
  if (ref.step_type === 'AGENT') return !!ref.agent_id
  if (ref.step_type === 'SKILL') return !!ref.skill_id
  return false
}

// Renumbers a list of step ids, given in the desired final order, to
// gapless 0..n-1 order_index values. Used both for "remove one step, close
// the gap" (US-012) and "reorder to this exact sequence" (US-011) — the
// caller supplies the ids already in the order they should end up in.
export function renumber(stepIdsInOrder: string[]): { id: string; order_index: number }[] {
  return stepIdsInOrder.map((id, index) => ({ id, order_index: index }))
}
