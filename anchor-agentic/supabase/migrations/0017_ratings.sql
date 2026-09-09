-- US-030: RATING is a polymorphic table, one row per (item, rater), unique
-- on (item_type, item_id, user_id) so resubmitting a score updates the
-- existing row instead of duplicating it. Modeled after clone_records
-- (0014)/version_snapshots (0011): no FK on item_id (it points at three
-- different tables).
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('AGENT', 'SKILL', 'WORKFLOW')),
  item_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_type, item_id, user_id)
);

create index ratings_item_idx on public.ratings (item_type, item_id);

-- Read is public (anon + authenticated): the marketplace_items view's
-- security_invoker aggregate subquery needs anon access to compute a
-- non-zero average/count for anonymous visitors (US-031 AC1) — same
-- sensitivity call already made for clone_records' anon_read_all in 0016
-- (ids + a small integer, no free text). Write is restricted to the
-- rater's own row; both insert and update policies are needed since the
-- rating route does an upsert (ON CONFLICT DO UPDATE).
alter table public.ratings enable row level security;
create policy "read_all" on public.ratings for select to public using (true);
create policy "rater_insert" on public.ratings for insert to authenticated with check (user_id = auth.uid());
create policy "rater_update" on public.ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
