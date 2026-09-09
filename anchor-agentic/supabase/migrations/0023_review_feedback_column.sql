-- US-044 AC3: feedback a moderator leaves when rejecting a review request
-- back to Draft. Same nullable single-column pattern as published_version (0015).
alter table public.agents add column review_feedback text;
alter table public.skills add column review_feedback text;
alter table public.workflows add column review_feedback text;
