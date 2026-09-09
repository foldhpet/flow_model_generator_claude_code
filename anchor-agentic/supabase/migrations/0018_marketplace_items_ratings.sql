-- US-031/US-032: adds live rating/rating_count aggregates to
-- marketplace_items, sourced from the new ratings table (0017). Postgres
-- only allows create-or-replace to append columns at the end of an
-- existing view, so rating/rating_count are appended after updated_at in
-- all three branches rather than inserted alongside clone_count.
-- These are correlated subqueries, recomputed on every read (not a stored
-- aggregate), so every read reflects the current mean/count with no
-- caching involved (US-032 AC2/AC4).
create or replace view public.marketplace_items with (security_invoker = true) as
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
    a.updated_at,
    (select round(avg(rt.score)::numeric, 1) from public.ratings rt
      where rt.item_type = 'AGENT' and rt.item_id = a.id) as rating,
    (select count(*) from public.ratings rt
      where rt.item_type = 'AGENT' and rt.item_id = a.id) as rating_count
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
    s.updated_at,
    (select round(avg(rt.score)::numeric, 1) from public.ratings rt
      where rt.item_type = 'SKILL' and rt.item_id = s.id),
    (select count(*) from public.ratings rt
      where rt.item_type = 'SKILL' and rt.item_id = s.id)
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
    w.updated_at,
    (select round(avg(rt.score)::numeric, 1) from public.ratings rt
      where rt.item_type = 'WORKFLOW' and rt.item_id = w.id),
    (select count(*) from public.ratings rt
      where rt.item_type = 'WORKFLOW' and rt.item_id = w.id)
  from public.workflows w
  join public.version_snapshots vs
    on vs.item_type = 'WORKFLOW' and vs.item_id = w.id and vs.version_number = w.published_version
  where w.status = 'Published' and w.published_version is not null;
