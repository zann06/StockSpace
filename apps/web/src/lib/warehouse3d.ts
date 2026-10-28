/**
 * 3D Warehouse helper functions for smooth animations and visual effects.
 */

import { MathUtils, Vector3 } from 'three'
import type { Camera } from 'three'

/**
 * Generate a random float in the given range.
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

/**
 * Pick a random element from an array.
 */
export function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Shuffle an array in place.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  let i = arr.length
  let j: number
  while (i > 0) {
    j = Math.floor(Math.random() * i)
    ;[arr[--i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Smooth turn toward a target heading using shortest-path interpolation.
 * Returns the new heading in radians.
 */
export function turnToward(current: number, target: number, dt: number, speed = 11): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + delta * Math.min(1, dt * speed)
}

/**
 * Smoothly interpolate between two angles using shortest-path logic.
 * Used for forklift rotation and box orientation.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + diff * t
}

/**
 * Smoothstep easing function for natural acceleration/deceleration.
 */
export function smoothstep(value: number): number {
  const clamped = MathUtils.clamp(value, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * Cubic ease-out for more natural movement.
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Ease-in-out cubic for smooth start and end.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Vector3 helper: move toward target with smooth deceleration.
 */
export function approachVector3(current: Vector3, target: Vector3, maxDistance: number): Vector3 {
  const diff = target.clone().sub(current)
  const distance = diff.length()
  if (distance <= maxDistance) return target.clone()
  const direction = diff.normalize()
  return current.clone().add(direction.multiplyScalar(maxDistance))
}

/**
 * Create a smooth path from start to end with optional lane detour.
 */
export function createDrivePath(start: Vector3, end: Vector3, laneZ?: number): Vector3[] {
  const points = [start.clone()]
  const mid = new Vector3(end.x, 0, laneZ ?? end.z)
  if (start.distanceTo(end) > 1.1 && Math.abs(start.z - end.z) > 0.5) {
    points.push(mid)
  }
  if (points[points.length - 1].distanceTo(end) > 0.05) {
    points.push(end.clone())
  }
  return points
}

/**
 * Calculate the duration for a drive based on path length and speed.
 */
export function calculateDriveDuration(pathLength: number, speed = 10): number {
  return MathUtils.clamp(0.3 + pathLength / speed, 0.4, 1.2)
}

/**
 * Smooth, frame-rate independent approach to target position with ease-out.
 * Returns new position and whether it's within epsilon.
 */
export function approachWithEasing(
  current: Vector3,
  target: Vector3,
  maxStep: number
): { position: Vector3; arrived: boolean } {
  const diff = target.clone().sub(current)
  const distance = diff.length()
  if (distance <= 0.001) return { position: target.clone(), arrived: true }

  // Smoother ease-out curve with ramp-up and ramp-down
  const progress = Math.min(1, distance / maxStep)
  // Use smoothstep for smooth acceleration and deceleration
  const smoothProgress = progress * progress * (3 - 2 * progress)
  const step = distance * smoothProgress

  const direction = diff.normalize()
  const newPos = current.clone().add(direction.multiplyScalar(step))
  return { position: newPos, arrived: false }
}

/**
 * Smooth rotation toward target with shortest-path interpolation.
 * Returns new rotation and whether it's within epsilon.
 */
export function rotateToward(
  current: number,
  target: number,
  maxAngle: number
): { rotation: number; arrived: boolean } {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  const absDelta = Math.abs(delta)
  if (absDelta <= 0.005) return { rotation: target, arrived: true }

  // Smoother rotation with ease-out
  const progress = Math.min(1, absDelta / maxAngle)
  const smoothProgress = progress * progress * (3 - 2 * progress)
  const step = absDelta * smoothProgress

  const rotated = current + Math.sign(delta) * step
  return { rotation: rotated, arrived: false }
}

/**
 * Forklift hover effect: gentle body bobbing with smooth sine wave.
 */
export function forkliftHoverEffect(
  elapsed: number,
  amplitude = 0.012,
  frequency = 2.8,
  isIdle: boolean = true
): number {
  if (!isIdle) return 0
  return Math.sin(elapsed * frequency) * amplitude
}

/**
 * Enhanced approach with cubic-bezier easing for smoother acceleration/deceleration.
 * Uses a custom ease-in-out curve for more natural movement.
 */
export function approachWithCubicBezier(
  current: Vector3,
  target: Vector3,
  maxStep: number,
  easeIn: number = 0.3,
  easeOut: number = 0.7
): { position: Vector3; arrived: boolean } {
  const diff = target.clone().sub(current)
  const distance = diff.length()
  if (distance <= 0.001) return { position: target.clone(), arrived: true }

  // Calculate progress based on distance
  const progress = Math.min(1, distance / maxStep)

  // Custom cubic-bezier easing: faster start, slower end
  let easedProgress: number
  if (progress < easeIn) {
    easedProgress = Math.pow(progress / easeIn, 3)
  } else if (progress < easeOut) {
    easedProgress = 1 - Math.pow((1 - progress) / (easeOut - easeIn), 3)
  } else {
    easedProgress = 1 - Math.pow((1 - progress) / (1 - easeOut), 3)
  }

  const step = distance * easedProgress
  const direction = diff.normalize()
  const newPos = current.clone().add(direction.multiplyScalar(step))
  return { position: newPos, arrived: false }
}

/**
 * Smooth position/rotation combination with individual thresholds.
 */
export function smoothTransform(
  position: Vector3,
  targetPosition: Vector3,
  rotation: number,
  targetRotation: number,
  posStep: number,
  rotStep: number
): { position: Vector3; rotation: number; done: boolean } {
  const posResult = approachWithEasing(position, targetPosition, posStep)
  const rotResult = rotateToward(rotation, targetRotation, rotStep)
  return {
    position: posResult.position,
    rotation: rotResult.rotation,
    done: posResult.arrived && rotResult.arrived,
  }
}

/**
 * Box hover effect: gentle vertical float with smooth easing.
 */
export function boxHoverEffect(
  elapsed: number,
  baseY: number,
  amplitude = 0.08,
  frequency = 2.5,
  isHovered: boolean = false,
  scaleAmplitude: number = 0.04
): { y: number; scale: number } {
  const wobble = Math.sin(elapsed * frequency) * amplitude
  const scaleWobble = isHovered ? Math.sin(elapsed * (frequency * 1.7)) * scaleAmplitude : 0
  return { y: baseY + wobble, scale: 1 + scaleWobble }
}

/**
 * Box pickup animation: slide-out from rack + lift with rotation.
 */
export function boxPickupAnimation(
  progress: number,
  baseY: number,
  liftHeight: number,
  rotate: boolean = true
): { y: number; zOffset: number; rotation: number } {
  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))
  const lift = liftHeight * eased
  const slide = 0.35 * eased // slide out before lifting
  const rotation: number = rotate ? Math.sin(eased * Math.PI * 0.5) * 0.08 : 0
  return { y: baseY + lift, zOffset: -slide, rotation }
}

/**
 * Box drop animation: slide into rack + lower with smooth rotation.
 */
export function boxDropAnimation(
  progress: number,
  baseY: number,
  liftHeight: number,
  rotate: boolean = true
): { y: number; zOffset: number; rotation: number } {
  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))
  const slide = 0.35 * (1 - eased) // slide in while lowering
  const lift = liftHeight * (1 - eased * eased)
  const rotation = rotate ? Math.sin((1 - eased) * Math.PI * 0.5) * -0.08 : 0
  return { y: baseY + lift, zOffset: slide, rotation }
}

/**
 * Smooth box hover effect: float up + scale + emissive highlight.
 * Returns new Y position and scale factor.
 */
export function boxHoverFloat(
  elapsed: number,
  baseY: number,
  isHovered: boolean,
  amplitude = 0.12,
  frequency = 2.8,
  scaleAmplitude = 0.06
): { y: number; scale: number; emissive: boolean } {
  if (!isHovered) {
    return { y: baseY, scale: 1, emissive: false }
  }
  const wobble = Math.sin(elapsed * frequency) * amplitude
  const scaleWobble = Math.sin(elapsed * (frequency * 1.3)) * scaleAmplitude
  return {
    y: baseY + wobble,
    scale: 1 + scaleWobble,
    emissive: true,
  }
}

/**
 * Smooth box pickup effect: lift while fading out slightly.
 * Used when forklift is approaching to pick up a box.
 */
export function boxPickupEffect(
  progress: number,
  baseY: number,
  liftHeight: number
): { y: number; opacity: number } {
  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))
  return {
    y: baseY + liftHeight * eased,
    opacity: 1 - eased * 0.3, // fade out slightly during pickup
  }
}

/**
 * Smooth box drop effect: slide in + lower + fade in.
 * Used when forklift is placing a box.
 */
export function boxDropEffect(
  progress: number,
  baseY: number,
  liftHeight: number
): { y: number; zOffset: number; opacity: number } {
  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))
  const slide = 0.4 * (1 - eased) // slide in while lowering
  const lift = liftHeight * (1 - eased * eased)
  const opacity = eased < 0.3 ? 0 : eased < 0.6 ? (eased - 0.3) / 0.3 : 1
  return { y: baseY + lift, zOffset: slide, opacity }
}

/**
 * Forklift approach effect: gentle pulsing when approaching pickup/drop location.
 * Returns box scale wobble and opacity highlight.
 */
export function forkliftApproachEffect(
  elapsed: number,
  isApproaching: boolean,
  amplitude = 0.03,
  frequency = 4.2
): { scaleWobble: number; emissiveIntensity: number; visible: boolean } {
  if (!isApproaching) {
    return { scaleWobble: 0, emissiveIntensity: 0, visible: false }
  }

  const pulse = Math.sin(elapsed * frequency) * 0.5 + 0.5
  const wobble = Math.sin(elapsed * (frequency * 1.5)) * amplitude

  return {
    scaleWobble: wobble,
    emissiveIntensity: pulse * 0.35,
    visible: true,
  }
}

/**
 * Advanced forklift path planning with smooth turns and speed control.
 * Creates a path with waypoints that ensure gentle curves and consistent speed.
 */
export function createAdvancedPath(
  start: Vector3,
  end: Vector3,
  laneZ?: number,
  maxCurveOffset = 3.5,
  speedMultiplier: number = 1.0
): { path: Vector3[]; durations: number[] } {
  const points: Vector3[] = [start.clone()]
  const durations: number[] = []

  // Calculate total distance
  const totalDistance = start.distanceTo(end)

  // Add intermediate waypoints for smooth turns
  if (totalDistance > 1.8) {
    const midX = (start.x + end.x) / 2
    const midZ = laneZ ?? (start.z + end.z) / 2

    // Dynamic curve offset based on distance
    const curveOffset = Math.min(maxCurveOffset, totalDistance * 0.35)

    const dx = end.x - start.x
    const dz = end.z - start.z

    // Smooth curve control point
    const controlPoint = new Vector3(
      midX + (dz > 0 ? curveOffset : -curveOffset),
      0,
      midZ + (dx > 0 ? -curveOffset : curveOffset)
    )

    points.push(controlPoint)

    // Calculate duration for this segment
    const segmentDistance = start.distanceTo(controlPoint)
    const segmentDuration = MathUtils.clamp(
      0.25 + (segmentDistance / 12) * speedMultiplier,
      0.35,
      0.9
    )
    durations.push(segmentDuration)
  }

  // Add final approach point if needed
  if (Math.abs(start.z - end.z) > 0.4) {
    points.push(new Vector3(end.x, 0, laneZ ?? end.z))
    const segmentDistance = points[points.length - 2].distanceTo(points[points.length - 1])
    const segmentDuration = MathUtils.clamp(
      0.2 + (segmentDistance / 10) * speedMultiplier,
      0.25,
      0.6
    )
    durations.push(segmentDuration)
  }

  // Final segment to target
  if (points[points.length - 1].distanceTo(end) > 0.05) {
    points.push(end.clone())
    const segmentDistance = points[points.length - 2].distanceTo(end)
    const segmentDuration = MathUtils.clamp(0.2 + (segmentDistance / 8) * speedMultiplier, 0.2, 0.5)
    durations.push(segmentDuration)
  }

  return { path: points, durations }
}

/**
 * Smooth box pickup interaction: pre-hover effect as forklift approaches.
 * Box gently lifts and pulses before actual pickup.
 */
export function boxPrePickupEffect(
  progress: number,
  baseY: number,
  liftHeight: number
): { y: number; scale: number; emissiveIntensity: number } {
  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))
  // Box lifts slightly and pulses as forklift approaches
  const lift = liftHeight * 0.35 * eased // pre-lift 35% before actual pickup
  const scale = 1 + Math.sin(progress * Math.PI * 2.5) * 0.04
  const emissive = Math.sin(progress * Math.PI * 3) * 0.25

  return {
    y: baseY + lift,
    scale,
    emissiveIntensity: Math.max(0, emissive),
  }
}

/**
 * Smooth box drop interaction: pre-hover effect as forklift approaches placement.
 * Box gently pulses and scales before placement.
 */
export function boxPreDropEffect(
  progress: number,
  baseY: number
): { y: number; scale: number; emissiveIntensity: number } {
  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))
  // Box pulses and expands slightly as forklift approaches placement
  const scale = 1 + Math.sin(eased * Math.PI * 2) * 0.05
  const emissive = Math.sin(eased * Math.PI * 2.5) * 0.3

  return {
    y: baseY,
    scale,
    emissiveIntensity: Math.max(0, emissive),
  }
}

/**
 * Smooth box hover with glow effect during forklift interaction.
 */
export function boxInteractionHover(
  elapsed: number,
  baseY: number,
  isActive: boolean,
  amplitude = 0.15,
  frequency = 3.5,
  scaleAmplitude = 0.08
): { y: number; scale: number; emissiveIntensity: number } {
  if (!isActive) {
    return { y: baseY, scale: 1, emissiveIntensity: 0 }
  }

  const wobble = Math.sin(elapsed * frequency) * amplitude
  const scaleWobble = Math.sin(elapsed * (frequency * 1.3)) * scaleAmplitude
  const glow = Math.sin(elapsed * (frequency * 0.8)) * 0.25 + 0.15

  return {
    y: baseY + wobble,
    scale: 1 + scaleWobble,
    emissiveIntensity: glow,
  }
}

/**
 * Generate a smooth path from start to end with optional lane detour and curve.
 */
export function createSmoothPath(
  start: Vector3,
  end: Vector3,
  laneZ?: number,
  controlOffset = 2.5
): Vector3[] {
  const points = [start.clone()]
  const mid = new Vector3(end.x, 0, laneZ ?? end.z)

  // Add curve control point for smoother turn
  if (start.distanceTo(end) > 1.5) {
    const midPoint = start.clone().lerp(mid, 0.5)
    const offset = new Vector3(
      (end.x - start.x) * (controlOffset / 10),
      0,
      (end.z - start.z) * (controlOffset / 10)
    )
    points.push(midPoint.add(offset))
  }

  if (Math.abs(start.z - end.z) > 0.5) {
    points.push(mid)
  }
  if (points[points.length - 1].distanceTo(end) > 0.05) {
    points.push(end.clone())
  }
  return points
}

/**
 * Smooth progress bar calculation with easing.
 */
export function calculateProgressBar(progress: number): { value: number; eased: number } {
  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))
  return { value: progress, eased }
}

/**
 * Check if a point is within the clickable area of a location.
 */
export function isPointNearLocation(
  point: Vector3,
  location: { x: number; z: number },
  tolerance = 2.5
): boolean {
  const dx = point.x - location.x
  const dz = point.z - location.z
  return Math.sqrt(dx * dx + dz * dz) < tolerance
}

/**
 * Convert screen coordinates to 3D world coordinates on the warehouse floor.
 */
export function screenToWorld(
  x: number,
  y: number,
  camera: Camera,
  planeNormal: Vector3,
  planePoint: Vector3
): Vector3 {
  const vector = new Vector3(x, y, 0.5)
  vector.unproject(camera)
  const dir = vector.sub(camera.position).normalize()
  const distance = -planeNormal.dot(planePoint) / planeNormal.dot(dir)
  const pos = camera.position.clone().add(dir.multiplyScalar(distance))
  return new Vector3(pos.x, 0, pos.z)
}

/**
 * Linear interpolation between two values.
 */
export function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t
}

/**
 * Smooth step interpolation for smoother transitions.
 */
export function smoothStep(start: number, end: number, t: number): number {
  const smoothT = t * t * (3 - 2 * t)
  return start + (end - start) * smoothT
}

/**
 * Distance between two 3D points.
 */
export function distance3D(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Distance between two points on the XZ plane (ignoring Y).
 */
export function distanceXZ(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Normalize a vector to unit length.
 */
export function normalizeVector(v: Vector3): Vector3 {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (mag === 0) return new Vector3(0, 0, 0)
  return new Vector3(v.x / mag, v.y / mag, v.z / mag)
}

/**
 * Calculate angle between two vectors in the XZ plane.
 */
export function angleXZ(a: Vector3, b: Vector3): number {
  const dot = a.x * b.x + a.z * b.z
  const magA = Math.sqrt(a.x * a.x + a.z * a.z)
  const magB = Math.sqrt(b.x * b.x + b.z * b.z)
  if (magA === 0 || magB === 0) return 0
  const cosAngle = dot / (magA * magB)
  return Math.acos(Math.max(-1, Math.min(1, cosAngle)))
}

/**
 * Check if a point is within the warehouse bounds.
 */
export function isWithinWarehouseBounds(
  position: Vector3,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
  return (
    position.x >= bounds.minX &&
    position.x <= bounds.maxX &&
    position.z >= bounds.minZ &&
    position.z <= bounds.maxZ
  )
}

/**
 * Get a random position within warehouse bounds.
 */
export function getRandomPosition(bounds: {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}): Vector3 {
  return new Vector3(
    randomFloat(bounds.minX, bounds.maxX),
    0,
    randomFloat(bounds.minZ, bounds.maxZ)
  )
}

/**
 * Generate a path with waypoints between two points.
 */
export function generatePath(start: Vector3, end: Vector3, steps: number = 10): Vector3[] {
  const path: Vector3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    path.push(new Vector3(lerp(start.x, end.x, t), 0, lerp(start.z, end.z, t)))
  }
  return path
}

/**
 * Quintic ease-in-out for very smooth acceleration/deceleration.
 */
export function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
}

/**
 * Smoothstep with adjustable sharpness for finer control.
 */
export function smoothStepSharp(t: number, sharpness: number = 2): number {
  const clamped = MathUtils.clamp(t, 0, 1)
  const pow = Math.pow(clamped, sharpness)
  return pow / (pow + Math.pow(1 - clamped, sharpness))
}

/**
 * Generate a smooth path with curve control points for natural turns.
 */
export function createCurvedPath(
  start: Vector3,
  end: Vector3,
  laneZ?: number,
  curveOffset = 2.8
): Vector3[] {
  const points = [start.clone()]

  // Calculate mid point with offset for curve
  if (start.distanceTo(end) > 2.0) {
    const midX = (start.x + end.x) / 2
    const midZ = laneZ ?? (start.z + end.z) / 2

    // Offset control point for curve
    const dx = end.x - start.x
    const dz = end.z - start.z
    const offset = Math.sqrt(dx * dx + dz * dz) * (curveOffset / 10)

    const controlPoint = new Vector3(
      midX + (dz > 0 ? offset : -offset),
      0,
      midZ + (dx > 0 ? -offset : offset)
    )

    points.push(controlPoint)
  }

  if (Math.abs(start.z - end.z) > 0.3) {
    points.push(new Vector3(end.x, 0, laneZ ?? end.z))
  }

  if (points[points.length - 1].distanceTo(end) > 0.05) {
    points.push(end.clone())
  }

  return points
}

/**
 * Calculate smooth rotation using shortest path.
 *
 * Rate-limited so large turns take time instead of snapping in a single frame,
 * and eased near the target so the cab settles instead of stopping abruptly.
 */
export function smoothRotateToward(
  current: number,
  target: number,
  maxStep: number,
  _easing: (t: number) => number = easeInOutCubic
): { rotation: number; arrived: boolean } {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  const absDelta = Math.abs(delta)

  if (absDelta <= 0.002) return { rotation: target, arrived: true }

  // Full rate for wide turns, progressively softer as the cab lines up.
  const settle = 0.35 + 0.65 * Math.min(1, absDelta / (Math.PI / 2))
  const step = Math.min(absDelta, maxStep * settle)
  return { rotation: current + Math.sign(delta) * step, arrived: false }
}

/**
 * Add subtle shake effect for impact/stop.
 */
export function shakeEffect(
  elapsed: number,
  intensity: number = 0.03,
  duration: number = 0.15
): number {
  if (elapsed > duration) return 0
  const progress = elapsed / duration
  const attenuation = Math.pow(1 - progress, 3)
  const noise = (Math.random() - 0.5) * 2
  return noise * intensity * attenuation
}

/**
 * Staggered movement: wait then move with easing.
 */
export function staggeredMove(
  progress: number,
  waitTime: number = 0.2,
  moveTime: number = 0.8
): number {
  if (progress < waitTime) return 0
  const moveProgress = (progress - waitTime) / moveTime
  return easeInOutQuint(MathUtils.clamp(moveProgress, 0, 1))
}

/**
 * Enhanced anticipatory slowdown: forklift smoothly decelerates before target.
 * Returns speed multiplier (1.0 = normal, 0.6 = 40% slower near target).
 */
export function anticipatorySlowdown(
  distanceToTarget: number,
  slowZone: number = 2.5,
  minSpeed: number = 0.55
): number {
  if (distanceToTarget > slowZone) return 1.0
  const progress = 1 - distanceToTarget / slowZone
  // Quadratic easing for natural deceleration
  const eased = progress * progress
  return minSpeed + (1 - minSpeed) * eased
}

/**
 * Smooth box carry wobble with rotation for realism.
 */
export function boxCarryWobble(
  elapsed: number,
  isMoving: boolean,
  baseY: number,
  amplitude: number = 0.06,
  frequency: number = 2.2,
  rotationAmplitude: number = 0.015
): { y: number; rotationX: number; rotationZ: number; scale: number } {
  if (!isMoving) {
    return { y: baseY, rotationX: 0, rotationZ: 0, scale: 1 }
  }

  const wobbleY = Math.sin(elapsed * frequency) * amplitude
  const wobbleX = Math.sin(elapsed * 1.8) * rotationAmplitude
  const wobbleZ = Math.cos(elapsed * 2.4) * rotationAmplitude
  const scalePulse = Math.sin(elapsed * 3.2) * 0.02

  return {
    y: baseY + wobbleY,
    rotationX: wobbleX,
    rotationZ: wobbleZ,
    scale: 1 + scalePulse,
  }
}

/**
 * Pickup zone expansion effect: smooth pulse when forklift is approaching.
 */
export function pickupZonePulse(
  elapsed: number,
  progress: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.45,
  frequency: number = 2.8
): { radius: number; opacity: number; scale: number; glow: number } {
  const t = MathUtils.clamp(progress, 0, 1)

  // Smooth expansion with easeOutBack
  const expansionProgress =
    t < 0.5
      ? (2 * t * t * (2.5 * t - 0.5)) / 2
      : 1 - (2 * (1 - t) * (1 - t) * (2.5 * (1 - t) - 0.5)) / 2

  const pulse = Math.sin(elapsed * frequency) * 0.5 + 0.5
  const radius = baseRadius + (maxRadius - baseRadius) * expansionProgress * (1 + pulse * 0.3)
  const opacity = 0.6 * expansionProgress + 0.25 * pulse * (1 - expansionProgress * 0.4)
  const scale = 1 + Math.sin(elapsed * (frequency * 1.3)) * 0.04 * expansionProgress
  const glow = Math.max(0, 0.25 + Math.sin(elapsed * (frequency * 0.9)) * 0.2) * expansionProgress

  return { radius, opacity, scale, glow }
}

/**
 * Drop zone glow ring: smooth pulsing effect when box is being placed.
 */
export function dropZoneRing(
  elapsed: number,
  progress: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.45,
  frequency: number = 3.2
): { radius: number; opacity: number; scale: number; glow: number } {
  const t = MathUtils.clamp(progress, 0, 1)

  // Smooth pulse with easeInOutSine
  const pulseProgress = (1 - Math.cos(t * Math.PI)) / 2
  const pulse = Math.sin(elapsed * frequency) * 0.5 + 0.5

  const radius = baseRadius + (maxRadius - baseRadius) * pulseProgress * (1 + pulse * 0.35)
  const opacity = 0.7 * pulseProgress + 0.2 * pulse * (1 - pulseProgress * 0.5)
  const scale = 1 + Math.sin(elapsed * (frequency * 1.5)) * 0.05 * pulseProgress
  const glow = Math.max(0, 0.3 + Math.sin(elapsed * (frequency * 0.7)) * 0.25) * pulseProgress

  return { radius, opacity, scale, glow }
}

/**
 * Box hover glow: emissive highlight when user hovers over idle box.
 */
export function boxHoverGlow(
  elapsed: number,
  isHovered: boolean,
  baseIntensity: number = 0.18,
  pulseFrequency: number = 2.5
): { emissiveIntensity: number; scaleWobble: number } {
  if (!isHovered) {
    return { emissiveIntensity: 0, scaleWobble: 0 }
  }

  const pulse = Math.sin(elapsed * pulseFrequency) * 0.5 + 0.5
  const intensity = baseIntensity + pulse * 0.22
  const scaleWobble = Math.sin(elapsed * (pulseFrequency * 1.4)) * 0.035

  return { emissiveIntensity: intensity, scaleWobble }
}

/**
 * Forklift approach glow: box glows brighter as forklift approaches pickup point.
 */
export function forkliftApproachGlow(
  progress: number,
  isActive: boolean,
  baseIntensity: number = 0.25,
  maxIntensity: number = 0.55
): { emissiveIntensity: number; visible: boolean } {
  if (!isActive) {
    return { emissiveIntensity: 0, visible: false }
  }

  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))
  const intensity = baseIntensity + (maxIntensity - baseIntensity) * eased

  return { emissiveIntensity: intensity, visible: true }
}

/**
 * Smooth carriage lift interpolation with velocity limiting for natural feel.
 */
export function smoothLiftInterpolation(
  current: number,
  target: number,
  dt: number,
  speed: number = 3.5,
  _acceleration: number = 6
): number {
  const diff = target - current
  const absDiff = Math.abs(diff)

  if (absDiff < 0.001) return target

  // Acceleration curve based on distance
  const maxStep = dt * speed * (1 + absDiff * 0.5)

  const step = Math.min(absDiff, maxStep)
  return current + Math.sign(diff) * step
}

/**
 * Collision proximity warning: boxes gently shake when forklift passes nearby.
 */
export function collisionWarningShake(
  distanceToForklift: number,
  threshold: number = 2.2,
  maxShake: number = 0.025,
  maxScale: number = 1.08
): { shakeX: number; shakeZ: number; scale: number; visible: boolean } {
  if (distanceToForklift > threshold) {
    return { shakeX: 0, shakeZ: 0, scale: 1, visible: false }
  }

  const progress = 1 - distanceToForklift / threshold
  const intensity = maxShake * progress * progress
  const scale = 1 + (maxScale - 1) * progress * progress

  // Add subtle noise for realistic shake
  const noiseX = (Math.random() - 0.5) * 2 * intensity
  const noiseZ = (Math.random() - 0.5) * 2 * intensity

  return {
    shakeX: noiseX,
    shakeZ: noiseZ,
    scale,
    visible: true,
  }
}

/**
 * Check if two bounding boxes intersect (XZ plane only).
 */
export function boundingBoxesIntersect(
  a: { x: number; z: number; size: number },
  b: { x: number; z: number; size: number }
): boolean {
  const halfSizeA = a.size / 2
  const halfSizeB = b.size / 2
  return Math.abs(a.x - b.x) < halfSizeA + halfSizeB && Math.abs(a.z - b.z) < halfSizeA + halfSizeB
}

/**
 * Find the nearest warehouse location from a position.
 */
export function findNearestLocation(
  position: Vector3,
  locations: Array<{ x: number; z: number; size: number }>
): { location: { x: number; z: number; size: number }; distance: number } | null {
  let nearest: { location: { x: number; z: number; size: number }; distance: number } | null = null
  let minDistance = Infinity

  for (const location of locations) {
    const dist = distanceXZ(position, new Vector3(location.x, 0, location.z))
    if (dist < minDistance) {
      minDistance = dist
      nearest = { location, distance: dist }
    }
  }

  return nearest
}

/**
 * Smooth sinusoidal easing with customizable phases for fluid animations.
 */
export function smoothSinusoidalEase(t: number, phase: number = 0): number {
  return (Math.sin(t * Math.PI - phase + Math.PI / 2) + 1) / 2
}

/**
 * Bezier-style easing for natural motion with adjustable sharpness.
 */
export function bezierEase(t: number, p1: number = 0.4, p2: number = 0.8): number {
  const t2 = t * t
  const t3 = t2 * t
  return 3 * p1 * t2 * (1 - t) + 3 * p2 * t3 * (1 - t) + t3
}

/**
 * Smooth box hover effect with multiple sine waves for organic movement.
 */
export function boxOrganicHover(
  elapsed: number,
  baseY: number,
  isHovered: boolean,
  amplitude: number = 0.1,
  baseFreq: number = 2.5,
  harmonyFreq: number = 3.7
): { y: number; scale: number; rotation: number; emissiveIntensity: number } {
  if (!isHovered) {
    return { y: baseY, scale: 1, rotation: 0, emissiveIntensity: 0 }
  }

  const wobble1 = Math.sin(elapsed * baseFreq) * amplitude * 0.7
  const wobble2 = Math.sin(elapsed * harmonyFreq) * amplitude * 0.3
  const y = baseY + wobble1 + wobble2
  const scale = 1 + Math.sin(elapsed * (baseFreq * 0.8)) * 0.05
  const rotation = Math.sin(elapsed * 1.5) * 0.02 + Math.cos(elapsed * 2.3) * 0.015
  const emissive = Math.sin(elapsed * 3.2) * 0.15 + 0.2

  return {
    y,
    scale,
    rotation,
    emissiveIntensity: Math.max(0, emissive),
  }
}

/**
 * Forklift smooth approach effect with anticipation bounce.
 */
export function forkliftApproachBounce(
  progress: number,
  amplitude: number = 0.02,
  _frequency: number = 5.5
): { yOffset: number; scale: number; emissive: number } {
  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))
  // Small anticipation bounce before movement
  const bounce = Math.sin(eased * Math.PI * 2) * amplitude * 0.6
  const scale = 1 + Math.sin(eased * Math.PI * 3) * 0.03
  const emissive = Math.sin(eased * Math.PI * 4) * 0.25 + 0.15

  return {
    yOffset: bounce,
    scale,
    emissive,
  }
}

/**
 * Smooth box placement with alignment feedback.
 */
export function boxPlacementFeedback(
  progress: number,
  baseY: number,
  liftHeight: number,
  isAligning: boolean
): { y: number; zOffset: number; scale: number; rotation: number } {
  const eased = easeInOutQuint(MathUtils.clamp(progress, 0, 1))

  let y = baseY + liftHeight * (1 - eased)
  const zOffset = 0.35 * (1 - eased)
  let scale = 1
  let rotation = 0

  if (isAligning && eased > 0.7) {
    // Gentle alignment wobble
    const alignProgress = (eased - 0.7) / 0.3
    y += Math.sin(alignProgress * Math.PI * 4) * 0.015
    scale = 1 + Math.sin(alignProgress * Math.PI * 2) * 0.02
    rotation = Math.sin(alignProgress * Math.PI * 3) * 0.025
  }

  return { y, zOffset, scale, rotation }
}

/**
 * Soft collision effect for gentle stops and starts.
 */
export function softCollisionEffect(
  elapsed: number,
  duration: number = 0.12,
  intensity: number = 0.025
): number {
  if (elapsed > duration) return 0
  const progress = elapsed / duration
  const attenuation = Math.pow(1 - progress, 4)
  const shake = (Math.random() - 0.5) * 2
  return shake * intensity * attenuation
}

/**
 * Multi-stage easing for complex animations with pauses.
 */
export function multiStageEase(
  progress: number,
  stages: number = 3,
  easeIn: number = 0.25,
  easeOut: number = 0.75
): number {
  if (stages <= 1) return easeInOutCubic(MathUtils.clamp(progress, 0, 1))

  const segment = 1 / stages
  const segmentIndex = Math.floor(progress * stages)
  const segmentProgress = (progress - segmentIndex * segment) / segment

  let eased: number
  if (segmentProgress < easeIn) {
    eased = Math.pow(segmentProgress / easeIn, 3)
  } else if (segmentProgress < easeOut) {
    eased = 1 - Math.pow((1 - segmentProgress) / (easeOut - easeIn), 3)
  } else {
    eased = 1 - Math.pow((1 - segmentProgress) / (1 - easeOut), 3)
  }

  return (segmentIndex + eased) / stages
}

/**
 * Box carry effect during forklift transport.
 */
export function boxCarryEffect(
  elapsed: number,
  isMoving: boolean,
  baseY: number,
  amplitude: number = 0.04,
  frequency: number = 2.2
): { y: number; scale: number; rotationX: number; rotationZ: number; emissiveIntensity: number } {
  if (!isMoving) {
    return { y: baseY, scale: 1, rotationX: 0, rotationZ: 0, emissiveIntensity: 0 }
  }

  const wobbleY = Math.sin(elapsed * frequency) * amplitude
  const wobbleScale = Math.sin(elapsed * (frequency * 0.7)) * 0.02
  const rotationX = Math.sin(elapsed * 1.8) * 0.015
  const rotationZ = Math.cos(elapsed * 2.4) * 0.018

  return {
    y: baseY + wobbleY,
    scale: 1 + wobbleScale,
    rotationX,
    rotationZ,
    emissiveIntensity: 0.22,
  }
}

/**
 * Pickup zone highlight with expanding pulse ring.
 */
export function pickupZoneHighlight(
  elapsed: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.37,
  frequency: number = 2.8,
  opacityBase: number = 0.6,
  opacityPeak: number = 0.9
): { radius: number; opacity: number; scale: number } {
  const pulse = Math.sin(elapsed * frequency * Math.PI * 2)
  const radius = baseRadius + (maxRadius - baseRadius) * 0.3 * (1 + pulse * 0.5)
  const opacity =
    opacityBase + (opacityPeak - opacityBase) * Math.max(0, (1 - Math.abs(pulse)) * 0.7)
  const scale = 1 + Math.sin(elapsed * frequency * 1.5) * 0.08

  return { radius, opacity, scale }
}

/**
 * Drop zone indicator with smooth transition glow.
 */
export function dropZoneIndicator(
  progress: number,
  elapsed: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.37,
  frequency: number = 3.2
): { radius: number; opacity: number; scale: number; glow: number } {
  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))
  const pulse = Math.sin(elapsed * frequency) * 0.5 + 0.5

  const radius =
    baseRadius + (maxRadius - baseRadius) * 0.35 * (1 + Math.sin(elapsed * (frequency * 0.7)) * 0.4)
  const opacity = 0.5 + 0.4 * eased + 0.25 * pulse * (1 - eased)
  const scale = 1 + Math.sin(elapsed * (frequency * 1.3)) * 0.06
  const glow = Math.max(0, 0.25 + Math.sin(elapsed * (frequency * 0.9)) * 0.15)

  return { radius, opacity, scale, glow }
}

/**
 * Forklift anticipatory slowdown - slows down 30% when within 1.5m of target
 * Returns adjusted speed multiplier (0.7 when approaching, 1.0 otherwise).
 */
export function forkliftAnticipatorySlowdown(
  distanceToTarget: number,
  threshold: number = 1.5,
  minSpeed: number = 0.7
): number {
  if (distanceToTarget > threshold) return 1.0
  // Linear interpolation from threshold to 0
  const progress = 1 - distanceToTarget / threshold
  return minSpeed + (1 - minSpeed) * progress
}

/**
 * Forklift body roll effect - body tilts during turns for realism
 * Returns tilt amount in radians based on turn sharpness and speed.
 */
export function forkliftBodyRoll(
  currentRotation: number,
  targetRotation: number,
  speed: number,
  maxRoll: number = 0.08,
  timeConstant: number = 0.15
): number {
  // Calculate rotation delta (shortest path)
  const delta = Math.atan2(
    Math.sin(targetRotation - currentRotation),
    Math.cos(targetRotation - currentRotation)
  )
  const absDelta = Math.abs(delta)

  // Faster turns = more roll, but only when turning significantly
  if (absDelta < 0.02) return 0

  // Smoothly interpolate toward roll target
  const rollTarget = -delta * maxRoll * Math.min(1, speed * 0.8)

  // Apply smoothing using lerp with time constant
  const rollDiff = rollTarget
  return rollDiff * timeConstant
}

/**
 * Smooth fork lift transition - smooth acceleration/deceleration for carriage movement
 * Returns eased progress for natural lift motion.
 */
export function smoothForkLiftTransition(
  progress: number,
  _liftTime: number = 0.4,
  easeType: 'easeIn' | 'easeOut' | 'easeInOut' = 'easeInOut'
): number {
  const clamped = MathUtils.clamp(progress, 0, 1)

  switch (easeType) {
    case 'easeIn':
      // Faster start, slower end
      return clamped * clamped * (3 - 2 * clamped)
    case 'easeOut':
      // Slower start, faster end
      return 1 - Math.pow(1 - clamped, 3)
    case 'easeInOut':
    default:
      // Smooth both ends
      return clamped * clamped * clamped * (clamped * (6 * clamped - 15) + 10)
  }
}

/**
 * Box pickup alignment - guides box into forks with visual feedback
 * Returns alignment progress and visual effect values.
 */
export function boxPickupAlignment(
  progress: number,
  elapsed: number,
  baseY: number,
  liftHeight: number,
  isActive: boolean
): { y: number; zOffset: number; scale: number; rotation: number; glow: number } {
  if (!isActive) {
    return { y: baseY, zOffset: 0, scale: 1, rotation: 0, glow: 0 }
  }

  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))

  // Smoothly transition to lift height
  const y = baseY + liftHeight * eased
  const zOffset = 0.35 * (1 - eased)
  const scale = 1 + Math.sin(elapsed * 4.5) * 0.03 * eased
  const rotation = Math.sin(elapsed * 2.8) * 0.015 * eased
  const glow = Math.max(0, 0.25 + Math.sin(elapsed * 3.2) * 0.2) * eased

  return { y, zOffset, scale, rotation, glow }
}

/**
 * Drop zone alignment feedback - visual cue when box is being placed
 * Returns visual effect progress for smooth placement.
 */
export function dropZoneAlignmentFeedback(
  progress: number,
  elapsed: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.45
): { radius: number; opacity: number; scale: number; glow: number; zOffset: number } {
  const eased = easeInOutQuint(MathUtils.clamp(progress, 0, 1))
  const pulse = Math.sin(elapsed * 4.2) * 0.5 + 0.5

  const radius = baseRadius + (maxRadius - baseRadius) * 0.4 * (1 + Math.sin(elapsed * 2.8) * 0.3)
  const opacity = 0.7 * eased + 0.25 * pulse * (1 - eased)
  const scale = 1 + Math.sin(elapsed * 3.5) * 0.05 * eased
  const glow = Math.max(0, 0.3 + Math.sin(elapsed * 2.1) * 0.2) * eased
  const zOffset = 0.35 * (1 - eased)

  return { radius, opacity, scale, glow, zOffset }
}

/**
 * Forklift approach anticipation - body bounces slightly before movement starts
 * Returns anticipation offset for natural start motion.
 */
export function forkliftApproachAnticipation(
  progress: number,
  amplitude: number = 0.02,
  _frequency: number = 6.5
): number {
  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))
  // Anticipation bounce before movement
  if (eased < 0.15) {
    return Math.sin((eased * Math.PI * 2) / 0.15) * amplitude * 0.8
  }
  return 0
}

/**
 * Smooth box wobble during carry - organic movement while transporting
 * Returns wobble values for realistic box movement on forks.
 */
export function smoothBoxCarryWobble(
  elapsed: number,
  isMoving: boolean,
  baseY: number,
  baseAmplitude: number = 0.05,
  frequency: number = 2.4
): { y: number; rotationX: number; rotationZ: number; scale: number } {
  if (!isMoving) {
    return { y: baseY, rotationX: 0, rotationZ: 0, scale: 1 }
  }

  // Multi-frequency sine waves for organic movement
  const wobbleY =
    Math.sin(elapsed * frequency) * baseAmplitude * 0.7 +
    Math.sin(elapsed * (frequency * 0.8)) * baseAmplitude * 0.3

  const wobbleX = Math.sin(elapsed * 1.6) * 0.012
  const wobbleZ = Math.cos(elapsed * 2.2) * 0.014

  const scalePulse = Math.sin(elapsed * 3.8) * 0.025

  return {
    y: baseY + wobbleY,
    rotationX: wobbleX,
    rotationZ: wobbleZ,
    scale: 1 + scalePulse,
  }
}

/**
 * Box anticipation effect - gentle lift and pulse as forklift approaches
 */
export function boxAnticipationEffect(
  progress: number,
  baseY: number,
  isForkliftApproaching: boolean,
  amplitude: number = 0.06,
  frequency: number = 4.5
): { y: number; scale: number; emissiveIntensity: number } {
  if (!isForkliftApproaching) {
    return { y: baseY, scale: 1, emissiveIntensity: 0 }
  }

  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))
  const wobble = Math.sin(progress * frequency) * amplitude * eased
  const scale = 1 + Math.sin(progress * (frequency * 1.8)) * 0.03 * eased
  const emissive = Math.sin(progress * (frequency * 2.2)) * 0.2 * eased + 0.15 * eased

  return {
    y: baseY + wobble,
    scale,
    emissiveIntensity: emissive,
  }
}

/**
 * Enhanced box carry effect with smoother wobble using lerp
 */
export function boxCarryEffectSmooth(
  elapsed: number,
  isMoving: boolean,
  baseY: number,
  amplitude: number = 0.05,
  frequency: number = 2.5,
  scaleAmplitude: number = 0.03
): { y: number; scale: number; rotationX: number; rotationZ: number; emissiveIntensity: number } {
  if (!isMoving) {
    return { y: baseY, scale: 1, rotationX: 0, rotationZ: 0, emissiveIntensity: 0 }
  }

  const wobbleY = Math.sin(elapsed * frequency) * amplitude
  const wobbleScale = Math.sin(elapsed * (frequency * 0.8)) * scaleAmplitude
  const rotationX = Math.sin(elapsed * 2.0) * 0.012
  const rotationZ = Math.cos(elapsed * 2.6) * 0.014

  return {
    y: baseY + wobbleY,
    scale: 1 + wobbleScale,
    rotationX,
    rotationZ,
    emissiveIntensity: 0.28,
  }
}

/**
 * Forklift delivery spotlight - creates directional light跟着 forklift saat delivering
 */
export function forkliftSpotlightEffect(
  progress: number,
  isActive: boolean,
  baseIntensity: number = 1.2,
  maxDistance: number = 8,
  angle: number = Math.PI / 6
): { intensity: number; distance: number; angle: number; visible: boolean } {
  if (!isActive) {
    return { intensity: 0, distance: 1, angle: Math.PI / 3, visible: false }
  }

  const eased = easeInOutCubic(MathUtils.clamp(progress, 0, 1))
  return {
    intensity: baseIntensity * eased,
    distance: maxDistance * (0.6 + 0.4 * eased),
    angle,
    visible: true,
  }
}

/**
 * Smoother glow transition using MathUtils.lerp
 */
export function smoothGlowTransition(
  current: number,
  target: number,
  dt: number,
  speed: number = 4
): number {
  return MathUtils.lerp(current, target, dt * speed)
}

/**
 * Subtle body bobbing when moving - adds realism to forklift movement
 */
export function forkliftMovingBob(
  elapsed: number,
  isMoving: boolean,
  amplitude: number = 0.008,
  frequency: number = 8
): number {
  if (!isMoving) return 0
  return Math.sin(elapsed * frequency) * amplitude
}

/**
 * Collision proximity warning - box gently shakes when forklift passes nearby
 */
export function collisionProximityShake(
  distanceToForklift: number,
  threshold: number = 1.8,
  maxIntensity: number = 0.02
): { shakeX: number; shakeZ: number; intensity: number; visible: boolean } {
  if (distanceToForklift > threshold) {
    return { shakeX: 0, shakeZ: 0, intensity: 0, visible: false }
  }

  const progress = 1 - distanceToForklift / threshold
  const intensity = maxIntensity * progress * progress
  const noiseX = (Math.random() - 0.5) * 2 * intensity
  const noiseZ = (Math.random() - 0.5) * 2 * intensity

  return {
    shakeX: noiseX,
    shakeZ: noiseZ,
    intensity,
    visible: true,
  }
}

/**
 * Pickup/drop zone smooth expansion with easeOutBack
 */
export function smoothZoneExpansion(
  progress: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.37,
  frequency: number = 3,
  easeOutBackFactor: number = 1.5
): { radius: number; opacity: number; scale: number } {
  // Use easeOutBack for that smooth "overshoot and settle" effect
  const t = MathUtils.clamp(progress, 0, 1)
  const s = easeOutBackFactor
  const eased =
    t < 0.5
      ? (2 * t * t * ((s + 1) * 2 * t - s)) / 2
      : 1 - (2 * (1 - t) * (1 - t) * ((s + 1) * 2 * (1 - t) - s)) / 2

  const pulse = Math.sin(progress * Math.PI * 2 * frequency) * 0.5 + 0.5
  const radius = baseRadius + (maxRadius - baseRadius) * 0.35 * (1 + pulse * 0.6) * eased
  const opacity = 0.4 * eased + 0.2 * pulse * (1 - eased * 0.3)
  const scale = 1 + Math.sin(progress * Math.PI * 3 * frequency) * 0.05 * eased

  return { radius, opacity, scale }
}

/**
 * Enhanced delivery ring with smooth pulsing
 */
export function enhancedDeliveryRing(
  elapsed: number,
  progress: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.37,
  frequency: number = 3.5
): { radius: number; opacity: number; scale: number; glow: number } {
  const t = MathUtils.clamp(progress, 0, 1)

  // Smooth ring expansion with easeOutQuart
  const ringProgress = t < 0.5 ? 8 * t * t * t * t : 1 - 8 * Math.pow(1 - t, 4)

  const pulse = Math.sin(elapsed * frequency) * 0.5 + 0.5
  const radius = baseRadius + (maxRadius - baseRadius) * 0.35 * ringProgress * (1 + pulse * 0.4)
  const opacity = 0.5 * ringProgress + 0.25 * pulse * (1 - ringProgress * 0.4)
  const scale = 1 + Math.sin(elapsed * (frequency * 1.4)) * 0.07 * ringProgress
  const glow = Math.max(0, 0.2 + Math.sin(elapsed * (frequency * 0.85)) * 0.18) * ringProgress

  return { radius, opacity, scale, glow }
}

/**
 * Smooth box hover with hover effect as forklift approaches
 */
export function boxHoverWithProximity(
  elapsed: number,
  baseY: number,
  distanceToForklift: number,
  threshold: number = 2.0,
  amplitude: number = 0.1,
  frequency: number = 2.8
): { y: number; scale: number; emissiveIntensity: number } {
  const isApproaching = distanceToForklift < threshold
  const progress = MathUtils.clamp(1 - distanceToForklift / threshold, 0, 1)

  const wobble = Math.sin(elapsed * frequency) * amplitude * (0.5 + 0.5 * progress)
  const scale = 1 + Math.sin(elapsed * (frequency * 1.3)) * 0.03 * progress
  const emissive = Math.max(0, 0.15 + Math.sin(elapsed * (frequency * 0.9)) * 0.15 * progress)

  return {
    y: baseY + wobble,
    scale,
    emissiveIntensity: isApproaching ? emissive : 0,
  }
}

/**
 * Forklift idle breathing effect - smooth gentle movement when parked
 */
export function forkliftIdleBreath(
  elapsed: number,
  amplitude: number = 0.006,
  frequency: number = 1.5
): number {
  return Math.sin(elapsed * frequency) * amplitude
}

/**
 * Smooth box placement feedback - visual cues when box is being positioned
 */
export function boxPlacementFeedbackEnhanced(
  progress: number,
  baseY: number,
  liftHeight: number,
  isPlacing: boolean
): { y: number; zOffset: number; scale: number; rotation: number; glow: number } {
  const eased = easeInOutQuint(MathUtils.clamp(progress, 0, 1))

  let y = baseY + liftHeight * (1 - eased)
  const zOffset = 0.35 * (1 - eased)
  let scale = 1
  let rotation = 0
  let glow = 0

  if (isPlacing) {
    // Alignment phase - subtle adjustments
    if (eased > 0.6) {
      const alignProgress = (eased - 0.6) / 0.4
      y += Math.sin(alignProgress * Math.PI * 6) * 0.01
      scale = 1 + Math.sin(alignProgress * Math.PI * 3) * 0.02
      rotation = Math.sin(alignProgress * Math.PI * 4) * 0.015
      glow = Math.max(0, Math.sin(alignProgress * Math.PI * 2) * 0.3)
    }
  }

  return { y, zOffset, scale, rotation, glow }
}

/**
 * Path trail effect - fading line showing recent forklift movement
 */
export function createTrailEffect(
  _elapsed: number,
  position: Vector3,
  maxPoints: number = 20,
  _pointSize: number = 0.08
): { positions: Vector3[]; colors: string[]; opacities: number[] } {
  // Store positions in a circular buffer
  const positions: Vector3[] = []
  const colors: string[] = []
  const opacities: number[] = []

  for (let i = 0; i < maxPoints; i++) {
    const opacity = (maxPoints - i) / maxPoints

    if (opacity > 0.05) {
      positions.push(position.clone())
      colors.push('#f6c445')
      opacities.push(opacity)
    }
  }

  return { positions, colors, opacities }
}

/**
 * Delivery completion celebration - brief ring expansion
 */
export function deliveryCompleteEffect(
  elapsed: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.5,
  duration: number = 0.6
): { radius: number; opacity: number; scale: number; visible: boolean } {
  if (elapsed > duration) {
    return { radius: baseRadius, opacity: 0, scale: 1, visible: false }
  }

  const progress = elapsed / duration
  const pulse = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5

  const radius = baseRadius + (maxRadius - baseRadius) * progress * (1 + pulse * 0.3)
  const opacity = 0.8 * (1 - progress) + 0.25 * pulse * progress
  const scale = 1 + Math.sin(progress * Math.PI * 3) * 0.1

  return { radius, opacity, scale, visible: true }
}

/**
 * Forklift approach anticipation - box pre-lift before pickup
 */
export function boxApproachAnticipation(
  progress: number,
  baseY: number,
  liftHeight: number
): { y: number; scale: number; emissiveIntensity: number } {
  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))

  // Box lifts slightly and pulses as forklift approaches
  const lift = liftHeight * 0.25 * eased
  const scale = 1 + Math.sin(progress * Math.PI * 3) * 0.04
  const emissive = Math.sin(progress * Math.PI * 2.5) * 0.3

  return {
    y: baseY + lift,
    scale,
    emissiveIntensity: Math.max(0, emissive),
  }
}

/**
 * Smooth box carry with reduced wobble for stability
 */
export function boxCarryStable(
  elapsed: number,
  isMoving: boolean,
  baseY: number,
  amplitude: number = 0.03,
  frequency: number = 2.5,
  scaleAmplitude: number = 0.02
): { y: number; scale: number; rotationX: number; rotationZ: number; emissiveIntensity: number } {
  if (!isMoving) {
    return { y: baseY, scale: 1, rotationX: 0, rotationZ: 0, emissiveIntensity: 0 }
  }

  const wobbleY = Math.sin(elapsed * frequency) * amplitude
  const wobbleScale = Math.sin(elapsed * (frequency * 0.9)) * scaleAmplitude
  const rotationX = Math.sin(elapsed * 1.6) * 0.008
  const rotationZ = Math.cos(elapsed * 2.2) * 0.01

  return {
    y: baseY + wobbleY,
    scale: 1 + wobbleScale,
    rotationX,
    rotationZ,
    emissiveIntensity: 0.32,
  }
}

/**
 * Enhanced forklift approach anticipation - smooth box pre-lift with pulse
 */
export function enhancedForkliftApproachAnticipation(
  progress: number,
  baseY: number,
  liftHeight: number,
  _amplitude: number = 0.08,
  _frequency: number = 5.5
): { y: number; scale: number; emissiveIntensity: number } {
  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))

  // Box gently lifts and pulses as forklift approaches
  const lift = liftHeight * 0.4 * eased
  const scale = 1 + Math.sin(progress * Math.PI * 3.5) * 0.05
  const emissive = Math.sin(progress * Math.PI * 3) * 0.35 + 0.2

  return {
    y: baseY + lift,
    scale,
    emissiveIntensity: Math.max(0, emissive),
  }
}

/**
 * Smooth box placement with alignment feedback
 */
export function boxPlacementWithFeedback(
  progress: number,
  baseY: number,
  liftHeight: number,
  isPlacing: boolean
): { y: number; zOffset: number; scale: number; rotation: number; glow: number } {
  const eased = easeInOutQuint(MathUtils.clamp(progress, 0, 1))

  let y = baseY + liftHeight * (1 - eased)
  const zOffset = 0.35 * (1 - eased)
  let scale = 1
  let rotation = 0
  let glow = 0

  if (isPlacing && eased > 0.6) {
    // Alignment phase - subtle adjustments
    const alignProgress = (eased - 0.6) / 0.4
    y += Math.sin(alignProgress * Math.PI * 6) * 0.01
    scale = 1 + Math.sin(alignProgress * Math.PI * 3) * 0.02
    rotation = Math.sin(alignProgress * Math.PI * 4) * 0.015
    glow = Math.max(0, Math.sin(alignProgress * Math.PI * 2) * 0.3)
  }

  return { y, zOffset, scale, rotation, glow }
}

/**
 * Delivery completion effect - smooth celebration pulse
 */
export function deliveryCelebration(
  elapsed: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.5,
  duration: number = 0.8
): { radius: number; opacity: number; scale: number; visible: boolean } {
  if (elapsed > duration) {
    return { radius: baseRadius, opacity: 0, scale: 1, visible: false }
  }

  const progress = elapsed / duration
  const pulse = Math.sin(progress * Math.PI * 5) * 0.5 + 0.5

  const radius = baseRadius + (maxRadius - baseRadius) * progress * (1 + pulse * 0.35)
  const opacity = 0.85 * (1 - progress) + 0.25 * pulse * progress
  const scale = 1 + Math.sin(progress * Math.PI * 3.5) * 0.12

  return { radius, opacity, scale, visible: true }
}

/**
 * Smooth box hover with proximity-based glow
 */
export function boxHoverWithProximityGlow(
  elapsed: number,
  baseY: number,
  distanceToForklift: number,
  threshold: number = 2.0,
  amplitude: number = 0.12,
  frequency: number = 3.2
): { y: number; scale: number; emissiveIntensity: number } {
  const isApproaching = distanceToForklift < threshold
  const progress = MathUtils.clamp(1 - distanceToForklift / threshold, 0, 1)

  const wobble = Math.sin(elapsed * frequency) * amplitude * (0.5 + 0.5 * progress)
  const scale = 1 + Math.sin(elapsed * (frequency * 1.4)) * 0.04 * progress
  const emissive = Math.max(0, 0.18 + Math.sin(elapsed * (frequency * 1.0)) * 0.2 * progress)

  return {
    y: baseY + wobble,
    scale,
    emissiveIntensity: isApproaching ? emissive : 0,
  }
}

/**
 * Forklift movement trail effect - fading path behind forklift
 */
export function createMovementTrail(
  _elapsed: number,
  position: Vector3,
  maxPoints: number = 25,
  _pointSize: number = 0.1
): { positions: Vector3[]; colors: string[]; opacities: number[] } {
  const positions: Vector3[] = []
  const colors: string[] = []
  const opacities: number[] = []

  for (let i = 0; i < maxPoints; i++) {
    const opacity = Math.pow((maxPoints - i) / maxPoints, 1.8)

    if (opacity > 0.03) {
      positions.push(position.clone())
      colors.push('#f6c445')
      opacities.push(opacity)
    }
  }

  return { positions, colors, opacities }
}

/**
 * Smooth box pickup interaction - pre-hover effect with anticipation
 */
export function boxPickupInteraction(
  progress: number,
  baseY: number,
  liftHeight: number,
  isPickingUp: boolean
): { y: number; zOffset: number; rotation: number; opacity: number } {
  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))

  let y = baseY
  let zOffset = 0
  let rotation = 0
  let opacity = 1

  if (isPickingUp) {
    // Lift phase
    y = baseY + liftHeight * eased
    zOffset = -0.35 * eased // slide out before lifting
    rotation = Math.sin(eased * Math.PI * 0.8) * 0.06
    opacity = 1
  }

  return { y, zOffset, rotation, opacity }
}

/**
 * Smooth box drop interaction - approach anticipation + placement
 */
export function boxDropInteraction(
  progress: number,
  baseY: number,
  liftHeight: number,
  isDropping: boolean
): { y: number; zOffset: number; scale: number; rotation: number; opacity: number } {
  const eased = easeInOutQuint(MathUtils.clamp(progress, 0, 1))

  let y = baseY
  let zOffset = 0
  let scale = 1
  let rotation = 0
  let opacity = 1

  if (isDropping) {
    // Placement phase
    y = baseY + liftHeight * (1 - eased)
    zOffset = 0.35 * (1 - eased) // slide in while lowering
    scale = 1 + Math.sin(eased * Math.PI * 2.5) * 0.04
    rotation = Math.sin(eased * Math.PI * 3) * 0.03
    opacity = eased < 0.4 ? 0 : eased < 0.7 ? (eased - 0.4) / 0.3 : 1
  }

  return { y, zOffset, scale, rotation, opacity }
}

/**
 * Enhanced delivery ring with smooth pulsing and expansion
 */
export function enhancedDeliveryRingPulse(
  elapsed: number,
  progress: number,
  baseRadius: number = 1.25,
  maxRadius: number = 1.45,
  frequency: number = 3.5
): { radius: number; opacity: number; scale: number; glow: number } {
  const t = MathUtils.clamp(progress, 0, 1)

  // Smooth expansion with easeOutBack
  const expansionProgress =
    t < 0.5
      ? (2 * t * t * (2.5 * t - 0.5)) / 2
      : 1 - (2 * (1 - t) * (1 - t) * (2.5 * (1 - t) - 0.5)) / 2

  const pulse = Math.sin(elapsed * frequency) * 0.5 + 0.5
  const radius = baseRadius + (maxRadius - baseRadius) * expansionProgress * (1 + pulse * 0.35)
  const opacity = 0.65 * expansionProgress + 0.25 * pulse * (1 - expansionProgress * 0.4)
  const scale = 1 + Math.sin(elapsed * (frequency * 1.4)) * 0.06 * expansionProgress
  const glow = Math.max(0, 0.28 + Math.sin(elapsed * (frequency * 0.85)) * 0.2) * expansionProgress

  return { radius, opacity, scale, glow }
}

/**
 * Smooth box hover with organic multi-frequency wobble
 */
export function boxOrganicHoverWithGlow(
  elapsed: number,
  baseY: number,
  isHovered: boolean,
  amplitude: number = 0.1,
  baseFreq: number = 2.5,
  harmonyFreq: number = 3.7,
  scaleAmplitude: number = 0.05
): { y: number; scale: number; rotation: number; emissiveIntensity: number } {
  if (!isHovered) {
    return { y: baseY, scale: 1, rotation: 0, emissiveIntensity: 0 }
  }

  const wobble1 = Math.sin(elapsed * baseFreq) * amplitude * 0.7
  const wobble2 = Math.sin(elapsed * harmonyFreq) * amplitude * 0.3
  const y = baseY + wobble1 + wobble2
  const scale = 1 + Math.sin(elapsed * (baseFreq * 0.85)) * scaleAmplitude
  const rotation = Math.sin(elapsed * 1.6) * 0.025 + Math.cos(elapsed * 2.4) * 0.018
  const emissive = Math.sin(elapsed * 3.5) * 0.18 + 0.22

  return {
    y,
    scale,
    rotation,
    emissiveIntensity: Math.max(0, emissive),
  }
}

/**
 * Forklift smooth rotation with anticipation
 */
export function smoothRotationWithAnticipation(
  current: number,
  target: number,
  maxStep: number,
  anticipationAmount: number = 0.03
): { rotation: number; arrived: boolean; anticipationOffset: number } {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  const absDelta = Math.abs(delta)

  if (absDelta <= 0.002) return { rotation: target, arrived: true, anticipationOffset: 0 }

  // Anticipation: slight reverse before turning
  const anticipationOffset = delta * anticipationAmount * (absDelta > Math.PI / 4 ? 0.5 : 0.2)
  const effectiveMaxStep = maxStep * (1 + Math.abs(anticipationOffset) * 0.3)

  const progress = Math.min(1, absDelta / effectiveMaxStep)
  const easedProgress = easeInOutCubic(progress)
  const step = absDelta * easedProgress

  const rotated = current + Math.sign(delta) * step
  return { rotation: rotated, arrived: false, anticipationOffset }
}

/**
 * Collision proximity warning with gentle shake
 */
export function collisionProximityWarning(
  distanceToForklift: number,
  threshold: number = 2.0,
  maxIntensity: number = 0.03,
  maxScale: number = 1.06
): { shakeX: number; shakeZ: number; scale: number; visible: boolean } {
  if (distanceToForklift > threshold) {
    return { shakeX: 0, shakeZ: 0, scale: 1, visible: false }
  }

  const progress = 1 - distanceToForklift / threshold
  const intensity = maxIntensity * progress * progress
  const scale = 1 + (maxScale - 1) * progress * progress

  // Add subtle noise for realistic shake
  const noiseX = (Math.random() - 0.5) * 2 * intensity
  const noiseZ = (Math.random() - 0.5) * 2 * intensity

  return {
    shakeX: noiseX,
    shakeZ: noiseZ,
    scale,
    visible: true,
  }
}

/**
 * Smooth box pickup with smooth fade
 */
export function boxPickupWithFade(
  progress: number,
  baseY: number,
  liftHeight: number
): { y: number; zOffset: number; opacity: number } {
  const eased = smoothstep(MathUtils.clamp(progress, 0, 1))

  const lift = liftHeight * eased
  const slide = -0.35 * eased
  const opacity = 1 - eased * 0.15

  return { y: baseY + lift, zOffset: slide, opacity }
}

/**
 * Smooth box drop with smooth fade in
 */
export function boxDropWithFade(
  progress: number,
  baseY: number,
  liftHeight: number
): { y: number; zOffset: number; opacity: number } {
  const eased = easeInOutQuint(MathUtils.clamp(progress, 0, 1))

  const lift = liftHeight * (1 - eased)
  const slide = 0.35 * (1 - eased)
  const opacity = eased < 0.35 ? 0 : eased < 0.65 ? (eased - 0.35) / 0.3 : 1

  return { y: baseY + lift, zOffset: slide, opacity }
}

/**
 * Legacy box hover with glow and rotation (kept for backward compatibility)
 */
export function legacyBoxHover(
  elapsed: number,
  baseY: number,
  isHovered: boolean,
  amplitude: number = 0.14,
  frequency: number = 3.0,
  scaleAmplitude: number = 0.06,
  rotationAmplitude: number = 0.035
): { y: number; scale: number; rotationX: number; rotationZ: number; emissiveIntensity: number } {
  if (!isHovered) {
    return { y: baseY, scale: 1, rotationX: 0, rotationZ: 0, emissiveIntensity: 0 }
  }

  const wobble = Math.sin(elapsed * frequency) * amplitude
  const scaleWobble = Math.sin(elapsed * (frequency * 1.35)) * scaleAmplitude
  const rotationX = Math.sin(elapsed * 1.7) * rotationAmplitude
  const rotationZ = Math.cos(elapsed * 2.5) * rotationAmplitude
  const glow = Math.sin(elapsed * (frequency * 0.9)) * 0.25 + 0.18

  return {
    y: baseY + wobble,
    scale: 1 + scaleWobble,
    rotationX,
    rotationZ,
    emissiveIntensity: Math.max(0, glow),
  }
}

/**
 * Forklift idle breathing with smooth sine wave
 */
export function forkliftIdleBreathing(
  elapsed: number,
  amplitude: number = 0.008,
  frequency: number = 1.8
): number {
  return Math.sin(elapsed * frequency) * amplitude
}

/**
 * Smooth box placement with alignment feedback and glow
 */
export function boxPlacementWithGlow(
  progress: number,
  baseY: number,
  liftHeight: number,
  isPlacing: boolean
): { y: number; zOffset: number; scale: number; rotation: number; glow: number } {
  const eased = easeInOutQuint(MathUtils.clamp(progress, 0, 1))

  let y = baseY + liftHeight * (1 - eased)
  const zOffset = 0.35 * (1 - eased)
  let scale = 1
  let rotation = 0
  let glow = 0

  if (isPlacing && eased > 0.7) {
    // Alignment phase - subtle adjustments
    const alignProgress = (eased - 0.7) / 0.3
    y += Math.sin(alignProgress * Math.PI * 7) * 0.008
    scale = 1 + Math.sin(alignProgress * Math.PI * 3.5) * 0.025
    rotation = Math.sin(alignProgress * Math.PI * 4.5) * 0.02
    glow = Math.max(0, Math.sin(alignProgress * Math.PI * 2.2) * 0.35)
  }

  return { y, zOffset, scale, rotation, glow }
}

// ============================================================================
// ENHANCED ANIMATION FUNCTIONS (v2)
// ============================================================================

/**
 * Cubic Bezier curve easing with custom control points.
 * Provides smoother acceleration/deceleration than standard easing.
 */
export function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/**
 * Velocity-based easing for natural acceleration/deceleration.
 * Uses physics-inspired velocity curves and is normalised so that
 * `position` maps exactly 0 → 1 across the full progress range.
 */
export function velocityBasedEasing(
  progress: number,
  maxVelocity = 1.0,
  accelPhase = 0.25,
  decelPhase = 0.25
): { position: number; velocity: number } {
  const t = MathUtils.clamp(progress, 0, 1)
  const accel = MathUtils.clamp(accelPhase, 0, 0.5)
  const decel = MathUtils.clamp(decelPhase, 0, 0.5)
  // The raw curve only covers (1 - 0.5 * accel) of the span, so scale it back up.
  const norm = 1 / (1 - 0.5 * accel)

  if (t < accel) {
    // Acceleration phase - quadratic ease in
    const p = t / accel
    return {
      position: 0.5 * p * p * accel * norm,
      velocity: p * maxVelocity * norm,
    }
  }

  if (t < 1 - decel) {
    // Constant velocity phase
    const accelDist = 0.5 * accel
    const cruiseDist = t - accel
    return {
      position: (accelDist + cruiseDist) * norm,
      velocity: maxVelocity * norm,
    }
  }

  // Deceleration phase - quadratic ease out
  const accelDist = 0.5 * accel
  const cruiseDist = 1 - decel - accel
  const decelT = (t - (1 - decel)) / decel
  const decelDist = decel * (1 - 0.5 * (1 - decelT) * (1 - decelT))
  return {
    position: (accelDist + cruiseDist + decelDist) * norm,
    velocity: maxVelocity * (1 - decelT) * norm,
  }
}

/**
 * Smooth look-at interpolation for forklift rotation.
 * Uses spherical interpolation for natural turning.
 */
export function smoothLookAt(
  currentRotation: number,
  targetDirection: Vector3,
  currentPosition: Vector3,
  deltaTime: number,
  turnSpeed = 3.0
): number {
  const dirToTarget = new Vector3().subVectors(targetDirection, currentPosition).normalize()

  const targetRotation = Math.atan2(dirToTarget.x, dirToTarget.z)

  // Use shortest path
  let delta = targetRotation - currentRotation
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI

  // Smooth interpolation with damping
  const smoothDelta = delta * (1 - Math.exp(-turnSpeed * deltaTime))
  return currentRotation + smoothDelta
}

/**
 * Enhanced box hover effect with more responsive feedback.
 * Returns subtle floating animation with intensity control.
 */
export function enhancedBoxHover(
  time: number,
  isHovered: boolean,
  isSelected: boolean,
  intensity = 1.0
): { yOffset: number; scale: number; glow: number; pulseRing: number } {
  const baseFloat = Math.sin(time * 2) * 0.015 * intensity
  const hoverFloat = isHovered ? Math.sin(time * 4) * 0.03 * intensity : 0
  const selectedFloat = isSelected ? Math.sin(time * 3) * 0.02 * intensity : 0

  const yOffset = baseFloat + hoverFloat + selectedFloat
  const scale = 1.0 + (isHovered ? 0.05 : 0) + (isSelected ? 0.03 : 0)
  const glow = (isHovered ? 0.3 : 0) + (isSelected ? 0.5 : 0)
  const pulseRing = isSelected ? Math.sin(time * 4) * 0.5 + 0.5 : 0

  return { yOffset, scale, glow, pulseRing }
}

/**
 * Multi-phase box pickup animation.
 * Phase 1: Approach (0-0.2)
 * Phase 2: Align (0.2-0.4)
 * Phase 3: Grip (0.4-0.6)
 * Phase 4: Lift (0.6-1.0)
 */
export function multiPhasePickup(
  progress: number,
  liftHeight: number
): { yOffset: number; zOffset: number; rotation: number; scale: number; phase: string } {
  const t = MathUtils.clamp(progress, 0, 1)

  if (t < 0.2) {
    // Phase 1: Approach - forklift moves to box
    const p = t / 0.2
    return {
      phase: 'approach',
      zOffset: 0.5 * (1 - easeInOutCubic(p)),
      yOffset: Math.sin(p * Math.PI) * 0.01, // slight anticipation
      rotation: 0,
      scale: 1,
    }
  }

  if (t < 0.4) {
    // Phase 2: Align - subtle positioning adjustments
    const p = (t - 0.2) / 0.2
    return {
      phase: 'align',
      zOffset: 0,
      yOffset: 0,
      rotation: Math.sin(p * Math.PI * 2) * 0.02,
      scale: 1 - Math.sin(p * Math.PI) * 0.03,
    }
  }

  if (t < 0.6) {
    // Phase 3: Grip - box slightly compresses
    const p = (t - 0.4) / 0.2
    return {
      phase: 'grip',
      zOffset: 0,
      yOffset: 0,
      rotation: 0,
      scale: 1 - easeInOutCubic(p) * 0.05,
    }
  }

  // Phase 4: Lift - smooth upward motion, box expands back while rising
  const p = (t - 0.6) / 0.4
  const eased = easeOutCubic(p)
  return {
    phase: 'lift',
    zOffset: 0,
    yOffset: eased * liftHeight,
    rotation: 0,
    scale: 0.95 + eased * 0.05,
  }
}

/**
 * Carry phase bobbing motion - simulates forklift suspension.
 */
export function carryBobbing(
  time: number,
  velocity: number,
  intensity = 1.0
): { yOffset: number; xOffset: number; rotation: number } {
  const speedFactor = MathUtils.clamp(velocity * 2, 0, 1)

  const yOffset = Math.sin(time * 5) * 0.02 * intensity * speedFactor
  const xOffset = Math.sin(time * 3.7) * 0.01 * intensity * speedFactor
  const rotation = Math.sin(time * 4.3) * 0.015 * intensity * speedFactor

  return { yOffset, xOffset, rotation }
}

/**
 * Drop animation with landing impact effect.
 */
export function dropWithImpact(
  progress: number,
  dropHeight: number
): { yOffset: number; scale: number; squash: number; glow: number; impactRing: number } {
  const t = MathUtils.clamp(progress, 0, 1)

  // Falling phase with gravity acceleration
  const fallProgress = Math.min(t * 1.5, 1.0)
  const yOffset = dropHeight * (1 - fallProgress * fallProgress)

  // Impact squash at landing
  let squash = 0
  let scale = 1.0
  let glow = 0
  let impactRing = 0

  if (t > 0.7) {
    const impactT = (t - 0.7) / 0.3
    squash = Math.sin(impactT * Math.PI * 3) * 0.1 * Math.exp(-impactT * 5)
    scale = 1.0 + squash
    glow = Math.exp(-impactT * 8) * 0.5
    impactRing = Math.min(impactT * 2, 1.0)
  }

  return { yOffset, scale, squash, glow, impactRing }
}

/**
 * Trail particle system data generator.
 * Returns particle positions along a path.
 */
export function generateTrailParticles(
  currentPosition: Vector3,
  velocity: Vector3,
  particleCount: number,
  spacing: number
): Vector3[] {
  const particles: Vector3[] = []
  const velocityLength = velocity.length()

  if (velocityLength < 0.01) return particles

  const direction = velocity.clone().normalize()

  for (let i = 0; i < particleCount; i++) {
    const offset = spacing * i
    const particle = currentPosition.clone().sub(direction.clone().multiplyScalar(offset))
    particle.y += Math.sin(i * 0.5) * 0.05 // slight wave
    particles.push(particle)
  }

  return particles
}

/**
 * Collision proximity warning with color shift.
 */
export function collisionWarning(
  distanceToObstacle: number,
  warningDistance: number,
  dangerDistance: number
): { intensity: number; color: [number, number, number]; pulseSpeed: number } {
  const normalizedDist = MathUtils.clamp(
    (distanceToObstacle - dangerDistance) / (warningDistance - dangerDistance),
    0,
    1
  )

  const intensity = 1 - normalizedDist

  // Color shift from yellow to red
  const color: [number, number, number] = [
    1.0, // red always at full
    normalizedDist, // yellow fades to 0
    0.0, // no blue
  ]

  const pulseSpeed = 2 + intensity * 4 // faster pulse when closer

  return { intensity, color, pulseSpeed }
}

/**
 * Level of Detail helper - determines rendering detail based on distance.
 */
export function getLODLevel(
  objectPosition: Vector3,
  cameraPosition: Vector3,
  thresholds = [5, 15, 30]
): 'high' | 'medium' | 'low' | 'culled' {
  const distance = objectPosition.distanceTo(cameraPosition)

  if (distance < thresholds[0]) return 'high'
  if (distance < thresholds[1]) return 'medium'
  if (distance < thresholds[2]) return 'low'
  return 'culled'
}

/**
 * Smooth path curve generation with automatic control point calculation.
 * Creates smooth Bezier-like curves through waypoints.
 */
export function generateSmoothPath(waypoints: Vector3[], _tension = 0.5): Vector3[] {
  if (waypoints.length < 2) return waypoints

  const smoothPath: Vector3[] = []
  const segments = 10 // points per segment

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[Math.max(0, i - 1)]
    const p1 = waypoints[i]
    const p2 = waypoints[i + 1]
    const p3 = waypoints[Math.min(waypoints.length - 1, i + 2)]

    for (let t = 0; t < segments; t++) {
      const u = t / segments
      const point = new Vector3()

      // Catmull-Rom spline interpolation
      const t2 = u * u
      const t3 = t2 * u

      point.x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * u +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)

      point.y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * u +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)

      point.z =
        0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * u +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)

      smoothPath.push(point)
    }
  }

  smoothPath.push(waypoints[waypoints.length - 1])
  return smoothPath
}

/**
 * Highlight ring animation for selected objects.
 */
export function highlightRing(
  time: number,
  isSelected: boolean,
  baseRadius: number
): { radius: number; opacity: number; thickness: number } {
  if (!isSelected) {
    return { radius: baseRadius, opacity: 0, thickness: 0.05 }
  }

  const pulse = Math.sin(time * 3) * 0.5 + 0.5
  const radius = baseRadius + pulse * 0.1
  const opacity = 0.4 + pulse * 0.3
  const thickness = 0.05 + pulse * 0.02

  return { radius, opacity, thickness }
}

/**
 * Direction indicator for forklift - shows where it's heading.
 */
export function directionIndicator(
  _forkliftRotation: number,
  velocity: number,
  maxLength = 2.0
): { length: number; opacity: number; pulsePhase: number } {
  const speedFactor = MathUtils.clamp(velocity / 2, 0, 1)
  const length = maxLength * speedFactor
  const opacity = speedFactor * 0.6
  const pulsePhase = velocity * 5 // faster pulse at higher speed

  return { length, opacity, pulsePhase }
}

/**
 * Proximity alert calculation for operator awareness.
 */
export function proximityAlert(
  objectPosition: Vector3,
  forkliftPosition: Vector3,
  alertRadius: number
): { inProximity: boolean; distance: number; direction: Vector3; urgency: number } {
  const direction = new Vector3().subVectors(objectPosition, forkliftPosition)
  const distance = direction.length()
  const inProximity = distance < alertRadius

  direction.normalize()

  const urgency = inProximity ? 1 - distance / alertRadius : 0

  return { inProximity, distance, direction, urgency }
}

/**
 * Real-time path adjustment based on obstacles.
 * Returns adjusted target position to avoid collisions.
 */
export function adjustPathForObstacles(
  currentPosition: Vector3,
  targetPosition: Vector3,
  obstacles: Vector3[],
  avoidanceRadius: number
): Vector3 {
  const adjustedTarget = targetPosition.clone()
  const pathDirection = new Vector3().subVectors(targetPosition, currentPosition).normalize()

  for (const obstacle of obstacles) {
    const toObstacle = new Vector3().subVectors(obstacle, currentPosition)
    const projectionLength = toObstacle.dot(pathDirection)

    // Only consider obstacles ahead
    if (projectionLength > 0) {
      const projection = pathDirection.clone().multiplyScalar(projectionLength)
      const perpendicular = new Vector3().subVectors(toObstacle, projection)
      const perpendicularDist = perpendicular.length()

      if (perpendicularDist < avoidanceRadius) {
        // Adjust target to go around obstacle
        const avoidanceVector = perpendicular.normalize().multiplyScalar(avoidanceRadius * 1.5)
        adjustedTarget.add(avoidanceVector)
      }
    }
  }

  return adjustedTarget
}

/**
 * Object pooling helper for particle systems.
 * Manages reusable particle objects for performance.
 */
export class ParticlePool {
  private pool: Array<{ position: Vector3; velocity: Vector3; life: number; maxLife: number }>
  private activeCount: number

  constructor(size: number) {
    this.pool = Array(size)
      .fill(null)
      .map(() => ({
        position: new Vector3(),
        velocity: new Vector3(),
        life: 0,
        maxLife: 1,
      }))
    this.activeCount = 0
  }

  spawn(position: Vector3, velocity: Vector3, maxLife: number): void {
    if (this.activeCount >= this.pool.length) return

    const particle = this.pool[this.activeCount]
    particle.position.copy(position)
    particle.velocity.copy(velocity)
    particle.life = maxLife
    particle.maxLife = maxLife
    this.activeCount++
  }

  update(deltaTime: number): void {
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const particle = this.pool[i]
      particle.life -= deltaTime

      if (particle.life <= 0) {
        // Swap with last active particle
        ;[this.pool[i], this.pool[this.activeCount - 1]] = [
          this.pool[this.activeCount - 1],
          this.pool[i],
        ]
        this.activeCount--
      } else {
        particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime))
      }
    }
  }

  getActive(): Array<{ position: Vector3; velocity: Vector3; life: number; maxLife: number }> {
    return this.pool.slice(0, this.activeCount)
  }

  reset(): void {
    this.activeCount = 0
  }
}
