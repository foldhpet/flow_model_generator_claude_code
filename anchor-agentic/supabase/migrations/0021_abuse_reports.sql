-- US-045: ABUSE_REPORT is a polymorphic table, same shape as ratings (0017)
-- but reporting is anonymous-friendly (unlike ratings, which require a
-- registered user_id) — reporter_id is nullable for anonymous reports.
create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('AGENT', 'SKILL', 'WORKFLOW')),
  item_id uuid not null,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('ABUSIVE', 'BROKEN', 'SPAM', 'OTHER')),
  detail text,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED_DISMISSED', 'RESOLVED_REMOVED')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index abuse_reports_item_idx on public.abuse_reports (item_type, item_id);

-- Unlike domain tables and ratings, reads here are moderator-only, not
-- public/authenticated_read_all: a report can name a reporter and carry
-- free-text detail, which is more sensitive than the content it's about.
alter table public.abuse_reports enable row level security;

create policy "anyone_insert" on public.abuse_reports for insert to public
  with check ((reporter_id is null and auth.uid() is null) or (reporter_id = auth.uid()));

create policy "moderator_read" on public.abuse_reports for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator));

create policy "moderator_resolve" on public.abuse_reports for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_moderator));
