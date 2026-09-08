import { describe, expect, it } from 'vitest'
import { hasExactlyOneReference, renumber } from '../../src/workflowSteps'

describe('hasExactlyOneReference', () => {
  it('accepts a TASK step with only task_id set', () => {
    expect(hasExactlyOneReference({ step_type: 'TASK', task_id: 't1' })).toBe(true)
  })

  it('accepts an AGENT step with only agent_id set', () => {
    expect(hasExactlyOneReference({ step_type: 'AGENT', agent_id: 'a1' })).toBe(true)
  })

  it('accepts a SKILL step with only skill_id set', () => {
    expect(hasExactlyOneReference({ step_type: 'SKILL', skill_id: 's1' })).toBe(true)
  })

  it('rejects when no reference field is populated', () => {
    expect(hasExactlyOneReference({ step_type: 'TASK' })).toBe(false)
  })

  it('rejects when more than one reference field is populated', () => {
    expect(hasExactlyOneReference({ step_type: 'TASK', task_id: 't1', agent_id: 'a1' })).toBe(false)
  })

  it('rejects when the populated field does not match step_type', () => {
    expect(hasExactlyOneReference({ step_type: 'TASK', agent_id: 'a1' })).toBe(false)
  })

  it('rejects an unknown step_type even if exactly one field is set', () => {
    expect(hasExactlyOneReference({ step_type: 'BOGUS', task_id: 't1' })).toBe(false)
  })

  it('treats empty-string reference fields as unpopulated', () => {
    expect(hasExactlyOneReference({ step_type: 'TASK', task_id: '', agent_id: null, skill_id: null })).toBe(false)
  })
})

describe('renumber', () => {
  it('assigns gapless 0..n-1 order_index in the given order', () => {
    expect(renumber(['c', 'a', 'b'])).toEqual([
      { id: 'c', order_index: 0 },
      { id: 'a', order_index: 1 },
      { id: 'b', order_index: 2 },
    ])
  })

  it('returns an empty array for an empty input', () => {
    expect(renumber([])).toEqual([])
  })

  it('handles a single step', () => {
    expect(renumber(['only'])).toEqual([{ id: 'only', order_index: 0 }])
  })
})
