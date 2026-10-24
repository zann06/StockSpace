import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Grid, Html, OrbitControls, RoundedBox } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Mesh } from 'three'
import type {
  Balance,
  LevelFilter,
  OccupancyStatus,
  Product,
  StorageLocation,
  ViewMode,
  ZoomCommand,
} from '@/types'
import { formatNumber } from '@/lib/format'

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
  products: Product[]
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

interface ObjectBaseProps {
  location: StorageLocation
  quantity: number
  status: OccupancyStatus
  selected: boolean
  hovered: boolean
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
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
            <RoundedBox
              key={`${level}-${index}`}
              castShadow
              args={box.size}
              radius={0.03}
              smoothness={2}
              position={[
                -spread / 2 + box.offsetIndex * 0.62,
                SHELF_Y[level - 1] + box.size[1] / 2 + 0.03,
                0,
              ]}
            >
              <meshStandardMaterial color={KRAFT_COLORS[box.colorIndex]} roughness={0.9} />
            </RoundedBox>
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

/** Decorative procedural forklift — original low-poly geometry, not selectable. */
function Forklift() {
  return (
    <group position={[5.7, 0, 1.5]} rotation-y={-0.55}>
      <mesh castShadow position={[0, 0.46, 0]}>
        <boxGeometry args={[0.56, 0.5, 0.95]} />
        <meshStandardMaterial color="#f6c445" roughness={0.6} />
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
      {[-0.2, 0.2].map((x) => (
        <mesh key={`mast-${x}`} position={[x, 0.75, 0.52]}>
          <boxGeometry args={[0.06, 1.5, 0.06]} />
          <meshStandardMaterial color="#8b93b5" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {[-0.16, 0.16].map((x) => (
        <mesh key={`fork-${x}`} position={[x, 0.1, 0.78]}>
          <boxGeometry args={[0.09, 0.04, 0.5]} />
          <meshStandardMaterial color="#3a4266" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {[-0.32, 0.32].map((x) =>
        [-0.33, 0.33].map((z) => (
          <mesh key={`wheel-${x}-${z}`} position={[x, 0.14, z]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.1, 16]} />
            <meshStandardMaterial color="#22263d" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
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

      <Forklift />

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
      shadows
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
