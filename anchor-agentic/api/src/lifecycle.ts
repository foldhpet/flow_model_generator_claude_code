// US-019: Archived is a terminal state — once set, no further edits are
// allowed, and only a Draft item can be archived (Published's own lifecycle
// path is Published -> Deprecated, handled elsewhere and out of scope here).
export function validateStatusTransition(currentStatus: string, nextStatus: string | undefined): string | null {
  if (currentStatus === 'Archived') return 'archived_item_is_terminal'
  if (nextStatus === undefined || nextStatus === currentStatus) return null
  if (nextStatus === 'Archived' && currentStatus !== 'Draft') return 'only_draft_can_be_archived'
  return null
}
