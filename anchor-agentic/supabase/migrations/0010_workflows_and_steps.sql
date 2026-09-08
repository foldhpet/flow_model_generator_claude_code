-- WORKFLOW + WORKFLOW_STEP (US-010, US-011, US-012). order_index is kept
-- gapless entirely by the Worker (it always renumbers 0..n-1 on add/
-- remove/reorder, never trusting a client-supplied absolute index); the
-- unique(workflow_id, order_index) constraint below just backstops that.
-- The "exactly one reference field populated, matching step_type" rule is
-- expressible as a same-table CHECK, so it lives in the database too.
create table public.workflows (
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

create index workflows_owner_status_idx on public.workflows (owner_id, status);

create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  order_index integer not null,
  step_type text not null check (step_type in ('TASK', 'AGENT', 'SKILL')),
  task_id uuid references public.tasks (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete cascade,
  skill_id uuid references public.skills (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workflow_id, order_index),
  check (
    (step_type = 'TASK' and task_id is not null and agent_id is null and skill_id is null) or
    (step_type = 'AGENT' and agent_id is not null and task_id is null and skill_id is null) or
    (step_type = 'SKILL' and skill_id is not null and task_id is null and agent_id is null)
  )
);

create index workflow_steps_workflow_idx on public.workflow_steps (workflow_id);
