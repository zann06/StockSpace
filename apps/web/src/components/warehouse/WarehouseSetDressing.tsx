import { memo } from 'react'
import { RoundedBox } from '@react-three/drei'

/**
 * Static warehouse dressing: shell, dock, floor markings, lighting fixtures,
 * pallets, and safety props. Everything is procedural so the scene still ships
 * without external 3D assets.
 */

const KRAFT = ['#d9b98e', '#cdae82', '#e2c79f'] as const
const YELLOW = '#f6c445'
const STEEL = '#8b93b5'
const DARK_STEEL = '#5c668c'
const WALL = '#e5e9f4'

interface Point2 {
  x: number
  z: number
}

function FloorStrip({
  position,
  size,
  color = YELLOW,
  opacity = 0.55,
}: {
  position: Point2
  size: [number, number]
  color?: string
  opacity?: number
}) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[position.x, 0.014, position.z]}>
      <planeGeometry args={size} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function FloorMarkings() {
  return (
    <group>
      {/* Pedestrian lane along the loading face. */}
      <FloorStrip position={{ x: 0, z: 4.55 }} size={[16.6, 0.045]} />
      <FloorStrip position={{ x: 0, z: 5.05 }} size={[16.6, 0.045]} />

      {/* Keep-clear line along the rack fronts. */}
      <FloorStrip position={{ x: 0, z: -1.32 }} size={[17.4, 0.04]} opacity={0.24} />

      {/* Forklift parking bay. */}
      <FloorStrip position={{ x: 5.7, z: 0.5 }} size={[1.72, 0.045]} />
      <FloorStrip position={{ x: 5.7, z: 2.5 }} size={[1.72, 0.045]} />
      <FloorStrip position={{ x: 4.84, z: 1.5 }} size={[0.045, 2.0]} />
      <FloorStrip position={{ x: 6.56, z: 1.5 }} size={[0.045, 2.0]} />

      {/* Yellow edge stripes on the two work platforms. */}
      <mesh position={[-4.4, 0.145, 1.0]}>
        <boxGeometry args={[2.38, 0.018, 0.06]} />
        <meshStandardMaterial color={YELLOW} roughness={0.7} />
      </mesh>
      <mesh position={[0.6, 0.725, 1.425]}>
        <boxGeometry args={[2.08, 0.018, 0.06]} />
        <meshStandardMaterial color={YELLOW} roughness={0.7} />
      </mesh>
    </group>
  )
}

function PalletStack({
  position,
  rotation = 0,
}: {
  position: [number, number, number]
  rotation?: number
}) {
  return (
    <group position={position} rotation-y={rotation}>
      {/* Pallet deck + stringers. */}
      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[1.18, 0.1, 1.02]} />
        <meshStandardMaterial color="#b98552" roughness={0.9} />
      </mesh>
      {[-0.43, 0, 0.43].map((x) => (
        <mesh key={`stringer-${x}`} castShadow position={[x, 0.025, 0]}>
          <boxGeometry args={[0.17, 0.06, 1.02]} />
          <meshStandardMaterial color="#9d6f42" roughness={0.95} />
        </mesh>
      ))}

      {/* Two layers of kraft cartons. */}
      {[0, 1].flatMap((layer) =>
        [-0.28, 0.28].map((x, index) => (
          <RoundedBox
            key={`carton-${layer}-${x}`}
            castShadow
            args={[0.52, 0.34, 0.62]}
            radius={0.025}
            smoothness={1}
            position={[x, 0.3 + layer * 0.36, index === 0 ? 0.02 : -0.02]}
          >
            <meshStandardMaterial color={KRAFT[(layer + index) % KRAFT.length]} roughness={0.9} />
          </RoundedBox>
        ))
      )}

      {/* Stretch wrap. */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[1.04, 0.9, 0.82]} />
        <meshStandardMaterial
          color="#f8fbff"
          transparent
          opacity={0.15}
          roughness={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function SafetyBollard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.06, 0.075, 0.64, 8]} />
        <meshStandardMaterial color={YELLOW} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.062, 0.062, 0.07, 8]} />
        <meshStandardMaterial color="#2b3050" roughness={0.6} />
      </mesh>
    </group>
  )
}

function SafetyCone({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <coneGeometry args={[0.12, 0.38, 12]} />
        <meshStandardMaterial color="#f07a3c" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.025, 0]}>
        <boxGeometry args={[0.28, 0.05, 0.28]} />
        <meshStandardMaterial color="#2b3050" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.23, 0]}>
        <cylinderGeometry args={[0.082, 0.092, 0.055, 12]} />
        <meshStandardMaterial color="#f6f4ee" roughness={0.8} />
      </mesh>
    </group>
  )
}

function Extinguisher({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.5, 12]} />
        <meshStandardMaterial color="#c5303c" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.63, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.1, 8]} />
        <meshStandardMaterial color="#2b3050" roughness={0.7} />
      </mesh>
      <mesh position={[0.08, 0.58, 0]} rotation-z={0.5}>
        <boxGeometry args={[0.06, 0.17, 0.05]} />
        <meshStandardMaterial color="#2b3050" roughness={0.7} />
      </mesh>
    </group>
  )
}

function WallShell() {
  return (
    <group>
      {/* Three single-sided walls: visible from inside, culled when the camera
          orbits behind them, so the cutaway view stays usable. */}
      <mesh position={[0, 1.7, -5.9]} receiveShadow>
        <planeGeometry args={[18.6, 3.4]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      <mesh position={[-9.4, 1.7, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[12.2, 3.4]} />
        <meshStandardMaterial color="#e1e6f3" roughness={0.95} />
      </mesh>
      <mesh position={[9.4, 1.7, 0]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[12.2, 3.4]} />
        <meshStandardMaterial color="#e1e6f3" roughness={0.95} />
      </mesh>

      {/* Baseboards. */}
      <mesh position={[0, 0.12, -5.83]}>
        <boxGeometry args={[18.6, 0.24, 0.08]} />
        <meshStandardMaterial color="#cfd6e8" roughness={0.9} />
      </mesh>
      <mesh position={[-9.33, 0.12, 0]}>
        <boxGeometry args={[0.08, 0.24, 12.2]} />
        <meshStandardMaterial color="#cfd6e8" roughness={0.9} />
      </mesh>
      <mesh position={[9.33, 0.12, 0]}>
        <boxGeometry args={[0.08, 0.24, 12.2]} />
        <meshStandardMaterial color="#cfd6e8" roughness={0.9} />
      </mesh>

      {/* High strip windows on the back wall. */}
      {[-6.2, -2.1, 2.1, 6.2].map((x) => (
        <group key={`window-${x}`} position={[x, 2.62, -5.87]}>
          <mesh>
            <planeGeometry args={[2.0, 0.56]} />
            <meshStandardMaterial
              color="#dce8ff"
              emissive="#c9dcff"
              emissiveIntensity={0.28}
              roughness={0.25}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, 0.31, 0.01]}>
            <boxGeometry args={[2.08, 0.05, 0.04]} />
            <meshStandardMaterial color={DARK_STEEL} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.31, 0.01]}>
            <boxGeometry args={[2.08, 0.05, 0.04]} />
            <meshStandardMaterial color={DARK_STEEL} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Structural columns and roof beams keep the shell readable without a
          full roof that would block the orbit camera. */}
      {[-4.6, 0, 4.6].map((z) => (
        <mesh key={`beam-${z}`} castShadow position={[0, 4.18, z]}>
          <boxGeometry args={[18.2, 0.12, 0.18]} />
          <meshStandardMaterial color={STEEL} roughness={0.55} metalness={0.3} />
        </mesh>
      ))}
      {[-9.18, 9.18].flatMap((x) =>
        [-4.6, 0, 4.6].map((z) => (
          <mesh key={`column-${x}-${z}`} castShadow position={[x, 2.08, z]}>
            <boxGeometry args={[0.16, 4.16, 0.16]} />
            <meshStandardMaterial color={STEEL} roughness={0.55} metalness={0.3} />
          </mesh>
        ))
      )}
    </group>
  )
}

function DockDoor() {
  return (
    <group position={[-9.38, 0, 3.0]} rotation-y={Math.PI / 2}>
      {/* Roll-up door panel. */}
      <mesh position={[0, 1.25, 0]}>
        <planeGeometry args={[2.5, 2.5]} />
        <meshStandardMaterial color="#b8c1d6" roughness={0.8} metalness={0.1} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={`slat-${index}`} position={[0, 0.25 + index * 0.4, 0.012]}>
          <boxGeometry args={[2.48, 0.025, 0.02]} />
          <meshStandardMaterial color="#9ca7c2" roughness={0.7} />
        </mesh>
      ))}
      {/* Frame. */}
      <mesh position={[0, 2.58, 0.02]}>
        <boxGeometry args={[2.72, 0.16, 0.14]} />
        <meshStandardMaterial color={DARK_STEEL} roughness={0.6} />
      </mesh>
      {[-1.34, 1.34].map((x) => (
        <mesh key={`jamb-${x}`} position={[x, 1.27, 0.02]}>
          <boxGeometry args={[0.12, 2.72, 0.14]} />
          <meshStandardMaterial color={DARK_STEEL} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function DockPlate() {
  return (
    <group>
      <mesh receiveShadow position={[-8.55, 0.018, 3.0]}>
        <boxGeometry args={[1.45, 0.035, 2.15]} />
        <meshStandardMaterial color="#59617d" roughness={0.8} metalness={0.2} />
      </mesh>
      {[-0.97, 0.97].map((offset) => (
        <mesh key={`dock-stripe-${offset}`} position={[-8.55, 0.04, 3.0 + offset]}>
          <boxGeometry args={[1.45, 0.012, 0.09]} />
          <meshStandardMaterial color={YELLOW} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function CeilingLights() {
  const positions: Array<[number, number]> = [
    [-5.8, -3.4],
    [0, -3.4],
    [5.8, -3.4],
    [-5.8, 2.2],
    [0, 2.2],
    [5.8, 2.2],
  ]

  return (
    <group>
      {positions.map(([x, z]) => (
        <group key={`light-${x}-${z}`} position={[x, 3.92, z]}>
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[1.25, 0.1, 0.26]} />
            <meshStandardMaterial color="#d8ddec" roughness={0.5} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.005, 0]}>
            <boxGeometry args={[1.12, 0.035, 0.18]} />
            <meshStandardMaterial
              color="#fff8e8"
              emissive="#ffe7b0"
              emissiveIntensity={1.35}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export const WarehouseSetDressing = memo(function WarehouseSetDressing() {
  return (
    <group>
      <WallShell />
      <FloorMarkings />
      <DockDoor />
      <DockPlate />
      <CeilingLights />

      {/* Pallet freight around the edges, clear of the forklift lanes. */}
      <PalletStack position={[-8.2, 0, -4.1]} rotation={0.12} />
      <PalletStack position={[7.95, 0, -4.1]} rotation={-0.22} />
      <PalletStack position={[8.0, 0, 4.15]} rotation={0.18} />

      {/* Corner protection for both work platforms. */}
      <SafetyBollard position={[-5.58, 0, 1.08]} />
      <SafetyBollard position={[-3.22, 0, 1.08]} />
      <SafetyBollard position={[-0.43, 0, 1.5]} />
      <SafetyBollard position={[1.63, 0, 1.5]} />

      <SafetyCone position={[-8.55, 0, 1.25]} />
      <SafetyCone position={[-8.55, 0, 4.8]} />
      <Extinguisher position={[8.95, 0, 3.8]} />
    </group>
  )
})
