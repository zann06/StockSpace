# Implementation checklist

Working checklist derived from `PRD.md` and the phased plan. Status is updated
as work lands. "Phase 1 (current)" items use labelled mock data only.

## Phase 0 — Project foundation ✅

- [x] Inspect existing repository, runtime, and tooling before changes
- [x] npm-workspaces monorepo scaffold (`apps/web`, placeholder for `apps/api`)
- [x] TypeScript strict configuration for the web app
- [x] ESLint 9 flat config + Prettier + EditorConfig
- [x] Client environment validation with Zod (`apps/web/src/lib/env.ts`)
- [x] `.env.example` with placeholder values only
- [x] Docker: web Dockerfile (nginx SPA) + compose with PostgreSQL `db`
- [x] GitHub Actions CI: format check, lint, typecheck, test, build
- [x] `docs/architecture.md` with recorded decisions

## Phase 1 — UI shell and 3D prototype ✅ (current)

- [x] Responsive app shell: collapsible sidebar, header with global search,
      notifications, profile menu, demo-mode indicator
- [x] Routing for all PRD routes (`/dashboard`, `/warehouse`, `/inventory`,
      `/inventory/products/:id`, `/transactions` (+ tabs), `/reports`,
      `/settings`, 404)
- [x] Dashboard: 4 KPI cards computed from (mock) data, greeting header,
      primary action
- [x] Interactive 3D warehouse: procedural racks/shelves/boxes, staging and
      packing areas, forklift, floor
- [x] Scene interactions: click/hover select, orbit/pan/zoom, reset camera,
      zoom buttons, 3D/2D toggle, level filters (L1/L2/L3), fullscreen,
      location labels
- [x] Right detail panel bound to the selected location (items + movements)
- [x] Bottom row: low-stock summary, most-moved products, movement chart
- [x] WebGL-unavailable fallback to an accessible location list
- [x] Inventory page with mock table: search, category filter, sorting,
      pagination; product detail page
- [x] Transactions page (read-only mock history + phase notice), reports and
      settings placeholders with honest disabled states
- [x] Reduced-motion preference respected; visible focus states; keyboard
      reachable controls
- [x] Unit + component tests (stats, mock invariants, shell, fallback)
- [x] Lint, typecheck, tests, production build all run and pass

## Phase 2 — Backend and persistence ✅ (current)

- [x] Prisma schema (users, workspaces, workspace_members, warehouses, zones,
      storage_locations, categories, products, inventory_balances,
      stock_movements, notifications) + init migration incl. `CHECK
      (quantity >= 0)` and `quantity <> 0` constraints
- [x] Fastify app scaffold (`apps/api`): Zod env validation, structured
      logging with secret redaction, deliberate CORS, JSON error handler
      (AppError / ZodError / Prisma codes → stable status codes)
- [x] Workspace scoping preHandler (`X-Workspace-Id`, validated against the
      database; membership checks arrive with auth in Phase 4)
- [x] CRUD: products (list/search/paginate, create, detail with balances +
      history, patch with immutable SKU), categories, warehouses + layout,
      location inventory
- [x] Stock-in, stock-out, transfer, adjustment inside Prisma interactive
      transactions; decrements via conditional `UPDATE … WHERE quantity >= n`
- [x] Reject negative stock (service + DB constraint), zero/negative
      quantities, same-source transfers, adjustments without reason
- [x] Integration tests (real PostgreSQL via Docker / CI service container):
      26 tests covering invariants incl. concurrent oversell, rollback on
      failed movement insert, cross-workspace access, duplicate SKU
- [x] Fictional seed data ("Toko TechNusa") mirroring the Phase 1 web mocks
- [x] API Dockerfile + compose `api` service (migrate-deploy on boot)
- [x] CI: dedicated `api` job with a PostgreSQL service container

## Phase 3 — Connect 3D to real data ✅

- [x] Load warehouse layout from API (`GET /api/warehouses/:id/layout`)
- [x] 3D objects bound to storage-location records; detail panel shows real
      balances
- [ ] Movement success refreshes balances, dashboard metrics, and scene state
- [x] Replace mock KPIs with `GET /api/dashboard/summary`; TanStack Query layer
- [x] Remove/retire `src/mocks` from the default path

## Phase 4 — Auth, permissions, reports

- [x] better-auth integration (credentials + cookie sessions) and login page
- [x] Server-side role/workspace enforcement + authorization tests
- [x] Reports: low-stock, movements with filters, CSV export
- [x] In-app notifications (grouped low-stock alerts)

## Phase 5 — Release hardening

- [ ] Responsive + accessibility pass (contrast, focus, a11y audit)
- [ ] End-to-end smoke test (login → inventory → stock-in → dashboard)
- [ ] README screenshots, CONTRIBUTING polish, SECURITY.md review
- [ ] VPS deployment guide over SSH (docs/deployment-vps.md)
- [ ] Verify fresh-clone setup from documented instructions
