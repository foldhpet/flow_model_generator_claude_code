-- TASK (US-006): owned by exactly one Role. role_id is required and, per
-- the Worker-layer rule, never changed after creation (no re-parenting).
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  name text not null check (name <> ''),
  instructions text,
  status text not null default 'Draft'
    check (status in ('Draft', 'Published', 'UnderReview', 'Removed', 'Archived', 'Deprecated')),
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_role_idx on public.tasks (role_id);
create index tasks_owner_status_idx on public.tasks (owner_id, status);
