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
import { consumePendingMovement, onMovement, type MovementEvent } from '@/lib/events'
import { useI18n } from '@/i18n'
import {
  easeInOutCubic,
  easeOutCubic,
  approachWithEasing,
  createAdvancedPath,
  smoothRotateToward,
  smoothTransform,
  // Enhanced v2 functions
  velocityBasedEasing,
  smoothLookAt,
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
  onSelect,
  onHover,
}: RackObjectProps) {
  const boxes = useMemo(
    () => rackBoxes(location.id, balances, levelFilter),
    [location.id, balances, levelFilter]
  )
  const uprightColor = selected ? '#6546f5' : hovered ? '#7f8cc4' : '#9aa6c8'

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
  onSelect,
  onHover,
}: AreaObjectProps) {
  const isStaging = platform === 'staging'
  const platformSize: [number, number, number] = isStaging ? [2.4, 0.14, 1.8] : [2.1, 0.72, 1.15]
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
const DELIVERY_LANE_Z = -0.4
const BOX_LOCAL_Y = 0.3
const BOX_LOCAL_Z = 0.8
const BOX_SLIDE = 0.55
const LIFT_DURATION = 0.62
const PLACE_DURATION = 0.72
const WHEEL_RADIUS = 0.14
/** Deliberately relaxed so the forklift cruises instead of darting. */
const FORKLIFT_SPEED = 3.9
const ROTATION_SPEED = 3.8
const ACCELERATION_FACTOR = 0.95
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

interface DeliveryRoutine {
  pickupCurve: CatmullRomCurve3
  dropCurve: CatmullRomCurve3
  returnCurve: CatmullRomCurve3
  pickupAt: Vector3
  dropAt: Vector3
  pickupYaw: number
  dropYaw: number
  pickupLift: number
  dropLift: number
  startLift: number
  sameSpot: boolean
  t1: number
  t2: number
  t3: number
  t4: number
  t5: number
}

/** Distance from a location's centre to the standing spot in front of it. */
function approachPoint(location: StorageLocation) {
  const halfDepth =
    location.type === 'RACK' ? RACK_DEPTH / 2 : location.type === 'STAGING' ? 0.9 : 0.575
  // Racks accept the forks inside the shelf; areas keep the tines just clear
  // of the platform while the carriage is at rest height.
  const distance = halfDepth + (location.type === 'RACK' ? 0.85 : 1.15)
  const rotation = location.rotation ?? 0
  return new Vector3(
    location.x + Math.sin(rotation) * distance,
    0,
    location.z + Math.cos(rotation) * distance
  )
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

/** Smooth drive path with advanced planning: start → aisle lane → the spot in front of the target. */
function driveCurve(from: Vector3, to: Vector3) {
  const start = new Vector3(from.x, 0, from.z)
  const end = new Vector3(to.x, 0, to.z)
  const { path } = createAdvancedPath(start, end, DELIVERY_LANE_Z, 3.2, 1.0)
  return new CatmullRomCurve3(path, false, 'centripetal')
}

function driveDuration(curve: CatmullRomCurve3) {
  // Generous travel time keeps the cruise calm; length still scales it.
  return MathUtils.clamp(1.0 + curve.getLength() / 6.0, 1.4, 3.0)
}

function headingOf(curve: CatmullRomCurve3, t: number) {
  const tangent = curve.getTangentAt(MathUtils.clamp(t, 0, 1))
  return Math.atan2(tangent.x, tangent.z)
}

/** A sideways step along a location's local X axis (same-rack level moves). */
function lateralOffset(location: StorageLocation, distance: number) {
  const rotation = location.rotation ?? 0
  return new Vector3(Math.cos(rotation) * distance, 0, -Math.sin(rotation) * distance)
}

function buildRoutine(job: DeliveryJob, start: Vector3, startLift: number): DeliveryRoutine {
  const sameSpot = job.pickup.location.id === job.drop.location.id
  const pickupAt = approachPoint(job.pickup.location)
  const dropAt = sameSpot
    ? pickupAt
        .clone()
        .add(lateralOffset(job.drop.location, job.drop.level >= job.pickup.level ? 0.55 : -0.55))
    : approachPoint(job.drop.location)
  const pickupCurve = driveCurve(start, pickupAt)
  const dropCurve = driveCurve(pickupAt, dropAt)
  const returnCurve = driveCurve(dropAt, FORKLIFT_PARK)
  const pickupYaw = headingOf(pickupCurve, 1)
  const t1 = driveDuration(pickupCurve)
  const t2 = t1 + LIFT_DURATION
  const t3 = t2 + driveDuration(dropCurve)
  const t4 = t3 + PLACE_DURATION
  return {
    pickupCurve,
    dropCurve,
    returnCurve,
    pickupAt,
    dropAt,
    pickupYaw,
    dropYaw: sameSpot ? pickupYaw : headingOf(dropCurve, 1),
    pickupLift: carriageLift(job.pickup),
    dropLift: carriageLift(job.drop),
    startLift,
    sameSpot,
    t1,
    t2,
    t3,
    t4,
    t5: t4 + driveDuration(returnCurve),
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

  const pulsePoint = useMemo(() => (job ? approachPoint(job.drop.location) : null), [job])

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
          plan: buildRoutine(job, new Vector3(model.position.x, 0, model.position.z), lift.current),
        }
        setCompleted(false)
      }
      const { plan, startedAt } = routine.current
      const elapsed = clock - startedAt
      setDeliveryInfo({ elapsed, plan })

      if (elapsed < plan.t1) {
        // Drive to the pickup point with a calm, single cubic-bezier ease.
        const driveT = MathUtils.clamp(elapsed / plan.t1, 0, 1)
        const easedProgress = cubicBezier(driveT, 0, 0.22, 0.78, 1)
        const point = plan.pickupCurve.getPointAt(easedProgress)
        const targetYaw = headingOf(plan.pickupCurve, easedProgress)
        const { rotation, arrived: rotArrived } = smoothRotateToward(
          yaw.current,
          targetYaw,
          dt * ROTATION_SPEED * ACCELERATION_FACTOR
        )
        yaw.current = rotation
        const { position, arrived: posArrived } = approachWithEasing(
          model.position,
          point,
          dt * FORKLIFT_SPEED * ACCELERATION_FACTOR
        )
        model.position.copy(position)
        if (rotArrived && posArrived) {
          model.position.copy(point)
          yaw.current = targetYaw
        }
        targetLift = MathUtils.lerp(plan.startLift, 0, easeInOutCubic(elapsed / 0.22))
      } else if (elapsed < plan.t2) {
        // Raise the forks to the source level; the box fades in on the tines.
        const liftT = MathUtils.clamp((elapsed - plan.t1) / LIFT_DURATION, 0, 1)
        // Cubic-bezier fork lift: gentle start, firm settle (custom control points).
        const liftEase = cubicBezier(liftT, 0, 0.32, 0.68, 1)
        model.position.set(plan.pickupAt.x, 0, plan.pickupAt.z)
        yaw.current = plan.pickupYaw
        targetLift = MathUtils.lerp(0, plan.pickupLift, liftEase)
        boxVisible = liftEase > 0.2
        boxOpacity = MathUtils.clamp((liftEase - 0.2) / 0.8, 0, 1)
        // Four-stage pickup micro-animation: approach → align → grip → lift.
        boxScale = multiPhasePickup(liftT, 0).scale
      } else if (elapsed < plan.t3) {
        // Carry: drive to the destination while matching its level.
        const carryT = MathUtils.clamp((elapsed - plan.t2) / (plan.t3 - plan.t2), 0, 1)

        // Velocity-based easing: eases out of the pickup, cruises, then brakes.
        const velocityEase = velocityBasedEasing(carryT)
        const easedProgress = velocityEase.position
        const carrySpeed = velocityEase.velocity

        const point = plan.dropCurve.getPointAt(easedProgress)

        // Smooth look-at turning instead of a hard heading target.
        if (plan.sameSpot) {
          yaw.current = plan.pickupYaw
        } else {
          const lookAhead = plan.dropCurve.getPointAt(Math.min(easedProgress + 0.08, 1))
          yaw.current = smoothLookAt(yaw.current, lookAhead, model.position, dt, 1.9)
        }

        const { position: newPos, arrived: posArrived } = approachWithEasing(
          model.position,
          point,
          dt * FORKLIFT_SPEED * ACCELERATION_FACTOR
        )
        model.position.copy(newPos)
        if (posArrived) model.position.copy(point)

        targetLift = MathUtils.lerp(plan.pickupLift, plan.dropLift, easedProgress)
        boxVisible = true

        // Passive suspension bobbing while carrying — stronger with speed.
        if (!reducedMotion) {
          const bobbing = carryBobbing(clock, carrySpeed * 1.6, 1)
          carriageBob.current.x = bobbing.xOffset
          carriageBob.current.y = bobbing.yOffset
          carriageBob.current.roll = bobbing.rotation
        }
      } else if (elapsed < plan.t4) {
        // Place: slide the box off the tines into the rack/platform with impact effect
        const placeT = MathUtils.clamp((elapsed - plan.t3) / PLACE_DURATION, 0, 1)
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
      } else if (elapsed < plan.t5) {
        // Drive back to the parking spot with an empty, lowering carriage.
        const returnT = MathUtils.clamp((elapsed - plan.t4) / (plan.t5 - plan.t4), 0, 1)
        // Same calm S-curve as the outbound leg — no mid-path speed spike.
        const easedProgress = cubicBezier(returnT, 0, 0.22, 0.78, 1)
        const point = plan.returnCurve.getPointAt(easedProgress)
        const targetYaw = headingOf(plan.returnCurve, easedProgress)
        const { rotation, arrived: rotArrived } = smoothRotateToward(
          yaw.current,
          targetYaw,
          dt * ROTATION_SPEED * ACCELERATION_FACTOR
        )
        yaw.current = rotation
        const { position, arrived: posArrived } = approachWithEasing(
          model.position,
          point,
          dt * FORKLIFT_SPEED * ACCELERATION_FACTOR
        )
        model.position.copy(position)
        if (rotArrived && posArrived) {
          model.position.copy(point)
          yaw.current = targetYaw
        }
        targetLift = MathUtils.lerp(plan.dropLift, 0, easedProgress)
      } else {
        // Finish at the parking spot and hand control back to the parent.
        model.position.set(FORKLIFT_PARK.x, 0, FORKLIFT_PARK.z)
        yaw.current = FORKLIFT_PARK_ROTATION
        targetLift = 0
        if (!completed) {
          setCompleted(true)
          onDone()
        }
      }

      if (elapsed >= plan.t3) {
        pulseProgress = MathUtils.clamp((elapsed - plan.t3) / 0.7, 0, 1)
      }

      // Compute glow values in useFrame (not during render)
      // Forklift chassis glow
      if (job && elapsed > plan.t2 && elapsed < plan.t4) {
        // Pick up & carry: bright yellow glow
        setChassisEmissive((prev) => MathUtils.lerp(prev, 0.35, dt * 4))
      } else if (job && elapsed >= plan.t4) {
        // Returning: softer glow
        setChassisEmissive((prev) => MathUtils.lerp(prev, 0.2, dt * 4))
      } else if (job && elapsed <= plan.t2) {
        // Approaching pickup: rising glow
        setChassisEmissive((prev) =>
          MathUtils.lerp(prev, Math.min(0.35, (elapsed / plan.t1) * 0.35), dt * 4)
        )
      } else {
        setChassisEmissive((prev) => MathUtils.lerp(prev, hovered ? 0.25 : 0, dt * 4))
      }

      // Pickup/drop location glow indicators
      setPickupIndicatorEmissive((prev) =>
        MathUtils.lerp(prev, job && elapsed < plan.t3 ? (hovered ? 0.4 : 0.25) : 0, dt * 4)
      )
      setDropIndicatorEmissive((prev) =>
        MathUtils.lerp(
          prev,
          job && elapsed >= plan.t3 && elapsed < plan.t4 ? (hovered ? 0.45 : 0.3) : 0,
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

      {/* Pickup location indicator - glow ring around source location */}
      {job && !completed && deliveryInfo ? (
        <>
          {deliveryInfo.elapsed < deliveryInfo.plan.t3 && deliveryInfo.plan.pickupAt ? (
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
          {deliveryInfo.elapsed >= deliveryInfo.plan.t3 &&
          deliveryInfo.elapsed < deliveryInfo.plan.t5 &&
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
            onSelect={onSelect}
            onHover={setHoveredId}
          />
        )
      )}

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
