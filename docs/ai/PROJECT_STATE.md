# PROJECT_STATE

> Purpose: Single, compact source of truth for AI + humans. Keep this file short.
> Update cadence: end of each Epic (or when architecture/API changes).
> Last updated: 2026-09-09
> Current epic: Epic J — Quality & Trust (pulled forward from V2; implementation done, RLS verification blocked)

---

## 1) One-paragraph product summary
AnchorAgentic.io is a free, community-driven platform where individuals define Roles, Tasks, Agents, Skills, and Workflows for agentic software development — clone proven templates into a personal Sandbox, refine them, and publish the best ones to a public Marketplace so the community gets better at building software with AI together. No monetization; cloning is always free; intentionally lightweight (community/passion-project scope, not enterprise).

## 2) Current status (very short)
- Completed epics: A (Auth & Platform Access), B (Domain Authoring), C (Sandbox & Version Control), D (Clone), E (Publish), F (Marketplace Browse & Search), G (Ratings), H (Export & API Parity), I (Sustainability)
- In progress: Epic J — Quality & Trust (US-042–046, pulled forward from its original V2-deferred status at the user's explicit request). Code, migrations, unit/integration tests all written and passing. **Blocked** on live RLS verification — see §12.
- Next up: finish Epic J verification (below), then re-check ACs one by one (same pattern as H/I), then decide on any remaining V2 items.

## 3) Key decisions (bullets only)
- [2026-09-09] Decision: Epic J's `Removed` status is genuinely terminal (resolves a contradiction between US-046 AC3 and AC4 in favor of AC4). Rationale: user resolved via AskUserQuestion; "unfounded report" is instead handled by dismissing the report *before* removal — dismissing an item's last open report while `UnderReview` restores it to `Published`. Impact: `moderation.ts` remove action has no undo path; only dismiss can restore.
- [2026-09-09] Decision: US-044 (voluntary review) vs. US-045 (report-driven review) are distinguished purely by data, not a separate flag — whether an `UnderReview` item has any `OPEN` `abuse_reports` rows. Impact: `GET /api/v1/moderation/queue` groups by presence/absence of open reports; the moderation UI shows approve/reject for empty-reports items and remove/dismiss for non-empty.
- [2026-09-09] Decision: Moderator role is a manual DB flag (`profiles.is_moderator`), no self-service elevation UI/endpoint. Rationale: user's explicit call, keeps the trust boundary out of application code. Impact: onboarding a moderator requires a human running SQL directly against the linked Supabase project; RLS on `profiles_self_write` (migration 0020) explicitly blocks a user from flipping their own flag via a normal PATCH.
- [2026-09-09] Decision: US-042/043 content evaluation is pure heuristic code (`contentEvaluation.ts`), no LLM call. Rationale: respects the $20/month hosting ceiling. Impact: catches boilerplate/banned-pattern/too-short/low-diversity content, not semantic quality.
- [2026-09-09] Decision: US-045 rate limiting uses a new Cloudflare Workers KV namespace (`RATE_LIMIT_KV`), fails open if unconfigured. Impact: abuse reporting works even before the KV namespace is provisioned in a given environment; only rate limiting itself is skipped.
- [Earlier] Decision: Serverless/edge-first stack (SvelteKit on Cloudflare Pages, Hono on Cloudflare Workers, Supabase Postgres+Auth) chosen to stay near $0/month, hard $20/month ceiling. See `docs/ARCHITECTURE.md`.
- [Earlier] Decision: API owns all authorization logic and never trusts client-supplied `owner_id`; Postgres RLS is a second, independent enforcement layer, never the sole one.
- [Earlier] Decision: Sandbox items are never private by design — "All Sandbox" is read-only visibility into everyone's in-progress work; there is no private/hidden mode.

## 4) Architecture at a glance
### 4.1 High-level diagram (text)
- Browser -> `web` (SvelteKit, server-rendered) -> `api` (Hono on Workers, `PUBLIC_API_URL`) -> Supabase Postgres (+ Supabase Auth)
- `web` never calls Supabase directly for anything the API already exposes.
- AuthN: Supabase Auth (email/password + GitHub OAuth for `github.ts`/credential export). AuthZ: API-side ownership/role checks first, Postgres RLS second.
- Hosting/runtime: Cloudflare Pages (`web`) + Cloudflare Workers (`api`), Supabase cloud project (linked, not self-hosted). KV namespace (`RATE_LIMIT_KV`) for per-IP rate limiting on anonymous abuse reports.

### 4.2 Tech stack
- UI: SvelteKit 2 / Svelte 5, Tailwind 4, Vite, adapter-cloudflare, Playwright (e2e), Vitest (unit)
- API: Hono 4 on Cloudflare Workers, Zod 4 for validation, `@supabase/supabase-js` as data access, Vitest 4 + `@cloudflare/vitest-pool-workers`
- DB: Supabase-hosted Postgres, migrations as plain numbered `.sql` files in `anchor-agentic/supabase/migrations/`, applied via `supabase db push` against the linked project (user-run, not automated)
- Testing: unit: Vitest (both projects); integration: Vitest against a mocked Supabase client (`api/test/integration/`); RLS: Vitest against the real linked Supabase project (`api/test/rls/`, gated on env vars, real network calls); e2e: Playwright (`web/e2e/`)
- Tooling: lint/format: Prettier + ESLint (`web`); CI: none configured yet (not found in repo)

### 4.3 Repo map (only the important folders)
- `anchor-agentic/web/src/routes/` — SvelteKit pages: `login`/`register`/`logout`, `sandbox`(+`/all`), `library`(+`/all`), `roles`, `tasks`, `agents`(+`/new`,`/[id]`), `skills`(+`/new`,`/[id]`), `workflows`(+`/new`,`/[id]`), `marketplace/[itemType]/[id]`, `moderation`, `export/[itemType]`, `settings`
- `anchor-agentic/api/src/routes/` — Hono routers: `marketplace`, `ratings`, `reports`, `moderation`, `sandbox`, `roles`, `tasks`, `agents`, `skills`, `workflows`, `library`, `clone`, `publish`, `export`, `github`
- `anchor-agentic/api/src/middleware/` — `auth` (`requireAuth`), `moderator` (`requireModerator`), `rateLimit` (`rateLimitByIp`), `errorHandler`, `requestId`
- `anchor-agentic/api/src/` (top-level modules) — `lifecycle.ts` (status transition rules), `publishValidation.ts` (structural publish gates), `contentEvaluation.ts` (heuristic content quality gates), `supabase.ts` (request-scoped + service-role client factories), `types.ts` (`Bindings`/`AppEnv`)
- `anchor-agentic/supabase/migrations/` — 23 numbered migrations, `0001`–`0023`, applied in order
- `docs/` — `INITIAL-CONCEPT.md`, `PRODUCT-CONCEPT.md`, `ARCHITECTURE.md`, `USER-STORIES.md` (source of truth for epics/ACs), `ai/PROJECT_STATE.md` (this file)
- `generator/`, `example-taf/` — legacy, unrelated Flow Model generator experiment; not part of AnchorAgentic.io

## 5) Domain model (minimum needed)
### 5.1 Core entities
- `Role`: a job function in the SDLC. Owns `Task`s.
- `Task`: owned by exactly one `Role`; unit of work.
- `Agent`: fulfills one `Role`, performs multiple `Task`s of that Role; maps to a real Claude Code sub-agent definition; has `system_prompt`, assigned via `agent_tasks`.
- `Skill`: independently invocable Claude Code Skill, not owned by a Role; has `skill_files` (path/content pairs).
- `Workflow`: ordered chain of `Task`s/Agents/Skills (`workflow_steps`); can dangle-reference other items.
- `abuse_reports` (new, Epic J): polymorphic (`item_type`+`item_id`) reports against Agents/Skills/Workflows; `status` = `OPEN`/`RESOLVED_DISMISSED`/`RESOLVED_REMOVED`; `reporter_id` nullable (anonymous-friendly).
- `profiles`: one per Supabase Auth user; `is_moderator` flag (Epic J, manual-only).
- Shared lifecycle status (Agent/Skill/Workflow): `Draft` → `Published` ⇄ `UnderReview` → `Removed` (terminal) or back to `Draft` (reject) or `Published` (approve/dismiss-restore); `Archived` also terminal. Enforced centrally by `lifecycle.ts`'s `validateStatusTransition`.

### 5.2 Key workflows (bullets)
- Clone: Marketplace/other-Sandbox item -> API ownership+ACL check -> DB copy into caller's Sandbox, `clone_records` provenance row.
- Publish: author submits -> `publishValidation.ts` structural gates + `contentEvaluation.ts` heuristic gates -> version snapshot -> `Published` (or, if `requestReview: true`, `UnderReview` instead, US-044).
- Report abuse (US-045): anonymous or authenticated visitor -> rate-limited by IP (KV) -> `abuse_reports` insert -> service-role flips item `Published → UnderReview`.
- Moderation (US-044/046): moderator-only queue (`UnderReview` items, grouped by presence of open reports) -> approve/reject (voluntary path) or remove/dismiss (report-driven path) -> RLS-enforced via `moderator_update` policy, no service-role needed for these four writes.

## 6) API contracts (summary only)
> Details live in route source files; keep here to a quick index.
| Area | Endpoint/Route | Method | Auth | Notes |
|------|-----------------|--------|------|------|
| Marketplace | `/api/v1/marketplace/items/:itemType/:id` | GET | no | public detail read |
| Ratings | `/api/v1/marketplace/items/:itemType/:id/rating` | POST | yes | upsert caller's score |
| Reports (Epic J) | `/api/v1/marketplace/items/:itemType/:id/report` | POST | optional | rate-limited by IP; anon or authed |
| Moderation (Epic J) | `/api/v1/moderation/queue` | GET | moderator | `UnderReview` items + open reports |
| Moderation (Epic J) | `/api/v1/moderation/items/:itemType/:id/{approve,reject,remove}` | POST | moderator | US-044/046 actions |
| Moderation (Epic J) | `/api/v1/moderation/reports/:reportId/dismiss` | POST | moderator | may restore item to `Published` |
| Publish | `/api/v1/publish/:itemType/:id` | POST | owner | gates + `requestReview` branch (Epic J) |
| Sandbox/Roles/Tasks/Agents/Skills/Workflows | `/api/v1/{sandbox,roles,tasks,agents,skills,workflows}/...` | CRUD | owner (sandbox writes) | see `agents.ts` etc. for full shape |
| Clone | `/api/v1/clone/:itemType/:id` | GET/POST | yes | provenance lookup / perform clone |
| Export | `/api/v1/export/:itemType/:id` | GET | yes | `.claude`-folder export (Epic H) |
| GitHub | `/api/v1/github/*` | varies | yes | OAuth callback + credential export |
| Health | `/api/v1/healthz` | GET | no | liveness |

## 7) UI routes & screens (summary only)
| Route | Screen | Purpose | Key components |
|------|--------|---------|----------------|
| `/login`, `/register`, `/logout` | Auth | Supabase Auth email/password + GitHub OAuth | — |
| `/sandbox`, `/sandbox/all` | Sandbox | My Sandbox (r/w) vs. All Sandbox (r/o, everyone's) | — |
| `/library`, `/library/all` | Library | search/browse authoring items | — |
| `/roles`, `/tasks/[id]`, `/agents/[id]`, `/skills/[id]`, `/workflows/[id]` (+`/new` variants) | Authoring | CRUD for each domain entity | — |
| `/marketplace/[itemType]/[id]` | Marketplace detail | public read; rate/clone (registered); report abuse (anyone, Epic J) | report form outside `isRegistered` gate |
| `/moderation` | Moderation queue (Epic J) | moderator-only; approve/reject or remove/dismiss | guarded by `moderationGuard` in `hooks.server.ts` |
| `/export/[itemType]` | Export | `.claude`-folder export download | — |
| `/settings` | Settings | account/GitHub credential management | — |

## 8) Data & persistence
- Database schema notes: 23 migrations, `anchor-agentic/supabase/migrations/0001`–`0023`; every domain table (`agents`/`skills`/`workflows`) shares the same lifecycle status check constraint including not-yet-fully-wired `UnderReview`/`Removed` values (now activated by Epic J). `abuse_reports` (0021) is the newest table; `profiles.is_moderator` (0020) and `review_feedback` column (0023) are the newest columns.
- Migration status: local migrations 0001–0023 are applied and match remote exactly (confirmed via `supabase migration list`, no drift) as of this session.
- Seed data: none formalized; RLS/integration tests create their own fixtures.

## 9) Security & privacy constraints (non-sensitive)
- Roles/permissions: owner-only writes on authoring items (RLS `owner_update`/API ownership checks); moderator-only writes on `UnderReview` items (RLS `moderator_update`, migration 0022); `profiles.is_moderator` is not self-settable via API (RLS on `profiles_self_write` blocks it).
- Sensitive data handling rules: never paste Supabase secrets (URL/anon key/service role key/DB password/access tokens) into chat — obtained only via `supabase login`/`link` or gitignored `.dev.vars`/`.env`. Test fixture emails must use an MX-valid domain (`mailinator.com`); Supabase Auth rejects `@example.com`.
- Audit/logging rules: content-evaluation outcomes (US-042 AC4) are logged via `logEvaluationOutcome` (JSON to console, readable via `wrangler tail`) — no paid logging service.

## 10) Observability & ops
- Logging: `console.log(JSON.stringify(...))` pattern in `api/src/middleware/errorHandler.ts` (`logRejection`, `logEvaluationOutcome`), visible via `wrangler tail` in deployed environments.
- Metrics: none configured.
- Error reporting: Hono `onError` -> `errorHandler` middleware; consistent JSON error shape across routes.
- Environments: `api/.dev.vars` (gitignored) for local Worker secrets; `web/.env` for local SvelteKit config; both have `.example` counterparts checked in.

## 11) Testing strategy (current)
- Unit tests: `api/test/unit/` — `lifecycle.test.ts`, `publishValidation.test.ts`, `contentEvaluation.test.ts` (new, Epic J), etc. All passing.
- Integration tests: `api/test/integration/` — mocked Supabase client; includes new `reports.test.ts`, `moderation.test.ts`, extended `publish.test.ts` for Epic J. All passing.
- RLS tests: `api/test/rls/` — real network calls against the linked Supabase project, `describe.skipIf(!canRun)` gated on env vars in `api/.dev.vars`. Includes new `abuseReports.rls.test.ts` and `moderators.rls.test.ts`. **Currently failing/blocked — see §12.**
- e2e tests: Playwright, `web/e2e/`. Not yet extended for the Epic J moderation/report UI (pending, part of the still-open manual verification step).
- Test data strategy: RLS suite uses three real Supabase Auth test identities (`RLS_TEST_USER_A`, `RLS_TEST_USER_B`, `RLS_TEST_MODERATOR`, credentials in `.dev.vars`) with fixed fake UUIDs reused across test cases within a file.

## 12) Known issues / tech debt (short, actionable)
- [ ] **Epic J RLS blocker (active, unresolved)** — `abuse_reports`'s `anyone_insert` policy (migration 0021) rejects a plain anonymous INSERT with `42501: new row violates row-level security policy`, even though: the policy's own boolean formula evaluates `true` when reproduced standalone under `set role anon`; `has_table_privilege('anon','public.abuse_reports','INSERT')` is `true`; migration is confirmed applied identically on local/remote; no triggers/defaults are mutating the row. Reproduced deterministically (twice, fresh UUIDs) via both PostgREST (`curl`, oddly returns HTTP 401 not 403) and raw `supabase db query --linked` SQL — rules out a PostgREST/JWT-header-specific cause. — impact: blocks `abuseReports.rls.test.ts` (3 of 8 cases fail: authenticated insert, moderator read, moderator resolve) and `npm test` overall (5 failing / 275 total as of last run) — location: `anchor-agentic/supabase/migrations/0021_abuse_reports.sql`, `anchor-agentic/api/test/rls/abuseReports.rls.test.ts` — plan: asked the user to run a reversible live probe themselves (`alter policy "anyone_insert" ... with check (true)` + retry insert, then restore) since Claude Code's auto-mode classifier blocks ALTER POLICY on the linked project — awaiting the user's result to determine whether the bug is in the policy expression itself or elsewhere in the RLS/executor path.
- [ ] `moderators.rls.test.ts` — one test (`lets a moderator update another user's skill via moderator_update`) failed sign-in for the moderator test account on the last run, even though the same account signed in successfully for other test cases in the same run — not yet investigated; may be transient/rate-limit, may be a separate bug. Re-test once the `abuse_reports` blocker above is resolved.
- [ ] Epic J e2e/manual verification not yet done: full US-044 loop (author requests review -> item leaves marketplace -> moderator approves/rejects) and full US-045/046 loop (anonymous report -> item pulled -> moderator dismisses [restores] or removes [terminal]) against local `wrangler dev` + linked Supabase — needs KV namespace (`RATE_LIMIT_KV`) actually created via `wrangler kv namespace create RATE_LIMIT_KV` and its id filled into `api/wrangler.jsonc` (currently a template placeholder).
- [ ] No CI pipeline configured for either `web` or `api` (not found in repo) — tests are run locally only.

## 13) Commands (copy/paste)
- Install: `cd anchor-agentic/api && npm install` / `cd anchor-agentic/web && npm install`
- Run API (local Worker): `cd anchor-agentic/api && npm run dev`
- Run UI (local dev server): `cd anchor-agentic/web && npm run dev`
- Run all API tests: `cd anchor-agentic/api && npm test`
- Run all UI tests: `cd anchor-agentic/web && npm run test:unit -- --run` (unit) and `npm run test:e2e` (Playwright)
- Lint/format (web only): `cd anchor-agentic/web && npm run lint` / `npm run format`
- Type check (web): `cd anchor-agentic/web && npm run check`
- Migrations (user-run against linked project, not automated): `cd anchor-agentic/supabase && supabase db push`
- Ad-hoc SQL against linked project (no DB password needed): `cd anchor-agentic/supabase && npx supabase db query --linked "<sql>"`
- Migration drift check: `cd anchor-agentic/supabase && npx supabase migration list`

## 14) "How to work with Claude Code on this repo" (token-saving rules)
- Ground new feature work in `docs/USER-STORIES.md` (find/add the epic+story+ACs) before writing code.
- Respect layer boundaries: UI in `web`, business logic/authZ in `api`, schema/RLS in `supabase`.
- Never paste Supabase secrets into chat; read `.dev.vars`/`.env` values only through tools, never echo them into chat text — use shell-variable substitution (curl sourcing `.dev.vars`) and filter response bodies to non-sensitive fields before printing.
- Use `supabase db query --linked` for diagnostic/read SQL against the linked project; leave schema/policy-mutating DDL (`ALTER POLICY`, etc.) to the user to run themselves, or ask first — the auto-mode classifier will block risky mutations on the live linked project anyway.
- Prefer minimal diffs; avoid refactors unless required for acceptance criteria.
- Re-check the relevant ACs against the finished implementation before calling a story/epic done (see Epic H/I/J completion-report pattern).

## 15) Next epic starter prompt (copy/paste)
> Replace placeholders and use this to start a fresh Claude session.

**Context:** Use `docs/ai/PROJECT_STATE.md` as the source of truth. Epic J (Quality & Trust) implementation is done; only the RLS verification step in §12 is blocking completion.

**Goal:** Resolve the `abuse_reports` RLS INSERT blocker (§12), then finish Epic J verification: re-run `cd anchor-agentic/api && npm test` to confirm 0 failures across all 275+ tests, re-test the `moderators.rls.test.ts` moderator sign-in flake, then do the manual/e2e US-044/045/046 loop verification against local `wrangler dev` + linked Supabase (after creating the real `RATE_LIMIT_KV` namespace).

**Acceptance criteria:**
- `npm test` in `anchor-agentic/api` passes with zero failures, zero unexpected skips.
- Every AC in US-042 through US-046 (`docs/USER-STORIES.md`) re-checked one by one against the running implementation.

**Constraints:**
- Touch only: `anchor-agentic/supabase/migrations/0021_abuse_reports.sql` (only if the RLS policy itself is confirmed to be the bug), `anchor-agentic/api/test/rls/*`, `anchor-agentic/api/wrangler.jsonc` (KV id)
- Tests required: RLS (real network), integration, e2e/manual
- No refactors unless necessary

**Deliverables:**
1) Root-caused and fixed (or explained) `abuse_reports` RLS behavior
2) Passing full test suite
3) Commands run + their output
4) Update `docs/ai/PROJECT_STATE.md` (§2, §3, §12 at minimum)
