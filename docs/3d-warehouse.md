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
  quantity), staging/packing platforms, and an animated forklift that runs the
  delivery choreography. All geometry is original; there are **no external 3D
  assets** to license.
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
| Click cargo box | Toggles a pulsing highlight ring on that box (the click still bubbles, so the rack stays selected) |
| Hover box / forklift | Subtle float + glow, and a status pill on the forklift |
| 3D / 2D toggle | 2D locks rotation into a top-down layout view |
| L1–L3 filter | Shows only the selected shelf level's boxes |
| Zoom ±, reset, fullscreen | Camera dolly, preset restore, Fullscreen API |
| Daftar lokasi | Accessible list overlay (also the automatic fallback) |

## Delivery animation

A saved movement emits a `MovementEvent`; the scene queues it and drives one
forklift trip (one job at a time, no overlap):

| Phase | Motion |
| --- | --- |
| Drive to source | Catmull-Rom drive path, eased with a single cubic-bezier `(0.22, 0.78)` over 1.4–3.0 s so the forklift pulls away and brakes calmly |
| Lift | Cubic-bezier fork rise (0.62 s) with a four-stage box micro-animation — approach → align → grip → lift (`multiPhasePickup`) |
| Carry | Velocity-based easing (accelerate, cruise, brake) + smooth look-at steering, with a small speed-scaled suspension bob on the carriage |
| Place | Box slides off the tines, gravity drop with squash-and-stretch and a landing flash, then the glow fades |
| Return | Same calm S-curve back to the parking spot, carriage lowering |

Feedback layered on top: trail particles from an object pool, a heading
indicator cone, an amber→red proximity ring when a rack is within
`PROXIMITY_WARNING_RADIUS` (1.5 units) while moving, and a pulsing ring on the
pickup location. Everything except the rack selection is skipped when the user
prefers reduced motion — the movement is still recorded, just not animated.

## Fallbacks & performance

- **No WebGL** (`isWebGLAvailable()` probe or render-time failure via
  `SceneErrorBoundary`) → the location list replaces the canvas; every feature
  stays reachable (PRD: the app must remain a practical inventory tool).
- `dpr` capped at 2, shared shadow-casting light, single directional shadow map
  at 1024², ~40 low-poly meshes — comfortably 60 fps on integrated graphics.
- Distant cargo boxes drop out of the shadow pass (level-of-detail) but stay
  visible, so zooming out never makes a stocked rack look empty. Trail particles
  come from a fixed-size pool and are gated behind reduced-motion.
- Movements invalidate the layout query, so balances/status dots update without
  a manual refresh.
