-- US-026/027/028: the real Marketplace, replacing the Epic-A sandbox_items
-- placeholder. One row per Published Agent/Skill/Workflow, sourced from the
-- frozen version_snapshots row at published_version (US-025's "v_public"),
-- not the live row — so a Draft edit made after publishing never changes
-- what the Marketplace shows until the owner re-publishes.
-- security_invoker = true is load-bearing, same reason as library_items
-- (0013): without it the view would bypass RLS entirely.

-- Roles/Tasks are never independently publishable, so their existing
-- anon_read_published policies (status = 'Published') can never match — a
-- Role's/Task's status never becomes 'Published'. Anonymous Marketplace
-- visitors still need to see the Role name behind a Published Agent and the
-- Tasks currently assigned to it (US-026 AC1, US-027 AC3), so these scoped
-- policies grant exactly that read, nothing broader than "backs a Published
-- Agent".
create policy "anon_read_via_published_agent" on public.roles for select to anon using (
  exists (select 1 from public.agents a where a.role_id = roles.id and a.status = 'Published')
);

create policy "anon_read_via_published_agent" on public.tasks for select to anon using (
  exists (
    select 1 from public.agent_tasks at_ join public.agents a on a.id = at_.agent_id
    where at_.task_id = tasks.id and a.status = 'Published'
  )
);

create policy "anon_read_via_published_agent" on public.agent_tasks for select to anon using (
  exists (select 1 from public.agents a where a.id = agent_tasks.agent_id and a.status = 'Published')
);

-- version_snapshots had no anon policy at all (only authenticated_read_all)
-- — without this, the join below would silently drop every Skill/Workflow
-- row (and the Agent's system_prompt) for anonymous callers. Scoped to
-- exactly the one snapshot each Published item currently points at.
create policy "anon_read_published_snapshot" on public.version_snapshots for select to anon using (
  (item_type = 'AGENT' and exists (
    select 1 from public.agents a where a.id = version_snapshots.item_id
      and a.status = 'Published' and a.published_version = version_snapshots.version_number))
  or (item_type = 'SKILL' and exists (
    select 1 from public.skills s where s.id = version_snapshots.item_id
      and s.status = 'Published' and s.published_version = version_snapshots.version_number))
  or (item_type = 'WORKFLOW' and exists (
    select 1 from public.workflows w where w.id = version_snapshots.item_id
      and w.status = 'Published' and w.published_version = version_snapshots.version_number))
);

-- clone_records carries no sensitive data beyond ids/timestamps (same
-- reasoning as its authenticated_read_all policy in 0014) — extending read
-- to anon keeps the Marketplace's clone-count sort/display consistent
-- across visitor auth state instead of silently zeroing for anonymous callers.
create policy "anon_read_all" on public.clone_records for select to anon using (true);

create view public.marketplace_items with (security_invoker = true) as
  select
    'AGENT'::text as item_type,
    a.id,
    a.owner_id,
    r.name as name,
    left(coalesce(vs.snapshot_data ->> 'system_prompt', ''), 160) as description,
    a.role_id,
    r.name as role_name,
    vs.snapshot_data ->> 'system_prompt' as system_prompt,
    null::jsonb as skill_files,
    null::jsonb as steps,
    a.published_version,
    (select count(*) from public.clone_records cr
      where cr.source_item_type = 'AGENT' and cr.source_item_id = a.id) as clone_count,
    coalesce(r.name, '') || ' ' || coalesce(vs.snapshot_data ->> 'system_prompt', '') as search_text,
    a.created_at,
    a.updated_at
  from public.agents a
  join public.roles r on r.id = a.role_id
  join public.version_snapshots vs
    on vs.item_type = 'AGENT' and vs.item_id = a.id and vs.version_number = a.published_version
  where a.status = 'Published' and a.published_version is not null

  union all

  select
    'SKILL',
    s.id,
    s.owner_id,
    vs.snapshot_data ->> 'name',
    vs.snapshot_data ->> 'description',
    null::uuid,
    null::text,
    null::text,
    vs.snapshot_data -> 'skill_files',
    null::jsonb,
    s.published_version,
    (select count(*) from public.clone_records cr
      where cr.source_item_type = 'SKILL' and cr.source_item_id = s.id),
    coalesce(vs.snapshot_data ->> 'name', '') || ' ' || coalesce(vs.snapshot_data ->> 'description', ''),
    s.created_at,
    s.updated_at
  from public.skills s
  join public.version_snapshots vs
    on vs.item_type = 'SKILL' and vs.item_id = s.id and vs.version_number = s.published_version
  where s.status = 'Published' and s.published_version is not null

  union all

  select
    'WORKFLOW',
    w.id,
    w.owner_id,
    vs.snapshot_data ->> 'name',
    vs.snapshot_data ->> 'description',
    null::uuid,
    null::text,
    null::text,
    null::jsonb,
    vs.snapshot_data -> 'steps',
    w.published_version,
    (select count(*) from public.clone_records cr
      where cr.source_item_type = 'WORKFLOW' and cr.source_item_id = w.id),
    coalesce(vs.snapshot_data ->> 'name', '') || ' ' || coalesce(vs.snapshot_data ->> 'description', ''),
    w.created_at,
    w.updated_at
  from public.workflows w
  join public.version_snapshots vs
    on vs.item_type = 'WORKFLOW' and vs.item_id = w.id and vs.version_number = w.published_version
  where w.status = 'Published' and w.published_version is not null;
