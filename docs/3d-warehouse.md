# The 3D warehouse

The interactive warehouse is a first-class product feature (PRD §7.4): it is
rendered from **persisted layout data**, never from UI-only constants, and it
degrades gracefully when WebGL is unavailable.

## Data flow

```
PostgreSQL (StorageLocation: x, z, rotation, capacity, levels, type, code)
  → GET /api/warehouses/:id/layout  (locations + balances + product summary)
    → useWarehouseData() (TanStack Query, cached & invalidated with movements)
      → WarehouseScene (React Three Fiber)
```

- `apps/web/src/components/warehouse/WarehouseScene.tsx` — procedural geometry:
  racks (uprights + shelf boards), cargo boxes (count derived from the balance
  quantity), staging/packing platforms, a decorative forklift. All geometry is
  original; there are **no external 3D assets** to license.
- Boxes per shelf row are deterministic (`quantity ≥ 200 → 3 boxes`, `≥ 40 → 2`,
  else 1) so the scene is stable across reloads.
- Status colours come from live balances: **Terisi** (green) · **Menipis** (red,
  any product at the location below its reorder threshold) · **Kosong** (grey).
  Colour is never the only signal — the same status is spelled out in the
  location list, tooltips, and detail panel, and the red low-stock marker
  pulses only when the user has not requested reduced motion.

## Interaction model

| Control | Behaviour |
| --- | --- |
| Orbit / pan / zoom | drei `OrbitControls` with damping (disabled under `prefers-reduced-motion`) |
| Click rack / area | Selects the location → right-hand detail panel loads `GET /api/storage-locations/:id/inventory` + movement history |
| Click label pill | Same selection, keyboard-reachable via the location list |
| 3D / 2D toggle | 2D locks rotation into a top-down layout view |
| L1–L3 filter | Shows only the selected shelf level's boxes |
| Zoom ±, reset, fullscreen | Camera dolly, preset restore, Fullscreen API |
| Daftar lokasi | Accessible list overlay (also the automatic fallback) |

## Fallbacks & performance

- **No WebGL** (`isWebGLAvailable()` probe or render-time failure via
  `SceneErrorBoundary`) → the location list replaces the canvas; every feature
  stays reachable (PRD: the app must remain a practical inventory tool).
- `dpr` capped at 2, shared shadow-casting light, single directional shadow map
  at 1024², ~40 low-poly meshes — comfortably 60 fps on integrated graphics.
- Movements invalidate the layout query, so balances/status dots update without
  a manual refresh.
