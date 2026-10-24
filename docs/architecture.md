# Architecture

This document records the architectural decisions behind StockSpace and how the
repository is organised. It is updated as phases from `PRD.md` land.

## Context

StockSpace is an open-source, full-stack inventory management web application
with an interactive 3D warehouse. The MVP scope, visual direction, and phased
delivery plan are defined in [`PRD.md`](../PRD.md); the visual reference is
`design-reference.png` at the repository root.

## High-level shape

```text
stockspace/                     npm-workspaces monorepo
├── apps/
│   └── web/                    React + TypeScript + Vite frontend (Phases 0–1)
│   └── api/                    Fastify REST API (Phase 2, planned)
├── packages/
│   └── shared/                 Shared Zod schemas / types (Phase 2, planned)
├── prisma/                     Prisma schema, migrations, seed (Phase 2)
├── docs/                       Architecture, database, 3D, deployment notes
└── .github/                    CI workflow, issue and PR templates
```

## Decisions

### D1 — Monorepo with npm workspaces

**Decision.** A single repository using npm workspaces (`apps/*`,
`packages/*`), no Turborepo/Nx/pnpm. Node >= 20.19 (`.nvmrc` pins 22).

**Why.** The PRD requires a publishable open-source repo with a web app, an API,
and shared types. Plain npm workspaces keep the clone-to-run path free of extra
tooling, which matters most for outside contributors. Build orchestration is a
thin root `package.json` script layer; if the repo grows we can adopt Turborepo
without moving files.

### D2 — Frontend stack

**Decision.** React 19 + TypeScript (strict) + Vite, React Router, Tailwind CSS
v4 (CSS-first `@theme` tokens), React Three Fiber + Drei + Three.js for the 3D
warehouse, Recharts for charts, lucide-react for icons,
`@fontsource-variable/plus-jakarta-sans` self-hosted (OFL) to match the
reference typography. UI text is **Indonesian (id-ID)** to match the design
reference; code, comments, and docs are English.

**Why.** Matches the PRD's recommended stack. Fonts are self-hosted via npm so
builds work offline and no third-party font CDN is required. Icon and font
licenses (ISC / OFL) are redistribution-safe.

**UI primitives.** Instead of pulling in shadcn/ui wholesale at this stage, we
keep a small set of hand-written accessible primitives (`Button`, `Card`,
`Badge`, `Input`…) in `apps/web/src/components/ui`. They implement the same
contract (keyboard reachable, visible focus, labelled states) with zero extra
runtime dependencies. We can migrate individual primitives to shadcn/ui later
if a need appears; the PRD explicitly allows "shadcn/ui **or** accessible
headless components".

### D3 — 3D warehouse is data-driven and procedural

**Decision.** The 3D scene renders exclusively from location records that carry
`id`, `code`, `type`, `x/z` position, and `rotation`. Racks, shelves, boxes,
staging, and packing areas are procedural geometry (original, no external
models). Selection, hover, level filters, reset/zoom camera controls, a 3D/2D
(top-down) toggle, and a keyboard-accessible location list fallback are part of
the core `WarehouseView` component. If WebGL is unavailable the component
automatically renders the list fallback instead of the canvas.

**Why.** The PRD requires the 3D scene to reflect persisted layout data and to
remain a useful, optional feature. In Phase 1 the same shape is fed from
clearly-labelled mock data (`src/mocks/`), so swapping the source for the API
in Phase 3 is a data-source change, not a rewrite.

### D4 — Data flow & the retired mock boundary

**Decision.** Since Phase 3 the web app is API-driven: a TanStack Query layer
(`apps/web/src/api/`) fetches workspace, layout, products, movements, dashboard
summary, and notifications from Fastify; mutations invalidate the affected
query keys so balances, history, dashboard metrics, and the 3D scene refresh
together. Until authentication (Phase 4) the workspace is chosen from
`GET /api/workspaces` and stored in `localStorage`; movement requests may omit
`actorId`, in which case the API records the first workspace owner/admin. The
Phase 1 mock dataset survives **only as test fixtures** (`src/mocks/`) feeding
a fetch stub — production code never imports it, enforced by review and grep.

**Why.** The PRD requires every displayed metric to derive from persisted data,
mock data to be clearly labelled, and the 3D scene to reflect the database.

### D5 — Backend and database

**Decision.** Node.js + TypeScript + Fastify REST API under `apps/api`
(ESM, `NodeNext`), PostgreSQL 16 + Prisma ORM (schema/migrations/seed under
`prisma/`), Zod for every external input, `docker-compose.yml` provides the
`db` + `api` + `web` services. Stock-in/out/transfer/adjustment run inside
Prisma interactive transactions; decrements are single conditional
`UPDATE … WHERE quantity >= n` statements, which serialize concurrent writers
and make overselling impossible (verified by integration tests, including a
parallel-requests case). Movements are append-only. The database additionally
enforces `CHECK (quantity >= 0)`. Workspace scoping is enforced by a preHandler
resolving `X-Workspace-Id`; it becomes membership-based when auth lands
(Phase 4). See [`database.md`](database.md) for the full contract.

**Why.** PRD-recommended, minimal, and consistent with the recruitment brief
(TypeScript, Docker, Linux/VPS). No Redis, no microservices — not needed for
the MVP. The compose `db` service publishes host port **5433** to avoid
clashing with a locally installed PostgreSQL on 5432.

### D6 — Authentication & authorization (Phase 4, implemented)

**Decision.** [better-auth](https://www.better-auth.com) v1.7 with the Prisma
adapter: email/password credentials (scrypt hashing handled by the library) and
HTTP-only cookie sessions (`User`/`Session`/`Account`/`Verification` tables).
Mounted on Fastify via a catch-all `/api/auth/*` route that bridges to
`auth.handler` (per the official Fastify guide); CORS is credentialed with
explicit origins. Server-side enforcement in `apps/api/src/lib/session.ts`:
every data route resolves the session (`requireSession`), the active workspace
from `X-Workspace-Id` (default: first membership) with a membership check
(`resolveWorkspace`), and write routes are guarded by `requireRole`:
VIEWER read-only · STAFF+ records movements · ADMIN+ edits products · OWNER
manages the workspace. The movement actor is always the session user — the
client cannot choose it. Seeded development accounts are documented in the
README and exist only via `npm run db:seed`.

**Why.** One coherent, maintained auth system (PRD §7.7) with no hand-rolled
password storage; roles live in `WorkspaceMember.role` and every permission
check happens server-side.

### D7 — Quality gates

**Decision.** ESLint 9/10 (flat config, typescript-eslint) + Prettier + strict
`tsc` + Vitest in CI (`.github/workflows/ci.yml`): a `web` job (unit +
component with an API fetch-stub) and an `api` job running **integration tests
against a real PostgreSQL service container**. Plus a production build of both
apps. Phase 4 adds authorization tests; Phase 5 adds an end-to-end smoke test.

**Why.** Every phase must leave `main` green; the PRD's testing section is
progressively satisfied per phase rather than dumped at the end.

**Forms note (D9).** Movement forms use controlled components + Zod validation
on submit — react-hook-form is deliberately not introduced until form
complexity justifies the dependency (re-evaluate when product CRUD UI lands).

### D8 — Client environment validation

**Decision.** `apps/web/src/lib/env.ts` validates `import.meta.env` with Zod
at startup (currently `VITE_API_URL`, optional with a default). Failures throw
a readable error instead of producing a half-configured app.

**Why.** Phase 0 requires environment validation; misconfiguration should be
loud and early.

## Data flow (target state, Phase 3)

```text
PostgreSQL ← Prisma → Fastify REST (/api/*) → JSON over HTTP
                                      ↘ TanStack Query → React pages
                                                              ↘ WarehouseView (3D)
```

## Security posture

- Every external input validated with Zod server-side (Phase 2+).
- Workspace scoping and role checks enforced in the API, not by hiding UI.
- Secrets only via environment variables; `.env.example` carries placeholders.
- Append-only movement history; corrections are compensating adjustments.
- Rate limiting on auth endpoints (Phase 4); deliberate CORS config.
