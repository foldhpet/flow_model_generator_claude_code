import { describe, expect, it } from 'vitest'
import { validateStatusTransition } from '../../src/lifecycle'

describe('validateStatusTransition', () => {
  it('allows a no-op transition (nextStatus undefined)', () => {
    expect(validateStatusTransition('Draft', undefined)).toBeNull()
  })

  it('allows a no-op transition (nextStatus equal to currentStatus)', () => {
    expect(validateStatusTransition('Published', 'Published')).toBeNull()
  })

  it('rejects any further transition once Archived (terminal)', () => {
    expect(validateStatusTransition('Archived', 'Draft')).toBe('archived_item_is_terminal')
  })

  it('rejects setting status to Published directly (must use the publish endpoint)', () => {
    expect(validateStatusTransition('Draft', 'Published')).toBe('use_publish_endpoint')
  })

  it('rejects Published -> Draft (publish is one-way, no un-publish)', () => {
    expect(validateStatusTransition('Published', 'Draft')).toBe('published_is_one_way')
  })

  it('rejects archiving a non-Draft item', () => {
    expect(validateStatusTransition('Published', 'Archived')).toBe('only_draft_can_be_archived')
  })

  it('allows archiving a Draft item', () => {
    expect(validateStatusTransition('Draft', 'Archived')).toBeNull()
  })
})
