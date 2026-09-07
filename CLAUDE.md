# AnchorAgentic.io

## Project Purpose

This repository builds **AnchorAgentic.io**, a free, community-driven platform where individuals define **Roles, Tasks, Agents, Skills, and Workflows** for agentic software development. Users start from proven templates, refine them hands-on in a personal Sandbox, and publish their best work to a public Marketplace so the whole community gets better at building software with AI together.

The platform is intentionally lightweight and community/passion-project scoped — not an enterprise product. There is no monetization; cloning is always free.

**Reference docs (read these before making product/architecture decisions):**
- `docs/INITIAL-CONCEPT.md` — the original problem statement and domain vocabulary as captured with the Product Owner Agent.
- `docs/PRODUCT-CONCEPT.md` — full product concept: personas, journeys, features, roadmap, NFRs, success metrics.
- `docs/ARCHITECTURE.md` — system architecture, KPIs, and the technical stack rationale.
- `docs/USER-STORIES.md` — epics and user stories (with acceptance criteria) derived from the product concept.

## Core Domain Model

- **Role** — a job function in the SDLC (e.g., Business Analyst, Test Analyst). An Agent is built to fulfill exactly one Role.
- **Task** — owned by a single Role; the unit of work an Agent performs.
- **Agent** — fulfills one Role and can perform multiple Tasks belonging to that Role. Maps to a real Claude Code sub-agent definition.
- **Skill** — a genuine Claude Code Skill, buildable through the platform and independently invocable (not owned by a Role).
- **Workflow** — an ordered chain of Tasks (tied to Roles) that can also directly invoke Skills and/or Agents.

Everything above is **clonable into a Sandbox, version-controlled, publishable to the Marketplace, and rateable (1-5, registered users only)**.

## Access Model

- **Anonymous visitors**: Marketplace browsing only (read published items + ratings). No Sandbox access.
- **Registered users**: Marketplace, plus **My Sandbox** (personal, version-controlled, read/write) and **All Sandbox** (everyone's in-progress work, read-only — Sandbox items are never private by design).
- Publishing moves an item from a Sandbox into the Marketplace. Cloning copies a Marketplace (or another user's Sandbox) item into your own Sandbox.

## Architecture

Serverless, edge-first stack chosen to stay near $0/month and under a hard $20/month hosting ceiling (see `docs/ARCHITECTURE.md`):

- **`anchor-agentic/web`** — SvelteKit frontend (Cloudflare Pages target). Server-rendered Marketplace, auth pages (`/register`, `/login`, `/logout`), and Sandbox pages. Talks to the API over `PUBLIC_API_URL`, never calls Supabase directly for anything the API already exposes.
- **`anchor-agentic/api`** — Hono API on Cloudflare Workers. Owns `/api/v1/marketplace/*` (public reads) and `/api/v1/sandbox/*` (auth-required), enforces ownership checks server-side, and never trusts client-supplied `owner_id`.
- **`anchor-agentic/supabase`** — Postgres schema + migrations for the linked Supabase cloud project. Supabase Auth is the identity provider; Postgres Row-Level Security is a second, independent enforcement layer behind the API's own checks (never the only enforcement layer).
- Export/artifact storage (Cloudflare R2) and the `.claude`-folder export mapping are part of the target design but not yet implemented — see `docs/ARCHITECTURE.md`'s Export Mapping Service section before building that feature.

Both `web` and `api` are self-contained npm projects (no monorepo tooling) — see each project's own `package.json`/`wrangler.toml` for scripts, and its `.env.example`/`.dev.vars.example` for required configuration.

## Project Structure

```
flow_model_generator_claude_code/
├── CLAUDE.md                     # This file
├── docs/
│   ├── INITIAL-CONCEPT.md
│   ├── PRODUCT-CONCEPT.md
│   ├── ARCHITECTURE.md
│   └── USER-STORIES.md
├── anchor-agentic/                # The actual product
│   ├── web/                       # SvelteKit frontend
│   ├── api/                       # Hono API on Cloudflare Workers
│   └── supabase/                  # Schema + migrations, linked to the cloud project
├── generator/                      # Legacy: earlier Flow Model generator experiment
└── example-taf/                    # Legacy: earlier Flow Model / Tri-Layer TAF example
```

`generator/` and `example-taf/` are earlier work exploring a Flow Model test-automation generator and are **not** part of AnchorAgentic.io — treat them as historical/reference material, not a target for new feature work, unless explicitly asked.

## Development Workflow

1. Ground any new feature work in `docs/USER-STORIES.md` (find or add the relevant epic/story and its acceptance criteria) before writing code.
2. Implement against the layer boundaries above: UI in `web`, business logic and authorization in `api`, schema/RLS in `supabase`.
3. Write/extend tests alongside the change: Vitest (`api`, including a dedicated `test/rls/` suite that talks to Supabase directly to prove RLS independent of the Worker) and Playwright (`web`, in `e2e/`).
4. Re-check the relevant acceptance criteria against the implementation before considering a story done.

## Collaboration Notes

- Never paste Supabase secrets (URL, anon key, service role key, DB password, access tokens) into chat. Credentials are obtained via `supabase login`/`supabase link` run by the user, or via gitignored `api/.dev.vars` / `web/.env` populated outside the chat channel.
- Test fixtures/emails should use a real, MX-valid domain (e.g. `mailinator.com`) — Supabase Auth's signup validator rejects unresolvable domains including `@example.com`.
- Keep the Sandbox-visibility rule intact: Sandbox items are never private — there is no private/hidden mode, by product design.
