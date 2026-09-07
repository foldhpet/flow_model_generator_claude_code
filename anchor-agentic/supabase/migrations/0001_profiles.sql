-- Profile data for auth.users. Supabase manages id/email/created_at on auth.users;
-- this table only carries the app-specific fields the USER entity needs (username).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_readable_by_all" on public.profiles
  for select
  using (true);

create policy "profiles_self_write" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
