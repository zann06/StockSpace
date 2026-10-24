# Database

StockSpace uses **PostgreSQL 16** with **Prisma ORM**. The schema lives in
[`prisma/schema.prisma`](../prisma/schema.prisma); migrations in
`prisma/migrations/`; fictional seed data in [`prisma/seed.ts`](../prisma/seed.ts).

## Running it locally

```bash
npm run db:up        # docker compose up -d db (host port 5433 → container 5432)
npm run db:migrate   # prisma migrate dev (dev database)
npm run db:seed      # load the fictional "Toko TechNusa" demo workspace
```

The API integration tests use a separate `stockspace_test` database
(created automatically on fresh docker volumes by
`docker/postgres/init/01-create-test-db.sql` and defensively by the test
global setup).

## Data model (PRD §10)

```
Workspace 1─n WorkspaceMember n─1 User
Workspace 1─n Warehouse 1─n Zone 1─n StorageLocation
Workspace 1─n Category 1─n Product
Product 1─n InventoryBalance n─1 StorageLocation   ← current stock per location+level
Workspace 1─n StockMovement (append-only)          ← every committed stock change
Workspace 1─n Notification
```

Key choices:

- **UUIDs** for all primary keys (non-guessable identifiers).
- **`costPrice` is `Decimal(14,2)`** — money is never a float.
- **`InventoryBalance.quantity` is `Int` with a database `CHECK (quantity >= 0)`**
  (added in the init migration). The API's conditional updates are the primary
  enforcement; the constraint is the last line of defense.
- **`StockMovement` is append-only.** Corrections are compensating
  `ADJUSTMENT` movements; nothing edits or deletes history.
- Uniqueness scoped per workspace: `Product(workspaceId, sku)`,
  `StorageLocation(warehouseId, code)`, `Category(workspaceId, name)`.
- Layout coordinates (`x`, `z`, `rotation`, `levels`, `capacity`) are stored on
  `StorageLocation` — the 3D scene renders exclusively from these rows
  (PRD invariant #6).

## How stock consistency is guaranteed (PRD §7.3, §12)

All four movement types (`stock-in`, `stock-out`, `transfer`, `adjustment`)
run inside a **Prisma interactive transaction** (`src/services/movements.ts`):

1. The location/product are re-validated inside the transaction.
2. **Decrements** use a single conditional `UPDATE … WHERE quantity >= n`
   (`updateMany`). The row lock taken by the UPDATE serializes concurrent
   writers: exactly one of two competing transactions can consume the same
   units. Overselling returns `422 INSUFFICIENT_STOCK` and writes nothing.
3. **Increments** upsert the balance row atomically.
4. The movement record is inserted in the same transaction — a failure at any
   step rolls back the balance change (verified by
   `apps/api/test/inventory.test.ts` "rolls back the balance update…").

Concurrency is exercised directly: the integration suite fires parallel
stock-outs against a small balance and asserts exactly the available units are
consumed.

## Inventory value calculation

`inventoryValue = Σ over balances (quantity × product.costPrice)`, i.e.
**cost-price valuation** of on-hand stock, computed from persisted rows in
`GET /api/dashboard/summary`. This definition is the one documented for the
Reports module (Phase 4).

## API surface (Phase 2 scope)

All data routes require the `X-Workspace-Id` header (validated against the
database; replaced by real session checks in Phase 4):

- `GET /api/health`
- `GET /api/dashboard/summary`
- `GET|POST /api/products`, `GET|PATCH /api/products/:id`
- `GET /api/categories`
- `GET /api/warehouses`, `GET /api/warehouses/:id/layout`
- `GET /api/storage-locations/:id/inventory`
- `POST /api/stock-movements/stock-in|stock-out|transfer|adjustment`
- `GET /api/stock-movements` (filters: `type`, `productId`, `locationId`, paging)
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`

Errors are JSON: `{ "error": { "code", "message" } }` with meaningful status
codes (401 missing workspace, 404 not found, 409 duplicate SKU, 422 validation
/ insufficient stock, 500 internal). Until authentication lands, movement
requests carry `actorId` explicitly — this field becomes the session user in
Phase 4.

## Backup & restore

```bash
# backup
docker exec stockspace-db-1 pg_dump -U stockspace stockspace > backup-$(date +%F).sql
# restore into a fresh container
cat backup-2026-10-25.sql | docker exec -i stockspace-db-1 psql -U stockspace stockspace
```

On a VPS, schedule the `pg_dump` via cron and copy the archive off-box
(rclone/S3). Test restores regularly — a backup is only real if it restores.
