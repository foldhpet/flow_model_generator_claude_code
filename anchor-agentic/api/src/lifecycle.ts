// US-019: Archived is a terminal state — once set, no further edits are
// allowed, and only a Draft item can be archived (Published's own lifecycle
// path is Published -> Deprecated, handled elsewhere and out of scope here).
// US-023: Published is reached only through the dedicated publish endpoint
// (which runs US-024's completeness checks and freezes v_public) — the
// generic PATCH used here by every domain router must reject a direct
// attempt to set status to Published, for every item type including
// Role/Task (which have no publish endpoint at all). Published is also a
// one-way transition: there is no un-publish, so Published -> Draft is
// rejected too.
export function validateStatusTransition(currentStatus: string, nextStatus: string | undefined): string | null {
  if (currentStatus === 'Archived') return 'archived_item_is_terminal'
  if (nextStatus === undefined || nextStatus === currentStatus) return null
  if (nextStatus === 'Published') return 'use_publish_endpoint'
  if (currentStatus === 'Published' && nextStatus === 'Draft') return 'published_is_one_way'
  if (nextStatus === 'Archived' && currentStatus !== 'Draft') return 'only_draft_can_be_archived'
  return null
}
