import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'

import {
  isRouteSegmentClear,
  isSegmentClear,
  planForkliftRoute,
  type RouteBounds,
  type RouteObstacle,
} from '@/lib/forkliftRoute'

const BOUNDS: RouteBounds = { minX: -8.9, maxX: 8.9, minZ: -5.9, maxZ: 5.9 }
const OPTIONS = {
  clearance: 0.62,
  cellSize: 0.22,
  bounds: BOUNDS,
  cornerRadius: 0.72,
  safetyClearance: 0.52,
} as const

/** Mirrors the seeded warehouse layout used by the 3D scene. */
const RACKS: RouteObstacle[] = [-4.8, -2.4, 0, 2.4, 4.8].map((x) => ({
  x,
  z: -2,
  halfWidth: 1.9 / 2,
  halfDepth: 0.85 / 2,
  rotation: 0,
}))
const STAGING: RouteObstacle = {
  x: -4.4,
  z: 1.9,
  halfWidth: 2.4 / 2,
  halfDepth: 1.8 / 2,
  rotation: 0,
}
const PACKING: RouteObstacle = {
  x: 0.6,
  z: 2,
  halfWidth: 2.1 / 2,
  halfDepth: 1.15 / 2,
  rotation: 0,
}
const OBSTACLES = [...RACKS, STAGING, PACKING]

const PARK = new Vector3(5.7, 0, 1.5)
const STAGING_DOCK = new Vector3(-4.4, 0, 0.3)
const PACKING_DOCK = new Vector3(0.6, 0, 0.725)
const RACK_DOCKS = [-4.8, -2.4, 0, 2.4, 4.8].map((x) => new Vector3(x, 0, -2 + 0.425 + 0.85))

function expectSafeRoute(points: Vector3[], clearance: number) {
  for (let index = 0; index < points.length - 1; index++) {
    expect(
      isRouteSegmentClear(
        points[index].x,
        points[index].z,
        points[index + 1].x,
        points[index + 1].z,
        OBSTACLES,
        clearance
      ),
      `segment ${index} crosses an obstacle`
    ).toBe(true)
  }
}

describe('planForkliftRoute', () => {
  it('keeps a clear line untouched', () => {
    const start = new Vector3(0, 0, 4)
    const end = new Vector3(3, 0, 4)
    const plan = planForkliftRoute(start, end, OBSTACLES, OPTIONS)

    expect(plan.points).toHaveLength(2)
    expect(plan.points[0].distanceTo(start)).toBeLessThan(1e-9)
    expect(plan.points[1].distanceTo(end)).toBeLessThan(1e-9)
    expect(plan.length).toBeCloseTo(3, 5)
  })

  it('detours around a blocking obstacle instead of cutting through it', () => {
    const block: RouteObstacle = { x: 0, z: 0, halfWidth: 1, halfDepth: 1, rotation: 0 }
    const start = new Vector3(-3, 0, 0)
    const end = new Vector3(3, 0, 0)
    const plan = planForkliftRoute(start, end, [block], {
      ...OPTIONS,
      bounds: { minX: -6, maxX: 6, minZ: -4, maxZ: 4 },
      clearance: 0.45,
      safetyClearance: 0.3,
    })

    expect(plan.length).toBeGreaterThan(6)
    for (let index = 0; index < plan.points.length - 1; index++) {
      expect(
        isRouteSegmentClear(
          plan.points[index].x,
          plan.points[index].z,
          plan.points[index + 1].x,
          plan.points[index + 1].z,
          [block],
          0.3
        )
      ).toBe(true)
    }
  })

  it('routes from the parking spot to the receiving dock without entering a platform', () => {
    const plan = planForkliftRoute(PARK, STAGING_DOCK, OBSTACLES, OPTIONS)

    expectSafeRoute(plan.points, 0.52)
    expect(plan.points[0].distanceTo(PARK)).toBeLessThan(1e-9)
    expect(plan.points[plan.points.length - 1].distanceTo(STAGING_DOCK)).toBeLessThan(1e-9)
    expect(plan.length).toBeGreaterThan(0)
  })

  it('keeps every seeded dock-to-dock trip clear of the real footprints', () => {
    const docks = [PARK, STAGING_DOCK, PACKING_DOCK, ...RACK_DOCKS]

    for (const start of docks) {
      for (const end of docks) {
        if (start.distanceTo(end) < 0.2) continue
        const plan = planForkliftRoute(start, end, OBSTACLES, OPTIONS)
        expectSafeRoute(plan.points, 0.52)
      }
    }
  })

  it('respects the warehouse bounds', () => {
    const plan = planForkliftRoute(PARK, STAGING_DOCK, OBSTACLES, OPTIONS)
    for (const point of plan.points) {
      expect(point.x).toBeGreaterThanOrEqual(BOUNDS.minX)
      expect(point.x).toBeLessThanOrEqual(BOUNDS.maxX)
      expect(point.z).toBeGreaterThanOrEqual(BOUNDS.minZ)
      expect(point.z).toBeLessThanOrEqual(BOUNDS.maxZ)
    }
  })

  it('reports whether an arbitrary segment is clear', () => {
    expect(isSegmentClear(new Vector3(-1, 0, -2), new Vector3(1, 0, -2), OBSTACLES, 0.3)).toBe(
      false
    )
    expect(isSegmentClear(new Vector3(-1, 0, 0.9), new Vector3(1, 0, 0.9), OBSTACLES, 0.3)).toBe(
      true
    )
  })
})
