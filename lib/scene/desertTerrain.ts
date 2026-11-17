/**
 * Pure mathematical heightfield for the desert canyon basin.
 * Shared across terrain mesh generation, prop/human grounding, mech footing, and camera clearance.
 * Units are meters (1 Three.js unit = 1m). Mech stands at origin (0, 0, 0) ~64m tall.
 *
 * The inner desert valley extends cleanly out to r = 128m so the 360° drone orbit (r = 105m)
 * always has an unobstructed, full-body line of sight from front, sides, and rear.
 * Towering canyon walls surround the valley perimeter at r > 132m.
 */

export function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);

  // Flat-ish compacted basin directly beneath the mech's feet (r < 18m)
  const basinBlend = smoothstep(12, 34, r);

  // Rolling desert sand dunes (asymmetrical wind-carved ridges)
  const dune1 = Math.sin(x * 0.052 + z * 0.03) * 1.85;
  const dune2 = Math.cos(x * 0.026 - z * 0.062 + 1.1) * 1.45;
  const dune3 = Math.sin((x + z) * 0.13) * 0.32;
  // Attenuate tall dunes along the camera's 105m circular path so feet stay visible
  const orbitCorridorFactor = 1.0 - 0.35 * Math.exp(-Math.pow((r - 105) / 22, 2));
  const dunes = (dune1 + dune2 + dune3) * basinBlend * orbitCorridorFactor;

  // Foreground gentle viewing ridge around z = 46..64m where human scouts stand
  const fgRidgeFactor = Math.exp(-Math.pow((z - 54) / 18, 2)) * Math.exp(-Math.pow(x / 46, 2));
  const fgRidge = fgRidgeFactor * 3.2 * basinBlend;

  // Canyon walls rising strictly along left & right flanks (|x| > 128m, outside the 105m orbit)
  // Keeping the north/south valley horizon low so dramatic clouds frame the mech from front & rear
  const sideWallDist = Math.max(0, Math.abs(x) - 128 - Math.sin(z * 0.025) * 6);
  const sideWall = Math.pow(sideWallDist * 0.08, 1.75) * 14.0;

  // Low rolling distant desert ridges beyond r > 148m (gentle horizon, never a tall cone blocking sky)
  const outerHorizonDist = Math.max(0, r - 148);
  const outerHorizon = Math.min(11, Math.pow(outerHorizonDist * 0.045, 1.4) * 5.0);

  // Natural rocky crag noise on the flanking canyon walls only
  const wallMask = smoothstep(126, 158, Math.abs(x));
  const crag =
    wallMask *
    (Math.sin(x * 0.16 + z * 0.11) * 2.2 +
      Math.cos(x * 0.08 - z * 0.18) * 2.4 +
      Math.sin(x * 0.36 + z * 0.31) * 0.7);

  return Math.min(68, dunes + fgRidge + sideWall + outerHorizon + crag);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface HumanScoutPlacement {
  x: number;
  z: number;
  yaw: number;
  scale: number;
  robeColorHex: number;
}

/**
 * Deterministic foreground human scouts facing the colossal mech for epic scale.
 */
export function getForegroundHumanPlacements(): HumanScoutPlacement[] {
  const specs = [
    { x: -1.4, z: 48.0, scale: 1.0, robeColorHex: 0x3b2c22 },
    { x: -11.5, z: 50.5, scale: 0.97, robeColorHex: 0x5c4330 },
    { x: -17.5, z: 55.0, scale: 1.02, robeColorHex: 0x4b3829 },
    { x: 9.8, z: 49.5, scale: 0.98, robeColorHex: 0x4a3525 },
    { x: 16.4, z: 53.5, scale: 0.96, robeColorHex: 0x624936 },
    { x: 4.9, z: 54.5, scale: 0.95, robeColorHex: 0x3d2f24 },
    { x: -6.8, z: 56.5, scale: 1.01, robeColorHex: 0x55402e },
  ];

  return specs.map((s) => ({
    ...s,
    yaw: Math.atan2(-s.x, -s.z),
  }));
}
