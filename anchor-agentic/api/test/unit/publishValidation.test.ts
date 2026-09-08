import { describe, expect, it } from 'vitest'
import { findDanglingSteps, isAgentPublishReady, isSkillPublishReady } from '../../src/publishValidation'

describe('isAgentPublishReady', () => {
  it('accepts a non-empty system_prompt', () => {
    expect(isAgentPublishReady({ system_prompt: 'Be helpful' })).toBe(true)
  })

  it('rejects a null system_prompt', () => {
    expect(isAgentPublishReady({ system_prompt: null })).toBe(false)
  })

  it('rejects an empty-string system_prompt', () => {
    expect(isAgentPublishReady({ system_prompt: '' })).toBe(false)
  })

  it('rejects a whitespace-only system_prompt', () => {
    expect(isAgentPublishReady({ system_prompt: '   ' })).toBe(false)
  })
})

describe('isSkillPublishReady', () => {
  it('accepts a non-empty skill_files array', () => {
    expect(isSkillPublishReady({ skill_files: [{ path: 'SKILL.md', content: '# x' }] })).toBe(true)
  })

  it('rejects an empty skill_files array', () => {
    expect(isSkillPublishReady({ skill_files: [] })).toBe(false)
  })

  it('rejects a non-array skill_files value', () => {
    expect(isSkillPublishReady({ skill_files: null })).toBe(false)
  })
})

describe('findDanglingSteps', () => {
  it('returns no dangling steps when every reference is Published', () => {
    const steps = [{ order_index: 0, ref_id: 't1' }]
    const statusById = new Map([['t1', 'Published']])
    expect(findDanglingSteps(steps, statusById)).toEqual([])
  })

  it('flags a step whose reference is missing (deleted)', () => {
    const steps = [{ order_index: 0, ref_id: 'missing' }]
    expect(findDanglingSteps(steps, new Map())).toEqual([{ order_index: 0, ref_id: 'missing' }])
  })

  it('flags a step whose reference is Archived', () => {
    const steps = [{ order_index: 1, ref_id: 't1' }]
    const statusById = new Map([['t1', 'Archived']])
    expect(findDanglingSteps(steps, statusById)).toEqual([{ order_index: 1, ref_id: 't1' }])
  })

  it('flags a step whose reference is Removed', () => {
    const steps = [{ order_index: 2, ref_id: 't1' }]
    const statusById = new Map([['t1', 'Removed']])
    expect(findDanglingSteps(steps, statusById)).toEqual([{ order_index: 2, ref_id: 't1' }])
  })

  it('does not flag a Draft reference owned by the same caller', () => {
    const steps = [{ order_index: 0, ref_id: 't1' }]
    const statusById = new Map([['t1', 'Draft']])
    expect(findDanglingSteps(steps, statusById)).toEqual([])
  })
})
