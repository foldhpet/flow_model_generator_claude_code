-- US-044/US-046: a moderator approving, rejecting, or removing a queued
-- item is (almost always) not its owner, so owner_update (0012) can't cover
-- these writes. Mirrors owner_update's shape, gated on is_moderator instead
-- of owner_id.
create policy "moderator_update" on public.agents for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator));

create policy "moderator_update" on public.skills for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator));

create policy "moderator_update" on public.workflows for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator));
