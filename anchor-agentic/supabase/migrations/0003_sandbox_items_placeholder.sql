-- Epic A test fixture: establishes the owner_id/status pattern that Epic B's
-- real domain tables (roles, tasks, agents, skills, workflows) will reuse.
-- Superseded by those tables once Epic B lands; kept minimal on purpose so
-- US-004's permission-boundary ACs are testable now.
create table public.sandbox_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  status text not null default 'Draft'
    check (status in ('Draft', 'Published', 'UnderReview', 'Removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sandbox_items_owner_status_idx on public.sandbox_items (owner_id, status);
