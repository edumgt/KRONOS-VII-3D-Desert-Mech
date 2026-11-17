/**
 * Pure camera choreography & 360-degree drone orbit math.
 * Ensures smooth, continuous circular orbit at mid-height with full mech body always framed
 * cleanly above the bottom control dock and zero camera shake.
 */

export type CameraMode =
  | 'orbit360'
  | 'cockpit'
  | 'pilot3rd'
  | 'free'
  | 'lowScale'
  | 'rearSpine';
export type AtmospherePreset = 'sunbreak' | 'dusk' | 'storm';

export interface MechOrigin {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface DroneOrbitConfig {
  radius: number;
  midHeight: number;
  targetY: number;
  baseAngularSpeed: number; // rad/s at 1.0x
  fovDeg: number;
}

export const DEFAULT_DRONE_CONFIG: DroneOrbitConfig = {
  // Mech spans y = 0..64m; target at y = 28m places feet cleanly above bottom HUD while keeping
  // full 64m crest inside the upper third with generous sky headroom.
  radius: 105,
  midHeight: 29,
  targetY: 28,
  baseAngularSpeed: 0.45, // ~14s per full 360° revolution at 1.0x; 2.8x = ~5s rapid drone orbit
  fovDeg: 45,
};

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  azimuthDeg: number;
}

/**
 * Normalizes an angle in radians to [0, 360) degrees.
 */
export function normalizeAzimuthDeg(radians: number): number {
  const deg = ((radians * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}

/**
 * Advances orbit angle smoothly by deltaTime * speedMultiplier (never fixed per frame).
 */
export function advanceOrbitAngle(
  currentAngle: number,
  deltaSec: number,
  speedMultiplier: number,
  isPlaying: boolean,
  config: DroneOrbitConfig = DEFAULT_DRONE_CONFIG,
): number {
  if (!isPlaying) return currentAngle;
  const clampedDt = Math.min(Math.max(deltaSec, 0), 0.5);
  return currentAngle + clampedDt * config.baseAngularSpeed * speedMultiplier;
}

/**
 * Computes exact 360° circular drone camera pose at mid-height, clamped safely above terrain.
 */
export function computeCameraPose(
  mode: CameraMode,
  orbitAngle: number,
  terrainHeightFn: (x: number, z: number) => number,
  config: DroneOrbitConfig = DEFAULT_DRONE_CONFIG,
  mechOrigin: MechOrigin = { x: 0, y: 0, z: 0, yaw: 0 },
): CameraPose {
  const mx = mechOrigin.x;
  const my = mechOrigin.y;
  const mz = mechOrigin.z;
  const yaw = mechOrigin.yaw;

  if (mode === 'cockpit') {
    // Positioned cleanly at the forward cranial/visor bridge looking over the desert canyon
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const camOffsetFwd = 13.1;
    const x = mx + sinY * camOffsetFwd;
    const z = mz + cosY * camOffsetFwd;
    const y = my + 49.4;
    const lookDist = 94;
    return {
      x,
      y,
      z,
      targetX: mx + sinY * lookDist,
      targetY: my + 34.5,
      targetZ: mz + cosY * lookDist,
      azimuthDeg: normalizeAzimuthDeg(yaw),
    };
  }

  if (mode === 'pilot3rd') {
    // Smooth 3rd-person follow cam behind & slightly offset so full mech + path are clear
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const backDist = 92;
    const sideOffset = 14;
    const x = mx - sinY * backDist + cosY * sideOffset;
    const z = mz - cosY * backDist - sinY * sideOffset;
    const minGroundY = terrainHeightFn(x, z) + 8.0;
    return {
      x,
      y: Math.max(minGroundY, my + 38),
      z,
      targetX: mx + sinY * 14,
      targetY: my + 29,
      targetZ: mz + cosY * 14,
      azimuthDeg: normalizeAzimuthDeg(yaw),
    };
  }

  if (mode === 'lowScale') {
    const x = mx + 2.4;
    const z = mz + 92.0;
    const minGroundY = terrainHeightFn(x, z) + 2.5;
    return {
      x,
      y: Math.max(minGroundY, my + 9.2),
      z,
      targetX: mx,
      targetY: my + 29,
      targetZ: mz,
      azimuthDeg: normalizeAzimuthDeg(Math.atan2(x - mx, z - mz)),
    };
  }

  if (mode === 'rearSpine') {
    const angle = yaw + Math.PI + 0.34;
    const r = 88;
    const x = mx + Math.sin(angle) * r;
    const z = mz + Math.cos(angle) * r;
    const minGroundY = terrainHeightFn(x, z) + 6.0;
    return {
      x,
      y: Math.max(minGroundY, my + 32),
      z,
      targetX: mx,
      targetY: my + 29,
      targetZ: mz,
      azimuthDeg: normalizeAzimuthDeg(angle),
    };
  }

  // Default / 'orbit360': Continuous smooth circular motion at mid-height, zero camera shake.
  const x = mx + Math.sin(orbitAngle) * config.radius;
  const z = mz + Math.cos(orbitAngle) * config.radius;
  const minGroundY = terrainHeightFn(x, z) + 6.0;
  const y = Math.max(minGroundY, my + config.midHeight);

  return {
    x,
    y,
    z,
    targetX: mx,
    targetY: my + config.targetY,
    targetZ: mz,
    azimuthDeg: normalizeAzimuthDeg(orbitAngle),
  };
}

/**
 * Verifies that the entire mech height [0..mechHeight] fits vertically inside the camera frustum
 * from a given distance and camera height.
 */
export function isFullBodyInFrame(
  pose: CameraPose,
  mechHeight: number,
  fovDeg: number,
  marginFactor = 0.9,
): boolean {
  const dx = pose.x - pose.targetX;
  const dy = pose.y - pose.targetY;
  const dz = pose.z - pose.targetZ;
  const dist = Math.hypot(dx, dy, dz);
  const halfFovRad = ((fovDeg * Math.PI) / 180) * 0.5;
  const visibleHalfHeight = Math.tan(halfFovRad) * dist * marginFactor;
  const topFits = pose.targetY + visibleHalfHeight >= mechHeight;
  const bottomFits = pose.targetY - visibleHalfHeight <= 0;
  return topFits && bottomFits;
}
