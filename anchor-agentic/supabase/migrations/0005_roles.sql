-- ROLE (US-005): owned, per-user entity — duplicate names across (and even
-- within) an owner are expected, so there is no uniqueness constraint on
-- name (Architecture Decision 5).
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (name <> ''),
  description text,
  status text not null default 'Draft'
    check (status in ('Draft', 'Published', 'UnderReview', 'Removed', 'Archived', 'Deprecated')),
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index roles_owner_status_idx on public.roles (owner_id, status);
