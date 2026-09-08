-- AGENT_TASK (US-008): join table assigning Tasks to the Agent fulfilling
-- their Role. The "Task must belong to the Agent's Role" rule is a
-- cross-row business invariant that a CHECK constraint can't express, so
-- it is enforced at the Worker layer only (see api/src/routes/agents.ts)
-- and proven by integration tests (Architecture Decision 3).
create table public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (agent_id, task_id)
);

create index agent_tasks_agent_idx on public.agent_tasks (agent_id);
create index agent_tasks_task_idx on public.agent_tasks (task_id);
