-- RLS as a second, independent enforcement layer for every Epic B table
-- (Architecture Decision 6), mirroring 0004_rls_policies.sql's pattern for
-- sandbox_items: anon can only read Published rows, authenticated can read
-- everything (nothing here is ever private to registered users), and only
-- the owner can write. agent_tasks and workflow_steps have no owner_id of
-- their own, so their write policies check ownership via the parent row.

alter table public.roles enable row level security;
alter table public.tasks enable row level security;
alter table public.agents enable row level security;
alter table public.skills enable row level security;
alter table public.workflows enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.version_snapshots enable row level security;

-- roles, tasks, agents, skills, workflows: identical owner-scoped pattern.
create policy "anon_read_published" on public.roles for select to anon using (status = 'Published');
create policy "authenticated_read_all" on public.roles for select to authenticated using (true);
create policy "owner_insert" on public.roles for insert to authenticated with check (owner_id = auth.uid());
create policy "owner_update" on public.roles for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_delete" on public.roles for delete to authenticated using (owner_id = auth.uid());

create policy "anon_read_published" on public.tasks for select to anon using (status = 'Published');
create policy "authenticated_read_all" on public.tasks for select to authenticated using (true);
create policy "owner_insert" on public.tasks for insert to authenticated with check (owner_id = auth.uid());
create policy "owner_update" on public.tasks for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_delete" on public.tasks for delete to authenticated using (owner_id = auth.uid());

create policy "anon_read_published" on public.agents for select to anon using (status = 'Published');
create policy "authenticated_read_all" on public.agents for select to authenticated using (true);
create policy "owner_insert" on public.agents for insert to authenticated with check (owner_id = auth.uid());
create policy "owner_update" on public.agents for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_delete" on public.agents for delete to authenticated using (owner_id = auth.uid());

create policy "anon_read_published" on public.skills for select to anon using (status = 'Published');
create policy "authenticated_read_all" on public.skills for select to authenticated using (true);
create policy "owner_insert" on public.skills for insert to authenticated with check (owner_id = auth.uid());
create policy "owner_update" on public.skills for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_delete" on public.skills for delete to authenticated using (owner_id = auth.uid());

create policy "anon_read_published" on public.workflows for select to anon using (status = 'Published');
create policy "authenticated_read_all" on public.workflows for select to authenticated using (true);
create policy "owner_insert" on public.workflows for insert to authenticated with check (owner_id = auth.uid());
create policy "owner_update" on public.workflows for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_delete" on public.workflows for delete to authenticated using (owner_id = auth.uid());

-- agent_tasks: ownership is derived from the parent Agent's owner_id.
create policy "authenticated_read_all" on public.agent_tasks for select to authenticated using (true);
create policy "owner_insert" on public.agent_tasks for insert to authenticated
  with check (exists (select 1 from public.agents where agents.id = agent_tasks.agent_id and agents.owner_id = auth.uid()));
create policy "owner_delete" on public.agent_tasks for delete to authenticated
  using (exists (select 1 from public.agents where agents.id = agent_tasks.agent_id and agents.owner_id = auth.uid()));

-- workflow_steps: ownership is derived from the parent Workflow's owner_id.
create policy "authenticated_read_all" on public.workflow_steps for select to authenticated using (true);
create policy "owner_insert" on public.workflow_steps for insert to authenticated
  with check (exists (select 1 from public.workflows where workflows.id = workflow_steps.workflow_id and workflows.owner_id = auth.uid()));
create policy "owner_update" on public.workflow_steps for update to authenticated
  using (exists (select 1 from public.workflows where workflows.id = workflow_steps.workflow_id and workflows.owner_id = auth.uid()))
  with check (exists (select 1 from public.workflows where workflows.id = workflow_steps.workflow_id and workflows.owner_id = auth.uid()));
create policy "owner_delete" on public.workflow_steps for delete to authenticated
  using (exists (select 1 from public.workflows where workflows.id = workflow_steps.workflow_id and workflows.owner_id = auth.uid()));

-- version_snapshots: append-only, readable by any registered user.
create policy "authenticated_read_all" on public.version_snapshots for select to authenticated using (true);
create policy "creator_insert" on public.version_snapshots for insert to authenticated with check (created_by = auth.uid());
