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

### D4 — Mock-data boundary during Phase 1

**Decision.** All demo data lives in `apps/web/src/mocks/` behind typed
modules. Production-bound modules (future `src/api/`) never import from
`src/mocks/`; pages import mocks only while `VITE_USE_MOCKS` semantics apply
(Phase 1: always, with a visible "Mode demo" indicator in the header and on
pages that show derived numbers).

**Why.** The PRD allows mock data in Phase 1 but demands clear labelling and a
clean cut-over to the API.

### D5 — Backend and database (planned, Phase 2)

**Decision.** Node.js + TypeScript + Fastify REST API under `apps/api`,
PostgreSQL 16 + Prisma ORM (schema/migrations/seed under `prisma/`), Zod for
every external input, `docker-compose.yml` already provides the `db` service.
Stock-in/out/transfer/adjustment run inside database transactions with
pessimistic locking on affected balance rows; movements are append-only.

**Why.** PRD-recommended, minimal, and consistent with the recruitment brief
(TypeScript, Docker, Linux/VPS). No Redis, no microservices — not needed for
the MVP.

### D6 — Authentication approach (planned, Phase 4)

**Decision.** [better-auth](https://better-auth.com) with the Prisma adapter:
email/password credentials (argon2 hashing, provided by the library) plus
HTTP-only cookie sessions, roles (`OWNER`, `STAFF`, `VIEWER`) checked
server-side on every protected route and scoped to a workspace. One auth
system, no mixing.

**Why.** The PRD requires an established solution over hand-rolled password
storage, compatible with Fastify and Prisma, and TypeScript-first. If better-auth
turns out to be a poor fit during Phase 4, the fallback is Lucia-style session
tables implemented directly on Prisma — the schema shape below already
accommodates it.

### D7 — Quality gates

**Decision.** ESLint 9 (flat config, typescript-eslint) + Prettier + strict
`tsc` + Vitest unit/component tests in CI (`.github/workflows/ci.yml`), plus a
production `vite build`. Phase 2 adds API integration tests against a real
PostgreSQL service in CI; Phase 5 adds an end-to-end smoke test.

**Why.** Every phase must leave `main` green; the PRD's testing section is
progressively satisfied per phase rather than dumped at the end.

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
