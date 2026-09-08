-- US-021: CLONE_RECORD is a polymorphic, append-only provenance log — one
-- row per top-level Clone action (Agent/Skill/Workflow only; Role/Task have
-- no standalone clone entry point per US-022's notes). Modeled after
-- version_snapshots (0011): no FK on source_item_id (it points at three
-- different tables), and the row is kept even if the source is later
-- Archived/removed (US-021 AC4), so there is no FK there either.
create table public.clone_records (
  id uuid primary key default gen_random_uuid(),
  source_item_type text not null check (source_item_type in ('AGENT', 'SKILL', 'WORKFLOW')),
  source_item_id uuid not null,
  cloned_item_id uuid not null,
  cloned_by uuid not null references public.profiles (id) on delete cascade,
  cloned_at timestamptz not null default now()
);

create index clone_records_source_idx on public.clone_records (source_item_type, source_item_id);
create index clone_records_cloned_item_idx on public.clone_records (cloned_item_id);

-- Append-only, readable by any registered user (clone counts and provenance
-- links must be visible across owners) — same shape as version_snapshots'
-- policies in 0012_rls_policies_epic_b.sql.
alter table public.clone_records enable row level security;
create policy "authenticated_read_all" on public.clone_records for select to authenticated using (true);
create policy "creator_insert" on public.clone_records for insert to authenticated with check (cloned_by = auth.uid());
