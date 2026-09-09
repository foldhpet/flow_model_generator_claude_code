-- US-040: OAuth connection — one row per user, storing their encrypted GitHub token
-- and the connected GitHub username for display. RLS restricts to owner-only access.
create table public.github_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  github_username text not null,
  encrypted_token text not null,
  token_iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index github_credentials_user_idx on public.github_credentials (user_id);

-- Owner-only access: read/insert/update/delete only your own row
alter table public.github_credentials enable row level security;
create policy "owner_read" on public.github_credentials for select to authenticated using (user_id = auth.uid());
create policy "owner_insert" on public.github_credentials for insert to authenticated with check (user_id = auth.uid());
create policy "owner_update" on public.github_credentials for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_delete" on public.github_credentials for delete to authenticated using (user_id = auth.uid());
