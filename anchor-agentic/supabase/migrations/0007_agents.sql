-- AGENT (US-007): fulfills exactly one Role. Since a role_id already
-- belongs to exactly one owner, a plain unique constraint on role_id
-- enforces "at most one Agent per Role" (Architecture Decision 5) without
-- needing to be composite on owner_id.
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null unique references public.roles (id) on delete cascade,
  system_prompt text,
  status text not null default 'Draft'
    check (status in ('Draft', 'Published', 'UnderReview', 'Removed', 'Archived', 'Deprecated')),
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agents_owner_status_idx on public.agents (owner_id, status);
