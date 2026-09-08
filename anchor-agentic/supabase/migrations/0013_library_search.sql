-- US-016/017: a single searchable, cross-entity read surface over the five
-- domain tables, backing the new /library ("My Sandbox") and /library/all
-- ("All Sandbox") pages. Each table gets its own generated tsvector column
-- (so a GIN index can actually be used before the UNION ALL runs) and the
-- view stitches them together. `security_invoker = true` is load-bearing:
-- without it the view would run with its owner's privileges and silently
-- bypass the read-all/write-own RLS policies from 0012_rls_policies_epic_b.sql.

alter table public.roles add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) stored;
create index roles_search_idx on public.roles using gin (search_vector);

alter table public.tasks add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(instructions, ''))) stored;
create index tasks_search_idx on public.tasks using gin (search_vector);

-- Agents have no name/description of their own — only system_prompt is
-- searchable text (US-017 AC2 still holds: "system_prompt" is explicitly
-- one of the three fields named).
alter table public.agents add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(system_prompt, ''))) stored;
create index agents_search_idx on public.agents using gin (search_vector);

alter table public.skills add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) stored;
create index skills_search_idx on public.skills using gin (search_vector);

alter table public.workflows add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) stored;
create index workflows_search_idx on public.workflows using gin (search_vector);

-- Agents have no name column of their own; label them the same way the web
-- layer already does elsewhere ("Agent for <Role name>") by surfacing the
-- parent Role's name here and letting the caller prefix it.
create view public.library_items with (security_invoker = true) as
  select 'ROLE'::text as item_type, id, owner_id, name, status, current_version,
    created_at, updated_at, search_vector
  from public.roles
  union all
  select 'TASK', id, owner_id, name, status, current_version,
    created_at, updated_at, search_vector
  from public.tasks
  union all
  select 'AGENT', a.id, a.owner_id, r.name, a.status, a.current_version,
    a.created_at, a.updated_at, a.search_vector
  from public.agents a
  join public.roles r on r.id = a.role_id
  union all
  select 'SKILL', id, owner_id, name, status, current_version,
    created_at, updated_at, search_vector
  from public.skills
  union all
  select 'WORKFLOW', id, owner_id, name, status, current_version,
    created_at, updated_at, search_vector
  from public.workflows;
