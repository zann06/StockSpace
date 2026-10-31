import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Grid, Html, OrbitControls, RoundedBox } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  CatmullRomCurve3,
  Color,
  MathUtils,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
} from 'three'
import type {
  Balance,
  LevelFilter,
  OccupancyStatus,
  SceneProduct,
  StorageLocation,
  ViewMode,
  ZoomCommand,
} from '@/types'
import { formatNumber } from '@/lib/format'
import { applyGroupDim } from '@/lib/warehouse3d'
import { WarehouseSetDressing } from '@/components/warehouse/WarehouseSetDressing'
import { BlobShadow, WarehouseWorkers } from '@/components/warehouse/WarehouseWorkers'
import { consumePendingMovement, onMovement, type MovementEvent } from '@/lib/events'
import { useI18n } from '@/i18n'
import {
  easeInOutCubic,
  easeOutCubic,
  smoothRotateToward,
  smoothTransform,
  // Enhanced v2 functions
  velocityBasedEasing,
  cubicBezier,
  enhancedBoxHover,
  multiPhasePickup,
  carryBobbing,
  dropWithImpact,
  generateTrailParticles,
  getLODLevel,
  highlightRing,
  directionIndicator,
  collisionWarning,
  proximityAlert,
  ParticlePool,
} from '@/lib/warehouse3d'
import { planForkliftRoute, type RouteBounds, type RouteObstacle } from '@/lib/forkliftRoute'

/**
 * Procedural 3D warehouse — racks, shelves, boxes, staging/packing areas, and
 * a forklift, all original geometry (no external models). Every interactive
 * object is derived from `StorageLocation` records with persisted coordinates.
 */

const RACK_WIDTH = 1.9
const RACK_DEPTH = 0.85
const SHELF_Y = [0.22, 1.16, 2.1] as const
const UPRIGHT_HEIGHT = 2.72

const OCCUPANCY_COLOR: Record<OccupancyStatus, string> = {
  EMPTY: '#98a1c0',
  OCCUPIED: '#10b981',
  LOW: '#f0445e',
}

const OCCUPANCY_LABEL: Record<OccupancyStatus, string> = {
  EMPTY: 'Kosong',
  OCCUPIED: 'Terisi',
  LOW: 'Menipis',
}

const KRAFT_COLORS = ['#d9b98e', '#cdae82', '#e2c79f', '#d3b188'] as const

export interface WarehouseSceneProps {
  locations: StorageLocation[]
  balances: Balance[]
  products: SceneProduct[]
  selectedLocationId: string | null
  onSelect: (id: string | null) => void
  levelFilter: LevelFilter
  viewMode: ViewMode
  zoomCommand: ZoomCommand | null
  resetNonce: number
  reducedMotion: boolean
  onReady: () => void
}

/** Camera presets + orbit control wiring for 3D/2D, zoom, and reset. */
function CameraRig({
  viewMode,
  zoomCommand,
  resetNonce,
}: {
  viewMode: ViewMode
  zoomCommand: ZoomCommand | null
  resetNonce: number
}) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null

  useEffect(() => {
    if (!controls) return
    if (viewMode === '2d') {
      camera.position.set(0.02, 15.5, 0.02)
      controls.target.set(0, 0, 0)
    } else {
      camera.position.set(7.4, 5.6, 8.8)
      controls.target.set(0, 0.6, 0)
    }
    controls.update()
  }, [viewMode, resetNonce, camera, controls])

  useEffect(() => {
    if (!zoomCommand || !controls) return
    const offset = camera.position.clone().sub(controls.target)
    const length = Math.min(
      26,
      Math.max(3, offset.length() * (zoomCommand.direction > 0 ? 0.82 : 1.22))
    )
    camera.position.copy(controls.target).add(offset.setLength(length))
    controls.update()
  }, [zoomCommand, camera, controls])

  return null
}

/** Red sphere marking a low-stock rack; pulses unless reduced motion is on. */
function LowStockMarker({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<Mesh>(null)
  useFrame((state) => {
    if (reducedMotion || !ref.current) return
    const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.18
    ref.current.scale.setScalar(scale)
  })
  return (
    <mesh ref={ref} position={[0, SHELF_Y[2] + 0.62, RACK_DEPTH / 2 + 0.08]}>
      <sphereGeometry args={[0.055, 16, 16]} />
      <meshBasicMaterial color={OCCUPANCY_COLOR.LOW} />
    </mesh>
  )
}

interface ObjectBaseProps {
  location: StorageLocation
  quantity: number
  status: OccupancyStatus
  selected: boolean
  hovered: boolean
  /** True while another location is focused — the rack renders translucent. */
  dimmed: boolean
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

/** Single box displayed on a rack shelf */
function RackBox({
  size,
  color,
  position,
  reducedMotion,
}: {
  size: [number, number, number]
  color: string
  position: [number, number, number]
  reducedMotion: boolean
}) {
  const ref = useRef<Mesh>(null)
  const ringRef = useRef<Mesh>(null)
  const [hoverState, setHoverState] = useState(false)
  const [selectedState, setSelectedState] = useState(false)
  const [castShadowState, setCastShadowState] = useState(true)
  const camera = useThree((state) => state.camera)

  useFrame((state) => {
    if (!ref.current) return
    const elapsed = state.clock.elapsedTime

    // Use enhanced hover effect (reduced motion → no continuous float)
    const hoverEffect = enhancedBoxHover(
      elapsed,
      hoverState,
      selectedState,
      reducedMotion ? 0 : 1.0
    )

    ref.current.position.y = position[1] + hoverEffect.yOffset
    ref.current.scale.setScalar(hoverEffect.scale)

    // Emissive glow
    const material = ref.current.material as MeshStandardMaterial
    material.emissive = new Color('#f6c445')
    material.emissiveIntensity = hoverEffect.glow

    // Highlight ring for selected boxes
    if (ringRef.current && selectedState) {
      const ringBase = Math.max(size[0], size[2]) * 0.75
      const ring = reducedMotion
        ? { radius: ringBase, opacity: 0.5, thickness: 0.05 }
        : highlightRing(elapsed, true, ringBase)
      ringRef.current.scale.setScalar(1 + (ring.radius - ringBase) * 2)
      const ringMaterial = ringRef.current.material as MeshStandardMaterial
      ringMaterial.opacity = ring.opacity
      ringRef.current.visible = true
    } else if (ringRef.current) {
      ringRef.current.visible = false
    }

    // LOD: distant boxes stop casting shadows (cheap win) but stay visible so
    // the rack never looks empty when zooming out.
    const boxWorldPos = new Vector3(position[0], position[1], position[2])
    const lodLevel = getLODLevel(boxWorldPos, camera.position, [6, 14, 26])
    const shouldCastShadow = lodLevel === 'high' || lodLevel === 'medium'
    setCastShadowState((prev) => (prev === shouldCastShadow ? prev : shouldCastShadow))
  })

  return (
    <>
      <RoundedBox
        ref={ref}
        castShadow={castShadowState}
        args={size}
        radius={0.03}
        smoothness={castShadowState ? 2 : 1}
        position={position}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHoverState(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          setHoverState(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={() => {
          // Toggle the box highlight but let the click bubble so the parent
          // rack still selects the location (existing behaviour preserved).
          setSelectedState((prev) => !prev)
        }}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.9}
          metalness={0.1}
          transparent
          opacity={0.98}
        />
      </RoundedBox>

      {/* Highlight ring for selected boxes — hovers at the box's own shelf level */}
      <mesh
        ref={ringRef}
        rotation-x={-Math.PI / 2}
        position={[position[0], position[1] - size[1] / 2 + 0.01, position[2]]}
        visible={false}
      >
        <ringGeometry args={[0.5, 0.55, 32]} />
        <meshStandardMaterial
          color="#6546f5"
          transparent
          opacity={0.6}
          emissive="#6546f5"
          emissiveIntensity={0.5}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

interface PlacedBox {
  offsetIndex: number
  countOnLevel: number
  colorIndex: number
  size: [number, number, number]
}

/** Deterministic box layout for one rack from its balances + level filter.
 * Built immutably so memoized props are never mutated downstream. */
function rackBoxes(
  locationId: string,
  balances: Balance[],
  levelFilter: LevelFilter
): Map<1 | 2 | 3, PlacedBox[]> {
  const rows = balances.filter((balance) => balance.locationId === locationId)
  const specs: { level: 1 | 2 | 3; colorIndex: number; size: [number, number, number] }[] = []
  rows.forEach((row, rowIndex) => {
    const level = (row.level ?? 1) as 1 | 2 | 3
    if (levelFilter !== 'ALL' && level !== levelFilter) return
    const count = Math.min(3, row.quantity >= 200 ? 3 : row.quantity >= 40 ? 2 : 1)
    for (let i = 0; i < count; i++) {
      const wobble = ((rowIndex + i) % 3) * 0.02
      specs.push({
        level,
        colorIndex: (rowIndex + i) % KRAFT_COLORS.length,
        size: [0.54 + wobble, 0.4, 0.55],
      })
    }
  })

  const grouped = new Map<1 | 2 | 3, PlacedBox[]>()
  for (const spec of specs) {
    const existing = grouped.get(spec.level) ?? []
    grouped.set(spec.level, [
      ...existing,
      {
        offsetIndex: existing.length,
        countOnLevel: 0,
        colorIndex: spec.colorIndex,
        size: spec.size,
      },
    ])
  }

  const byLevel = new Map<1 | 2 | 3, PlacedBox[]>()
  for (const [level, boxes] of grouped) {
    byLevel.set(
      level,
      boxes.map((box) => ({ ...box, countOnLevel: boxes.length }))
    )
  }
  return byLevel
}

/** Floating label pill above a location — a real button, so it is reachable. */
function LocationLabel({
  location,
  quantity,
  status,
  onSelect,
}: Pick<ObjectBaseProps, 'location' | 'quantity' | 'status' | 'onSelect'>) {
  return (
    <Html position={[0, 3.1, 0]} center distanceFactor={11} zIndexRange={[15, 0]}>
      <button
        type="button"
        onClick={() => onSelect(location.id)}
        title={`${location.label} — ${OCCUPANCY_LABEL[status]} · ${formatNumber(quantity)} unit`}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white/95 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-ink shadow-sm transition-colors hover:border-primary/40"
      >
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: OCCUPANCY_COLOR[status] }}
        />
        {location.label}
      </button>
    </Html>
  )
}

interface RackObjectProps extends ObjectBaseProps {
  balances: Balance[]
  levelFilter: LevelFilter
  reducedMotion: boolean
}

function RackObject({
  location,
  balances,
  levelFilter,
  reducedMotion,
  quantity,
  status,
  selected,
  hovered,
  dimmed,
  onSelect,
  onHover,
}: RackObjectProps) {
  const boxes = useMemo(
    () => rackBoxes(location.id, balances, levelFilter),
    [location.id, balances, levelFilter]
  )
  const rackGroupRef = useRef<Group>(null)
  const uprightColor = selected ? '#6546f5' : hovered ? '#7f8cc4' : '#9aa6c8'

  // Focus mode: another location is selected — turn this rack translucent.
  useEffect(() => {
    applyGroupDim(rackGroupRef.current, dimmed)
  }, [dimmed])

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect(selected ? null : location.id)
  }
  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onHover(location.id)
  }
  const handleOut = () => onHover(null)

  return (
    <group
      ref={rackGroupRef}
      position={[location.x, 0, location.z]}
      rotation-y={location.rotation}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      {/* Uprights */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            castShadow
            position={[
              sx * (RACK_WIDTH / 2 - 0.045),
              UPRIGHT_HEIGHT / 2,
              sz * (RACK_DEPTH / 2 - 0.045),
            ]}
          >
            <boxGeometry args={[0.07, UPRIGHT_HEIGHT, 0.07]} />
            <meshStandardMaterial color={uprightColor} roughness={0.45} metalness={0.35} />
          </mesh>
        ))
      )}
      {/* Shelf boards */}
      {SHELF_Y.map((y) => (
        <mesh key={y} position={[0, y, 0]} receiveShadow>
          <boxGeometry args={[RACK_WIDTH - 0.06, 0.05, RACK_DEPTH]} />
          <meshStandardMaterial color="#d6dbeb" roughness={0.85} />
        </mesh>
      ))}
      {/* Cargo boxes */}
      {[...boxes.entries()].flatMap(([level, levelBoxes]) =>
        levelBoxes.map((box, index) => {
          const spread = (box.countOnLevel - 1) * 0.62
          return (
            <RackBox
              key={`${level}-${index}`}
              size={box.size}
              color={KRAFT_COLORS[box.colorIndex]}
              position={[
                -spread / 2 + box.offsetIndex * 0.62,
                SHELF_Y[level - 1] + box.size[1] / 2 + 0.03,
                0,
              ]}
              reducedMotion={reducedMotion}
            />
          )
        })
      )}
      {status === 'LOW' ? <LowStockMarker reducedMotion={reducedMotion} /> : null}
      {selected ? (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.32, 1.44, 48]} />
          <meshBasicMaterial color="#6546f5" transparent opacity={0.85} />
        </mesh>
      ) : null}
      <LocationLabel location={location} quantity={quantity} status={status} onSelect={onSelect} />
    </group>
  )
}

interface AreaObjectProps extends ObjectBaseProps {
  platform: 'staging' | 'packing'
}

function AreaObject({
  location,
  platform,
  quantity,
  status,
  selected,
  hovered,
  dimmed,
  onSelect,
  onHover,
}: AreaObjectProps) {
  const areaGroupRef = useRef<Group>(null)

  useEffect(() => {
    applyGroupDim(areaGroupRef.current, dimmed)
  }, [dimmed])
  const isStaging = platform === 'staging'
  const platformSize: [number, number, number] = isStaging ? STAGING_PLATFORM : PACKING_PLATFORM
  const platformY = platformSize[1] / 2
  const boxRows = isStaging ? 2 : 1
  const boxCountPerRow = isStaging ? 3 : 2
  const highlight = selected || hovered

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect(selected ? null : location.id)
  }
  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onHover(location.id)
  }
  const handleOut = () => onHover(null)

  return (
    <group
      ref={areaGroupRef}
      position={[location.x, 0, location.z]}
      rotation-y={location.rotation}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <mesh castShadow receiveShadow position={[0, platformY, 0]}>
        <boxGeometry args={platformSize} />
        <meshStandardMaterial
          color={selected ? '#6546f5' : highlight ? '#454f85' : isStaging ? '#333a5e' : '#454d78'}
          roughness={0.7}
        />
      </mesh>
      {status !== 'EMPTY'
        ? Array.from({ length: boxRows }).flatMap((_, row) =>
            Array.from({ length: boxCountPerRow }).map((__, column) => {
              const spread = (boxCountPerRow - 1) * 0.6
              return (
                <RoundedBox
                  key={`${row}-${column}`}
                  castShadow
                  args={[0.5, 0.4, 0.5]}
                  radius={0.03}
                  smoothness={2}
                  position={[
                    -spread / 2 + column * 0.6,
                    platformSize[1] + 0.2 + row * 0.42,
                    row === 0 ? 0.05 : -0.1,
                  ]}
                >
                  <meshStandardMaterial
                    color={KRAFT_COLORS[(row + column) % KRAFT_COLORS.length]}
                    roughness={0.9}
                    emissive={hovered ? '#6546f5' : '#000000'}
                    emissiveIntensity={hovered ? 0.16 : 0}
                  />
                </RoundedBox>
              )
            })
          )
        : null}
      {selected ? (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.55, 1.67, 48]} />
          <meshBasicMaterial color="#6546f5" transparent opacity={0.85} />
        </mesh>
      ) : null}
      <LocationLabel location={location} quantity={quantity} status={status} onSelect={onSelect} />
    </group>
  )
}

/** Forklift parking spot + aisle lane. The lane sits between the rack fronts
 * (z ≈ -1.575) and the staging/packing platforms (z ≈ 1.0). */
const FORKLIFT_PARK = new Vector3(5.7, 0, 1.5)
const FORKLIFT_PARK_ROTATION = -0.55
const BOX_LOCAL_Y = 0.3
const BOX_LOCAL_Z = 0.8
const BOX_SLIDE = 0.55
const LIFT_DURATION = 0.62
const PLACE_DURATION = 0.72
const WHEEL_RADIUS = 0.14
/** Deliberately relaxed so the forklift cruises instead of darting. */
const FORKLIFT_SPEED = 3.9
const ROTATION_SPEED = 3.8
const HOVER_FREQUENCY = 2.8

/** Hover offset for idle forklift body bobbing. */
const FORKLIFT_HOVER = 0.012

/** Delivery ring pulse frequency */
const DELIVERY_PULSE_FREQ = 3.2
const DELIVERY_PULSE_AMP = 0.12

/** Rack proximity alert thresholds (world units from a rack centre).
 *  The aisle lane sits ~1.6 units from rack centres, so the warning only fires
 *  on the final tight approach — not on every pass down the aisle. */
const PROXIMITY_WARNING_RADIUS = 1.5
const PROXIMITY_DANGER_RADIUS = 1.0

/** Hard floor limits (19 × 13 plane, with a little wall clearance). */
const WAREHOUSE_BOUNDS: RouteBounds = {
  minX: -8.9,
  maxX: 8.9,
  minZ: -5.9,
  maxZ: 5.9,
}

/** Forklift body clearance used by the route planner. The aisles are 2.5 units
 *  wide, so this still leaves a comfortable corridor while keeping the machine
 *  clear of rack uprights and platforms. */
const ROUTE_CLEARANCE = 0.62
const ROUTE_OPTIONS = {
  clearance: ROUTE_CLEARANCE,
  cellSize: 0.22,
  bounds: WAREHOUSE_BOUNDS,
  cornerRadius: 0.72,
  // Rounded corners may cut inside the A* path, so keep at least the half-width
  // of the forklift plus the loaded crate (≈0.49) between the centreline and a
  // real shelf/platform. The planner tightens the fillet radius until it fits.
  safetyClearance: 0.52,
} as const

/** Dock geometry. Racks are served from their front (+local Z); staging and
 *  packing are served from the central-aisle side (-local Z), which is the
 *  natural drive lane. */
const RACK_DOCK_GAP = 0.85
const AREA_DOCK_GAP = 0.7
const RACK_REVERSE_DISTANCE = 0.9
const AREA_REVERSE_DISTANCE = 0.7

const STAGING_PLATFORM: [number, number, number] = [2.4, 0.14, 1.8]
const PACKING_PLATFORM: [number, number, number] = [2.1, 0.72, 1.15]

interface Placement {
  location: StorageLocation
  level: number
}

interface DeliveryJob {
  id: number
  type: MovementEvent['type']
  pickup: Placement
  drop: Placement
}

interface DockGeometry {
  /** Standing spot in front of the location. */
  point: Vector3
  /** Unit vector from the dock into the location. */
  direction: Vector3
  /** Unit vector pointing away from the location (reverse-out direction). */
  away: Vector3
  /** Heading the forklift uses while parked at the dock. */
  yaw: number
  /** How far to reverse before turning away from the shelf. */
  reverseDistance: number
}

interface DeliveryRoutine {
  pickupCurve: CatmullRomCurve3
  carryCurve: CatmullRomCurve3
  returnCurve: CatmullRomCurve3
  pickupAt: Vector3
  pickupExit: Vector3
  dropAt: Vector3
  dropExit: Vector3
  pickupYaw: number
  dropYaw: number
  carryStartYaw: number
  returnStartYaw: number
  pickupLift: number
  dropLift: number
  startLift: number
  pickupReverse: number
  dropReverse: number
  pickupTurn: number
  dropTurn: number
  t1: number
  t2: number
  t3: number
  t4: number
  t5: number
  t6: number
  t7: number
  t8: number
  t9: number
}

/** Footprint of a location, used for both docking and obstacle avoidance. */
function locationHalfDepth(location: StorageLocation) {
  if (location.type === 'RACK') return RACK_DEPTH / 2
  return location.type === 'STAGING' ? STAGING_PLATFORM[2] / 2 : PACKING_PLATFORM[2] / 2
}

function routeObstaclesFromLocations(locations: StorageLocation[]): RouteObstacle[] {
  return locations.map((location) => ({
    x: location.x,
    z: location.z,
    halfWidth:
      location.type === 'RACK'
        ? RACK_WIDTH / 2
        : location.type === 'STAGING'
          ? STAGING_PLATFORM[0] / 2
          : PACKING_PLATFORM[0] / 2,
    halfDepth: locationHalfDepth(location),
    rotation: location.rotation ?? 0,
  }))
}

/** Standing spot + facing direction for a location. */
function dockGeometry(location: StorageLocation): DockGeometry {
  const side = location.type === 'RACK' ? 1 : -1
  const gap = location.type === 'RACK' ? RACK_DOCK_GAP : AREA_DOCK_GAP
  const distance = locationHalfDepth(location) + gap
  const rotation = location.rotation ?? 0
  const point = new Vector3(
    location.x + Math.sin(rotation) * distance * side,
    0,
    location.z + Math.cos(rotation) * distance * side
  )
  // Direction from the standing spot into the rack/platform.
  const direction = new Vector3(-Math.sin(rotation) * side, 0, -Math.cos(rotation) * side)
  return {
    point,
    direction,
    away: direction.clone().multiplyScalar(-1),
    yaw: Math.atan2(direction.x, direction.z),
    reverseDistance: location.type === 'RACK' ? RACK_REVERSE_DISTANCE : AREA_REVERSE_DISTANCE,
  }
}

function surfaceHeight({ location, level }: Placement) {
  if (location.type === 'RACK') {
    const shelf = Math.min(3, Math.max(1, Math.round(level)))
    return SHELF_Y[shelf - 1]
  }
  return location.type === 'STAGING' ? 0.14 : 0.72
}

/** Carriage offset that puts the box bottom just above the target surface. */
function carriageLift(placement: Placement) {
  return Math.max(0, surfaceHeight(placement) + 0.03 - (BOX_LOCAL_Y - 0.18))
}

function headingOf(curve: CatmullRomCurve3, t: number) {
  const tangent = curve.getTangentAt(MathUtils.clamp(t, 0, 1))
  return Math.atan2(tangent.x, tangent.z)
}

function shortestAngleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

/** Travel time scales with path length and stays calm on long hauls. */
function driveDuration(curve: CatmullRomCurve3) {
  const cruise = FORKLIFT_SPEED * 0.76
  return MathUtils.clamp(0.9 + curve.getLength() / cruise, 1.3, 6.5)
}

function reverseDuration(distance: number) {
  return MathUtils.clamp(0.35 + distance / 1.8, 0.45, 1.2)
}

function turnDuration(from: number, to: number) {
  return MathUtils.clamp(Math.abs(shortestAngleDelta(from, to)) / 3.4, 0.18, 0.95)
}

/** A sideways step along a location's local X axis (same-rack level moves). */
function lateralOffset(location: StorageLocation, distance: number) {
  const rotation = location.rotation ?? 0
  return new Vector3(Math.cos(rotation) * distance, 0, -Math.sin(rotation) * distance)
}

function buildRoutine(
  job: DeliveryJob,
  start: Vector3,
  startLift: number,
  obstacles: RouteObstacle[]
): DeliveryRoutine {
  const pickupDock = dockGeometry(job.pickup.location)
  const dropDock = dockGeometry(job.drop.location)
  const sameSpot = job.pickup.location.id === job.drop.location.id
  const dropAt = sameSpot
    ? pickupDock.point
        .clone()
        .add(lateralOffset(job.drop.location, job.drop.level >= job.pickup.level ? 0.55 : -0.55))
    : dropDock.point.clone()

  // The forklift reverses straight out of a dock before turning, so its forks
  // (and the carried box) never sweep through the rack uprights.
  const pickupExit = pickupDock.point
    .clone()
    .addScaledVector(pickupDock.away, pickupDock.reverseDistance)
  const dropPre = dropAt.clone().addScaledVector(dropDock.away, dropDock.reverseDistance)
  const dropExit = dropAt.clone().addScaledVector(dropDock.away, dropDock.reverseDistance)

  // Route to the pre-dock point, then add the short straight lead-in. The final
  // segment is aligned with the dock heading, so the forklift arrives square.
  const pickupRoute = planForkliftRoute(start, pickupExit, obstacles, ROUTE_OPTIONS)
  const pickupCurve = new CatmullRomCurve3(
    [...pickupRoute.points, pickupDock.point.clone()],
    false,
    'centripetal'
  )

  // Carry: leave the pickup dock backwards, then take the planned route to the
  // destination pre-dock point.
  const carryRoute = planForkliftRoute(pickupExit, dropPre, obstacles, ROUTE_OPTIONS)
  const carryCurve = new CatmullRomCurve3(
    [...carryRoute.points, dropAt.clone()],
    false,
    'centripetal'
  )

  // Return: back out of the destination, then drive home.
  const returnRoute = planForkliftRoute(dropExit, FORKLIFT_PARK, obstacles, ROUTE_OPTIONS)
  const returnCurve = new CatmullRomCurve3(returnRoute.points, false, 'centripetal')

  const pickupYaw = pickupDock.yaw
  const dropYaw = sameSpot ? pickupDock.yaw : dropDock.yaw
  const carryStartYaw = headingOf(carryCurve, 0)
  const returnStartYaw = headingOf(returnCurve, 0)

  const t1 = driveDuration(pickupCurve)
  const pickupReverse = reverseDuration(pickupDock.reverseDistance)
  const pickupTurn = turnDuration(pickupYaw, carryStartYaw)
  const t2 = t1 + LIFT_DURATION
  const t3 = t2 + pickupReverse
  const t4 = t3 + pickupTurn
  const t5 = t4 + driveDuration(carryCurve)
  const t6 = t5 + PLACE_DURATION
  const dropReverse = reverseDuration(dropDock.reverseDistance)
  const dropTurn = turnDuration(dropYaw, returnStartYaw)
  const t7 = t6 + dropReverse
  const t8 = t7 + dropTurn
  const t9 = t8 + driveDuration(returnCurve)

  return {
    pickupCurve,
    carryCurve,
    returnCurve,
    pickupAt: pickupDock.point.clone(),
    pickupExit,
    dropAt,
    dropExit,
    pickupYaw,
    dropYaw,
    carryStartYaw,
    returnStartYaw,
    pickupLift: carriageLift(job.pickup),
    dropLift: carriageLift(job.drop),
    startLift,
    pickupReverse,
    dropReverse,
    pickupTurn,
    dropTurn,
    t1,
    t2,
    t3,
    t4,
    t5,
    t6,
    t7,
    t8,
    t9,
  }
}

/**
 * Event-driven forklift choreography: drive to the source, raise the forks to
 * the shelf level, pick the box up, carry it to the destination, slide it onto
 * the shelf/platform, then return to the parking spot. `onDone` clears the job.
 * Mounted with `job = null` under reduced motion, so it simply stays parked.
 */
function Forklift({
  job,
  reducedMotion,
  locations,
  onDone,
}: {
  job: DeliveryJob | null
  reducedMotion: boolean
  /** Rack footprints used for operator proximity alerts. */
  locations: StorageLocation[]
  onDone: () => void
}) {
  const { t } = useI18n()

  const group = useRef<Group>(null)
  const body = useRef<Group>(null)
  const carriage = useRef<Group>(null)
  const box = useRef<Mesh>(null)
  const pulse = useRef<Mesh>(null)
  const wheels = useRef<Array<Mesh | null>>([])
  const routine = useRef<{ jobId: number; startedAt: number; plan: DeliveryRoutine } | null>(null)

  const [completed, setCompleted] = useState(false)
  const yaw = useRef(FORKLIFT_PARK_ROTATION)
  const [renderYaw, setRenderYaw] = useState(FORKLIFT_PARK_ROTATION)
  const lift = useRef(0)
  const [chassisEmissive, setChassisEmissive] = useState(0)
  const [pickupIndicatorEmissive, setPickupIndicatorEmissive] = useState(0)
  const [dropIndicatorEmissive, setDropIndicatorEmissive] = useState(0)
  const [boxHover, setBoxHover] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Store delivery progress for use in render section
  const [deliveryInfo, setDeliveryInfo] = useState<{
    elapsed: number
    plan: DeliveryRoutine
  } | null>(null)

  // Pulse animation state for delivery rings
  const [pulseOffset, setPulseOffset] = useState(0)

  // Enhanced visual effects state
  const [trailParticles, setTrailParticles] = useState<Vector3[]>([])
  const [activeParticles, setActiveParticles] = useState<
    Array<{ position: Vector3; life: number; maxLife: number }>
  >([])
  const [forkliftPosition, setForkliftPosition] = useState(new Vector3())
  const [directionArrow, setDirectionArrow] = useState<{
    length: number
    opacity: number
    visible: boolean
  }>({
    length: 0,
    opacity: 0,
    visible: false,
  })
  // Operator proximity alert (rack too close while driving)
  const [hazard, setHazard] = useState<{
    intensity: number
    color: [number, number, number]
    pulseSpeed: number
  } | null>(null)
  const particlePool = useRef<ParticlePool>(new ParticlePool(20))
  const previousPosition = useRef(new Vector3(FORKLIFT_PARK.x, 0, FORKLIFT_PARK.z))
  const currentVelocity = useRef(new Vector3())
  // Carriage suspension offsets (applied once per frame, after the routine runs)
  const carriageBob = useRef({ x: 0, y: 0, roll: 0 })

  const obstacles = useMemo(() => routeObstaclesFromLocations(locations), [locations])
  const pulsePoint = useMemo(() => (job ? dockGeometry(job.drop.location).point : null), [job])

  // A waiting crate on the receiving platform makes the inbound trip legible:
  // the box is already there before the forklift arrives, then it is picked up.
  const waitingCrate = useMemo(() => {
    if (!job || job.pickup.location.type !== 'STAGING') return null
    const dock = dockGeometry(job.pickup.location)
    const position = dock.point.clone().addScaledVector(dock.direction, BOX_LOCAL_Z)
    position.y = surfaceHeight(job.pickup) + 0.21
    return { position, yaw: dock.yaw }
  }, [job])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const model = group.current
    if (!model) return
    const clock = state.clock.elapsedTime
    const previousX = model.position.x
    const previousZ = model.position.z

    // Update pulse animation for the delivery rings. Only a running job shows
    // them, so idle frames cost no React work (the dashboard also mounts this
    // scene — a 60 fps state update there would keep re-rendering for nothing).
    if (job) setPulseOffset(clock * DELIVERY_PULSE_FREQ)
    let targetLift = 0
    let boxVisible = false
    let boxOpacity = 1
    let boxSlide = 0
    let pulseProgress = -1
    // Drop-impact overrides (only active during the place phase)
    let boxImpactGlow = -1
    let boxSquash = 0
    let boxScale = 1

    // Reset per-frame suspension offsets; only the carry phase writes them.
    carriageBob.current.x = 0
    carriageBob.current.y = 0
    carriageBob.current.roll = 0

    if (!job) {
      // Idle: smoothly drift back to the parking spot and face the usual direction.
      const { position, rotation, done } = smoothTransform(
        model.position,
        FORKLIFT_PARK,
        yaw.current,
        FORKLIFT_PARK_ROTATION,
        dt * FORKLIFT_SPEED,
        dt * ROTATION_SPEED
      )
      model.position.copy(position)
      yaw.current = rotation
      if (done) {
        model.position.set(FORKLIFT_PARK.x, 0, FORKLIFT_PARK.z)
        yaw.current = FORKLIFT_PARK_ROTATION
      }
    } else {
      if (!routine.current || routine.current.jobId !== job.id) {
        routine.current = {
          jobId: job.id,
          startedAt: clock,
          plan: buildRoutine(
            job,
            new Vector3(model.position.x, 0, model.position.z),
            lift.current,
            obstacles
          ),
        }
        setCompleted(false)
      }
      const { plan, startedAt } = routine.current
      const elapsed = clock - startedAt
      setDeliveryInfo({ elapsed, plan })

      if (elapsed < plan.t1) {
        // Drive to the pickup dock with a calm, single cubic-bezier ease.
        const driveT = MathUtils.clamp(elapsed / plan.t1, 0, 1)
        const easedProgress = easeInOutCubic(driveT)
        const point = plan.pickupCurve.getPointAt(easedProgress)
        model.position.set(point.x, 0, point.z)
        const targetYaw = headingOf(plan.pickupCurve, easedProgress)
        yaw.current = smoothRotateToward(
          yaw.current,
          targetYaw,
          dt * ROTATION_SPEED * 1.35
        ).rotation
        const liftDown = easeInOutCubic(MathUtils.clamp(elapsed / Math.min(0.3, plan.t1), 0, 1))
        targetLift = MathUtils.lerp(plan.startLift, 0, liftDown)
      } else if (elapsed < plan.t2) {
        // Raise the forks to the source level; the box fades in on the tines.
        const liftT = MathUtils.clamp((elapsed - plan.t1) / LIFT_DURATION, 0, 1)
        // Cubic-bezier fork lift: gentle start, firm settle (custom control points).
        const liftEase = cubicBezier(liftT, 0, 0.32, 0.68, 1)
        model.position.set(plan.pickupAt.x, 0, plan.pickupAt.z)
        yaw.current = smoothRotateToward(
          yaw.current,
          plan.pickupYaw,
          dt * ROTATION_SPEED * 1.6
        ).rotation
        targetLift = MathUtils.lerp(0, plan.pickupLift, liftEase)
        boxVisible = liftEase > 0.2
        boxOpacity = MathUtils.clamp((liftEase - 0.2) / 0.8, 0, 1)
        // Four-stage pickup micro-animation: approach → align → grip → lift.
        boxScale = multiPhasePickup(liftT, 0).scale
      } else if (elapsed < plan.t3) {
        // Reverse straight out of the rack while still facing it. This is the
        // move that keeps the loaded forks from sweeping through the uprights.
        const reverseT = MathUtils.clamp((elapsed - plan.t2) / plan.pickupReverse, 0, 1)
        const easedProgress = easeInOutCubic(reverseT)
        model.position.lerpVectors(plan.pickupAt, plan.pickupExit, easedProgress)
        yaw.current = smoothRotateToward(
          yaw.current,
          plan.pickupYaw,
          dt * ROTATION_SPEED * 1.35
        ).rotation
        targetLift = plan.pickupLift
        boxVisible = true
      } else if (elapsed < plan.t4) {
        // Pivot in the open aisle, clear of the rack, then line up with the
        // carry route.
        model.position.copy(plan.pickupExit)
        yaw.current = smoothRotateToward(
          yaw.current,
          plan.carryStartYaw,
          dt * ROTATION_SPEED * 2.4
        ).rotation
        targetLift = plan.pickupLift
        boxVisible = true
      } else if (elapsed < plan.t5) {
        // Carry: follow the planned, obstacle-free curve to the destination.
        const carryT = MathUtils.clamp((elapsed - plan.t4) / (plan.t5 - plan.t4), 0, 1)

        // Velocity-based easing: eases out of the pickup, cruises, then brakes.
        const velocityEase = velocityBasedEasing(carryT)
        const easedProgress = velocityEase.position
        const carrySpeed = velocityEase.velocity

        const point = plan.carryCurve.getPointAt(easedProgress)
        model.position.set(point.x, 0, point.z)
        const targetYaw = headingOf(plan.carryCurve, easedProgress)
        yaw.current = smoothRotateToward(yaw.current, targetYaw, dt * ROTATION_SPEED * 1.6).rotation

        targetLift = MathUtils.lerp(plan.pickupLift, plan.dropLift, easedProgress)
        boxVisible = true

        // Passive suspension bobbing while carrying — stronger with speed.
        if (!reducedMotion) {
          const bobbing = carryBobbing(clock, carrySpeed * 1.6, 1)
          carriageBob.current.x = bobbing.xOffset
          carriageBob.current.y = bobbing.yOffset
          carriageBob.current.roll = bobbing.rotation
        }
      } else if (elapsed < plan.t6) {
        // Place: slide the box off the tines into the rack/platform with impact effect
        const placeT = MathUtils.clamp((elapsed - plan.t5) / PLACE_DURATION, 0, 1)
        const easedProgress = easeOutCubic(placeT)
        model.position.set(plan.dropAt.x, 0, plan.dropAt.z)
        // Ease the final turn instead of snapping the heading.
        yaw.current = smoothRotateToward(yaw.current, plan.dropYaw, dt * ROTATION_SPEED).rotation
        targetLift = plan.dropLift
        boxVisible = true

        // Gravity-driven drop with landing squash + flash. Guard against a
        // level-1 destination where dropLift can be (near) zero.
        if (plan.dropLift > 0.001) {
          const dropEffect = dropWithImpact(easedProgress, plan.dropLift)
          boxSlide = BOX_SLIDE * (1 - MathUtils.clamp(dropEffect.yOffset / plan.dropLift, 0, 1))
          boxSquash = dropEffect.squash
          boxImpactGlow = dropEffect.glow
        } else {
          boxSlide = BOX_SLIDE * easedProgress
        }
        boxOpacity = easedProgress < 0.55 ? 1 : 1 - easeOutCubic((easedProgress - 0.55) / 0.45)
      } else if (elapsed < plan.t7) {
        // Back away from the destination with an empty, lowering carriage.
        const reverseT = MathUtils.clamp((elapsed - plan.t6) / plan.dropReverse, 0, 1)
        const easedProgress = easeInOutCubic(reverseT)
        model.position.lerpVectors(plan.dropAt, plan.dropExit, easedProgress)
        yaw.current = smoothRotateToward(
          yaw.current,
          plan.dropYaw,
          dt * ROTATION_SPEED * 1.35
        ).rotation
        targetLift = MathUtils.lerp(plan.dropLift, 0, easedProgress)
      } else if (elapsed < plan.t8) {
        // Pivot at the exit, clear of the shelf, before the homeward run.
        model.position.copy(plan.dropExit)
        yaw.current = smoothRotateToward(
          yaw.current,
          plan.returnStartYaw,
          dt * ROTATION_SPEED * 2.4
        ).rotation
        targetLift = 0
      } else if (elapsed < plan.t9) {
        // Drive back to the parking spot with an empty carriage.
        const returnT = MathUtils.clamp((elapsed - plan.t8) / (plan.t9 - plan.t8), 0, 1)
        // Same calm S-curve as the outbound leg — no mid-path speed spike.
        const easedProgress = easeInOutCubic(returnT)
        const point = plan.returnCurve.getPointAt(easedProgress)
        model.position.set(point.x, 0, point.z)
        const targetYaw = headingOf(plan.returnCurve, easedProgress)
        yaw.current = smoothRotateToward(
          yaw.current,
          targetYaw,
          dt * ROTATION_SPEED * 1.35
        ).rotation
        targetLift = 0
      } else {
        // Finish at the parking spot and hand control back to the parent. The
        // heading is left alone here so the idle drift rotates it smoothly.
        model.position.set(FORKLIFT_PARK.x, 0, FORKLIFT_PARK.z)
        targetLift = 0
        if (!completed) {
          setCompleted(true)
          onDone()
        }
      }

      if (elapsed >= plan.t5) {
        pulseProgress = MathUtils.clamp((elapsed - plan.t5) / 0.7, 0, 1)
      }

      // Compute glow values in useFrame (not during render)
      // Forklift chassis glow
      if (job && elapsed > plan.t4 && elapsed < plan.t6) {
        // Pick up & carry: bright yellow glow
        setChassisEmissive((prev) => MathUtils.lerp(prev, 0.35, dt * 4))
      } else if (job && elapsed >= plan.t6) {
        // Returning: softer glow
        setChassisEmissive((prev) => MathUtils.lerp(prev, 0.2, dt * 4))
      } else if (job && elapsed <= plan.t4) {
        // Approaching pickup: rising glow
        setChassisEmissive((prev) =>
          MathUtils.lerp(prev, Math.min(0.35, (elapsed / plan.t1) * 0.35), dt * 4)
        )
      } else {
        setChassisEmissive((prev) => MathUtils.lerp(prev, hovered ? 0.25 : 0, dt * 4))
      }

      // Pickup/drop location glow indicators
      setPickupIndicatorEmissive((prev) =>
        MathUtils.lerp(prev, job && elapsed < plan.t4 ? (hovered ? 0.4 : 0.25) : 0, dt * 4)
      )
      setDropIndicatorEmissive((prev) =>
        MathUtils.lerp(
          prev,
          job && elapsed >= plan.t5 && elapsed < plan.t9 ? (hovered ? 0.45 : 0.3) : 0,
          dt * 4
        )
      )
    }

    model.rotation.y = yaw.current

    // Calculate velocity for trail particles and direction indicator
    currentVelocity.current.subVectors(model.position, previousPosition.current).divideScalar(dt)
    previousPosition.current.copy(model.position)
    const speed = currentVelocity.current.length()

    // Update trail particles when moving (not in reduced motion)
    if (!reducedMotion) {
      if (speed > 0.1) {
        setTrailParticles(
          generateTrailParticles(
            model.position.clone().add(new Vector3(0, 0.2, 0)),
            currentVelocity.current,
            6,
            0.16
          )
        )
        if (Math.random() < 0.3) {
          particlePool.current.spawn(
            model.position.clone().add(new Vector3(0, 0.15, -0.4)),
            new Vector3(Math.random() * 0.1 - 0.05, 0.05, Math.random() * 0.1 - 0.05),
            0.8
          )
        }
      } else {
        setTrailParticles((prev) => (prev.length === 0 ? prev : []))
      }
      // Always advance the pool so particles keep fading after the forklift stops.
      particlePool.current.update(dt)
    }

    // Update direction indicator
    if (!reducedMotion && job && speed > 0.1) {
      const indicator = directionIndicator(yaw.current, speed, 1.5)
      setDirectionArrow((prev) =>
        prev.visible &&
        Math.abs(prev.length - indicator.length) < 0.01 &&
        Math.abs(prev.opacity - indicator.opacity) < 0.01
          ? prev
          : { length: indicator.length, opacity: indicator.opacity, visible: true }
      )
    } else {
      setDirectionArrow((prev) => (prev.visible ? { ...prev, visible: false } : prev))
    }

    // Operator proximity alert: fire only while genuinely moving fast near a rack,
    // so it does not blink every time the forklift stops at a shelf.
    if (!reducedMotion && speed > 0.8 && locations.length > 0) {
      let closest = Infinity
      for (const location of locations) {
        const probe = proximityAlert(
          new Vector3(location.x, 0, location.z),
          model.position,
          PROXIMITY_WARNING_RADIUS
        )
        if (probe.distance < closest) closest = probe.distance
      }
      if (closest < PROXIMITY_WARNING_RADIUS) {
        const warning = collisionWarning(closest, PROXIMITY_WARNING_RADIUS, PROXIMITY_DANGER_RADIUS)
        setHazard((prev) =>
          prev && Math.abs(prev.intensity - warning.intensity) < 0.02 ? prev : warning
        )
      } else {
        setHazard((prev) => (prev ? null : prev))
      }
    } else {
      setHazard((prev) => (prev ? null : prev))
    }

    // Delivery overlays (heading arrow, hazard ring, particles) only render
    // during a job — skip their per-frame state churn when the forklift idles.
    if (job) {
      setForkliftPosition(model.position.clone())
      setRenderYaw(yaw.current)
      setActiveParticles(particlePool.current.getActive())
    }

    lift.current = targetLift
    if (carriage.current) {
      // Base lift + suspension bob, applied in one place so nothing overwrites it.
      carriage.current.position.set(
        carriageBob.current.x,
        targetLift + carriageBob.current.y,
        carriage.current.position.z
      )
      carriage.current.rotation.z = carriageBob.current.roll
    }
    if (box.current) {
      box.current.visible = boxVisible
      box.current.position.z = BOX_LOCAL_Z + boxSlide
      // Reset any leftover landing squash once the place phase is over.
      if (boxSquash !== 0) {
        // Squash & stretch: widen slightly while the box compresses vertically.
        box.current.scale.set(
          boxScale * (1 + boxSquash * 0.5),
          boxScale * (1 - boxSquash),
          boxScale * (1 + boxSquash * 0.5)
        )
      } else {
        box.current.scale.setScalar(boxScale)
      }
      const material = box.current.material as MeshStandardMaterial
      material.opacity = boxOpacity
      if (job && boxVisible && boxOpacity > 0.5) {
        material.emissive.setHex(0xf6c445)
        // Drop impact flash takes priority, then hover, then the carry glow.
        const baseGlow = boxHover ? 0.45 : 0.25
        material.emissiveIntensity =
          boxImpactGlow >= 0 ? Math.max(baseGlow, boxImpactGlow) : baseGlow
      } else {
        material.emissive.setHex(0x000000)
        material.emissiveIntensity = 0
      }
    }
    if (pulse.current) {
      if (pulseProgress < 0) {
        pulse.current.visible = false
      } else {
        pulse.current.visible = true
        pulse.current.scale.setScalar(1 + pulseProgress * 0.9)
        const material = pulse.current.material as MeshBasicMaterial
        material.opacity = 0.85 * (1 - pulseProgress)
      }
    }
    if (body.current) {
      // Idle body bobbing with smooth sine wave, only visible when not delivering
      const bobAmplitude = job ? 0 : reducedMotion ? 0 : FORKLIFT_HOVER
      body.current.position.y = reducedMotion ? 0 : Math.sin(clock * HOVER_FREQUENCY) * bobAmplitude
    }

    // Smooth wheel spin based on movement
    const moved = Math.hypot(model.position.x - previousX, model.position.z - previousZ)
    if (moved > 0) {
      const spin = moved / WHEEL_RADIUS
      wheels.current.forEach((wheel) => {
        if (wheel) wheel.rotation.y += spin
      })
    }
  })

  return (
    <>
      <group
        ref={group}
        position={[FORKLIFT_PARK.x, 0, FORKLIFT_PARK.z]}
        rotation-y={FORKLIFT_PARK_ROTATION}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <BlobShadow radius={1.15} opacity={0.2} />
        <group ref={body}>
          {/* Chassis + operator cage */}
          <mesh castShadow position={[0, 0.46, 0]}>
            <boxGeometry args={[0.56, 0.5, 0.95]} />
            <meshStandardMaterial
              color="#f6c445"
              roughness={0.6}
              emissive={hovered || (job && !completed) ? '#f6c445' : '#000000'}
              emissiveIntensity={chassisEmissive}
            />
          </mesh>
          <mesh position={[0, 0.72, -0.1]}>
            <boxGeometry args={[0.44, 0.04, 0.44]} />
            <meshStandardMaterial color="#2b3050" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.08, -0.1]}>
            <boxGeometry args={[0.44, 0.04, 0.44]} />
            <meshStandardMaterial color="#2b3050" roughness={0.6} />
          </mesh>
          {[-0.18, 0.18].map((x) => (
            <mesh key={`post-${x}`} position={[x, 0.9, -0.1]}>
              <boxGeometry args={[0.04, 0.72, 0.04]} />
              <meshStandardMaterial color="#2b3050" roughness={0.6} />
            </mesh>
          ))}
          {/* Mast (tall enough for rack level 3) */}
          {[-0.2, 0.2].map((x) => (
            <mesh key={`mast-${x}`} position={[x, 1.3, 0.52]}>
              <boxGeometry args={[0.06, 2.6, 0.06]} />
              <meshStandardMaterial color="#8b93b5" roughness={0.5} metalness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 2.56, 0.52]}>
            <boxGeometry args={[0.44, 0.05, 0.05]} />
            <meshStandardMaterial color="#8b93b5" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* Carriage: back plate + forks + the box currently being carried */}
          <group ref={carriage}>
            <mesh position={[0, 0.25, 0.54]}>
              <boxGeometry args={[0.44, 0.5, 0.05]} />
              <meshStandardMaterial color="#3a4266" roughness={0.5} metalness={0.4} />
            </mesh>
            {[-0.16, 0.16].map((x) => (
              <mesh key={`fork-${x}`} position={[x, 0.1, 0.78]}>
                <boxGeometry args={[0.09, 0.04, 0.5]} />
                <meshStandardMaterial color="#3a4266" roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
            <RoundedBox
              ref={box}
              castShadow
              args={[0.42, 0.36, 0.42]}
              radius={0.03}
              smoothness={2}
              position={[0, BOX_LOCAL_Y, BOX_LOCAL_Z]}
              onPointerOver={(event) => {
                event.stopPropagation()
                if (job && !completed) {
                  setBoxHover(true)
                }
              }}
              onPointerOut={(event) => {
                event.stopPropagation()
                if (job && !completed) {
                  setBoxHover(false)
                }
              }}
            >
              <meshStandardMaterial
                color="#d9b98e"
                roughness={0.9}
                emissive={boxHover ? '#f6c445' : '#000000'}
                emissiveIntensity={job && !completed ? (boxHover ? 0.4 : 0.25) : 0}
              />
            </RoundedBox>
          </group>
        </group>

        {/* Wheels sit outside the bobbing body group so they stay on the floor */}
        {[-0.32, 0.32].map((x, xIndex) =>
          [-0.33, 0.33].map((z, zIndex) => (
            <group key={`wheel-${x}-${z}`} position={[x, 0.14, z]} rotation-z={Math.PI / 2}>
              <mesh
                ref={(node) => {
                  wheels.current[xIndex * 2 + zIndex] = node
                }}
                castShadow
              >
                <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.1, 16]} />
                <meshStandardMaterial color="#22263d" roughness={0.9} />
              </mesh>
            </group>
          ))
        )}

        {hovered || job ? (
          <Html position={[0, 2.95, 0]} center distanceFactor={12} zIndexRange={[14, 0]}>
            <span className="pointer-events-none flex items-center gap-1.5 rounded-full border border-line bg-white/95 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-ink shadow-sm">
              <span
                aria-hidden
                className={`h-2 w-2 rounded-full ${job ? 'bg-primary' : 'bg-success'}`}
              />
              {job ? t('Mengantar barang') : t('Forklift siap')}
            </span>
          </Html>
        ) : null}
      </group>

      {/* Inbound crate waiting on the receiving platform. It is the box the
          forklift drives over to collect; it disappears as the forks take it. */}
      {waitingCrate && job && deliveryInfo && deliveryInfo.elapsed < deliveryInfo.plan.t1 + 0.12 ? (
        <>
          <group position={waitingCrate.position} rotation-y={waitingCrate.yaw}>
            <RoundedBox castShadow args={[0.42, 0.36, 0.42]} radius={0.03} smoothness={2}>
              <meshStandardMaterial
                color="#d9b98e"
                roughness={0.9}
                emissive="#f6c445"
                emissiveIntensity={0.18 + Math.abs(Math.sin(pulseOffset * 0.5)) * 0.12}
              />
            </RoundedBox>
          </group>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[waitingCrate.position.x, 0.155, waitingCrate.position.z]}
          >
            <ringGeometry args={[0.42, 0.5, 40]} />
            <meshBasicMaterial
              color="#f6c445"
              transparent
              opacity={0.32 + Math.abs(Math.sin(pulseOffset * 0.5)) * 0.2}
              depthWrite={false}
            />
          </mesh>
        </>
      ) : null}

      {/* Pickup location indicator - glow ring around source location */}
      {job && !completed && deliveryInfo ? (
        <>
          {deliveryInfo.elapsed < deliveryInfo.plan.t4 && deliveryInfo.plan.pickupAt ? (
            <mesh
              rotation-x={-Math.PI / 2}
              position={[deliveryInfo.plan.pickupAt.x, 0.03, deliveryInfo.plan.pickupAt.z]}
            >
              <ringGeometry args={[1.25, 1.37, 48]} />
              <meshBasicMaterial
                color="#f6c445"
                transparent
                opacity={pickupIndicatorEmissive * 0.6}
                depthWrite={false}
              />
              {/* Pulsing outer ring */}
              <ringGeometry args={[1.25 + Math.sin(pulseOffset) * DELIVERY_PULSE_AMP, 1.37, 48]} />
              <meshBasicMaterial
                color="#f6c445"
                transparent
                opacity={Math.max(0, (1 - Math.abs(Math.sin(pulseOffset))) * 0.3)}
                depthWrite={false}
              />
            </mesh>
          ) : null}

          {/* Drop location indicator - glow ring around destination location */}
          {deliveryInfo.elapsed >= deliveryInfo.plan.t5 &&
          deliveryInfo.elapsed < deliveryInfo.plan.t9 &&
          deliveryInfo.plan.dropAt ? (
            <mesh
              rotation-x={-Math.PI / 2}
              position={[deliveryInfo.plan.dropAt.x, 0.03, deliveryInfo.plan.dropAt.z]}
            >
              <ringGeometry args={[1.25, 1.37, 48]} />
              <meshBasicMaterial
                color="#10b981"
                transparent
                opacity={dropIndicatorEmissive * 0.7}
                depthWrite={false}
              />
              {/* Pulsing outer ring */}
              <ringGeometry args={[1.25 + Math.sin(pulseOffset) * DELIVERY_PULSE_AMP, 1.37, 48]} />
              <meshBasicMaterial
                color="#10b981"
                transparent
                opacity={Math.max(0, (1 - Math.abs(Math.sin(pulseOffset))) * 0.35)}
                depthWrite={false}
              />
            </mesh>
          ) : null}
        </>
      ) : null}

      {pulsePoint ? (
        <mesh ref={pulse} rotation-x={-Math.PI / 2} position={[pulsePoint.x, 0.03, pulsePoint.z]}>
          <ringGeometry args={[0.82, 0.94, 48]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}

      {/* Trail particles - visual feedback when forklift is moving */}
      {!reducedMotion && trailParticles.length > 0 && (
        <>
          {trailParticles.map((particle, i) => (
            <mesh key={`trail-${i}`} position={particle}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial
                color="#f6c445"
                transparent
                opacity={0.4 * (1 - i / trailParticles.length)}
                depthWrite={false}
              />
            </mesh>
          ))}
        </>
      )}

      {/* Active particle pool particles */}
      {!reducedMotion &&
        activeParticles.map((particle, i) => {
          const lifeProgress = particle.life / particle.maxLife
          return (
            <mesh key={`particle-${i}`} position={particle.position}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshBasicMaterial
                color="#8b93b5"
                transparent
                opacity={0.5 * lifeProgress}
                depthWrite={false}
              />
            </mesh>
          )
        })}

      {/* Direction indicator - shows where forklift is heading */}
      {directionArrow.visible && job && (
        <group
          position={[forkliftPosition.x, forkliftPosition.y, forkliftPosition.z]}
          rotation-y={renderYaw}
        >
          <mesh position={[0, 0.05, directionArrow.length / 2 + 0.6]}>
            <coneGeometry args={[0.15, directionArrow.length, 8]} />
            <meshBasicMaterial
              color="#6546f5"
              transparent
              opacity={directionArrow.opacity}
              depthWrite={false}
            />
          </mesh>
          {/* Pulsing ring at arrow tip */}
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, directionArrow.length + 0.6]}>
            <ringGeometry args={[0.2, 0.25, 16]} />
            <meshBasicMaterial
              color="#6546f5"
              transparent
              opacity={directionArrow.opacity * 0.6}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* Operator proximity alert — amber→red hazard ring under the forklift */}
      {hazard ? (
        <mesh rotation-x={-Math.PI / 2} position={[forkliftPosition.x, 0.04, forkliftPosition.z]}>
          <ringGeometry args={[0.95, 1.08, 44]} />
          <meshBasicMaterial
            color={`rgb(${Math.round(hazard.color[0] * 255)}, ${Math.round(
              hazard.color[1] * 255
            )}, ${Math.round(hazard.color[2] * 255)})`}
            transparent
            opacity={0.25 + 0.4 * Math.abs(Math.sin(pulseOffset * hazard.pulseSpeed))}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </>
  )
}

/**
 * Fly-to focus: when a location is selected, the camera glides to a computed
 * viewpoint (outward offset toward the room centre) and the orbit target locks
 * onto the rack. Any user input cancels the flight. Reduced motion jumps
 * instantly instead of animating.
 */
function FlyToCamera({
  locations,
  selectedLocationId,
  viewMode,
  reducedMotion,
}: {
  locations: StorageLocation[]
  selectedLocationId: string | null
  viewMode: ViewMode
  reducedMotion: boolean
}) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null

  const flight = useRef<{
    startedAt: number
    fromPos: Vector3
    toPos: Vector3
    fromTarget: Vector3
    toTarget: Vector3
  } | null>(null)

  // User grabbing the controls cancels the flight.
  useEffect(() => {
    const controlsImpl = controls
    if (!controlsImpl) return
    const cancel = () => {
      flight.current = null
    }
    controlsImpl.addEventListener('start', cancel)
    return () => controlsImpl.removeEventListener('start', cancel)
  }, [controls])

  useEffect(() => {
    if (!controls) return
    if (!selectedLocationId) {
      flight.current = null
      return
    }
    const location = locations.find((item) => item.id === selectedLocationId)
    if (!location) return

    const target = new Vector3(location.x, 1.15, location.z)
    // Viewpoint: push outward from the room centre so the camera never ends up
    // inside a neighbouring rack.
    const outward = new Vector3(location.x, 0, location.z).normalize().multiplyScalar(4.6)
    const destination = new Vector3(location.x + outward.x + 0.9, 3.6, location.z + outward.z + 2.6)

    if (reducedMotion) {
      camera.position.copy(destination)
      controls.target.copy(target)
      controls.update()
      return
    }

    flight.current = {
      startedAt: 0,
      fromPos: camera.position.clone(),
      toPos: destination,
      fromTarget: controls.target.clone(),
      toTarget: target,
    }
  }, [selectedLocationId, locations, controls, camera, reducedMotion, viewMode])

  useFrame((state) => {
    const active = flight.current
    if (!active || !controls) return
    if (active.startedAt === 0) active.startedAt = state.clock.elapsedTime

    const progress = Math.min(1, (state.clock.elapsedTime - active.startedAt) / 0.9)
    const eased = easeInOutCubic(progress)
    camera.position.lerpVectors(active.fromPos, active.toPos, eased)
    controls.target.lerpVectors(active.fromTarget, active.toTarget, eased)
    controls.update()

    if (progress >= 1) flight.current = null
  })

  return null
}

function SceneContents({
  locations,
  balances,
  products,
  selectedLocationId,
  onSelect,
  levelFilter,
  viewMode,
  reducedMotion,
}: Omit<WarehouseSceneProps, 'zoomCommand' | 'resetNonce' | 'onReady'>) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [job, setJob] = useState<DeliveryJob | null>(null)
  const jobCounter = useRef(0)
  const locationsRef = useRef(locations)
  const reducedMotionRef = useRef(reducedMotion)

  useEffect(() => {
    locationsRef.current = locations
  }, [locations])

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  useEffect(() => {
    const levelOf = (value: number | null | undefined) =>
      Math.min(3, Math.max(1, Math.round(value ?? 1)))
    const handleMovement = (event: MovementEvent) => {
      // Adjustments are bookkeeping, not a physical move — no forklift trip.
      if (event.type === 'ADJUSTMENT' || reducedMotionRef.current) return
      const current = locationsRef.current
      const source = event.sourceLocationId
        ? current.find((location) => location.id === event.sourceLocationId)
        : undefined
      const destination = event.destinationLocationId
        ? current.find((location) => location.id === event.destinationLocationId)
        : undefined
      const pickupLocation = source ?? current.find((location) => location.type === 'STAGING')
      const dropLocation = destination ?? current.find((location) => location.type === 'PACKING')
      if (!pickupLocation || !dropLocation) return
      const pickup: Placement = { location: pickupLocation, level: levelOf(event.sourceLevel) }
      const drop: Placement = { location: dropLocation, level: levelOf(event.destinationLevel) }
      if (pickupLocation.id === dropLocation.id && pickup.level === drop.level) return
      setJob({ id: ++jobCounter.current, type: event.type, pickup, drop })
    }

    const unsubscribe = onMovement(handleMovement)
    // The form lives on another route: replay the last movement on mount.
    const pending = consumePendingMovement()
    if (pending) handleMovement(pending)
    return unsubscribe
  }, [])

  useEffect(() => {
    document.body.style.cursor = hoveredId ? 'pointer' : 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hoveredId])

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  )

  const rackRows = useMemo(
    () =>
      locations.map((location) => {
        const rows = balances.filter((balance) => balance.locationId === location.id)
        const quantity = rows.reduce((sum, row) => sum + row.quantity, 0)
        let status: OccupancyStatus = 'EMPTY'
        if (rows.length > 0) {
          status = 'OCCUPIED'
          if (location.type === 'RACK') {
            const hasLow = rows.some((row) => {
              const product = productById.get(row.productId)
              return product ? row.quantity < product.reorderThreshold : false
            })
            if (hasLow) status = 'LOW'
          }
        }
        return { location, quantity, status }
      }),
    [locations, balances, productById]
  )

  return (
    <>
      <color attach="background" args={['#eef0fa']} />
      <fog attach="fog" args={['#eef0fa', 20, 38]} />
      <ambientLight intensity={1.05} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={1.9}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-far={30}
      />
      <directionalLight position={[-6, 6, -4]} intensity={0.5} />
      {/* Warm practical light matching the hanging lamps in the dressing */}
      <pointLight
        position={[0, 3.4, 1.2]}
        intensity={7}
        distance={11}
        decay={1.6}
        color="#ffe3b3"
      />

      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[19, 13]} />
        <meshStandardMaterial color="#e9ecf6" roughness={1} />
      </mesh>
      <Grid
        position={[0, 0.005, 0]}
        args={[19, 13]}
        cellSize={0.65}
        cellThickness={0.6}
        cellColor="#dfe3f2"
        sectionSize={3.9}
        sectionThickness={1}
        sectionColor="#cfd6ec"
        fadeDistance={30}
        fadeStrength={1}
      />

      {rackRows.map(({ location, quantity, status }) =>
        location.type === 'RACK' ? (
          <RackObject
            key={location.id}
            location={location}
            balances={balances}
            levelFilter={levelFilter}
            reducedMotion={reducedMotion}
            quantity={quantity}
            status={status}
            selected={selectedLocationId === location.id}
            hovered={hoveredId === location.id}
            dimmed={!!selectedLocationId && selectedLocationId !== location.id}
            onSelect={onSelect}
            onHover={setHoveredId}
          />
        ) : (
          <AreaObject
            key={location.id}
            location={location}
            platform={location.type === 'STAGING' ? 'staging' : 'packing'}
            quantity={quantity}
            status={status}
            selected={selectedLocationId === location.id}
            hovered={hoveredId === location.id}
            dimmed={!!selectedLocationId && selectedLocationId !== location.id}
            onSelect={onSelect}
            onHover={setHoveredId}
          />
        )
      )}

      <WarehouseSetDressing />

      <WarehouseWorkers reducedMotion={reducedMotion} />

      <FlyToCamera
        locations={locations}
        selectedLocationId={selectedLocationId}
        viewMode={viewMode}
        reducedMotion={reducedMotion}
      />

      <Forklift
        job={reducedMotion ? null : job}
        reducedMotion={reducedMotion}
        locations={locations}
        onDone={() => setJob(null)}
      />

      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        enableRotate={viewMode === '3d'}
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={26}
        maxPolarAngle={Math.PI / 2.12}
        target={[0, 0.6, 0]}
      />
    </>
  )
}

export function WarehouseScene(props: WarehouseSceneProps) {
  const { zoomCommand, resetNonce, onReady, ...rest } = props
  return (
    <Canvas
      // `soft` maps to PCFSoftShadowMap, which three.js removed (it silently
      // falls back to PCF anyway) — ask for the percentage-closer filter
      // explicitly so the console stays clean and the cheaper filter is used.
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [7.4, 5.6, 8.8], fov: 42 }}
      gl={{ antialias: true }}
      onCreated={onReady}
      aria-label="Scene 3D gudang"
    >
      <CameraRig viewMode={rest.viewMode} zoomCommand={zoomCommand} resetNonce={resetNonce} />
      <SceneContents {...rest} />
    </Canvas>
  )
}
