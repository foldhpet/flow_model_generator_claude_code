-- SKILL (US-009): independent of Role. skill_files captures each file's
-- relative path + content, sufficient to reconstruct .claude/skills/<name>/.
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (name <> ''),
  description text,
  skill_files jsonb not null default '[]',
  status text not null default 'Draft'
    check (status in ('Draft', 'Published', 'UnderReview', 'Removed', 'Archived', 'Deprecated')),
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index skills_owner_status_idx on public.skills (owner_id, status);
