import { describe, expect, it } from 'vitest'
import { buildAgentExport, buildSkillExport, buildWorkflowExport, exportSlug, slugify } from '../../src/exportMapping'

describe('slugify', () => {
  it('lowercases, replaces non-alphanumerics, and trims repeats', () => {
    expect(slugify('  Test Analyst!! ')).toBe('test-analyst')
  })

  it('falls back to untitled for an empty result', () => {
    expect(slugify('!!!')).toBe('untitled')
    expect(slugify('')).toBe('untitled')
  })
})

describe('exportSlug', () => {
  it('appends the first 8 chars of the id for collision-safety', () => {
    expect(exportSlug('Test Analyst', '12345678-aaaa-bbbb-cccc-dddddddddddd')).toBe('test-analyst-12345678')
  })
})

describe('buildAgentExport', () => {
  it('emits one file with YAML frontmatter from the Role and an Abilities section per Task', () => {
    const { files } = buildAgentExport({
      agent: { id: '12345678-aaaa-bbbb-cccc-dddddddddddd', system_prompt: 'You are diligent.' },
      role: { name: 'Test Analyst', description: 'Writes tests.' },
      tasks: [{ name: 'Write test cases', instructions: 'Cover the happy path and edge cases.' }],
    })

    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('.claude/agents/test-analyst-12345678.md')
    expect(files[0].content).toContain('name: "test-analyst-12345678"')
    expect(files[0].content).toContain('description: "Writes tests."')
    expect(files[0].content).toContain('You are diligent.')
    expect(files[0].content).toContain('## Abilities')
    expect(files[0].content).toContain('### Write test cases')
    expect(files[0].content).toContain('Cover the happy path and edge cases.')
  })

  it('falls back to the Role name for description and omits Abilities when there are no Tasks', () => {
    const { files } = buildAgentExport({
      agent: { id: '12345678-aaaa-bbbb-cccc-dddddddddddd', system_prompt: null },
      role: { name: 'Test Analyst', description: null },
      tasks: [],
    })

    expect(files[0].content).toContain('description: "Test Analyst"')
    expect(files[0].content).not.toContain('## Abilities')
  })
})

describe('buildSkillExport', () => {
  it('emits one file per skill_files row, byte-for-byte, under the skill slug folder', () => {
    const { files } = buildSkillExport({
      skill: {
        id: '12345678-aaaa-bbbb-cccc-dddddddddddd',
        name: 'Code Review Checklist',
        skill_files: [
          { path: 'SKILL.md', content: '# Code Review Checklist\nFrontmatter untouched.' },
          { path: 'reference.md', content: 'Extra detail.' },
        ],
      },
    })

    expect(files).toEqual([
      {
        path: '.claude/skills/code-review-checklist-12345678/SKILL.md',
        content: '# Code Review Checklist\nFrontmatter untouched.',
      },
      { path: '.claude/skills/code-review-checklist-12345678/reference.md', content: 'Extra detail.' },
    ])
  })

  it('does not synthesize any extra files for a single-file Skill', () => {
    const { files } = buildSkillExport({
      skill: {
        id: '12345678-aaaa-bbbb-cccc-dddddddddddd',
        name: 'Solo',
        skill_files: [{ path: 'SKILL.md', content: 'only file' }],
      },
    })
    expect(files).toHaveLength(1)
  })
})

describe('buildWorkflowExport', () => {
  it('lists steps in order, inlines TASK instructions, and cross-references AGENT/SKILL exports', () => {
    const { files } = buildWorkflowExport({
      workflow: { id: '12345678-aaaa-bbbb-cccc-dddddddddddd', name: 'Cataloging Flow' },
      steps: [
        {
          order_index: 2,
          step_type: 'AGENT',
          agent: { id: '22222222-aaaa-bbbb-cccc-dddddddddddd', role_name: 'Librarian' },
          agentExported: false,
        },
        { order_index: 1, step_type: 'TASK', task: { name: 'Sort shelf', instructions: 'Alphabetize by author.' } },
        {
          order_index: 3,
          step_type: 'SKILL',
          skill: { id: '33333333-aaaa-bbbb-cccc-dddddddddddd', name: 'Barcode Lookup' },
          skillExported: true,
        },
      ],
    })

    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('.claude/commands/cataloging-flow-12345678.md')
    const content = files[0].content

    const taskIdx = content.indexOf('Sort shelf')
    const agentIdx = content.indexOf('Agent for Librarian')
    const skillIdx = content.indexOf('Skill: Barcode Lookup')
    expect(taskIdx).toBeLessThan(agentIdx)
    expect(agentIdx).toBeLessThan(skillIdx)

    expect(content).toContain('Alphabetize by author.')
    expect(content).toContain('.claude/agents/librarian-22222222.md` (must be exported separately)')
    expect(content).toContain('.claude/skills/barcode-lookup-33333333/`.')
    expect(content).not.toContain('.claude/skills/barcode-lookup-33333333/` (must be exported separately)')
  })
})
