# AnchorAgentic.io — User Stories & Acceptance Criteria

**Deliverable Owner:** Business Analyst Agent
**Source Inputs:** `docs/INITIAL-CONCEPT.md`, `docs/PRODUCT-CONCEPT.md`, `docs/ARCHITECTURE.md`
**Version:** 1.0 — 2026-09-06
**Status:** Ready for Test Analyst Agent handoff

---

## How to Read This Document

- Stories are grouped into **Epics** that mirror the Product Owner's Feature Categories (F-1.x through F-5.x) and the Architect's phased roadmap.
- **Phase 1/2 (V1/MVP)** stories are unlabeled. **Phase 3 (V2)** stories are explicitly tagged **[V2 — Deferred]** in their title and must not block any V1 story's Definition of Done.
- Acceptance criteria are grounded in the concrete entities and constraints from `ARCHITECTURE.md`: `ROLE`, `TASK`, `AGENT`, `AGENT_TASK`, `SKILL`, `WORKFLOW`, `WORKFLOW_STEP`, `VERSION_SNAPSHOT`, `RATING`, `CLONE_RECORD`, the item lifecycle states (`Draft → Published → UnderReview → Removed/Archived/Deprecated`), and the RLS-enforced anonymous/registered/owner permission model.
- Two architectural resolutions are treated as settled (not re-opened), per the Architect's explicit decisions, with a Note flagging this on the relevant stories:
  1. **Role and Task are not independently publishable** — only Agent, Skill, and Workflow are Marketplace items (publishable/ratable/clonable).
  2. **Role is an owned, per-user entity**, not a shared global taxonomy — duplicate "Test Analyst" Roles across users are expected and acceptable.

---

## Story Index / Table of Contents

### Epic A — Authentication & Platform Access
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-001](#us-001) | Register a new account | F-4.2 | High | 3 |
| [US-002](#us-002) | Log in / log out | F-4.2 | High | 2 |
| [US-003](#us-003) | Anonymous browsing without an account | F-4.2, F-1.1 | High | 2 |
| [US-004](#us-004) | Enforce anonymous vs. registered vs. owner permission boundaries | F-4.2 | High | 8 |

### Epic B — Domain Authoring (Role, Task, Agent, Skill, Workflow)
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-005](#us-005) | Author a new Role in My Sandbox | F-3.1 | High | 3 |
| [US-006](#us-006) | Author a Task owned by exactly one Role | F-3.2 | High | 3 |
| [US-007](#us-007) | Author an Agent fulfilling exactly one Role (1:1 enforcement) | F-3.3 | High | 5 |
| [US-008](#us-008) | Assign Tasks to an Agent (Role-scoped) | F-3.3 | High | 3 |
| [US-009](#us-009) | Author a Skill independent of any Role | F-3.4 | High | 5 |
| [US-010](#us-010) | Author a Workflow and add ordered steps | F-3.5 | High | 8 |
| [US-011](#us-011) | Reorder Workflow steps | F-3.5 | Medium | 3 |
| [US-012](#us-012) | Edit or remove a Workflow step | F-3.5 | Medium | 3 |
| [US-013](#us-013) | Persistent "+" create action on every page | F-2.5 | Medium | 2 |

### Epic C — Sandbox & Version Control
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-014](#us-014) | Every save creates a new version snapshot | F-2.4 | High | 5 |
| [US-015](#us-015) | View version history of a Sandbox item | F-2.4 | Medium | 5 |
| [US-016](#us-016) | Browse My Sandbox (own items only) | F-2.1 | High | 3 |
| [US-017](#us-017) | Browse and search All Sandbox (read-all across users) | F-2.2 | Medium | 5 |
| [US-018](#us-018) | Read-only enforcement of others' items in All Sandbox | F-2.2 | High | 3 |
| [US-019](#us-019) | Archive a Draft item | F-2.1 | Low | 2 |

### Epic D — Clone
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-020](#us-020) | Clone a published Marketplace item into My Sandbox | F-2.3 | High | 5 |
| [US-021](#us-021) | Clone provenance is recorded and visible | F-2.3 | Medium | 2 |
| [US-022](#us-022) | Clone duplicates the full referenced entity graph | F-2.3 | High | 8 |

### Epic E — Publish
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-023](#us-023) | Publish an Agent/Skill/Workflow from Sandbox to Marketplace | F-1.3 | High | 5 |
| [US-024](#us-024) | Publish-time completeness validation | F-1.3 | High | 5 |
| [US-025](#us-025) | Continue iterating after publish without altering the published version | F-1.3, F-2.4 | Medium | 5 |

### Epic F — Marketplace Browse & Search
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-026](#us-026) | Browse published Marketplace items (anonymous + registered) | F-1.1 | High | 5 |
| [US-027](#us-027) | View Marketplace item detail page | F-1.1 | High | 3 |
| [US-028](#us-028) | Search and filter the Marketplace | F-1.2 | Medium | 5 |
| [US-029](#us-029) | Fast, cached Marketplace listing performance | F-1.1 | Medium | 3 |

### Epic G — Ratings
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-030](#us-030) | Registered user rates a published item (1-5) | F-1.4 | High | 3 |
| [US-031](#us-031) | Anonymous user views ratings but cannot rate | F-1.4 | High | 2 |
| [US-032](#us-032) | Rating aggregate updates immediately and everywhere | F-1.4 | Medium | 3 |

### Epic H — Export & API Parity
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-033](#us-033) | Export an Agent to `.claude/agents/<name>.md` | F-4.3, F-4.5 | High | 5 |
| [US-034](#us-034) | Export a Skill to `.claude/skills/<name>/SKILL.md` | F-4.3, F-4.5 | High | 5 |
| [US-035](#us-035) | Export a Workflow to `.claude/commands/<name>.md` | F-4.3, F-4.5 | High | 5 |
| [US-036](#us-036) | Export via GitHub push (OAuth) | F-4.3, F-4.5 | High | 8 |
| [US-037](#us-037) | Local zip download of an export bundle | F-4.3, F-4.5 | High | 5 |
| [US-038](#us-038) | Sandbox API access for logged-in users | F-4.4 | Medium | 8 |
| [US-039](#us-039) | Marketplace API parity (browse/export headlessly) | F-4.3 | Medium | 5 |
| [US-040](#us-040) | Connect and revoke GitHub OAuth authorization | F-4.3 | Medium | 3 |

### Epic I — Sustainability
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-041](#us-041) | Donation link-out on the Marketplace | F-1.5 | Low | 2 |

### Epic J — Quality & Trust [V2 — Deferred]
| ID | Title | Feature ID(s) | Priority | Estimate |
|---|---|---|---|---|
| [US-042](#us-042) | [V2] Automated prompt evaluation before publish | F-5.1 | Medium | 8 |
| [US-043](#us-043) | [V2] Automated structure evaluation before publish | F-5.2 | Medium | 5 |
| [US-044](#us-044) | [V2] Optional human review before publish | F-5.3 | Low | 5 |
| [US-045](#us-045) | [V2] Report abusive or broken published content | F-5.4 | Medium | 5 |
| [US-046](#us-046) | [V2] Moderator removes reported content | F-5.4 | Medium | 5 |

---

## Dependency Matrix

| Story | Depends On | Reason |
|---|---|---|
| US-002 | US-001 | Must be able to register before logging in |
| US-003 | — | Anonymous access has no dependency; must exist before US-004 can be tested end-to-end |
| US-004 | US-001, US-002, US-003 | Permission boundary enforcement needs both anonymous and registered paths implemented |
| US-005 | US-002, US-004 | Role authoring requires a registered, authenticated Sandbox owner |
| US-006 | US-005 | Task must be owned by an existing Role |
| US-007 | US-005 | Agent must fulfill an existing Role (1:1) |
| US-008 | US-006, US-007 | Assigning Tasks to an Agent requires both to exist and share a Role |
| US-009 | US-002, US-004 | Skill authoring requires an authenticated Sandbox owner (no Role dependency) |
| US-010 | US-006, US-007, US-009 | Workflow steps reference Tasks, Agents, and Skills |
| US-011 | US-010 | Reordering requires steps to already exist |
| US-012 | US-010 | Editing/removing requires steps to already exist |
| US-013 | US-005, US-007, US-009, US-010 | The "+" action must target real creation flows |
| US-014 | US-005, US-006, US-007, US-009, US-010 | Versioning applies to saves on any domain entity |
| US-015 | US-014 | History view requires snapshots to exist |
| US-016 | US-005 (or any Sandbox item) | My Sandbox listing needs authored items |
| US-017 | US-016 | All Sandbox is a cross-user superset of My Sandbox behavior |
| US-018 | US-017 | Read-only enforcement is tested against All Sandbox results |
| US-019 | US-016 | Archiving requires a Draft item to exist |
| US-020 | US-023 (something must be Published), US-004 | Clone source must be a published item; clone requires registered permission |
| US-021 | US-020 | Provenance is recorded as part of the clone action |
| US-022 | US-020 | Graph duplication is part of the clone action's detailed behavior |
| US-023 | US-007 or US-009 or US-010, US-024 | Only Agent/Skill/Workflow can be published, and only after validation passes |
| US-024 | US-010 (for Workflow dangling-ref checks), US-008 | Validation logic depends on Workflow steps and Agent-Task assignment existing |
| US-025 | US-023, US-014 | Post-publish iteration depends on publish and versioning both existing |
| US-026 | US-023 | Marketplace has nothing to browse until something is published |
| US-027 | US-026 | Detail page is reached from the listing |
| US-028 | US-026 | Search/filter operates over the listing |
| US-029 | US-026 | Caching is a refinement of the base browse capability |
| US-030 | US-002, US-026 | Rating requires authentication and a published item to rate |
| US-031 | US-030 | Anonymous view depends on ratings existing to view |
| US-032 | US-030 | Aggregate recompute depends on ratings being submitted |
| US-033 | US-007 | Exporting an Agent requires an authored Agent |
| US-034 | US-009 | Exporting a Skill requires an authored Skill |
| US-035 | US-010 | Exporting a Workflow requires an authored Workflow |
| US-036 | US-033/034/035, US-040 | Git push needs mapped export content and an authorized GitHub connection |
| US-037 | US-033/034/035 | Local zip needs mapped export content |
| US-038 | US-004, US-005–US-012 | Sandbox API parity requires the underlying Sandbox capabilities to exist |
| US-039 | US-026, US-033/034/035 | Marketplace API parity requires browse and export logic to exist |
| US-040 | US-002 | OAuth connection requires an authenticated user |
| US-041 | US-026 | Donation link surfaces on the Marketplace UI |
| US-042 | US-023 | Evaluation runs as a pre-publish gate on the existing publish flow |
| US-043 | US-023 | Structure evaluation runs as a pre-publish gate |
| US-044 | US-042, US-043 | Human review is an optional additional step alongside automated checks |
| US-045 | US-026 | Reporting requires published content to exist |
| US-046 | US-045 | Removal acts on a reported item |

---

## Epic A — Authentication & Platform Access

### US-001
**User Story Title:** Register a New Account

**User Story ID:** US-001

**As a** first-time visitor
**I want to** register for an account with an email and password
**So that** I can unlock Sandbox and rating capabilities beyond anonymous Marketplace browsing

**Description:**
Registration is the gate for all write/community functionality (F-4.2). Registered users are represented as `USER` rows and authenticated via Supabase Auth (JWT). Anonymous users are explicitly excluded from Sandbox access and rating.

**Acceptance Criteria:**
- [ ] Given a visitor is on the Registration page, When they submit a valid, unique email, a username, and a password meeting minimum strength requirements, Then a new `USER` row is created and a verification/session flow begins.
- [ ] Given a visitor submits an email that already exists in `USER`, When they attempt to register, Then registration is rejected with a clear "email already registered" error and no duplicate row is created.
- [ ] Given a visitor submits an invalid email format, When they submit the form, Then the system rejects the submission client-side and server-side with a validation error, without hitting the database.
- [ ] Given a visitor successfully registers, When registration completes, Then they land on the Marketplace with an active authenticated session (per the "first thing seen: the Marketplace" navigation rule).
- [ ] The system should hash/store credentials via Supabase Auth (never storing plaintext passwords in application tables).

**Priority:** High

**Estimate:** 3 story points

**Dependencies:** None

**Notes:** Auth is Supabase Auth (JWT), per Architecture Layer 2/4. Username uniqueness rules should be confirmed with UX but are not blocking for this story.

---

### US-002
**User Story Title:** Log In and Log Out

**User Story ID:** US-002

**As a** registered user
**I want to** log in with my credentials and log out when done
**So that** I can securely access My Sandbox, All Sandbox, and rating features across sessions

**Description:**
Supports session management via Supabase Auth JWTs, with refresh handled client-side per the architecture's security NFRs.

**Acceptance Criteria:**
- [ ] Given a registered user on the Login page, When they submit valid credentials, Then a JWT session is issued and they are redirected to the Marketplace as a recognized registered user.
- [ ] Given a registered user submits invalid credentials, When they attempt login, Then an error message is displayed and no session is created.
- [ ] Given a user has an active session, When they click "Log out," Then their session/JWT is invalidated client-side and subsequent requests are treated as anonymous.
- [ ] Given a user's JWT has expired, When they attempt a Sandbox action, Then the system prompts re-authentication rather than silently failing or exposing a 500 error.

**Priority:** High

**Estimate:** 2 story points

**Dependencies:** US-001

**Notes:** None.

---

### US-003
**User Story Title:** Anonymous Browsing Without an Account

**User Story ID:** US-003

**As an** anonymous (unregistered) visitor
**I want to** browse the Marketplace and view ratings without creating an account
**So that** I can evaluate the platform's value before committing to registration

**Description:**
Corresponds to Journey 1 (Maya, First-Time Anonymous Discovery). Anonymous users may read published Agents/Skills/Workflows and their ratings, but have zero access to Sandbox and cannot submit ratings.

**Acceptance Criteria:**
- [ ] Given a visitor with no session, When they load the Marketplace URL, Then they see the list of `PUBLISHED` Agents, Skills, and Workflows with their ratings, without any login prompt blocking the view.
- [ ] Given an anonymous visitor views an item detail page, When the page renders, Then they see description, current published version, and aggregate rating, but no "Rate this item" control and no "Clone" control.
- [ ] Given an anonymous visitor attempts to navigate directly to a Sandbox URL (My Sandbox or All Sandbox), When the request is made, Then they are redirected to a "Register/Login to continue" prompt rather than seeing Sandbox content.
- [ ] The system should never return `Draft`, `UnderReview`, or `Removed`-status item data to an unauthenticated request, at both the API and RLS layers.

**Priority:** High

**Estimate:** 2 story points

**Dependencies:** None (must exist before US-004 can be fully verified)

**Notes:** None.

---

### US-004
**User Story Title:** Enforce Anonymous vs. Registered vs. Owner Permission Boundaries

**User Story ID:** US-004

**As a** platform operator
**I want to** enforce the anonymous (read-published-only) / registered (read-all-Sandbox, write-own, rate) / owner (write-own-item) permission model at both the API and database layers
**So that** no bug in one layer can expose write operations or private data to the wrong user class

**Description:**
This is the architecture's Decision 6: RLS as a second enforcement layer, not the only one. Every Sandbox/Marketplace endpoint must be validated against this boundary. Sandbox items are never private (Constraint from `INITIAL-CONCEPT.md` and `PRODUCT-CONCEPT.md`) — "owner-write-only" does not mean "owner-read-only."

**Acceptance Criteria:**
- [ ] Given an anonymous request, When it targets any Sandbox-scoped endpoint (`/api/sandbox/*`), Then the API Gateway rejects it with 401/403 before it reaches a business-logic service.
- [ ] Given a registered user (not the owner) requests to read another user's Draft `ROLE`, `TASK`, `AGENT`, `SKILL`, or `WORKFLOW` via All Sandbox, When the request is made, Then the read succeeds (Sandbox is never private) but any accompanying write endpoint (PATCH/DELETE) for that item returns 403.
- [ ] Given a registered user attempts to write (create/edit/archive) an item they do not own, When the request reaches Postgres, Then the Row-Level Security policy rejects the write independent of whether the Worker-layer check was bypassed or buggy.
- [ ] Given an anonymous request targets a `Draft`, `UnderReview`, or `Removed` item via the Marketplace read endpoint, When the request is made, Then the API returns 404/403 rather than leaking the item's existence or content.
- [ ] The system should log all 403 authorization failures with a correlated request ID for observability.

**Priority:** High

**Estimate:** 8 story points

**Dependencies:** US-001, US-002, US-003

**Notes:** This story is cross-cutting infrastructure for every other story in this document; treat it as a foundational Phase 1 story, not a late add-on. Ground truth: `ARCHITECTURE.md` Layer 2 (Worker-layer enforcement) and Layer 4 (RLS as defense in depth).

---

## Epic B — Domain Authoring

### US-005
**User Story Title:** Author a New Role in My Sandbox

**User Story ID:** US-005

**As a** registered user
**I want to** define a new Role (e.g., "Business Analyst," "Test Analyst") in My Sandbox
**So that** I have a foundational entity an Agent can be built to fulfill

**Description:**
Maps to F-3.1. A `ROLE` row has `owner_id`, `name`, `description`, `status` (Draft/Published/etc. — though Roles are never independently published per architectural resolution), and `current_version`. Role is an owned, per-user entity (Architecture Decision 5) — not a shared global taxonomy. Creating a Role does not require or create an Agent yet.

**Acceptance Criteria:**
- [ ] Given a registered user is in My Sandbox, When they use the "+" action to create a new Role and supply a name and description, Then a new `ROLE` row is created with `owner_id` = the current user, `status = Draft`, `current_version = 1`.
- [ ] Given the user submits a Role with an empty name, When they submit, Then the system rejects the submission with a validation error and no row is created.
- [ ] Given two different users each create a Role named "Test Analyst," When both are saved, Then both `ROLE` rows persist independently with distinct `owner_id`s and no uniqueness conflict occurs across users.
- [ ] The system should record a `VERSION_SNAPSHOT` (item_type=ROLE, version_number=1) immediately on creation.

**Priority:** High

**Estimate:** 3 story points

**Dependencies:** US-002, US-004

**Notes:** Follows the Architect's Decision 5 resolution: Role is owned/per-user, not a shared global taxonomy. Role itself is never independently published to the Marketplace (Architecture Assumption) — it only becomes externally visible as folded metadata inside an exported Agent.

---

### US-006
**User Story Title:** Author a Task Owned by Exactly One Role

**User Story ID:** US-006

**As a** registered user
**I want to** define a Task and attach it to exactly one of my Roles
**So that** I can build up the set of actions an Agent fulfilling that Role can perform

**Description:**
Maps to F-3.2. A `TASK` row has `role_id` (FK, required), `owner_id`, `name`, `instructions`, `status`, `current_version`. Tasks are never shared across multiple Roles.

**Acceptance Criteria:**
- [ ] Given a registered user owns a Role, When they create a new Task and select that Role as its owner, Then a `TASK` row is created with `role_id` pointing to the selected Role and `owner_id` = current user.
- [ ] Given a user attempts to create a Task without selecting a Role, When they submit, Then the system rejects the submission — `role_id` is a required, non-nullable reference.
- [ ] Given a user attempts to select a Role owned by a different user as the parent for their new Task, When they submit, Then the system rejects the request (Task ownership must chain to a Role the same user owns).
- [ ] Given a Task is created, When a second Task is created with different instructions under the same Role, Then both Tasks persist as siblings under that one Role — a Role can own many Tasks.
- [ ] The system should reject any attempt to re-parent an existing Task to a second Role simultaneously (a Task belongs to exactly one Role at all times).

**Priority:** High

**Estimate:** 3 story points

**Dependencies:** US-005

**Notes:** None.

---

### US-007
**User Story Title:** Author an Agent Fulfilling Exactly One Role

**User Story ID:** US-007

**As a** registered user
**I want to** define an Agent that fulfills exactly one of my Roles
**So that** I have a sharable unit that embodies that Role's identity and capabilities

**Description:**
Maps to F-3.3. An `AGENT` row has `role_id` with a `UNIQUE` constraint enforcing 1:1 with Role (per-owner, not platform-wide — per Decision 5, two different users can each have their own "Test Analyst" Role+Agent pair), `owner_id`, `name`, `system_prompt`, `status`, `current_version`.

**Acceptance Criteria:**
- [ ] Given a registered user owns a Role that has no Agent yet, When they create an Agent and select that Role, Then a new `AGENT` row is created with `role_id` = that Role's id and `owner_id` = current user.
- [ ] Given a Role already has an Agent fulfilling it, When the same user attempts to create a second Agent for that same Role, Then the system rejects the request with a "Role already has an Agent" error (UNIQUE constraint on `role_id`, enforced per owner).
- [ ] Given two different users each own a Role named "Test Analyst" with its own Agent, When either user creates/edits their Agent, Then the 1:1 constraint is evaluated only within that owner's content graph, not across owners.
- [ ] Given a user submits an Agent with an empty `system_prompt`, When they attempt to publish it later (not at Draft-save time), Then publish-time validation (US-024) will flag it — but Draft-save itself should still succeed to support iterative authoring.
- [ ] The system should record a `VERSION_SNAPSHOT` on Agent creation and on every subsequent edit.

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-005

**Notes:** The Role↔Agent 1:1 constraint is enforced per-owner's content graph, not platform-wide, per Architecture Decision 5. Flag: this follows the Architect's explicit resolution.

---

### US-008
**User Story Title:** Assign Tasks to an Agent (Role-Scoped)

**User Story ID:** US-008

**As a** registered user
**I want to** assign one or more of my Role's Tasks to my Agent
**So that** the Agent performs the correct set of Tasks belonging to the Role it fulfills

**Description:**
Maps to F-3.3. Implemented via the `AGENT_TASK` join table. An Agent may only be assigned Tasks that belong to the same Role it fulfills — an Agent cannot perform Tasks from a Role it doesn't embody.

**Acceptance Criteria:**
- [ ] Given an Agent fulfilling Role R, When the owner assigns a Task that belongs to Role R, Then an `AGENT_TASK` row is created linking the Agent and Task.
- [ ] Given an Agent fulfilling Role R, When the owner attempts to assign a Task that belongs to a different Role (even one they own), Then the system rejects the assignment with a clear error ("Task must belong to the Agent's Role").
- [ ] Given an Agent has 3 Tasks assigned, When the owner unassigns one, Then the corresponding `AGENT_TASK` row is removed and a new `VERSION_SNAPSHOT` of the Agent is recorded reflecting the updated Task set.
- [ ] The system should allow an Agent to be assigned zero, one, or many Tasks from its Role — Task assignment is not required to save the Agent as a Draft.

**Priority:** High

**Estimate:** 3 story points

**Dependencies:** US-006, US-007

**Notes:** None.

---

### US-009
**User Story Title:** Author a Skill Independent of Any Role

**User Story ID:** US-009

**As a** registered user
**I want to** build a genuine Claude Code Skill through the platform, independent of any Role
**So that** I can create a directly-invocable capability that isn't tied to a specific SDLC Role

**Description:**
Maps to F-3.4. A `SKILL` row has `owner_id`, `name`, `description`, `skill_files` (JSON — the Skill's supporting file contents), `status`, `current_version`. Skills have no `role_id` and are never owned by a Role.

**Acceptance Criteria:**
- [ ] Given a registered user is in My Sandbox, When they create a new Skill with a name, description, and at least one skill file's content, Then a `SKILL` row is created with `owner_id` = current user and no Role association exists or is required anywhere in the data model.
- [ ] Given a user authors a Skill, When they save it, Then the `skill_files` JSON structure captures each file's relative path and content sufficient to later reconstruct a `.claude/skills/<name>/` folder.
- [ ] Given a user attempts to create a Skill with no name, When they submit, Then the system rejects the submission with a validation error.
- [ ] The system should record a `VERSION_SNAPSHOT` on Skill creation and every subsequent edit, independent of the versioning applied to Roles/Tasks/Agents/Workflows.

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-002, US-004

**Notes:** Skills map unchanged onto Claude Code's existing Skill convention (Architecture Decision 1) — this is intentionally the least lossy of the five export mappings.

---

### US-010
**User Story Title:** Author a Workflow and Add Ordered Steps

**User Story ID:** US-010

**As a** registered user
**I want to** define a Workflow as an ordered chain of steps that can each be a Task, an Agent, or a Skill
**So that** I can compose an executable end-to-end SDLC sequence

**Description:**
Maps to F-3.5. A `WORKFLOW` row (`owner_id`, `name`, `description`, `status`, `current_version`) contains many `WORKFLOW_STEP` rows, each with `order_index`, `step_type` (`TASK`/`AGENT`/`SKILL`), and exactly one of `task_id`/`agent_id`/`skill_id` populated matching `step_type`.

**Acceptance Criteria:**
- [ ] Given a registered user creates a new Workflow via the persistent "+" action, When they name it and save, Then a `WORKFLOW` row is created with `status = Draft`, `current_version = 1`, and zero steps.
- [ ] Given a Workflow exists, When the owner adds a step of `step_type = TASK` referencing one of their Tasks, Then a `WORKFLOW_STEP` row is created with the next sequential `order_index` and `task_id` populated (`agent_id`/`skill_id` left null).
- [ ] Given a Workflow exists, When the owner adds a step of `step_type = AGENT` or `step_type = SKILL`, Then the corresponding `agent_id` or `skill_id` field is populated and the other two reference fields remain null.
- [ ] Given a user attempts to add a step with `step_type = TASK` but no `task_id` (or a `task_id` that doesn't resolve to an existing Task the user can reference), When they submit, Then the system rejects the step with a validation error.
- [ ] Given three steps are added in sequence, When the Workflow is saved, Then `order_index` values are strictly increasing and gapless (0, 1, 2) reflecting the chain order.
- [ ] The system should record a `VERSION_SNAPSHOT` of the Workflow (including its full step list) on every save.

**Priority:** High

**Estimate:** 8 story points

**Dependencies:** US-006, US-007, US-009

**Notes:** A Workflow step may reference an Agent or Skill owned by another user only if that Agent/Skill is currently `Published` (see US-024 for the corresponding publish-time dangling-reference check); referencing another user's unpublished Draft is out of scope for V1 and should be blocked at the UI/API layer.

---

### US-011
**User Story Title:** Reorder Workflow Steps

**User Story ID:** US-011

**As a** registered user
**I want to** change the order of steps within my Workflow
**So that** the sequence correctly reflects the intended SDLC process order

**Description:**
Supports iterative refinement of a Workflow (Journey 3, Priya).

**Acceptance Criteria:**
- [ ] Given a Workflow has steps at `order_index` 0, 1, 2, When the owner drags/moves step 2 to position 0, Then the system re-indexes all affected steps so the new order is 0, 1, 2 with no gaps or duplicates.
- [ ] Given a reorder action completes, When the Workflow is saved, Then a new `VERSION_SNAPSHOT` captures the updated step order.
- [ ] Given a non-owner (even via All Sandbox) attempts to reorder another user's Workflow steps, When the request is made, Then it is rejected per the owner-write-own boundary (US-004).

**Priority:** Medium

**Estimate:** 3 story points

**Dependencies:** US-010

**Notes:** None.

---

### US-012
**User Story Title:** Edit or Remove a Workflow Step

**User Story ID:** US-012

**As a** registered user
**I want to** edit which Task/Agent/Skill a step references, or remove a step entirely
**So that** I can refine my Workflow without rebuilding it from scratch

**Description:**
Complements US-010/011 for full Workflow step lifecycle management.

**Acceptance Criteria:**
- [ ] Given a Workflow step references Task A, When the owner changes it to reference Task B (same `step_type`), Then the `WORKFLOW_STEP` row's reference field is updated and a new `VERSION_SNAPSHOT` is recorded.
- [ ] Given a Workflow step exists at `order_index` 1 of 3, When the owner removes it, Then the row is deleted and remaining steps are re-indexed to 0, 1 (no gap).
- [ ] Given the owner attempts to change a step's `step_type` from `TASK` to `AGENT`, When they submit, Then the system requires them to also supply a valid `agent_id` and clears `task_id`, maintaining the "exactly one reference field populated" invariant.
- [ ] The system should prevent saving a Workflow with zero steps as `Published` (see US-024) but should allow saving it as `Draft` with zero steps for early-stage iteration.

**Priority:** Medium

**Estimate:** 3 story points

**Dependencies:** US-010

**Notes:** None.

---

### US-013
**User Story Title:** Persistent "+" Create Action on Every Page

**User Story ID:** US-013

**As a** registered user
**I want to** access a persistent "+" button in the top-right of every page
**So that** I can start creating a new Agent, Skill, or Workflow at any point without navigating away first

**Description:**
Maps to F-2.5. Reduces friction to begin contributing (Guiding Principle 1). Not shown to anonymous users (they have no Sandbox to create into).

**Acceptance Criteria:**
- [ ] Given a registered user is on any page of the platform (Marketplace, My Sandbox, All Sandbox, item detail), When the page renders, Then a persistent "+" button is visible in the top-right corner.
- [ ] Given the user clicks the "+" button, When the menu opens, Then they are offered the choice to create a new Agent, Skill, or Workflow (Role and Task creation are reached via the Agent/Workflow authoring flow, not as top-level "+" options, since they are supporting entities).
- [ ] Given an anonymous visitor is browsing the Marketplace, When the page renders, Then the "+" button is not shown (or is shown disabled with a "Register to create" tooltip).
- [ ] Given the user selects "New Agent" from the "+" menu, When they confirm, Then they are routed directly into the Agent authoring flow (US-007) with a fresh Draft context.

**Priority:** Medium

**Estimate:** 2 story points

**Dependencies:** US-005, US-007, US-009, US-010

**Notes:** Role/Task are intentionally excluded from the top-level "+" menu since they are not independently published or the primary sharable unit — this follows the Architect's resolution that only Agent/Skill/Workflow are first-class Marketplace citizens.

---

## Epic C — Sandbox & Version Control

### US-014
**User Story Title:** Every Save Creates a New Version Snapshot

**User Story ID:** US-014

**As a** registered user
**I want to** have every change to my Role/Task/Agent/Skill/Workflow automatically versioned
**So that** I can iterate safely and never lose earlier states of my work

**Description:**
Maps to F-2.4 / Architecture Decision 2. Implemented as a `VERSION_SNAPSHOT` table storing full JSON snapshots per save, keyed polymorphically by `(item_type, item_id, version_number)`. This is application-level versioning, not per-item git repositories.

**Acceptance Criteria:**
- [ ] Given a user edits and saves any of Role, Task, Agent, Skill, or Workflow, When the save succeeds, Then a new `VERSION_SNAPSHOT` row is inserted with `item_type` matching the entity, `item_id` = the entity's id, `version_number` = previous max + 1, and `snapshot_data` containing the full post-save state.
- [ ] Given a save occurs, When the `VERSION_SNAPSHOT` is written, Then the parent entity's `current_version` field is updated to match the new `version_number` in the same transaction.
- [ ] Given a save fails validation, When the failure occurs, Then no `VERSION_SNAPSHOT` is created and `current_version` remains unchanged.
- [ ] The system should record `created_by` on every `VERSION_SNAPSHOT` as the acting user's id, even for clone-triggered initial snapshots (see US-020).

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-005, US-006, US-007, US-009, US-010

**Notes:** Ground truth: Architecture Decision 2 — chosen specifically over real per-item git repos to stay within the $20/month hosting cap. Git-export (US-036) is a separate, distinct concern from this internal versioning mechanism.

---

### US-015
**User Story Title:** View Version History of a Sandbox Item

**User Story ID:** US-015

**As a** registered user
**I want to** view the version history of my own Sandbox items
**So that** I can track how my work has evolved and understand what changed between saves

**Description:**
Surfaces the `VERSION_SNAPSHOT` records created by US-014 in a readable history view.

**Acceptance Criteria:**
- [ ] Given a Workflow has 4 saved versions, When the owner opens its "Version History" panel, Then they see all 4 `VERSION_SNAPSHOT` entries listed with `version_number`, `created_at`, and `created_by`, ordered newest-first.
- [ ] Given the owner selects a prior version, When they view it, Then the full `snapshot_data` for that version is rendered read-only (not silently applied as the current state).
- [ ] Given a registered user views another user's item via All Sandbox, When they open its version history, Then they can read it (Sandbox items are never private) but see no "restore this version" write action.
- [ ] The system should paginate version history for items with many saves rather than loading unbounded snapshot lists.

**Priority:** Medium

**Estimate:** 5 story points

**Dependencies:** US-014

**Notes:** "Restore to a prior version" as an explicit write action is out of scope for V1 (not named in the source docs); this story covers read-only history viewing only. Flag as a candidate follow-up story if the Product Owner confirms it's needed.

---

### US-016
**User Story Title:** Browse My Sandbox (Own Items Only)

**User Story ID:** US-016

**As a** registered user
**I want to** see a dedicated "My Sandbox" view listing only the items I own
**So that** I can quickly find and continue working on my own in-progress content

**Description:**
Maps to F-2.1. Supports the navigation model described in `INITIAL-CONCEPT.md`: ability to switch between "My Sandbox" and "All Sandbox."

**Acceptance Criteria:**
- [ ] Given a registered user navigates to "My Sandbox," When the page loads, Then it lists all Roles, Tasks, Agents, Skills, and Workflows where `owner_id` = current user, regardless of `status` (Draft, Published, Archived).
- [ ] Given a user owns 0 items, When they open My Sandbox, Then they see an empty state prompting them to use the "+" action to create their first item.
- [ ] Given a user's item has been Published, When they view My Sandbox, Then the item still appears there (with a "Published" status badge) — publishing does not remove it from the owner's Sandbox view.
- [ ] The system should not show any other user's items in the My Sandbox view under any filter combination.

**Priority:** High

**Estimate:** 3 story points

**Dependencies:** US-005 (or any authored item)

**Notes:** None.

---

### US-017
**User Story Title:** Browse and Search All Sandbox (Read-All Across Users)

**User Story ID:** US-017

**As a** registered user
**I want to** search across every registered user's in-progress Sandbox content
**So that** I can learn from others' work-in-progress and avoid duplicating effort

**Description:**
Maps to F-2.2. Corresponds to Journey 4. Full-text search via Postgres `tsvector`/GIN indexes across all `SANDBOX`-status items regardless of owner.

**Acceptance Criteria:**
- [ ] Given a registered user switches to "All Sandbox," When the page loads with no filters, Then it lists Sandbox items from every registered user (including their own), not just Drafts belonging to the current user.
- [ ] Given a user searches "payments" with `type=Agent` filter, When results return, Then only Agents whose name/description/system_prompt match the search term across all owners are shown.
- [ ] Given All Sandbox results are rendered, When the user views a result, Then no edit affordances (edit/delete/publish buttons) are rendered for items the current user does not own.
- [ ] Given a Published item also exists, When a user searches All Sandbox, Then Published items belonging to other users are still discoverable there too (Sandbox visibility isn't restricted to only Draft-status), since "All Sandbox" reflects the full cross-user content graph.
- [ ] The system should return All Sandbox search results within the platform's general Marketplace-adjacent performance target (a few seconds) even as the item count grows into the low thousands.

**Priority:** Medium

**Estimate:** 5 story points

**Dependencies:** US-016

**Notes:** None.

---

### US-018
**User Story Title:** Read-Only Enforcement of Others' Items in All Sandbox

**User Story ID:** US-018

**As a** platform operator
**I want to** guarantee that All Sandbox is strictly read-only for items the viewer doesn't own
**So that** the "read-all, write-own" rule is never violated by a UI or API oversight

**Description:**
This is the explicit test/verification counterpart to US-017's UI-level claim, ensuring API-level and RLS-level enforcement, not just missing buttons in the UI.

**Acceptance Criteria:**
- [ ] Given User B views User A's Draft Agent via All Sandbox, When User B issues a direct `PATCH /api/sandbox/agents/{id}` API call against it (bypassing the UI), Then the API returns 403 Forbidden.
- [ ] Given User B issues a direct `DELETE` call against User A's item, When the request reaches Postgres, Then the RLS policy denies the write independent of the Worker-layer check.
- [ ] Given User B attempts to add/reorder/remove a Workflow step on User A's Workflow via All Sandbox, When the request is made, Then it is rejected with the same 403 boundary as any other write.
- [ ] The system should return the same read data to User B for User A's Sandbox item as it would to User A themselves (no redaction), since Sandbox content is never private — only writes are restricted.

**Priority:** High

**Estimate:** 3 story points

**Dependencies:** US-017

**Notes:** None.

---

### US-019
**User Story Title:** Archive a Draft Item

**User Story ID:** US-019

**As a** registered user
**I want to** archive a Draft item I no longer want to actively work on
**So that** I can declutter My Sandbox without permanently deleting my version history

**Description:**
Maps to the item lifecycle state diagram: `Draft → Archived: Owner deletes/archives`. Archived items are terminal (`Archived → [*]`).

**Acceptance Criteria:**
- [ ] Given the owner has a Draft Agent, When they choose "Archive," Then the Agent's `status` transitions from `Draft` to `Archived` and it is hidden from the default My Sandbox listing (but remains queryable via a "show archived" toggle).
- [ ] Given an item is `Archived`, When the owner attempts to edit it, Then the system blocks further edits (Archived is terminal per the state diagram) and suggests cloning it if they want to resume work.
- [ ] Given an item is `Published`, When the owner attempts to "Archive" it directly, Then the action is unavailable — publish is a one-way transition and Published items follow a different lifecycle path (`Published → Deprecated`, not `Archived`).
- [ ] The system should retain all prior `VERSION_SNAPSHOT` rows for an Archived item (archiving is not deletion of history).

**Priority:** Low

**Estimate:** 2 story points

**Dependencies:** US-016

**Notes:** None.

---

## Epic D — Clone

### US-020
**User Story Title:** Clone a Published Marketplace Item into My Sandbox

**User Story ID:** US-020

**As a** registered user
**I want to** clone a published Agent, Skill, or Workflow into my own Sandbox
**So that** I can adapt community-refined content as my own starting point, always for free

**Description:**
Maps to F-2.3. Corresponds to Journey 2 (Devon). Clone is always free (no monetization). Clone creates a fresh owned copy — never a reference to the original.

**Acceptance Criteria:**
- [ ] Given a `Published` Agent exists in the Marketplace, When a registered user clicks "Clone into My Sandbox," Then a new `AGENT` row is created with `owner_id` = the cloning user, `status = Draft`, `current_version = 1`, and content copied from the source.
- [ ] Given the same flow for a `Published` Skill or Workflow, When cloned, Then the equivalent new `SKILL` or `WORKFLOW` row (plus, for Workflow, new `WORKFLOW_STEP` rows) is created owned by the cloning user.
- [ ] Given an anonymous visitor views a Published item, When they attempt to clone it, Then the action is unavailable and they are prompted to register/log in first.
- [ ] Given a user clones an item, When the clone completes, Then no charge, quota, or paid-tier gate is applied — cloning is unconditionally free, with no limit tied to any monetization mechanism.
- [ ] Given a clone completes, When the new item appears, Then it is immediately visible in the cloning user's My Sandbox with `status = Draft`, ready for further edits.

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-023, US-004

**Notes:** Only Agent, Skill, and Workflow are clonable — Role and Task have no standalone clone action (they are cloned only as part of cloning the Agent/Workflow that references them, per US-022).

---

### US-021
**User Story Title:** Clone Provenance Is Recorded and Visible

**User Story ID:** US-021

**As a** contributor whose work gets cloned
**And as** a cloning user
**I want to** have clone actions recorded with source/destination provenance
**So that** the platform can track reuse (for community metrics) and users can see where their cloned item originated

**Description:**
Maps to the `CLONE_RECORD` table: `source_item_type`, `source_item_id`, `cloned_item_id`, `cloned_by`, `cloned_at`.

**Acceptance Criteria:**
- [ ] Given a user clones a Published Agent, When the clone completes, Then a `CLONE_RECORD` row is inserted with `source_item_type = AGENT`, `source_item_id` = the original Agent's id, `cloned_item_id` = the new Agent's id, `cloned_by` = the cloning user, `cloned_at` = now.
- [ ] Given a cloned item's detail view is opened by its new owner, When the page renders, Then it displays a "Cloned from [original item name]" provenance link back to the source Marketplace listing.
- [ ] Given the original item's owner views their own item's Marketplace listing, When they check its stats, Then they can see a count of how many times it has been cloned (derived from `CLONE_RECORD` rows where `source_item_id` = their item).
- [ ] The system should preserve the `CLONE_RECORD` even if the original source item is later Deprecated or Removed (provenance is historical, not conditional on source item's current state).

**Priority:** Medium

**Estimate:** 2 story points

**Dependencies:** US-020

**Notes:** The "3,000 clones in 6 months" success metric from `PRODUCT-CONCEPT.md` is measured directly from `CLONE_RECORD` row counts sourced from `PUBLISHED` items, per `ARCHITECTURE.md`'s KPI table — this story is what makes that KPI measurable.

---

### US-022
**User Story Title:** Clone Duplicates the Full Referenced Entity Graph

**User Story ID:** US-022

**As a** registered user
**I want to** receive a fully self-contained, independently editable copy when I clone an Agent or Workflow
**So that** my edits never accidentally affect another user's Role, Task, Agent, or Skill

**Description:**
Per `ARCHITECTURE.md`'s Data Model notes and Journey 2 sequence diagram: cloning an Agent duplicates "Agent + owning Role + Tasks -> new owned rows," not just the Agent row itself. This story generalizes that behavior to Workflow clones (which may reference Tasks, Agents, and Skills across multiple steps).

**Acceptance Criteria:**
- [ ] Given a Published Agent fulfilling Role "Test Analyst" with 3 assigned Tasks, When a user clones the Agent, Then the system creates a new owned `ROLE` row (copy of "Test Analyst"), 3 new owned `TASK` rows (copies), a new owned `AGENT` row (copy) with `role_id` pointing to the new Role, and new `AGENT_TASK` rows linking the new Agent to the new Tasks — all owned by the cloning user.
- [ ] Given a Published Workflow with steps referencing 2 Tasks (via their owning Agents' Roles), 1 Agent, and 1 Skill, When a user clones the Workflow, Then the system duplicates the full referenced graph (Roles, Tasks, Agents, Skills as needed) into new owned rows, and the new `WORKFLOW_STEP` rows are rewired to point to the newly-created copies, not the originals.
- [ ] Given a Published Skill (which has no sub-references) is cloned, When the clone completes, Then only a single new `SKILL` row is created — no additional graph duplication is needed since Skills are leaf entities.
- [ ] Given the clone's graph duplication completes, When the cloning user edits their copy of a Task, Then the original owner's source Task is completely unaffected (fully independent copies, not shared references).
- [ ] The system should create one `VERSION_SNAPSHOT` (version 1) for each newly-created cloned entity (Role, Task, Agent, and the top-level cloned item), and one top-level `CLONE_RECORD` for the primary cloned item (Agent or Workflow).

**Priority:** High

**Estimate:** 8 story points

**Dependencies:** US-020

**Notes:** This is the most architecturally significant clone behavior — it directly implements the "copy + provenance" semantics shown in the Architecture's Journey 2 sequence diagram, generalized per Decision 5 (Role is owned/duplicated per user, never shared/referenced across owners).

---

## Epic E — Publish

### US-023
**User Story Title:** Publish an Agent, Skill, or Workflow from Sandbox to Marketplace

**User Story ID:** US-023

**As a** registered user
**I want to** publish my Agent, Skill, or Workflow from My Sandbox to the Marketplace
**So that** other users can discover, clone, and rate it

**Description:**
Maps to F-1.3. Publish is a one-way `SANDBOX (Draft) → PUBLISHED` transition per the item lifecycle state diagram — there is no "unpublish" action in V1. Only Agent, Skill, and Workflow are publishable; Role and Task are not independently publishable.

**Acceptance Criteria:**
- [ ] Given the owner has a Draft Agent that passes completeness validation (US-024), When they click "Publish," Then the Agent's `status` transitions to `Published`, becomes visible on the Marketplace to all users (including anonymous), and is now eligible for rating and cloning.
- [ ] Given the same flow for a Skill or Workflow, When published, Then the equivalent transition and Marketplace visibility applies.
- [ ] Given a user attempts to publish a `ROLE` or `TASK` directly (e.g., via a crafted API call), When the request is made, Then the system rejects it — there is no publish endpoint for Role or Task, only for Agent/Skill/Workflow.
- [ ] Given an item is already `Published`, When the owner attempts to "un-publish" it, Then no such action exists in V1 — publish is one-way (the closest available action is Deprecation, which is a separate future story, not de-listing).
- [ ] The system should require the acting user to be the item's `owner_id` — publishing another user's Draft item, even via All Sandbox visibility, is rejected.

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-007, US-009, US-010, US-024

**Notes:** Follows the Architect's explicit resolution that Role and Task are not independently published — they are supporting entities referenced by, and inlined into, Agents/Workflows at export time (see US-033/035), never Marketplace listings themselves.

---

### US-024
**User Story Title:** Publish-Time Completeness Validation

**User Story ID:** US-024

**As a** registered user
**I want to** have my item validated for completeness before it can publish
**So that** malformed or broken content isn't published (even absent V2's automated quality gates)

**Description:**
Maps to the Publish Service's `validate completeness (no dangling step refs)` step shown in Architecture Journey 3's sequence diagram. This is basic structural validation present in V1, distinct from and simpler than the full V2 automated evaluation pipeline (US-042/043).

**Acceptance Criteria:**
- [ ] Given a Workflow has a step referencing a Task, Agent, or Skill that has since been deleted/archived by its owner, When the owner attempts to publish the Workflow, Then publish is rejected with a "dangling step reference" error identifying the broken step.
- [ ] Given a Workflow has zero steps, When the owner attempts to publish it, Then publish is rejected ("a Workflow must have at least one step to publish").
- [ ] Given an Agent has an empty `system_prompt`, When the owner attempts to publish it, Then publish is rejected with a clear validation message.
- [ ] Given a Skill has an empty `skill_files` structure (no files at all), When the owner attempts to publish it, Then publish is rejected ("a Skill must include at least one file").
- [ ] Given all completeness checks pass, When the owner clicks Publish, Then the transition proceeds without further gating (this is not a quality/content-review gate — it is a structural well-formedness check only).

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-008, US-010

**Notes:** This story is intentionally scoped to structural completeness only, per V1's "open publish (no moderation gate)" principle. Do not conflate this with US-042/043 (V2 automated evaluation), which are content-quality checks, not structural well-formedness checks.

---

### US-025
**User Story Title:** Continue Iterating After Publish Without Altering the Published Version

**User Story ID:** US-025

**As a** contributor
**I want to** keep refining my item in My Sandbox after publishing it
**So that** I can improve it over time while the Marketplace-visible version remains stable for cloners and raters until I choose to re-publish

**Description:**
Maps to the state diagram's `Published → Published: Rated / Cloned by others` self-loop and the Publish Service's "freeze v_public" behavior described in Journey 3.

**Acceptance Criteria:**
- [ ] Given a Workflow is `Published` at version 3, When the owner makes further edits, Then a new `VERSION_SNAPSHOT` (version 4) is recorded, but the Marketplace-visible content continues to reflect the frozen `v_public` snapshot (version 3) until a new publish action occurs.
- [ ] Given the owner has made post-publish edits, When other users browse the Marketplace, Then they continue to see the previously published (frozen) version, not the owner's in-progress unpublished edits.
- [ ] Given the owner is satisfied with their post-publish edits, When they click "Publish" again, Then the `v_public` pointer/snapshot updates to the latest version and the Marketplace listing reflects the new content.
- [ ] The system should preserve all `CLONE_RECORD` and `RATING` rows tied to the item across re-publish events (re-publishing does not reset provenance or ratings).

**Priority:** Medium

**Estimate:** 5 story points

**Dependencies:** US-023, US-014

**Notes:** The exact re-publish UX (explicit "Re-publish" button vs. automatic) should be confirmed with the Product Owner; acceptance criteria assume an explicit action consistent with publish being owner-initiated, not automatic on every save.

---

## Epic F — Marketplace Browse & Search

### US-026
**User Story Title:** Browse Published Marketplace Items (Anonymous + Registered)

**User Story ID:** US-026

**As a** visitor (anonymous or registered)
**I want to** browse a grid/list of published Agents, Skills, and Workflows with their ratings
**So that** I can discover content relevant to my project before deciding to clone anything

**Description:**
Maps to F-1.1. Corresponds to Journey 1. Marketplace is the "first thing seen" landing view for a registered user per `INITIAL-CONCEPT.md`.

**Acceptance Criteria:**
- [ ] Given any visitor (anonymous or registered) loads the Marketplace, When the page renders, Then it lists all `Published`-status Agents, Skills, and Workflows with name, type, short description, and aggregate rating.
- [ ] Given the Marketplace has zero published items (cold start), When a visitor loads it, Then a clear empty/seed state is shown rather than a blank page (mitigated at launch by seeded default templates per the roadmap, but the empty-state UI must still exist defensively).
- [ ] Given a registered user logs in, When they land, Then the Marketplace is the default first view (per the "first thing seen" navigation rule), with clear navigation to My Sandbox / All Sandbox.
- [ ] The system should never include `Draft`, `UnderReview`, `Archived`, or `Removed` items in this listing, for any visitor type.

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-023

**Notes:** None.

---

### US-027
**User Story Title:** View Marketplace Item Detail Page

**User Story ID:** US-027

**As a** visitor (anonymous or registered)
**I want to** open a published item's detail page
**So that** I can read its full description, current version, and rating before deciding to clone it

**Description:**
Maps to F-1.1, extending US-026 to the item-level view shown in Journey 1's sequence diagram (`GET /api/marketplace/items/{id}`).

**Acceptance Criteria:**
- [ ] Given a visitor clicks a Marketplace listing, When the detail page loads, Then it shows the item's name, type (Agent/Skill/Workflow), full description, current published version number, aggregate rating and rating count.
- [ ] Given the item is an Agent, When the detail page renders, Then it shows the Role it fulfills and the list of Tasks it performs (read-only, inlined presentation — Role/Task are not separately browsable Marketplace entries).
- [ ] Given the item is a Workflow, When the detail page renders, Then it shows the ordered list of steps with each step's type (Task/Agent/Skill) and referenced item name.
- [ ] Given a registered user views the detail page, When it renders, Then they additionally see "Clone into My Sandbox" and "Rate this item" controls, absent for anonymous visitors.
- [ ] Given an anonymous visitor requests a detail page for a non-Published item id (guessed/enumerated), When the request is made, Then the system returns 404 rather than leaking any content.

**Priority:** High

**Estimate:** 3 story points

**Dependencies:** US-026

**Notes:** None.

---

### US-028
**User Story Title:** Search and Filter the Marketplace

**User Story ID:** US-028

**As a** visitor (anonymous or registered)
**I want to** search and filter Marketplace items by type, Role, and rating
**So that** I can efficiently find relevant content as the library grows

**Description:**
Maps to F-1.2. Uses Postgres full-text search (`tsvector`/GIN indexes) per Architecture Layer 4.

**Acceptance Criteria:**
- [ ] Given a visitor enters a search term, When results return, Then only `Published` items whose name/description (and, for Agents, Role name) match the term are shown, ranked by relevance.
- [ ] Given a visitor applies a `type=Agent` filter, When results return, Then only Published Agents are shown, excluding Skills and Workflows.
- [ ] Given a visitor applies a `role=Test Analyst` filter, When results return, Then only Agents (and Workflows whose steps reference such Agents, if in scope) associated with a Role named "Test Analyst" are shown — noting per Decision 5 that multiple distinct owners' "Test Analyst" Roles are all included, not deduplicated into one canonical entry.
- [ ] Given a visitor sorts by "Highest Rated," When results are re-rendered, Then items are ordered by descending aggregate rating, ties broken by clone count or recency (implementation detail, to be confirmed with design).
- [ ] The system should return Marketplace search results within the platform's sub-2-second p95 performance target under typical load.

**Priority:** Medium

**Estimate:** 5 story points

**Dependencies:** US-026

**Notes:** Sort-by-rating is explicitly called out in the Architecture's Risk table as a key mitigation for V1's no-moderation risk — prioritize this within the story if scope must be trimmed.

---

### US-029
**User Story Title:** Fast, Cached Marketplace Listing Performance

**User Story ID:** US-029

**As a** visitor (anonymous or registered)
**I want to** have the Marketplace listing load quickly even under repeated traffic
**So that** browsing feels responsive and matches the platform's stated performance target

**Description:**
Non-functional requirement made testable: Marketplace listings are cached at the edge via Workers KV with a short TTL, invalidated on publish/rating writes, per Architecture Layer 2 and NFRs.

**Acceptance Criteria:**
- [ ] Given the Marketplace listing endpoint is called repeatedly within the cache TTL window, When requests are made, Then subsequent requests are served from Workers KV edge cache rather than re-querying Postgres each time.
- [ ] Given a new item is published, When the publish transaction commits, Then the Marketplace listing cache is invalidated so the newly published item appears on the next request (no stale-cache lag beyond the TTL).
- [ ] Given a rating is submitted for a Published item, When the rating aggregate is recomputed, Then the cache is invalidated so the updated aggregate is reflected on the next Marketplace read.
- [ ] The system should achieve a p95 Marketplace page load (LCP) under 2 seconds under the platform's expected traffic (hundreds to low-thousands of concurrent users), per the KPI table.

**Priority:** Medium

**Estimate:** 3 story points

**Dependencies:** US-026

**Notes:** This is the testable expression of the "Technical: API response time (Marketplace read, p95) < 2s" and "User Experience: Marketplace page load (LCP) < 2s" KPIs from `ARCHITECTURE.md`.

---

## Epic G — Ratings

### US-030
**User Story Title:** Registered User Rates a Published Item (1-5)

**User Story ID:** US-030

**As a** registered user
**I want to** submit a 1-5 rating on a Published Agent, Skill, or Workflow
**So that** I can signal quality to the community after using it

**Description:**
Maps to F-1.4. Corresponds to Journey 5. A `RATING` row (`item_type`, `item_id`, `user_id`, `score`, `created_at`) is unique per (user, item) — resubmitting updates rather than duplicates.

**Acceptance Criteria:**
- [ ] Given a registered user views a Published item they haven't rated, When they submit a score of 4, Then a new `RATING` row is inserted with `score = 4`, `user_id` = current user, `item_type`/`item_id` = the target item.
- [ ] Given the same user later changes their mind and submits a score of 2 for the same item, When they resubmit, Then the existing `RATING` row is updated (UPSERT keyed on unique `user_id` + `item_id`), not duplicated.
- [ ] Given a user attempts to submit a score outside the 1-5 range (e.g., 0 or 6), When they submit, Then the request is rejected with a validation error.
- [ ] Given a user attempts to rate a Draft or UnderReview item (not yet Published), When they attempt the action, Then rating is unavailable — only Published items are ratable.
- [ ] Given a user attempts to rate a Role or Task directly, When they attempt the action, Then no rating control exists — only Agent, Skill, and Workflow are ratable, per the domain model's `item_type` CHECK constraint on `RATING`.

**Priority:** High

**Estimate:** 3 story points

**Dependencies:** US-002, US-026

**Notes:** None.

---

### US-031
**User Story Title:** Anonymous User Views Ratings But Cannot Rate

**User Story ID:** US-031

**As an** anonymous visitor
**I want to** see the aggregate rating of a Published item
**So that** I can gauge quality before deciding whether to register and clone it

**Description:**
Maps to F-1.4's explicit anonymous-view/registered-write split.

**Acceptance Criteria:**
- [ ] Given an anonymous visitor views a Published item's Marketplace listing or detail page, When the page renders, Then the aggregate rating (average score and count) is visible.
- [ ] Given an anonymous visitor views the same page, When it renders, Then no "submit a rating" control is present, and any direct API call to the rating submission endpoint without a valid JWT returns 401/403.
- [ ] Given an item has zero ratings yet, When any visitor (anonymous or registered) views it, Then the system displays a clear "Not yet rated" state rather than a misleading "0" or error.

**Priority:** High

**Estimate:** 2 story points

**Dependencies:** US-030

**Notes:** None.

---

### US-032
**User Story Title:** Rating Aggregate Updates Immediately and Everywhere

**User Story ID:** US-032

**As any** user of the platform
**I want to** see rating changes reflected immediately across the Marketplace
**So that** the rating signal stays trustworthy and current for all viewers

**Description:**
Maps to the Rating Service sequence diagram in Journey 5: `Rate->>PG: recompute aggregate rating` followed by cache invalidation so "next Marketplace read (any user, incl. anonymous) returns updated aggregate."

**Acceptance Criteria:**
- [ ] Given a user submits or updates a rating, When the write transaction commits, Then the item's aggregate rating (average + count) is recomputed synchronously as part of that same operation.
- [ ] Given the aggregate is recomputed, When any subsequent Marketplace read occurs (by any user, including anonymous), Then it reflects the new aggregate — the short-TTL edge cache (Workers KV) is invalidated on this write, not left to expire naturally.
- [ ] Given a user submits a rating, When the UI responds, Then the submitting user's own view immediately reflects their rating without requiring a manual page refresh.
- [ ] The system should compute the aggregate as a simple arithmetic mean of all current `RATING.score` values for that `item_id`, recalculated on each write (not an approximate/streaming estimate).

**Priority:** Medium

**Estimate:** 3 story points

**Dependencies:** US-030

**Notes:** None.

---

## Epic H — Export & API Parity

### US-033
**User Story Title:** Export an Agent to `.claude/agents/<name>.md`

**User Story ID:** US-033

**As a** registered user
**I want to** export my Agent into the exact file Claude Code expects for a sub-agent definition
**So that** it drops directly into my `.claude` folder with no manual reformatting

**Description:**
Maps to F-4.3/F-4.5 and Architecture Decision 1: **Agent → `.claude/agents/<name>.md`**, with the Role's name/description folded into YAML frontmatter and the Agent's assigned Tasks inlined as an "Abilities/Steps" section in the markdown body.

**Acceptance Criteria:**
- [ ] Given a user requests export of their Agent, When the Export Mapping Service builds the artifact, Then it produces a single file at path `.claude/agents/<agent-name-slug>.md`.
- [ ] Given the Agent fulfills Role "Test Analyst" with `system_prompt` text, When the file is generated, Then the file's YAML frontmatter includes the Role's name and description, and the body includes the Agent's `system_prompt`.
- [ ] Given the Agent has 3 assigned Tasks, When the file is generated, Then the body includes an "Abilities" (or equivalently named) section listing each Task's name and instructions, inlined as markdown — Task and Role have no separate exported files of their own.
- [ ] Given the Agent's name contains spaces or special characters, When the filename is generated, Then it is slugified into a valid, collision-safe filesystem-friendly name.
- [ ] The system should generate this file content server-side using only small, text-based assembly (markdown/JSON), consistent with the Workers CPU-time constraint (Architecture Decision 4) — no binary processing occurs at this stage.

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-007

**Notes:** This story implements Architecture Decision 1's Agent mapping exactly, including the explicit design trade-off that Role and Task lose independent identity on export by design (they are platform-authoring conveniences, not Claude Code primitives).

---

### US-034
**User Story Title:** Export a Skill to `.claude/skills/<name>/SKILL.md`

**User Story ID:** US-034

**As a** registered user
**I want to** export my Skill into Claude Code's native Skill folder convention
**So that** it works immediately as a real Claude Code Skill without any translation

**Description:**
Maps to Architecture Decision 1: **Skill → `.claude/skills/<name>/SKILL.md`** (+ supporting files) unchanged, since Skills are already first-class Claude Code citizens.

**Acceptance Criteria:**
- [ ] Given a user requests export of their Skill, When the Export Mapping Service builds the artifact, Then it produces a folder at path `.claude/skills/<skill-name-slug>/` containing a `SKILL.md` file plus any additional supporting files captured in `skill_files`.
- [ ] Given the Skill's `skill_files` JSON contains 3 entries (e.g., `SKILL.md`, `reference.md`, `template.txt`), When exported, Then all 3 files are reproduced at their correct relative paths within the Skill's folder, byte-for-byte matching the authored content.
- [ ] Given a Skill has no additional supporting files beyond `SKILL.md`, When exported, Then only the single `SKILL.md` file is produced without empty placeholder files.
- [ ] The system should preserve any YAML frontmatter the user authored within `SKILL.md` content exactly as stored, since Skills require no lossy Role/Task folding (unlike Agents).

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-009

**Notes:** None.

---

### US-035
**User Story Title:** Export a Workflow to `.claude/commands/<name>.md`

**User Story ID:** US-035

**As a** registered user
**I want to** export my Workflow as a Claude Code slash-command file
**So that** I can invoke my ordered SDLC sequence directly from Claude Code

**Description:**
Maps to Architecture Decision 1: **Workflow → `.claude/commands/<name>.md`**, a slash-command file that documents/orchestrates the ordered step sequence, referencing Agents/Skills by name.

**Acceptance Criteria:**
- [ ] Given a user requests export of their Workflow, When the Export Mapping Service builds the artifact, Then it produces a single file at path `.claude/commands/<workflow-name-slug>.md`.
- [ ] Given the Workflow has steps in order [Task X, Agent Y, Skill Z], When the file is generated, Then the body documents the steps in that exact order, referencing Agent Y and Skill Z by their exported names/slugs (matching the filenames produced by US-033/US-034) and inlining Task X's instructions directly (Tasks have no exported file of their own).
- [ ] Given a Workflow step references an Agent or Skill that has not itself been exported in the same operation, When the Workflow file is generated, Then the reference is still emitted by name/slug with a note that the referenced Agent/Skill file must also exist under `.claude/agents/` or `.claude/skills/` for the command to function, rather than failing the export outright.
- [ ] The system should reject export of a Workflow that fails the same completeness validation used at publish time (US-024) — e.g., no export is generated for a Workflow with dangling step references, since the produced command file would be broken.

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-010

**Notes:** None.

---

### US-036
**User Story Title:** Export via GitHub Push (OAuth)

**User Story ID:** US-036

**As a** registered user
**I want to** push my exported `.claude` files directly as a commit to my own GitHub repository
**So that** the export fits frictionlessly into my existing git-based workflow

**Description:**
Maps to F-4.3/F-4.5, the "git push" branch of Journey 2's sequence diagram. Uses the GitHub REST Contents/Git Data API via a minimally-scoped OAuth App (`repo` contents write only, per Architecture security NFRs), wrapped with exponential backoff and idempotent commit checks.

**Acceptance Criteria:**
- [ ] Given a user has authorized GitHub access (US-040) and selects "Export to GitHub" for an Agent/Skill/Workflow, When they choose a target repository and branch, Then the Export Mapping Service commits the generated file(s) to that repo/branch via the GitHub Contents API.
- [ ] Given the export commit succeeds, When the API responds, Then the user is shown a link to the new commit in their GitHub repository, and the operation completes within the p95 target of < 8 seconds.
- [ ] Given a transient GitHub API failure occurs mid-request, When the Export Service retries, Then it uses exponential backoff and an idempotent commit check to avoid creating duplicate commits for the same logical export.
- [ ] Given a user has not authorized GitHub access, When they attempt "Export to GitHub," Then they are redirected to the OAuth connection flow (US-040) before the export can proceed.
- [ ] The system should request only the minimal `repo` contents-write OAuth scope for the target repository — never broader account-level access.

**Priority:** High

**Estimate:** 8 story points

**Dependencies:** US-033, US-034, US-035, US-040

**Notes:** Multi-git-host support (GitLab, Bitbucket) is explicitly out of scope for V1 per Architecture's Assumptions — GitHub only.

---

### US-037
**User Story Title:** Local Zip Download of an Export Bundle

**User Story ID:** US-037

**As a** registered user
**I want to** download my exported `.claude`-formatted content as a local zip file
**So that** I can manually copy it into my local `.claude` folder without needing a GitHub repository

**Description:**
Maps to F-4.3/F-4.5, the "local download" branch of Journey 2's sequence diagram. Per Architecture Decision 4, zip compression is offloaded to the browser via JSZip to stay within Workers' CPU-time limits, with the server assembling only small text-based file content.

**Acceptance Criteria:**
- [ ] Given a user selects "Download as zip" for an Agent, Skill, or Workflow, When the export request completes, Then the browser receives the generated `.claude`-structured file content and packages it into a zip client-side using JSZip.
- [ ] Given the zip is generated, When the download completes, Then extracting it into a user's `.claude` folder reproduces exactly the paths defined in US-033/034/035 (e.g., `.claude/agents/test-analyst.md`).
- [ ] Given the export bundle is large (e.g., a Workflow referencing many Agents/Skills exported together), When it exceeds what's practical for pure client-side packaging, Then the Export Service may instead stage the bundle in Cloudflare R2 and return a signed URL for direct download, per the architecture's stated fallback.
- [ ] The system should complete the local-download export path within the p95 target of < 5 seconds.
- [ ] The system should never perform binary/heavy compute server-side for this path — server-side work remains limited to small, text-based file assembly, consistent with the Workers 10ms free-tier CPU constraint.

**Priority:** High

**Estimate:** 5 story points

**Dependencies:** US-033, US-034, US-035

**Notes:** Ground truth: Architecture Decision 4's explicit mitigation strategy for the Workers CPU-time limit risk.

---

### US-038
**User Story Title:** Sandbox API Access for Logged-In Users

**User Story ID:** US-038

**As a** registered user comfortable with APIs
**I want to** create, read, update, and manage my Sandbox Roles/Tasks/Agents/Skills/Workflows entirely via authenticated API calls
**So that** I can use programmatic/scripted workflows instead of the web UI

**Description:**
Maps to F-4.4 and Guiding Principle 5 ("API-equal to UI"). Every Sandbox capability exposed in Epics B and C (US-005 through US-019) must have a corresponding authenticated REST endpoint under `/api/v1/sandbox/...`.

**Acceptance Criteria:**
- [ ] Given a registered user has a valid JWT, When they call `POST /api/v1/sandbox/roles`, `/tasks`, `/agents`, `/skills`, `/workflows` with valid payloads, Then each entity is created exactly as it would be via the UI, subject to the same domain invariants (Role↔Agent 1:1, Task ownership, Workflow step integrity) enforced identically to UI-driven creation.
- [ ] Given a registered user calls `GET /api/v1/sandbox/all?type=Agent&owner=any`, When the request is made, Then it returns the same All Sandbox read-all results as the UI's All Sandbox view, respecting the same read-all/write-own boundary.
- [ ] Given a registered user calls `PATCH /api/v1/sandbox/workflows/{id}/steps` to reorder steps, When the request is made, Then a new `VERSION_SNAPSHOT` is recorded identically to a UI-driven reorder (US-011).
- [ ] Given every API endpoint under `/api/v1/`, When called, Then it requires and validates a JWT for any write, and enforces the same RLS/permission model as the UI path (US-004) — there is no API path that bypasses these checks.
- [ ] The system should document all Sandbox API endpoints (e.g., OpenAPI spec) sufficient for a developer to script the full clone→customize→export loop without ever opening the UI.

**Priority:** Medium

**Estimate:** 8 story points

**Dependencies:** US-004, US-005, US-006, US-007, US-008, US-009, US-010, US-011, US-012

**Notes:** This story operationalizes Guiding Principle 5 ("API-equal to UI") — it should be treated as a running acceptance bar applied to every Sandbox feature above, not a one-time deliverable; new Sandbox UI features should ship with API parity, not follow it later.

---

### US-039
**User Story Title:** Marketplace API Parity (Browse/Export Headlessly)

**User Story ID:** US-039

**As a** developer-minded user
**I want to** browse, search, and export Marketplace Agents/Skills/Workflows entirely via API, without using the web UI
**So that** I can script my discovery-to-integration workflow end-to-end

**Description:**
Maps to F-4.3 and the explicit V1 MVP scope item: "APIs exposed so users can directly reach Agents, Skills, and Workflows from the Marketplace and export them." Applies to both anonymous (read-only) and registered (read + export) API access.

**Acceptance Criteria:**
- [ ] Given an anonymous API caller (no JWT), When they call `GET /api/v1/marketplace/items` or `/items/{id}`, Then they receive the same published-only data as an anonymous UI visitor would see, with the same 404/403 behavior for non-Published ids.
- [ ] Given a registered API caller with a valid JWT, When they call `POST /api/v1/export` with `{itemId, itemType, target: "zip"}`, Then they receive a downloadable/streamed export bundle equivalent to the UI's "Download as zip" flow (US-037).
- [ ] Given a registered API caller, When they call `POST /api/v1/export` with `target: "github"` and a connected repo, Then the same GitHub push behavior as US-036 occurs, returning the resulting commit reference.
- [ ] Given an API caller searches `GET /api/v1/marketplace/items?type=Agent&role=Test+Analyst&sort=rating`, When the request is made, Then results match what the equivalent UI search/filter (US-028) would show.
- [ ] The system should apply the same rate limiting to API callers as to UI-driven traffic, to protect the platform's free-tier compute budget.

**Priority:** Medium

**Estimate:** 5 story points

**Dependencies:** US-026, US-033, US-034, US-035

**Notes:** None.

---

### US-040
**User Story Title:** Connect and Revoke GitHub OAuth Authorization

**User Story ID:** US-040

**As a** registered user
**I want to** connect my GitHub account (with minimal, scoped permissions) and revoke that connection later
**So that** I can control exactly when and how the platform can write to my repositories

**Description:**
Supports US-036's git-push export path. OAuth App scoped minimally to `repo` contents write for the target repository only, per Architecture security NFRs.

**Acceptance Criteria:**
- [ ] Given a registered user has no GitHub connection, When they initiate "Connect GitHub" from Settings or the export flow, Then they are redirected through GitHub's OAuth consent screen requesting only `repo` contents-write scope, never broader account access.
- [ ] Given the OAuth flow completes successfully, When the user returns to the platform, Then their account stores the necessary token/credential securely (never displayed in plaintext in the UI) and the "Export to GitHub" option becomes available.
- [ ] Given a user wants to disconnect, When they click "Revoke GitHub Access" in Settings, Then the stored credential is deleted/invalidated on the platform side and the user is instructed that they may also revoke the OAuth App's access directly within GitHub for full revocation.
- [ ] Given a user's GitHub token has expired or been revoked externally, When they attempt an export to GitHub, Then the system detects the failure and prompts re-authorization rather than silently failing.

**Priority:** Medium

**Estimate:** 3 story points

**Dependencies:** US-002

**Notes:** None.

---

## Epic I — Sustainability

### US-041
**User Story Title:** Donation Link-Out on the Marketplace

**User Story ID:** US-041

**As a** visitor who values the platform
**I want to** find and use a donation link
**So that** I can voluntarily help fund hosting costs beyond the founder's covered budget

**Description:**
Maps to F-1.5. Purely a link-out (e.g., Ko-fi/GitHub Sponsors) — no in-platform payment processing, no creator payouts, funds infrastructure only.

**Acceptance Criteria:**
- [ ] Given any visitor (anonymous or registered) is on the Marketplace, When the page renders, Then a visible but non-intrusive "Support this project" / donation link is present.
- [ ] Given a visitor clicks the donation link, When they are redirected, Then they land on the external donation platform (e.g., Ko-fi or GitHub Sponsors) via a simple outbound redirect — no payment data is handled by AnchorAgentic.io itself.
- [ ] The system should not gate any feature (Sandbox access, cloning, export, rating) behind a donation — donations are voluntary and unconnected to feature access, consistent with the "no monetization, no paid tiers" constraint.
- [ ] The system should present the donation option proactively from V1 launch, not only after the $20/month hosting cap is breached.

**Priority:** Low

**Estimate:** 2 story points

**Dependencies:** US-026

**Notes:** None.

---

## Epic J — Quality & Trust [V2 — Deferred]

> **The following five stories are explicitly out of scope for V1/MVP.** They must not block, gate, or be treated as a dependency for any story in Epics A-I. They are included here for roadmap completeness and Test Analyst awareness of Phase 3 scope, per `PRODUCT-CONCEPT.md`'s Phase 2/Phase 3 roadmap and `ARCHITECTURE.md`'s "Phase 3: Quality & Trust / V2" plan.

### US-042
**User Story Title:** [V2 — Deferred] Automated Prompt Evaluation Before Publish

**User Story ID:** US-042

**As a** platform operator
**I want to** run automated content-quality checks on an item's prompt content before it can publish
**So that** the baseline quality of Marketplace content improves without requiring human moderators for every item

**Description:**
Maps to F-5.1. Runs as a Worker-triggered pipeline before the `SANDBOX → PUBLISHED` transition, per the Architecture's Phase 3 roadmap. This is distinct from and in addition to the V1 structural completeness check (US-024).

**Acceptance Criteria:**
- [ ] Given a user attempts to publish an Agent, Skill, or Workflow, When the V2 quality-gate pipeline is enabled, Then an automated prompt-evaluation check runs against the item's textual content (system_prompt/instructions/description) before the publish transition is allowed to complete.
- [ ] Given the automated check flags a heuristic issue (e.g., banned-content pattern, near-empty prompt content, boilerplate-only text), When publish is attempted, Then the transition is blocked and the owner receives specific, actionable feedback about what failed.
- [ ] Given the automated check passes, When publish is attempted, Then the item proceeds to the `Published` state (or to `UnderReview` if human review is also requested — see US-044).
- [ ] The system should log every automated evaluation outcome (pass/fail + reason) for later analysis and pipeline tuning.

**Priority:** Medium

**Estimate:** 8 story points

**Dependencies:** US-023

**Notes:** V2/Phase 3 scope. Do not implement or test against V1 builds. Per the Architecture's success criteria for this phase: "newly published content passes through at least automated quality checks."

---

### US-043
**User Story Title:** [V2 — Deferred] Automated Structure Evaluation Before Publish

**User Story ID:** US-043

**As a** platform operator
**I want to** run automated schema/convention-conformance checks before an item can publish
**So that** malformed or broken published content is caught by the platform, not the community

**Description:**
Maps to F-5.2. Per the Architecture: "schema/convention conformance checks (e.g., Workflow steps reference valid Tasks/Agents/Skills, Agent has a non-empty system prompt) enforced in the Publish Service." This extends V1's basic structural checks (US-024) with deeper convention validation.

**Acceptance Criteria:**
- [ ] Given a user attempts to publish a Workflow, When the V2 structure-evaluation pipeline runs, Then it verifies every step resolves to a real, currently-accessible Task/Agent/Skill and that the referenced Agents/Skills are themselves eligible for cross-reference (e.g., Published or owned by the same user).
- [ ] Given an Agent is submitted for publish, When structure evaluation runs, Then it verifies the Agent has a non-empty `system_prompt` and at least one assigned Task, beyond the basic non-empty check already present in V1 (US-024).
- [ ] Given a Skill is submitted for publish, When structure evaluation runs, Then it verifies the `skill_files` structure conforms to the expected `SKILL.md`-plus-supporting-files convention needed for a valid export (US-034).
- [ ] Given structure evaluation fails, When publish is attempted, Then the transition is blocked with specific, per-field feedback.

**Priority:** Medium

**Estimate:** 5 story points

**Dependencies:** US-023

**Notes:** V2/Phase 3 scope. Do not implement or test against V1 builds.

---

### US-044
**User Story Title:** [V2 — Deferred] Optional Human Review Before Publish

**User Story ID:** US-044

**As a** contributor wanting extra validation
**I want to** optionally request human review of my item before it goes live on the Marketplace
**So that** I can gain additional confidence in higher-stakes contributions

**Description:**
Maps to F-5.3. Implemented as an opt-in `UnderReview` state in the item lifecycle state diagram, distinct from the mandatory automated checks (US-042/043).

**Acceptance Criteria:**
- [ ] Given a user has passed automated prompt and structure evaluation, When they choose "Request human review" instead of publishing immediately, Then the item transitions to `UnderReview` rather than directly to `Published`.
- [ ] Given an item is `UnderReview`, When a designated reviewer approves it, Then the item transitions from `UnderReview` to `Published` (per the state diagram: "Review passed / no action").
- [ ] Given an item is `UnderReview`, When a reviewer requests changes, Then the item returns to `Draft` status with reviewer feedback attached, rather than auto-publishing.
- [ ] Given human review is optional, When a user skips it, When they still pass automated checks, Then they may publish directly without ever entering `UnderReview`.

**Priority:** Low

**Estimate:** 5 story points

**Dependencies:** US-042, US-043

**Notes:** V2/Phase 3 scope. The Architecture explicitly flags "what does optional human review look like in practice — self-review, peer review, or platform-designated reviewers?" as an open question; acceptance criteria above assume a designated-reviewer model pending that clarification.

---

### US-045
**User Story Title:** [V2 — Deferred] Report Abusive or Broken Published Content

**User Story ID:** US-045

**As a** registered or anonymous user
**I want to** flag a published item as abusive or broken
**So that** the platform can review and remove harmful or non-functional content

**Description:**
Maps to F-5.4. Introduces an `ABUSE_REPORT` table and a reporting UI on every Marketplace listing, per the Architecture's Phase 3 plan. Both registered and anonymous users may report, per `PRODUCT-CONCEPT.md`'s F-5.4 description.

**Acceptance Criteria:**
- [ ] Given any visitor (anonymous or registered) views a Published item, When they click "Report," Then they can select a reason (e.g., abusive content, broken/non-functional, spam) and submit optional free-text detail.
- [ ] Given a report is submitted, When it is recorded, Then a new `ABUSE_REPORT` row is created referencing the reported item and the submission's reason/detail, timestamped.
- [ ] Given an item accumulates a report, When the report is created, Then the item's lifecycle status transitions from `Published` to `UnderReview` per the state diagram ("Flagged for abuse (V2)"), pending moderator action.
- [ ] Given an anonymous user submits a report, When it is recorded, Then no authentication is required, but basic anti-abuse protections (e.g., rate limiting per IP) apply to the reporting endpoint itself to prevent report-spam.

**Priority:** Medium

**Estimate:** 5 story points

**Dependencies:** US-026

**Notes:** V2/Phase 3 scope. Per Architecture's Future Considerations, the `ABUSE_REPORT` schema should be designed with lightweight community norms/code-of-conduct in mind from the start, even though that broader policy question remains open.

---

### US-046
**User Story Title:** [V2 — Deferred] Moderator Removes Reported Content

**User Story ID:** US-046

**As a** platform moderator
**I want to** review flagged content and remove it if warranted
**So that** abusive or broken content does not remain live on the Marketplace

**Description:**
Maps to F-5.4's removal half. Completes the `UnderReview → Removed` state transition shown in the item lifecycle state diagram.

**Acceptance Criteria:**
- [ ] Given an item is `UnderReview` due to one or more abuse reports, When a moderator reviews it and determines removal is warranted, Then the item's status transitions to `Removed`.
- [ ] Given an item transitions to `Removed`, When any user (anonymous or registered) subsequently browses or searches the Marketplace, Then the item no longer appears in listings, search results, or direct-link detail views (404).
- [ ] Given an item is `Removed`, When a moderator instead determines the report was unfounded, Then the item transitions back to `Published` (per the state diagram: "Review passed / no action") and remains visible.
- [ ] Given an item is `Removed`, When the state diagram is consulted, Then `Removed` is treated as terminal (`Removed → [*]`) — there is no path back to `Published` once formally removed (as opposed to the "unfounded report" case above, which never fully transitions to `Removed`).
- [ ] The system should preserve the item's `VERSION_SNAPSHOT` history and `CLONE_RECORD`/`RATING` provenance even after removal, for audit purposes, while hiding it from all end-user-facing views.

**Priority:** Medium

**Estimate:** 5 story points

**Dependencies:** US-045

**Notes:** V2/Phase 3 scope. Moderator role/permissions model itself (who qualifies as a moderator) is not defined in the source docs and should be raised as an open question back to the Product Owner before this story enters a V2 sprint.

---

## Summary of Open Items Flagged to the Product Owner / Test Analyst

1. **US-015**: "Restore a prior version" as a write action is not explicitly named in the source docs — currently scoped as read-only history viewing. Confirm if restore is needed for V1.
2. **US-025**: Exact re-publish UX (explicit action vs. automatic) should be confirmed with design.
3. **US-028**: Tie-breaking rule for "sort by rating" (clone count vs. recency) is an implementation detail not specified upstream.
4. **US-044**: "Optional human review" reviewer model (self/peer/platform-designated) is explicitly an open question in `PRODUCT-CONCEPT.md` — acceptance criteria assume designated-reviewer pending clarification.
5. **US-046**: Moderator role/permission model is undefined in source docs and needed before V2 implementation.

These are flagged, not blocking — none affect the V1/MVP story set (Epics A-I), which is fully specified against the architecture as delivered.
