import { MathUtils, Vector3 } from 'three'

/**
 * Obstacle-aware route planning for the 3D forklift.
 *
 * The warehouse layout is persisted data (`StorageLocation`), so the route
 * planner cannot rely on hard-coded lanes: it receives the current footprints
 * and finds a collision-free path between two dock points. Paths are planned on
 * an A* grid with a forklift-sized clearance, simplified with a line-of-sight
 * pass, then rounded into gentle arcs so the drive looks natural instead of
 * zig-zagging between grid cells.
 */

export interface RouteObstacle {
  /** Centre of the obstacle in world space. */
  x: number
  z: number
  halfWidth: number
  halfDepth: number
  /** Rotation around the Y axis in radians (matches `StorageLocation.rotation`). */
  rotation: number
}

export interface RouteBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface RoutePlanOptions {
  /** How far the forklift centre should stay from every obstacle while planning. */
  clearance?: number
  /** A* grid resolution in world units. Smaller is more precise but slower. */
  cellSize?: number
  /** Hard world limits (the warehouse floor). */
  bounds?: RouteBounds
  /** Maximum radius used to round corners. */
  cornerRadius?: number
  /** Minimum gap kept between the centreline and a real obstacle after rounding. */
  safetyClearance?: number
}

export interface RoutePlan {
  /** Collision-free, smoothed path from start to end (y is always 0). */
  points: Vector3[]
  length: number
}

const DEFAULT_CLEARANCE = 0.62
const DEFAULT_CELL_SIZE = 0.22
const DEFAULT_CORNER_RADIUS = 0.72
const DEFAULT_SAFETY_CLEARANCE = 0.34
const EPSILON = 1e-7

/** Transform a world point into an obstacle's local (unrotated) frame. */
function toLocal(x: number, z: number, obstacle: RouteObstacle) {
  const dx = x - obstacle.x
  const dz = z - obstacle.z
  const cos = Math.cos(obstacle.rotation)
  const sin = Math.sin(obstacle.rotation)
  return {
    x: dx * cos - dz * sin,
    z: dx * sin + dz * cos,
  }
}

function isPointBlocked(
  x: number,
  z: number,
  obstacles: RouteObstacle[],
  clearance: number
): boolean {
  for (const obstacle of obstacles) {
    const local = toLocal(x, z, obstacle)
    if (
      Math.abs(local.x) <= obstacle.halfWidth + clearance &&
      Math.abs(local.z) <= obstacle.halfDepth + clearance
    ) {
      return true
    }
  }
  return false
}

/** Segment vs rotated rectangle using the slab method in local coordinates. */
function segmentHitsObstacle(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  obstacle: RouteObstacle,
  clearance: number
): boolean {
  const a = toLocal(ax, az, obstacle)
  const b = toLocal(bx, bz, obstacle)
  const dx = b.x - a.x
  const dz = b.z - a.z
  const halfWidth = obstacle.halfWidth + clearance
  const halfDepth = obstacle.halfDepth + clearance

  let tMin = 0
  let tMax = 1

  for (const axis of [
    { start: a.x, delta: dx, half: halfWidth },
    { start: a.z, delta: dz, half: halfDepth },
  ]) {
    if (Math.abs(axis.delta) < EPSILON) {
      if (axis.start < -axis.half || axis.start > axis.half) return false
      continue
    }
    let t1 = (-axis.half - axis.start) / axis.delta
    let t2 = (axis.half - axis.start) / axis.delta
    if (t1 > t2) {
      const swap = t1
      t1 = t2
      t2 = swap
    }
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  }

  return true
}

export function isSegmentClear(
  a: Vector3,
  b: Vector3,
  obstacles: RouteObstacle[],
  clearance: number
): boolean {
  for (const obstacle of obstacles) {
    if (segmentHitsObstacle(a.x, a.z, b.x, b.z, obstacle, clearance)) return false
  }
  return true
}

/** True when the straight line between two points is a safe drive. */
export function isRouteSegmentClear(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  obstacles: RouteObstacle[],
  clearance: number
): boolean {
  for (const obstacle of obstacles) {
    if (segmentHitsObstacle(ax, az, bx, bz, obstacle, clearance)) return false
  }
  return true
}

function resolveBounds(
  start: Vector3,
  end: Vector3,
  obstacles: RouteObstacle[],
  requested: RouteBounds | undefined,
  clearance: number
): RouteBounds {
  if (requested) return requested

  let minX = Math.min(start.x, end.x)
  let maxX = Math.max(start.x, end.x)
  let minZ = Math.min(start.z, end.z)
  let maxZ = Math.max(start.z, end.z)

  for (const obstacle of obstacles) {
    const extent = Math.hypot(obstacle.halfWidth, obstacle.halfDepth) + clearance + 1.5
    minX = Math.min(minX, obstacle.x - extent)
    maxX = Math.max(maxX, obstacle.x + extent)
    minZ = Math.min(minZ, obstacle.z - extent)
    maxZ = Math.max(maxZ, obstacle.z + extent)
  }

  return { minX: minX - 2, maxX: maxX + 2, minZ: minZ - 2, maxZ: maxZ + 2 }
}

interface Grid {
  cols: number
  rows: number
  cellSize: number
  minX: number
  minZ: number
  blocked: Uint8Array
}

function buildGrid(
  bounds: RouteBounds,
  obstacles: RouteObstacle[],
  clearance: number,
  cellSize: number
): Grid {
  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize))
  const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize))
  const blocked = new Uint8Array(cols * rows)

  for (let iz = 0; iz < rows; iz++) {
    const z = bounds.minZ + (iz + 0.5) * cellSize
    for (let ix = 0; ix < cols; ix++) {
      const x = bounds.minX + (ix + 0.5) * cellSize
      if (isPointBlocked(x, z, obstacles, clearance)) blocked[iz * cols + ix] = 1
    }
  }

  return { cols, rows, cellSize, minX: bounds.minX, minZ: bounds.minZ, blocked }
}

function toGridIndex(grid: Grid, x: number, z: number) {
  const ix = MathUtils.clamp(Math.round((x - grid.minX) / grid.cellSize - 0.5), 0, grid.cols - 1)
  const iz = MathUtils.clamp(Math.round((z - grid.minZ) / grid.cellSize - 0.5), 0, grid.rows - 1)
  return { ix, iz }
}

function gridWorld(grid: Grid, ix: number, iz: number) {
  return new Vector3(
    grid.minX + (ix + 0.5) * grid.cellSize,
    0,
    grid.minZ + (iz + 0.5) * grid.cellSize
  )
}

/** Nearest non-blocked cell, used when a dock sits right on the clearance edge. */
function nearestFreeCell(grid: Grid, ix: number, iz: number) {
  if (!grid.blocked[iz * grid.cols + ix]) return { ix, iz }

  let best = { ix, iz, distance: Infinity }
  const radius = 16
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = ix + dx
      const nz = iz + dz
      if (nx < 0 || nz < 0 || nx >= grid.cols || nz >= grid.rows) continue
      if (grid.blocked[nz * grid.cols + nx]) continue
      const distance = dx * dx + dz * dz
      if (distance < best.distance) best = { ix: nx, iz: nz, distance }
    }
  }
  return { ix: best.ix, iz: best.iz }
}

/** Small binary heap so the A* open set stays cheap for the ~7k-cell grid. */
class MinHeap {
  private indexes: number[] = []
  private priorities: number[] = []

  get size() {
    return this.indexes.length
  }

  push(index: number, priority: number) {
    this.indexes.push(index)
    this.priorities.push(priority)
    let child = this.indexes.length - 1
    while (child > 0) {
      const parent = (child - 1) >> 1
      if (this.priorities[parent] <= this.priorities[child]) break
      this.swap(parent, child)
      child = parent
    }
  }

  pop(): { index: number; priority: number } | null {
    if (this.indexes.length === 0) return null
    const index = this.indexes[0]
    const priority = this.priorities[0]
    const lastIndex = this.indexes.pop() as number
    const lastPriority = this.priorities.pop() as number
    if (this.indexes.length > 0) {
      this.indexes[0] = lastIndex
      this.priorities[0] = lastPriority
      let parent = 0
      for (;;) {
        const left = parent * 2 + 1
        const right = left + 1
        let smallest = parent
        if (left < this.indexes.length && this.priorities[left] < this.priorities[smallest]) {
          smallest = left
        }
        if (right < this.indexes.length && this.priorities[right] < this.priorities[smallest]) {
          smallest = right
        }
        if (smallest === parent) break
        this.swap(parent, smallest)
        parent = smallest
      }
    }
    return { index, priority }
  }

  private swap(a: number, b: number) {
    const index = this.indexes[a]
    this.indexes[a] = this.indexes[b]
    this.indexes[b] = index
    const priority = this.priorities[a]
    this.priorities[a] = this.priorities[b]
    this.priorities[b] = priority
  }
}

const NEIGHBOURS = [
  { dx: 1, dz: 0, cost: 1 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: 1, cost: Math.SQRT2 },
  { dx: 1, dz: -1, cost: Math.SQRT2 },
  { dx: -1, dz: 1, cost: Math.SQRT2 },
  { dx: -1, dz: -1, cost: Math.SQRT2 },
]

function heuristic(ix: number, iz: number, goalIx: number, goalIz: number) {
  const dx = Math.abs(ix - goalIx)
  const dz = Math.abs(iz - goalIz)
  return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)
}

function aStar(grid: Grid, start: { ix: number; iz: number }, goal: { ix: number; iz: number }) {
  const total = grid.cols * grid.rows
  const startIndex = start.iz * grid.cols + start.ix
  const goalIndex = goal.iz * grid.cols + goal.ix
  const gScore = new Float64Array(total).fill(Infinity)
  const cameFrom = new Int32Array(total).fill(-1)
  const closed = new Uint8Array(total)
  const open = new MinHeap()

  gScore[startIndex] = 0
  open.push(startIndex, heuristic(start.ix, start.iz, goal.ix, goal.iz))

  while (open.size > 0) {
    const node = open.pop()
    if (!node) break
    if (closed[node.index]) continue
    if (node.index === goalIndex) break
    closed[node.index] = 1

    const ix = node.index % grid.cols
    const iz = Math.floor(node.index / grid.cols)

    for (const neighbour of NEIGHBOURS) {
      const nx = ix + neighbour.dx
      const nz = iz + neighbour.dz
      if (nx < 0 || nz < 0 || nx >= grid.cols || nz >= grid.rows) continue

      const neighbourIndex = nz * grid.cols + nx
      if (closed[neighbourIndex] || grid.blocked[neighbourIndex]) continue

      // Do not squeeze diagonally between two blocked cells.
      if (neighbour.dx !== 0 && neighbour.dz !== 0) {
        if (grid.blocked[iz * grid.cols + nx] || grid.blocked[nz * grid.cols + ix]) continue
      }

      const tentative = gScore[node.index] + neighbour.cost
      if (tentative + EPSILON >= gScore[neighbourIndex]) continue

      gScore[neighbourIndex] = tentative
      cameFrom[neighbourIndex] = node.index
      open.push(neighbourIndex, tentative + heuristic(nx, nz, goal.ix, goal.iz))
    }
  }

  if (startIndex !== goalIndex && cameFrom[goalIndex] === -1) return null

  const cells: Vector3[] = []
  let current = goalIndex
  while (current !== -1) {
    cells.push(gridWorld(grid, current % grid.cols, Math.floor(current / grid.cols)))
    if (current === startIndex) break
    current = cameFrom[current]
  }
  cells.reverse()
  return cells
}

function clonePoints(points: Vector3[]) {
  return points.map((point) => point.clone())
}

/** Greedy line-of-sight simplification: keeps the route taut without cutting corners. */
function simplifyPath(points: Vector3[], obstacles: RouteObstacle[], clearance: number) {
  if (points.length <= 2) return clonePoints(points)

  const result: Vector3[] = [points[0].clone()]
  let anchor = 0

  while (anchor < points.length - 1) {
    let next = anchor + 1
    for (let candidate = points.length - 1; candidate > anchor + 1; candidate--) {
      if (isSegmentClear(points[anchor], points[candidate], obstacles, clearance)) {
        next = candidate
        break
      }
    }
    result.push(points[next].clone())
    anchor = next
  }

  return result
}

function quadraticPoint(a: Vector3, control: Vector3, b: Vector3, t: number) {
  const u = 1 - t
  return new Vector3(
    u * u * a.x + 2 * u * t * control.x + t * t * b.x,
    0,
    u * u * a.z + 2 * u * t * control.z + t * t * b.z
  )
}

function appendUnique(points: Vector3[], point: Vector3) {
  const last = points[points.length - 1]
  if (last && last.distanceToSquared(point) < EPSILON) return
  points.push(point.clone())
}

/**
 * Replaces each corner with a quadratic fillet. The arc is tangent to both
 * segments, so the forklift never has to stop-and-pivot at a grid corner.
 */
function roundCorners(points: Vector3[], radius: number) {
  if (points.length <= 2 || radius <= 0.01) return clonePoints(points)

  const result: Vector3[] = [points[0].clone()]

  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]
    const corner = points[index]
    const next = points[index + 1]

    const toPrevious = previous.clone().sub(corner)
    const toNext = next.clone().sub(corner)
    const previousLength = toPrevious.length()
    const nextLength = toNext.length()
    if (previousLength < EPSILON || nextLength < EPSILON) continue

    // Leave at least part of each segment straight so neighbouring fillets do
    // not overlap on short grid steps.
    const fillet = Math.min(radius, previousLength * 0.42, nextLength * 0.42)
    if (fillet < 0.02) {
      appendUnique(result, corner)
      continue
    }

    const start = corner.clone().add(toPrevious.normalize().multiplyScalar(fillet))
    const end = corner.clone().add(toNext.normalize().multiplyScalar(fillet))
    appendUnique(result, start)

    const steps = Math.max(4, Math.ceil(fillet * 10))
    for (let step = 1; step <= steps; step++) {
      appendUnique(result, quadraticPoint(start, corner, end, step / steps))
    }
  }

  appendUnique(result, points[points.length - 1])
  return result
}

function pathIsClear(points: Vector3[], obstacles: RouteObstacle[], clearance: number) {
  if (clearance <= 0) return true
  for (let index = 0; index < points.length; index++) {
    if (isPointBlocked(points[index].x, points[index].z, obstacles, clearance)) return false
  }
  for (let index = 0; index < points.length - 1; index++) {
    if (!isSegmentClear(points[index], points[index + 1], obstacles, clearance)) return false
  }
  return true
}

function pathLength(points: Vector3[]) {
  let length = 0
  for (let index = 0; index < points.length - 1; index++) {
    length += points[index].distanceTo(points[index + 1])
  }
  return length
}

/**
 * Plan a collision-free drive between two dock points.
 *
 * The returned polyline always starts exactly at `start` and ends exactly at
 * `end`. When a direct line is already clear the planner returns it untouched,
 * which keeps short aisle hops perfectly straight.
 */
export function planForkliftRoute(
  start: Vector3,
  end: Vector3,
  obstacles: RouteObstacle[],
  options: RoutePlanOptions = {}
): RoutePlan {
  const clearance = options.clearance ?? DEFAULT_CLEARANCE
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE
  const cornerRadius = options.cornerRadius ?? DEFAULT_CORNER_RADIUS
  const safetyClearance = options.safetyClearance ?? DEFAULT_SAFETY_CLEARANCE
  const bounds = resolveBounds(start, end, obstacles, options.bounds, clearance)

  const from = new Vector3(start.x, 0, start.z)
  const to = new Vector3(end.x, 0, end.z)

  if (isSegmentClear(from, to, obstacles, clearance)) {
    return { points: [from, to], length: from.distanceTo(to) }
  }

  const grid = buildGrid(bounds, obstacles, clearance, cellSize)
  const fromCell = toGridIndex(grid, from.x, from.z)
  const toCell = toGridIndex(grid, to.x, to.z)
  const fromIndex = nearestFreeCell(grid, fromCell.ix, fromCell.iz)
  const toIndex = nearestFreeCell(grid, toCell.ix, toCell.iz)

  const cellPath = aStar(grid, fromIndex, toIndex)
  if (!cellPath) {
    // Extremely defensive fallback: never throw in the render loop. The caller
    // still gets a straight line, and the dock points themselves are outside
    // obstacles, so the forklift cannot tunnel through a rack.
    return { points: [from, to], length: from.distanceTo(to) }
  }

  const raw = [from, ...cellPath, to]
  const simplified = simplifyPath(raw, obstacles, clearance * 0.98)

  // Round corners progressively more tightly until the arc no longer eats into
  // the safety margin around a real obstacle.
  let radius = cornerRadius
  let smoothed = roundCorners(simplified, radius)
  while (radius > 0.05 && !pathIsClear(smoothed, obstacles, safetyClearance)) {
    radius *= 0.7
    smoothed = roundCorners(simplified, radius)
  }

  if (!pathIsClear(smoothed, obstacles, safetyClearance)) {
    smoothed = clonePoints(simplified)
  }

  return { points: smoothed, length: pathLength(smoothed) }
}
