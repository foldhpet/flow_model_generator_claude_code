# Initial Product Concept

> Captured incrementally through a guided session with the Product Owner Agent.

> **Note:** Wherever "Agents and Workflows" appear below as the core sharable/buildable entities, **Skills** are also included as a first-class entity of the same kind — the platform's core building blocks are **Agents, Skills, and Workflows** (all clonable into a Sandbox, version-controlled, publishable to the Marketplace, and rateable).

## Step 1: Problem / Opportunity & Target User

**Problem / Opportunity:**
A platform to support Agentic Development of future software products. Users can define Roles in the SDLC (Software Development Lifecycle) and Tasks associated with each Role, then connect Tasks into Workflows. This lets users move through SDLC workflows while getting AI assistance at every stage. The platform is intentionally lightweight — not aimed at enterprise usage — targeted instead at individuals building small, custom projects using this platform together with Claude.

**Target User:**
Mostly individuals who either:
- Want to start learning how to develop using an Agentic SDLC approach, or
- Lack knowledge/experience in certain SDLC Roles.

For the latter group, the platform offers default Agent templates and Agentic workflow templates out of the box. Users can customize these agents/workflows or create brand new ones from scratch, based on the templates.

## Step 2: Why Now / Core Pain & Differentiation

**Core pain today:** Most people don't know where to start or how to start with an agentic SDLC approach. Learning by trial and error is slow and intimidating without guidance.

**Why this platform vs. using Claude directly, role-by-role:**
- Providing ready-made examples (Agent/Workflow templates) makes it dramatically easier to get started and to learn from.
- As users experiment — building, testing, and refining their own Agents and Workflows — they build experience and confidence over time.
- The platform is essentially two things: (1) an easy way to **start** with agentic SDLC, and (2) a way to **share** what you've built with other users.
- Sharing/community angle: if a user creates a new Agent that is well-defined, tested, and refined, they should be able to easily share it with other users of the platform (and presumably discover/reuse others' shared Agents/Workflows in turn).

## Step 3: First User Session / Core Journey

**Access model:**
- **Unregistered (anonymous) users:** can browse the **Marketplace** only — can read all published Agents and Workflows, and can see their ratings, but cannot rate them and have no access to Sandbox instances.
- **Registered users:** get access to **Sandbox** instances in addition to the Marketplace.

**Sandbox & versioning:**
- A registered user can **clone** any Agent or Workflow (from the Marketplace, or from another user's Sandbox) into their own Sandbox, and adjust it there in a **version-controlled** way.
- Anything created/modified in *any* Sandbox is readable by all registered users (i.e., Sandboxes are visible/searchable across users, not private).
- Once an Agent/Workflow in a Sandbox is fully tested and refined, it can be **published** to the Marketplace.

**Ratings:**
- Registered users can rate published Agents/Workflows on a 1-5 scale.
- Unregistered users can see ratings but cannot rate.

**Landing / navigation for a registered user:**
- First thing seen: the **Marketplace**.
- Ability to switch between **All Sandbox** projects (search across everyone's in-progress Agents/Workflows, including their own) and **My Sandbox** (only their own).
- A persistent **"+" button** (top-right, visible on all pages) lets the user create a new Agent or Workflow at any time.

**Definition of success (first session / ongoing):**
- Success is user-defined/subjective, but broadly: being able to **read** other registered users' Agents & Workflows, and being able to **create** new Agents and Workflows.
- Ultimately, the user should be able to **integrate** the Agents and Workflows seamlessly into their IDE — under the `.claude` folder.

## Step 4: Domain Vocabulary — Role, Task, Skill, Workflow, Agent

- **Role:** A definition of a job role in the SDLC (e.g., Business Analyst, Test Analyst). An **Agent** is built to fulfill a Role.
- **Task:** Owned by a single Role (not shared across multiple Roles).
- **Skill:** A genuine **Claude Code Skill**, buildable through the platform, and directly invocable (independent of a specific Role) — same concept as Claude Code Skills today.
- **Workflow:** An ordered chain of Tasks. Tasks are tied to Roles. A Workflow can directly invoke both **Skills** and **Agents** as part of its steps.
- **Agent:** Embodies exactly **one Role**, but can perform **multiple Tasks** (all Tasks belonging to that Role).

**Relationship summary:** Role (1) → Agent (1, fulfills the Role) → Tasks (many, owned by that Role) → Workflow (orders Tasks; can also invoke Skills and Agents directly). Skills are independent, reusable, directly-invocable Claude Code Skills, not owned by a Role.

## Step 5: Business Model

- **Fully free**, community/passion project — not a commercial product.
- Each user is responsible for their own LLM subscription and token usage/costs; the platform itself does not bill for AI usage.
- The platform's role is simply to **collect and host** the Agents, Skills, and Workflows that users create.
- **Cloning is always free** — no paid tiers, no monetization path for creators, no charging for highly-rated contributions.

## Step 6: MVP (v1) Scope

1. **Web UI** that works well in Chrome and Firefox.
2. **Registered users:** read access to All Sandbox, write access to My Sandbox.
3. **Non-registered (anonymous) users:** access to the Marketplace.
4. **APIs exposed** so users can directly reach Agents, Skills, and Workflows from the Marketplace and **export them to their git repository or download a local copy** to their hard drive.
5. **Logged-in users** can reach Agents, Skills, and Workflows in their Sandbox via **API calls**.
6. **Ratings** available for registered users (to rate).
7. **Ratings visible** on the Marketplace (to everyone, per earlier: registered users rate, anonymous users can view ratings).

Note: v1 explicitly includes all core capabilities discussed (Marketplace, Sandbox with All/My distinction, publish, ratings, API/export access) — nothing was deferred to a later phase.

## Step 7: Quality Control / Moderation (Deferred to v2)

- **Not in v1** — explicitly scoped for **v2**.
- v2 should include a **quality-gate pipeline** before something can be published to the Marketplace, potentially including:
  - Automated **prompt evaluation**.
  - Automated **structure evaluation**.
  - **Optional human review**.
  - Any other quality gates that help improve the quality of Agents, Skills, and Workflows prior to publishing.
- Reporting/flagging/removal mechanism for abusive or broken published content is **explicitly deferred to v2**, bundled with the moderation/quality-gate work.

