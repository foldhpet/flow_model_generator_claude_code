-- PUBLISH (US-025, Architecture Journey 3): published_version freezes the
-- "v_public" snapshot pointer at publish time. NULL means never published.
-- Draft edits after a publish keep bumping current_version but never touch
-- published_version, so the Marketplace-visible content (recoverable via
-- version_snapshots at (item_type, item_id, published_version)) stays frozen
-- until an explicit re-publish. Roles/Tasks are never independently
-- publishable, so they get no such column.
alter table public.agents add column published_version integer;
alter table public.skills add column published_version integer;
alter table public.workflows add column published_version integer;
