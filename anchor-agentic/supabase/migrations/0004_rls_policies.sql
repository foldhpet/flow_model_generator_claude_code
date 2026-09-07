-- RLS is a second, independent enforcement layer on top of the API Worker's
-- own permission checks (see docs/ARCHITECTURE.md, Decision 6). With RLS
-- enabled and no matching policy, Postgres denies by default, so a
-- non-owner's write is rejected by the database alone even if the Worker
-- layer is buggy or bypassed.
alter table public.sandbox_items enable row level security;

create policy "anon_read_published" on public.sandbox_items
  for select
  to anon
  using (status = 'Published');

create policy "authenticated_read_all" on public.sandbox_items
  for select
  to authenticated
  using (true);

create policy "owner_insert" on public.sandbox_items
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "owner_update" on public.sandbox_items
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_delete" on public.sandbox_items
  for delete
  to authenticated
  using (owner_id = auth.uid());
