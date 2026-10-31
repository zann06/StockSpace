import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { type Group, type Mesh, CatmullRomCurve3, Vector3 } from 'three'

/**
 * Low-poly warehouse NPCs (priority-1 set dressing): they make the scene feel
 * inhabited without new assets — every worker is boxes + spheres like the rest
 * of the scene.
 *
 *   - Packer: stands at the packing platform, clipboard in hand, idle sway.
 *   - Hauler: walks a fixed loop along the rack-front aisle, always facing the
 *     direction of travel.
 *   - Watcher: idle near the dock door, slowly looking around.
 *
 * Under `reducedMotion` the hauler stands still and nobody bobs.
 */

const VEST = '#f6a821'
const VEST_DARK = '#d98d12'
const PANTS = '#3d4466'
const SKIN = '#e8c39a'
const HARDHAT = '#f3f5fb'

/** Shared low-poly humanoid: legs, torso + vest, arms, head + hard hat. */
function WorkerBody({
  phaseRef,
  sway = 0,
}: {
  /** Mutable walk-phase counter — advanced by the parent's useFrame. */
  phaseRef?: { current: number }
  sway?: number
}) {
  const leftLeg = useRef<Mesh>(null)
  const rightLeg = useRef<Mesh>(null)
  const leftArm = useRef<Mesh>(null)
  const rightArm = useRef<Mesh>(null)

  // Legs/arms swing is applied here (frame-synced) so the parent never reads
  // or writes refs during render.
  useFrame(({ clock }) => {
    const walking = (phaseRef?.current ?? 0) > 0
    const phase = phaseRef?.current ?? clock.elapsedTime
    const legSwing = walking ? Math.sin(phase * 7) * 0.3 : 0
    const armSwing = walking ? Math.sin(phase * 7 + Math.PI) * 0.32 : Math.sin(phase * 1.6) * 0.05
    if (leftLeg.current) {
      leftLeg.current.rotation.x = legSwing
      leftLeg.current.position.z = walking ? Math.sin(phase * 7) * 0.05 : 0
    }
    if (rightLeg.current) {
      rightLeg.current.rotation.x = -legSwing
      rightLeg.current.position.z = walking ? -Math.sin(phase * 7) * 0.05 : 0
    }
    if (leftArm.current) leftArm.current.rotation.x = armSwing
    if (rightArm.current) rightArm.current.rotation.x = -armSwing
  })

  return (
    <group>
      <mesh ref={leftLeg} position={[-0.07, 0.22, 0]}>
        <boxGeometry args={[0.09, 0.44, 0.1]} />
        <meshStandardMaterial color={PANTS} roughness={0.9} />
      </mesh>
      <mesh ref={rightLeg} position={[0.07, 0.22, 0]}>
        <boxGeometry args={[0.09, 0.44, 0.1]} />
        <meshStandardMaterial color={PANTS} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.62, 0]} rotation-z={sway * 0.06}>
        <boxGeometry args={[0.26, 0.42, 0.16]} />
        <meshStandardMaterial color={VEST} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.5, 0.001]}>
        <boxGeometry args={[0.27, 0.14, 0.17]} />
        <meshStandardMaterial color={VEST_DARK} roughness={0.75} />
      </mesh>
      <mesh ref={leftArm} position={[-0.17, 0.64, 0]}>
        <boxGeometry args={[0.07, 0.36, 0.09]} />
        <meshStandardMaterial color={VEST} roughness={0.75} />
      </mesh>
      <mesh ref={rightArm} position={[0.17, 0.64, 0]}>
        <boxGeometry args={[0.07, 0.36, 0.09]} />
        <meshStandardMaterial color={VEST} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.94, 0]}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.03, 0]}>
        <sphereGeometry args={[0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={HARDHAT} roughness={0.4} />
      </mesh>
    </group>
  )
}

/** Clipboard held by the packer. */
function Clipboard() {
  return (
    <group position={[0.22, 0.74, 0.14]} rotation-x={0.5} rotation-z={-0.3}>
      <mesh>
        <boxGeometry args={[0.16, 0.22, 0.02]} />
        <meshStandardMaterial color="#a4703c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.02, 0.012]}>
        <boxGeometry args={[0.12, 0.15, 0.005]} />
        <meshStandardMaterial color="#f3f5fb" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** Packer at the packing platform — idle sway, clipboard in hand. */
function PackerWorker({ position }: { position: [number, number, number] }) {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = Math.sin(clock.elapsedTime * 1.7) * 0.008
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.1) * 0.015
  })
  return (
    <group ref={ref} position={position} rotation-y={-2.2}>
      <WorkerBody />
      <Clipboard />
    </group>
  )
}

/** Aisle waypoints the hauler walks between (staging side → rack B → back). */
const HAUL_WAYPOINTS: Array<[number, number]> = [
  [-3.9, 2.9],
  [-2.0, 3.8],
  [1.9, 3.8],
  [3.4, 2.9],
  [1.9, 3.8],
  [-2.0, 3.8],
]

/** Hauler walking a closed loop along the rack-front aisle. */
function HaulerWorker({
  position,
  reducedMotion,
}: {
  position: [number, number, number]
  reducedMotion: boolean
}) {
  const ref = useRef<Group>(null)
  const walkPhase = useRef(0)
  const curve = new CatmullRomCurve3(
    HAUL_WAYPOINTS.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    'catmullrom',
    0.4
  )
  const t = useRef(0)
  const previous = useRef(new Vector3(position[0], 0, position[2]))

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    const dt = Math.min(delta, 0.05)
    const speed = 0.045 // curve-parameter units per second
    t.current = (t.current + dt * speed) % 1

    const point = curve.getPointAt(t.current)
    const tangent = curve.getTangentAt(t.current)
    ref.current.position.set(point.x, 0, point.z)
    ref.current.rotation.y = Math.atan2(tangent.x, tangent.z)

    const moved = previous.current.distanceTo(point)
    previous.current.copy(point)
    walkPhase.current += moved * 5.5
  })

  return (
    <group ref={ref} position={position}>
      <WorkerBody phaseRef={walkPhase} />
    </group>
  )
}

/** Watcher near the dock door — idle, slowly scanning the room. */
function WatcherWorker({ position }: { position: [number, number, number] }) {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.6 + 2.4
    }
  })
  return (
    <group ref={ref} position={position}>
      <WorkerBody />
    </group>
  )
}

/** All three NPCs. Static placement — no labels, no interactivity. */
export function WarehouseWorkers({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group aria-hidden>
      <PackerWorker position={[-0.9, 0, 3.1]} />
      <HaulerWorker position={[-3.9, 0, 2.9]} reducedMotion={reducedMotion} />
      <WatcherWorker position={[8.2, 0, 4.9]} />
    </group>
  )
}
