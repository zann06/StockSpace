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
}

type MovementListener = (event: MovementEvent) => void

const movementListeners = new Set<MovementListener>()

export function emitMovement(event: MovementEvent) {
  movementListeners.forEach((listener) => listener(event))
}

export function onMovement(listener: MovementListener): () => void {
  movementListeners.add(listener)
  return () => movementListeners.delete(listener)
}
