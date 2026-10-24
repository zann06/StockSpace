# StockSpace — Product Requirements Document (PRD)

**Project type:** Open-source, full-stack inventory management web application with an interactive 3D warehouse  
**Status:** MVP specification  
**License:** MIT (unless a dependency or asset requires a different license)  
**Primary audience:** Small businesses, independent retailers, small warehouses, and developers who want to self-host an inventory system  
**Design reference:** `design-reference.png` — use this image as the primary visual reference for layout, color, spacing, and 3D presentation. Recreate the interface and interaction patterns; do not embed the screenshot as the finished UI.

## 1. Product vision

StockSpace helps a small business manage inventory while seeing where products are stored in an interactive 3D warehouse. It combines familiar inventory workflows with a clean, light interface and a 3D warehouse view that is useful—not merely decorative.

The application must be practical as an inventory tool even when the 3D scene is unavailable or disabled. The 3D view must connect to real application data: selecting a rack, shelf, bin, or staging area displays its location and the inventory stored there.

## 2. Goals

1. Provide a usable inventory workflow for receiving, storing, moving, adjusting, and issuing stock.
2. Visualize warehouse racks and storage locations in interactive 3D.
3. Make low-stock items and recent stock movements easy to understand.
4. Provide a responsive, accessible UI inspired by the supplied reference.
5. Be straightforward for contributors to run locally and deploy using Docker.
6. Publish a maintainable, documented open-source repository suitable for public GitHub.

## 3. Non-goals for the first release

- Full accounting, invoicing, or payroll.
- Marketplace or shipping-carrier integrations.
- AI forecasting or AI-generated purchase orders.
- Real-time robotics, forklift control, or physical warehouse automation.
- Full ERP functionality.
- Complex multi-warehouse enterprise optimization.
- Claiming the 3D scene is a survey-accurate representation of a real warehouse.

## 4. Target users and roles

### Owner / Admin
- Manage products, categories, units, suppliers, storage locations, users, and settings.
- View stock valuation, low-stock alerts, transaction history, and reports.
- Configure warehouse layout and assign storage locations.

### Staff / Operator
- View inventory and locations.
- Record incoming and outgoing stock.
- Move stock between locations.
- View relevant transaction history.
- Cannot manage users or change sensitive system settings unless explicitly granted permission.

### Viewer (optional MVP stretch goal)
- Read-only access to dashboards, products, and warehouse view.

Enforce permissions on the server, not only by hiding frontend controls.

## 5. Core user journeys

### A. First-time setup
1. User signs in.
2. User creates a warehouse.
3. User adds zones, racks, shelves, and bins—or starts with a demo layout.
4. User adds products and opening stock.
5. User assigns products to storage locations.
6. User opens the 3D Warehouse and sees the saved layout and stock status.

### B. Receive stock
1. Staff opens **Transactions → Stock In**.
2. Staff selects a product, quantity, destination location, and optional reference/note.
3. App validates the request.
4. On confirmation, inventory quantity and a transaction record are updated atomically.
5. Dashboard and 3D location indicators refresh.

### C. Issue stock
1. Staff opens **Transactions → Stock Out**.
2. Staff selects product, quantity, and source location.
3. App prevents issuing more stock than is available.
4. On confirmation, stock balance decreases and an immutable movement record is created.

### D. Move stock
1. Staff selects a product and quantity, source location, and destination location.
2. App validates source availability.
3. App creates linked movement records or one transfer record with movement lines.
4. Source and destination quantities update atomically.
5. The 3D view reflects the new location.

### E. Explore warehouse
1. User opens **3D Warehouse**.
2. User rotates, pans, and zooms the scene.
3. User selects a rack, shelf, bin, or staging zone.
4. A detail panel displays the location code, capacity (if configured), stock count, products, and low-stock/occupancy indicators.
5. User can jump from a selected location to its inventory list.

## 6. Information architecture

Primary sidebar:
- Dashboard
- 3D Warehouse
- Inventory
- Transactions
- Reports
- Settings

Global header:
- Search products, rack codes, SKU, or barcode
- Notifications
- User profile and role menu

Suggested routes:
- `/dashboard`
- `/warehouse`
- `/inventory`
- `/inventory/products/new`
- `/inventory/products/:id`
- `/transactions`
- `/transactions/stock-in`
- `/transactions/stock-out`
- `/transactions/transfers`
- `/reports`
- `/settings`
- `/login`

Do not expose admin-only routes to unauthorized roles.

## 7. Functional requirements

### 7.1 Dashboard
- Show total units in stock, low-stock product count, inventory value, and stock movements today.
- Show a large 3D warehouse preview or interactive scene.
- Show low-stock items, frequently moved products, and stock movement trends.
- Show recent movements with date, product, quantity, type, and actor.
- All displayed metrics must come from the database; label demo data clearly when demo mode is enabled.

### 7.2 Product inventory
Product fields:
- Name (required)
- SKU (required and unique within the workspace)
- Category
- Unit of measure
- Optional barcode
- Cost price (optional; restrict visibility if needed)
- Reorder threshold
- Description
- Active/inactive status
- Created/updated timestamps

Capabilities:
- Search, sort, filter, and paginate products.
- View current quantity by location.
- Create, edit, archive, and inspect product history.
- Prevent duplicate SKU values.
- Validate quantities and monetary values server-side.

### 7.3 Stock transactions
Supported transaction types:
- Stock in
- Stock out
- Transfer between locations
- Stock adjustment with reason

Requirements:
- Every committed stock change creates a durable transaction record.
- Do not allow negative stock unless an explicit future setting is introduced.
- Use database transactions to keep inventory balances and movement history consistent.
- Record actor, timestamp, quantity, source/destination location, and note/reference.
- Do not silently edit or delete historical movement records. Corrections should be recorded as compensating adjustments.

### 7.4 Warehouse layout and 3D scene
- Build the 3D scene with React Three Fiber and Drei.
- Provide orbit, pan, zoom, reset-camera, and fullscreen controls.
- Support 3D and simplified 2D/list fallback views.
- Render zones, racks, shelves, bins, and staging areas from saved layout data.
- Each rendered object must have a stable database ID and location code.
- Selecting an object opens a detail drawer/panel.
- Visually indicate empty, occupied, and low-stock locations using accessible visual cues; do not rely on color alone.
- Provide level filters and a location search.
- Use a small starter warehouse model made from procedural geometry or original assets with compatible licenses.
- Optimize geometry, shadows, and draw calls. Respect reduced-motion preferences and provide a loading state.
- If WebGL is unavailable, show the location list and inventory details instead of crashing.

Suggested initial 3D interaction:
- Click a rack to select it.
- Click a shelf/bin to drill down to its products.
- Hover/focus shows a short label.
- A right-hand detail panel updates based on the selected location.
- 3D objects should use actual stored layout coordinates, not hardcoded UI-only mock data.

### 7.5 Reports
- Stock movement report with date range, product, transaction type, and actor filters.
- Low-stock report.
- Inventory by location.
- CSV export for filtered results.
- Clearly define whether inventory value uses cost price and document the calculation.

### 7.6 Search and notifications
- Search by product name, SKU, barcode, rack, shelf, or bin code.
- Low-stock notifications inside the app.
- Avoid noisy notifications; group repeated low-stock alerts where possible.
- Notifications are informational, not a substitute for reviewing stock.

### 7.7 Authentication and authorization
- Use a secure authentication solution compatible with the chosen backend.
- Prefer an established library/provider rather than implementing password storage from scratch.
- Hash passwords using a modern, appropriate password-hashing algorithm if local email/password authentication is implemented.
- Enforce server-side role checks and workspace scoping.
- Protect against unauthorized object access, mass assignment, and insecure direct object references.
- Provide a seeded development account only in local development; never ship a public default production password.
- Include logout and session-expiry handling.

### 7.8 Settings
- Workspace/business name, locale, currency display, and timezone.
- Inventory units and low-stock defaults.
- User and role management for admins.
- Warehouse layout settings.

## 8. UI/UX and visual design

Use `design-reference.png` as the main reference. Match its overall visual language as closely as practical while creating a coherent, responsive, accessible application.

### Visual direction
- Clean, bright, modern, premium SaaS dashboard.
- White and very light cool-gray surfaces.
- Violet/purple as the primary accent.
- Dark navy text, muted blue-gray secondary text.
- Soft borders, subtle shadows, rounded cards, generous spacing.
- No excessive gradients, glassmorphism, decorative badges, or unnecessary UI clutter.
- 3D warehouse scene is the visual centerpiece.
- Use consistent iconography and typography.

Suggested design tokens:
- Primary: `#6546F5` (adjust to fit reference)
- Primary hover: `#5435E8`
- Text: `#151B4A`
- Muted text: `#7A83A8`
- Background: `#F7F8FC`
- Surface: `#FFFFFF`
- Border: `#E8EBF5`
- Success: `#10B981`
- Warning: `#F59E0B`
- Danger: `#F0445E`
- Radius: 12–18px for cards, 10–12px for controls
- Use subtle shadows; avoid heavy drop shadows.

### Dashboard composition
- Left sidebar with StockSpace logo and primary navigation.
- Header with global search, notifications, and user menu.
- Top KPI cards for total stock, low stock, inventory value, and today's movements.
- Large central warehouse scene with 3D/2D toggle, camera reset, fullscreen, and floor/level filters.
- Right-side contextual panel for selected rack/location and its products.
- Bottom row for low-stock summary, most-moved products, and stock movement chart.
- Make the layout adapt to laptop, tablet, and mobile. On narrow screens, stack panels and allow the 3D view to occupy a focused full-width section.

### UX rules
- Every button must work or be visibly disabled with an explanation.
- Provide empty, loading, error, success, and permission-denied states.
- Use confirmation for destructive or high-impact actions.
- Use inline validation and human-readable error messages.
- Keep keyboard navigation available for forms, tables, and navigation.
- Ensure readable contrast and visible focus indicators.
- Do not use the reference screenshot as a background or flatten the UI into an image. Rebuild it as actual HTML components and an interactive 3D scene.

## 9. Recommended technology stack

Keep the implementation aligned with the recruitment brief: TypeScript, React, Git/GitHub, Docker, Linux CLI, VPS, and SSH.

### Frontend
- React + TypeScript + Vite
- React Router
- Tailwind CSS
- shadcn/ui or accessible headless components
- React Three Fiber + Drei + Three.js
- TanStack Query for server state
- React Hook Form + Zod for forms and validation
- Recharts or another maintained chart library

### Backend
Recommended simple, consistent option:
- Node.js + TypeScript
- Fastify (or Express if the project already uses it)
- REST API with documented request/response schemas
- Zod for input validation

### Data and infrastructure
- PostgreSQL
- Prisma ORM and migrations
- Auth.js or another maintained authentication solution compatible with the selected architecture; choose one approach and document it rather than mixing auth systems.
- Docker and Docker Compose for local development
- Nginx or Caddy as reverse proxy in production
- GitHub Actions for lint, type-check, tests, and build
- Linux VPS deployment guide over SSH

Do not add Redis, Kubernetes, microservices, or event streaming to the MVP without a demonstrated need.

## 10. Initial data model

Use UUIDs or another consistent non-guessable identifier strategy.

- `users`: id, name, email, auth_provider_id, created_at
- `workspaces`: id, name, currency, timezone, created_at
- `workspace_members`: id, workspace_id, user_id, role
- `warehouses`: id, workspace_id, name, code
- `warehouse_zones`: id, warehouse_id, name, code
- `storage_locations`: id, warehouse_id, zone_id, parent_location_id, type, code, label, x, y, z, rotation, capacity, active
- `categories`: id, workspace_id, name
- `products`: id, workspace_id, sku, name, category_id, unit, barcode, cost_price, reorder_threshold, description, active
- `inventory_balances`: id, product_id, storage_location_id, quantity, updated_at
- `stock_movements`: id, workspace_id, product_id, type, quantity, source_location_id, destination_location_id, reference, note, actor_id, created_at
- `stock_adjustments`: id, movement_id, reason (only if adjustment-specific fields are needed)
- `notifications`: id, workspace_id, user_id, type, title, body, read_at, created_at

Requirements:
- Add foreign keys, indexes, uniqueness constraints, and check constraints where appropriate.
- SKU uniqueness should be scoped to workspace.
- Quantity should use an appropriate numeric type; do not use floating-point values for stock quantities if fractional quantities are not supported.
- Inventory updates and movement records must be committed atomically.
- Keep layout coordinates in the database so the 3D view can be reconstructed.
- Include seed data for a fictional sample business and warehouse.

## 11. API outline

Example REST endpoints (adjust names consistently during implementation):

- `POST /api/auth/...`
- `GET /api/dashboard/summary`
- `GET /api/products`
- `POST /api/products`
- `GET /api/products/:id`
- `PATCH /api/products/:id`
- `GET /api/warehouses`
- `GET /api/warehouses/:id/layout`
- `PATCH /api/storage-locations/:id`
- `GET /api/storage-locations/:id/inventory`
- `GET /api/stock-movements`
- `POST /api/stock-movements/stock-in`
- `POST /api/stock-movements/stock-out`
- `POST /api/stock-movements/transfer`
- `POST /api/stock-movements/adjustment`
- `GET /api/reports/low-stock`
- `GET /api/reports/movements`
- `GET /api/reports/export.csv`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`

Document validation errors and permission errors. Use pagination for list endpoints.

## 12. Security and data integrity

- Validate every external input on the server.
- Enforce workspace membership and role permissions on every protected endpoint.
- Use environment variables for secrets; commit only `.env.example`.
- Never log passwords, tokens, or sensitive session data.
- Configure secure cookies/session handling according to the chosen auth setup.
- Apply rate limits to authentication and sensitive write endpoints.
- Configure CORS deliberately.
- Use parameterized queries/ORM protections.
- Prevent negative inventory and concurrent-update race conditions with transactions and suitable row locking or atomic updates.
- Add audit-friendly transaction history.
- Provide database migration and backup/restore instructions.
- Avoid storing real personal or business data in seed fixtures.

## 13. Testing and quality gates

Minimum automated checks:
- ESLint
- Prettier
- TypeScript type checking
- Unit tests for stock calculations and reorder thresholds
- Integration tests for stock-in, stock-out, transfer, and insufficient-stock rejection
- Authorization tests proving a user cannot access another workspace's data
- UI tests for product creation and stock movement
- End-to-end smoke test for login → inventory → stock-in → updated dashboard
- Production build test

Important invariants:
1. Stock out cannot exceed available stock.
2. A transfer must decrease source and increase destination by the same quantity.
3. Failed transactions must not leave partial balance updates.
4. Every committed stock adjustment has a recorded actor and reason.
5. Unauthorized users cannot mutate inventory or warehouse layouts.
6. The 3D scene reflects persisted layout and inventory data.

## 14. Open-source release requirements

- License: MIT, after checking asset and dependency licenses.
- `README.md`: overview, screenshots, feature list, architecture, local setup, demo account instructions for development only, environment variables, testing, deployment, and roadmap.
- `CONTRIBUTING.md`: setup, branching, commit conventions, pull request checklist.
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`: vulnerability reporting process; do not ask people to post secrets in public issues.
- `LICENSE`
- `.env.example` with placeholder values only.
- GitHub issue templates: bug report, feature request.
- Pull request template.
- GitHub Actions workflow for lint, type-check, test, and build.
- `docs/architecture.md`, `docs/database.md`, `docs/deployment-vps.md`, `docs/3d-warehouse.md`.
- Use only original, public-domain, or appropriately licensed models/icons/fonts. Record asset attribution when required.
- Do not commit API keys, production credentials, database dumps, or real business data.

## 15. Suggested repository structure

```text
stockspace/
├── apps/
│   ├── web/                 # React + TypeScript frontend
│   └── api/                 # Node.js + TypeScript REST API
├── packages/
│   └── shared/              # Shared schemas/types if useful
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── 3d-warehouse.md
│   └── deployment-vps.md
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── design-reference.png
├── .env.example
├── docker-compose.yml
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE
```

Adjust the exact monorepo layout if needed, but keep frontend, API, database schema, documentation, and deployment instructions clearly separated.

## 16. Delivery phases

### Phase 0 — Project foundation
- Inspect the existing repository before changing files.
- Write architecture decisions and implementation plan.
- Configure workspace, lint, formatting, TypeScript, environment validation, and Docker.
- Create a basic CI pipeline.

### Phase 1 — UI shell and 3D prototype
- Recreate the clean dashboard shell inspired by `design-reference.png`.
- Implement responsive sidebar, header, KPI cards, charts, and contextual detail panel.
- Create procedural 3D racks, shelves, boxes, and staging areas.
- Support selection, camera controls, reset, zoom, and level filters.
- Use clearly labelled mock data only during this phase.

### Phase 2 — Database and inventory workflows
- Implement schema and migrations.
- Add product/category/location CRUD.
- Implement stock-in, stock-out, transfer, and adjustment using database transactions.
- Add integration tests for inventory invariants.

### Phase 3 — Connect 3D to real data
- Load warehouse layout from the API.
- Link selected 3D objects to storage-location records.
- Show actual products and balances in the detail panel.
- Refresh scene state after successful stock movements.
- Add fallback list view.

### Phase 4 — Authentication, roles, and reports
- Add sign-in and server-side authorization.
- Add dashboard metrics, reports, filters, and CSV export.
- Add low-stock notifications.

### Phase 5 — Release readiness
- Finish responsive and accessibility review.
- Add automated tests and CI quality gates.
- Complete README, contributing docs, license, security policy, and VPS deployment guide.
- Verify fresh-clone setup from documented instructions.
- Prepare a demo workspace with fictional data.

## 17. Definition of Done

The MVP is complete when:
- A developer can start it from a fresh clone by following the README.
- `docker compose up --build` (or the exact documented command) starts the required services.
- A user can sign in using the documented development flow.
- A user can create a product and storage location.
- Stock-in, stock-out, transfer, and adjustment work with correct database consistency.
- The dashboard reports values derived from persisted data.
- The 3D scene displays saved racks/locations and selects the matching inventory records.
- Low-stock items are identifiable and reportable.
- Role and workspace access controls are tested.
- Lint, type-check, tests, and production build pass.
- No secrets or unlicensed assets are committed.
- GitHub documentation is sufficient for outside contributors.

## 18. Product principles

1. Functionality before visual gimmicks.
2. 3D must expose useful inventory context and remain optional for accessibility and lower-powered devices.
3. The reference guides the visual direction, but all controls and charts must be real UI components.
4. Keep the MVP modular and avoid premature microservices.
5. Prefer maintainable, typed code and explicit error handling.
6. Never claim a feature is complete until it runs and has been tested.
