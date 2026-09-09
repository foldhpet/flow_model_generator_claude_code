-- Epic J: manual moderator flag (AskUserQuestion decision — no self-service
-- elevation UI; a human sets this directly via SQL/dashboard).
alter table public.profiles add column is_moderator boolean not null default false;

-- profiles_self_write (0001) only checked auth.uid() = id, which lets any
-- user flip their own is_moderator through a normal authenticated PATCH.
-- RLS is row-level, not column-level, so the fix is requiring the new value
-- to match the row's current value — a self-update can never change it.
drop policy "profiles_self_write" on public.profiles;
create policy "profiles_self_write" on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_moderator = (select p.is_moderator from public.profiles p where p.id = auth.uid())
  );
