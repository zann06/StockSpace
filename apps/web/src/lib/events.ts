/**
 * Tiny pub/sub for UI events that cross feature boundaries (e.g. a committed
 * stock movement triggering a 3D delivery animation in the warehouse scene).
 */

export interface MovementEvent {
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'
  productId: string
  quantity: number
  destinationLocationId?: string | null
  sourceLocationId?: string | null
  /** Shelf level (1–3) so the 3D forklift lifts to the right rack level. */
  destinationLevel?: number | null
  sourceLevel?: number | null
}

type MovementListener = (event: MovementEvent) => void

const movementListeners = new Set<MovementListener>()

/**
 * The movement form lives on a different route than the 3D scene, so a
 * committed movement could otherwise finish before the warehouse mounts.
 * Keep the latest one briefly so a freshly mounted scene can replay it.
 */
const PENDING_TTL_MS = 30_000
let pendingMovement: { event: MovementEvent; at: number } | null = null

export function emitMovement(event: MovementEvent) {
  pendingMovement = { event, at: Date.now() }
  movementListeners.forEach((listener) => listener(event))
}

export function onMovement(listener: MovementListener): () => void {
  movementListeners.add(listener)
  return () => movementListeners.delete(listener)
}

/** Returns the most recent movement once, unless it is older than `maxAgeMs`. */
export function consumePendingMovement(maxAgeMs = PENDING_TTL_MS): MovementEvent | null {
  if (!pendingMovement) return null
  const { event, at } = pendingMovement
  pendingMovement = null
  return Date.now() - at <= maxAgeMs ? event : null
}
