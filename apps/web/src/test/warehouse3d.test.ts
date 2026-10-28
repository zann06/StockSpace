import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'

import {
  carryBobbing,
  collisionWarning,
  dropWithImpact,
  enhancedBoxHover,
  highlightRing,
  multiPhasePickup,
  proximityAlert,
  velocityBasedEasing,
} from '@/lib/warehouse3d'

describe('velocityBasedEasing', () => {
  it('maps progress 0..1 onto position 0..1', () => {
    expect(velocityBasedEasing(0).position).toBeCloseTo(0, 5)
    expect(velocityBasedEasing(1).position).toBeCloseTo(1, 5)
  })

  it('is monotonically non-decreasing', () => {
    let previous = -Infinity
    for (let i = 0; i <= 100; i++) {
      const { position } = velocityBasedEasing(i / 100)
      expect(position).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = position
    }
  })

  it('accelerates from zero and brakes to zero', () => {
    expect(velocityBasedEasing(0).velocity).toBeCloseTo(0, 5)
    expect(velocityBasedEasing(1).velocity).toBeCloseTo(0, 5)
    expect(velocityBasedEasing(0.5).velocity).toBeGreaterThan(0)
  })

  it('clamps out-of-range progress', () => {
    expect(velocityBasedEasing(-3).position).toBeCloseTo(0, 5)
    expect(velocityBasedEasing(4).position).toBeCloseTo(1, 5)
  })
})

describe('multiPhasePickup', () => {
  it('reports the expected phase for each segment', () => {
    expect(multiPhasePickup(0.1, 1).phase).toBe('approach')
    expect(multiPhasePickup(0.3, 1).phase).toBe('align')
    expect(multiPhasePickup(0.5, 1).phase).toBe('grip')
    expect(multiPhasePickup(0.8, 1).phase).toBe('lift')
  })

  it('ends the lift at the full height with the box back at rest scale', () => {
    const end = multiPhasePickup(1, 2)
    expect(end.yOffset).toBeCloseTo(2, 5)
    expect(end.scale).toBeCloseTo(1, 5)
  })

  it('keeps the phases continuous at the boundaries', () => {
    expect(multiPhasePickup(0.2, 1).zOffset).toBeCloseTo(0, 5)
    expect(multiPhasePickup(0.4, 1).scale).toBeCloseTo(1, 5)
    expect(multiPhasePickup(0.6, 1).scale).toBeCloseTo(0.95, 5)
  })
})

describe('dropWithImpact', () => {
  it('starts at full height and is grounded before the impact', () => {
    expect(dropWithImpact(0, 2).yOffset).toBeCloseTo(2, 5)
    expect(dropWithImpact(0.667, 2).yOffset).toBeCloseTo(0, 5)
  })

  it('produces a decaying impact squash', () => {
    const squash = dropWithImpact(0.72, 2).squash
    expect(Math.abs(squash)).toBeGreaterThan(0)
    expect(Math.abs(dropWithImpact(1, 2).squash)).toBeLessThan(Math.abs(squash))
  })
})

describe('enhancedBoxHover', () => {
  it('is static when intensity is zero (reduced motion)', () => {
    const hover = enhancedBoxHover(1.23, true, true, 0)
    expect(hover.yOffset).toBe(0)
  })

  it('lifts and glows more when hovered and selected', () => {
    const idle = enhancedBoxHover(0.5, false, false, 1)
    const active = enhancedBoxHover(0.5, true, true, 1)
    expect(active.glow).toBeGreaterThan(idle.glow)
    expect(active.scale).toBeGreaterThan(idle.scale)
  })
})

describe('carryBobbing', () => {
  it('does not move when stationary', () => {
    const still = carryBobbing(1.234, 0, 1)
    expect(still.yOffset).toBeCloseTo(0, 6)
    expect(still.xOffset).toBeCloseTo(0, 6)
  })

  it('stays subtle while moving', () => {
    const moving = carryBobbing(1.234, 1, 1)
    expect(Math.abs(moving.yOffset)).toBeLessThanOrEqual(0.02)
    expect(Math.abs(moving.xOffset)).toBeLessThanOrEqual(0.01)
  })
})

describe('proximityAlert and collisionWarning', () => {
  it('reports urgency only inside the alert radius', () => {
    const near = proximityAlert(new Vector3(1, 0, 0), new Vector3(0, 0, 0), 2)
    const far = proximityAlert(new Vector3(5, 0, 0), new Vector3(0, 0, 0), 2)
    expect(near.inProximity).toBe(true)
    expect(near.urgency).toBeGreaterThan(0)
    expect(far.inProximity).toBe(false)
    expect(far.urgency).toBe(0)
  })

  it('shifts colour toward red as the obstacle gets closer', () => {
    const far = collisionWarning(1.8, 1.9, 1.0)
    const close = collisionWarning(1.0, 1.9, 1.0)
    expect(close.intensity).toBeGreaterThan(far.intensity)
    expect(close.color[1]).toBeLessThan(far.color[1])
  })
})

describe('highlightRing', () => {
  it('is invisible when not selected', () => {
    expect(highlightRing(1, false, 1).opacity).toBe(0)
  })

  it('pulses around the base radius when selected', () => {
    const ring = highlightRing(1, true, 1)
    expect(ring.radius).toBeGreaterThanOrEqual(1)
    expect(ring.radius).toBeLessThanOrEqual(1.1)
    expect(ring.opacity).toBeGreaterThan(0)
  })
})
