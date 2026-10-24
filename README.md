# StockSpace

**Open-source inventory management with an interactive 3D warehouse.**

StockSpace helps a small business manage inventory while seeing exactly where
products are stored — receive, store, move, adjust, and issue stock, and explore
your racks in a real 3D scene that reflects your saved warehouse layout.

> **Status: Phase 1 (UI shell + 3D prototype) complete.** The app currently runs
> on clearly-labelled demo data; the API, database, and authentication land in
> Phases 2–4. See the [roadmap](#roadmap) and
> [implementation checklist](docs/implementation-checklist.md).

## Features (current)

- 📊 **Dashboard** — total stock, low-stock count, inventory value, today's
  transactions, movement chart, most-moved products — all computed from the
  dataset (never hardcoded).
- 🧊 **Interactive 3D warehouse** — procedural racks, shelves, cargo boxes,
  staging & packing areas, and a forklift. Click/hover to select, orbit/pan/
  zoom, reset camera, 3D ↔ 2D top-down toggle, level filters (L1–L3),
  fullscreen, and floating location labels.
- ♿ **Accessible fallback** — when WebGL is unavailable the scene is replaced
  by a keyboard-navigable location list; reduced-motion preferences are
  respected; visible focus states everywhere.
- 📦 **Inventory & product detail** — searchable, sortable, paginated product
  table with per-location stock, thresholds, and movement history.
- 🧾 **Transactions** — read-only movement history with type filters
  (recording lands with the API in Phase 2).
- 🔍 **Global search** — products by name/SKU/barcode, locations by code.
- 🔔 **Grouped low-stock notifications**.
- 📱 **Responsive** — desktop sidebar collapses to an off-canvas menu on mobile.

All demo data is fictional (see `apps/web/src/mocks/`) and labelled with a
visible **"Mode Demo"** badge.

## Screenshots

The UI is built against `design-reference.png` (repository root). Real
screenshots will be added during Phase 5 release hardening.

## Tech stack

| Layer    | Choice                                                              |
| -------- | ------------------------------------------------------------------- |
| Frontend | React 19, TypeScript (strict), Vite, React Router, Tailwind CSS v4  |
| 3D       | React Three Fiber, Drei, Three.js (procedural geometry, no models)  |
| Charts   | Recharts                                                            |
| Icons    | lucide-react (ISC) · Font: Plus Jakarta Sans via Fontsource (OFL)   |
| Backend  | Fastify + TypeScript (Phase 2) · Zod validation                      |
| Database | PostgreSQL 16 + Prisma (Phase 2)                                     |
| Infra    | Docker Compose, GitHub Actions CI, nginx for static hosting          |

## Quick start (local development)

Requirements: **Node.js ≥ 20.19** (22 recommended; `.nvmrc` pins 22) and npm.

```bash
npm install       # installs all workspaces
npm run dev       # start the web app on http://localhost:5173
```

Quality gates:

```bash
npm run lint         # ESLint
npm run typecheck    # tsc (strict)
npm run test         # Vitest (unit + component)
npm run build        # production build
npm run format:check # Prettier
```

There is no login yet (authentication is Phase 4); the app opens directly into
the dashboard in demo mode. **No demo credentials exist yet** — when
authentication lands, a development-only seed account will be documented here.

### Docker

```bash
docker compose up --build   # web on http://localhost:8080, PostgreSQL on :5432
```

The `db` service is ready for Phase 2; `web` builds the frontend into nginx.
The API service will be added in Phase 2.

## Project structure

```text
stockspace/
├── apps/web/          # React + TypeScript frontend (current focus)
├── packages/shared/   # Shared Zod schemas/types (Phase 2)
├── prisma/            # Schema, migrations, seed (Phase 2)
├── docs/              # architecture, implementation checklist, …
├── .github/           # CI workflow, issue & PR templates
├── docker-compose.yml
└── PRD.md             # Product requirements driving the roadmap
```

## Documentation

- [Architecture decisions](docs/architecture.md)
- [Implementation checklist & phase status](docs/implementation-checklist.md)
- Database docs (Phase 2) · [3D warehouse docs](docs/3d-warehouse.md) (Phase 2–3) ·
  VPS deployment guide (Phase 5)

## Roadmap

- [x] **Phase 0** — monorepo, TS/ESLint/Prettier, env validation, Docker, CI
- [x] **Phase 1** — UI shell, dashboard, interactive 3D prototype (demo data)
- [ ] **Phase 2** — Fastify API, PostgreSQL + Prisma, stock-in/out/transfer/
      adjustment with DB transactions, integration tests
- [ ] **Phase 3** — connect 3D & dashboard to real data
- [ ] **Phase 4** — authentication (better-auth), roles & workspace scoping,
      reports, CSV export, notifications
- [ ] **Phase 5** — release hardening, E2E smoke test, VPS deployment guide

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports follow
[SECURITY.md](SECURITY.md) — please do not open public issues for
vulnerabilities.

## License

[MIT](LICENSE) © StockSpace contributors. Third-party assets: icons by
[lucide](https://lucide.dev) (ISC), font _Plus Jakarta Sans_ (SIL OFL 1.1,
served via Fontsource). All 3D geometry is procedural/original.
