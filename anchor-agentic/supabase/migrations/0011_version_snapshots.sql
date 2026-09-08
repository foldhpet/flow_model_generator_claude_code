-- VERSION_SNAPSHOT (Architecture Decision 2): a single polymorphic table
-- capturing version history for Role/Task/Agent/Skill/Workflow on every
-- save, application-level rather than per-item git repos. No FK on
-- item_id (it points at five different tables) — every write funnels
-- through api/src/versioning.ts, the sole place raw inserts happen
-- (Architecture Decision 3's mitigation for polymorphic associations).
create table public.version_snapshots (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('ROLE', 'TASK', 'AGENT', 'SKILL', 'WORKFLOW')),
  item_id uuid not null,
  version_number integer not null,
  snapshot_data jsonb not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_type, item_id, version_number)
);

create index version_snapshots_item_idx on public.version_snapshots (item_type, item_id);
