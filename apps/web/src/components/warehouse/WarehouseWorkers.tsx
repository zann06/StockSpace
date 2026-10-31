import { useRef } from 'react'

import { lerpAngle } from '@/lib/warehouse3d'
import { useFrame } from '@react-three/fiber'
import { type Group, CatmullRomCurve3, Vector3 } from 'three'

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

/** Shared low-poly humanoid: hip/shoulder pivots, torso counter-yaw, step bob. */
function WorkerBody({
  phaseRef,
  sway = 0,
}: {
  /** Mutable walk-phase counter — advanced by the parent's useFrame. */
  phaseRef?: { current: number }
  sway?: number
}) {
  const bobGroup = useRef<Group>(null)
  const leftHip = useRef<Group>(null)
  const rightHip = useRef<Group>(null)
  const torso = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)

  // Legs/arms/torso are applied here (frame-synced) so the parent never reads
  // or writes refs during render.
  useFrame(({ clock }) => {
    const walking = (phaseRef?.current ?? 0) > 0
    const phase = walking ? phaseRef!.current : clock.elapsedTime * 0.9

    const legSwing = walking ? Math.sin(phase * 7) * 0.34 : 0
    const armSwing = walking ? Math.sin(phase * 7 + Math.PI) * 0.45 : Math.sin(phase * 1.6) * 0.06

    // Hip pivots: swing + lift the forward leg so the foot leaves the floor.
    if (leftHip.current) {
      leftHip.current.rotation.x = legSwing
      leftHip.current.position.y = 0.44 + Math.max(0, legSwing) * 0.09
    }
    if (rightHip.current) {
      rightHip.current.rotation.x = -legSwing
      rightHip.current.position.y = 0.44 + Math.max(0, -legSwing) * 0.09
    }
    // Counter-swing arms around shoulder pivots.
    if (leftArm.current) leftArm.current.rotation.x = armSwing
    if (rightArm.current) rightArm.current.rotation.x = -armSwing
    // Torso counter-yaw + subtle head-bob make the stride read naturally.
    if (torso.current) torso.current.rotation.y = walking ? Math.sin(phase * 7) * 0.09 : 0
    if (bobGroup.current) {
      bobGroup.current.position.y = walking
        ? Math.abs(Math.sin(phase * 7)) * 0.035
        : Math.sin(phase * 1.2) * 0.008
    }
  })

  return (
    <group ref={bobGroup}>
      {/* Legs hang from hip pivots so they swing like real strides */}
      <group ref={leftHip} position={[-0.07, 0.44, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.09, 0.44, 0.1]} />
          <meshStandardMaterial color={PANTS} roughness={0.9} />
        </mesh>
      </group>
      <group ref={rightHip} position={[0.07, 0.44, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.09, 0.44, 0.1]} />
          <meshStandardMaterial color={PANTS} roughness={0.9} />
        </mesh>
      </group>
      <group ref={torso}>
        <mesh position={[0, 0.62, 0]} rotation-z={sway * 0.06}>
          <boxGeometry args={[0.26, 0.42, 0.16]} />
          <meshStandardMaterial color={VEST} roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.5, 0.001]}>
          <boxGeometry args={[0.27, 0.14, 0.17]} />
          <meshStandardMaterial color={VEST_DARK} roughness={0.75} />
        </mesh>
        <group ref={leftArm} position={[-0.17, 0.82, 0]}>
          <mesh position={[0, -0.18, 0]}>
            <boxGeometry args={[0.07, 0.36, 0.09]} />
            <meshStandardMaterial color={VEST} roughness={0.75} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.17, 0.82, 0]}>
          <mesh position={[0, -0.18, 0]}>
            <boxGeometry args={[0.07, 0.36, 0.09]} />
            <meshStandardMaterial color={VEST} roughness={0.75} />
          </mesh>
        </group>
        <mesh position={[0, 0.94, 0]}>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.03, 0]}>
          <sphereGeometry args={[0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={HARDHAT} roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}

/** Cheap contact shadow blob — grounds characters without real shadows. */
export function BlobShadow({
  radius = 0.42,
  opacity = 0.16,
}: {
  radius?: number
  opacity?: number
}) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
      <circleGeometry args={[radius, 20]} />
      <meshBasicMaterial color="#1b2340" transparent opacity={opacity} depthWrite={false} />
    </mesh>
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
      <BlobShadow />
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
  const yaw = useRef(0)
  // Centripetal parameterisation avoids overshoot on the tight aisle corners.
  const curve = new CatmullRomCurve3(
    HAUL_WAYPOINTS.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    'centripetal'
  )
  const t = useRef(0)
  const previous = useRef(new Vector3(position[0], 0, position[2]))

  useFrame((_, delta) => {
    if (!ref.current) return
    const dt = Math.min(delta, 0.05)

    if (reducedMotion) {
      // Frozen at the spawn pose — legs stay neutral, worker faces the racks.
      yaw.current = 0.9
      ref.current.rotation.y = yaw.current
      return
    }

    const speed = 0.04 // curve-parameter units per second
    t.current = (t.current + dt * speed) % 1

    const point = curve.getPointAt(t.current)
    const tangent = curve.getTangentAt(t.current)
    const targetYaw = Math.atan2(tangent.x, tangent.z)

    // Face the travel direction with shortest-path smoothing (no snapping on
    // corners), and lean forward very slightly while walking.
    yaw.current = lerpAngle(yaw.current, targetYaw, Math.min(1, dt * 8))
    ref.current.rotation.y = yaw.current
    ref.current.rotation.x = 0.025

    ref.current.position.set(point.x, 0, point.z)

    const moved = previous.current.distanceTo(point)
    previous.current.copy(point)
    // Stride cadence ~2.1 steps/second at the walking speed above.
    walkPhase.current += moved * 1.3
  })

  return (
    <group ref={ref} position={position}>
      <BlobShadow />
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
      <BlobShadow />
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
