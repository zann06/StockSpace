import { afterEach, describe, expect, it, vi } from 'vitest'

import { consumePendingMovement, emitMovement, onMovement, type MovementEvent } from '@/lib/events'

const movement: MovementEvent = {
  type: 'TRANSFER',
  productId: 'product-1',
  quantity: 4,
  sourceLocationId: 'rack-a1',
  sourceLevel: 1,
  destinationLocationId: 'rack-b2',
  destinationLevel: 3,
}

describe('movement events', () => {
  afterEach(() => {
    vi.useRealTimers()
    consumePendingMovement()
  })

  it('notifies live subscribers with the full event', () => {
    const listener = vi.fn()
    const unsubscribe = onMovement(listener)
    emitMovement(movement)
    unsubscribe()
    expect(listener).toHaveBeenCalledWith(movement)
  })

  it('replays a recent movement once for a freshly mounted scene', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    emitMovement(movement)
    vi.setSystemTime(5_000)

    expect(consumePendingMovement()).toEqual(movement)
    expect(consumePendingMovement()).toBeNull()
  })

  it('drops pending movements older than the replay window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    emitMovement(movement)
    vi.setSystemTime(40_000)

    expect(consumePendingMovement()).toBeNull()
  })
})
