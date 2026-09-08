import type { SupabaseClient } from '@supabase/supabase-js'

export type VersionedItemType = 'ROLE' | 'TASK' | 'AGENT' | 'SKILL' | 'WORKFLOW'

const TABLE_BY_ITEM_TYPE: Record<VersionedItemType, string> = {
  ROLE: 'roles',
  TASK: 'tasks',
  AGENT: 'agents',
  SKILL: 'skills',
  WORKFLOW: 'workflows',
}

// Single choke point for every write to version_snapshots (Architecture
// Decision 2/3) — inserts the snapshot, then bumps current_version on the
// parent row to match. Called by every create/update handler across the
// roles/tasks/agents/skills/workflows routers.
export async function recordVersionSnapshot(
  supabase: SupabaseClient,
  itemType: VersionedItemType,
  itemId: string,
  versionNumber: number,
  snapshotData: unknown,
  userId: string,
) {
  const { error: snapshotError } = await supabase.from('version_snapshots').insert({
    item_type: itemType,
    item_id: itemId,
    version_number: versionNumber,
    snapshot_data: snapshotData,
    created_by: userId,
  })
  if (snapshotError) throw snapshotError

  const { error: bumpError } = await supabase
    .from(TABLE_BY_ITEM_TYPE[itemType])
    .update({ current_version: versionNumber, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (bumpError) throw bumpError
}
