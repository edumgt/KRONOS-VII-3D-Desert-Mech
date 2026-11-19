import { AtmospherePreset } from './cameraRig';

export type SandLayerId = 0 | 1 | 2; // 0 = ground saltation/wisps, 1 = mid swirling grit, 2 = high sunlit motes

export interface SandAtmosphereProfile {
  preset: AtmospherePreset;
  windX: number;
  windZ: number;
  gustAmplitude: number;
  gustFrequency: number;
  turbulence: number;
  baseColorHex: number;
  highlightColorHex: number;
  ribbonColorHex: number;
  opacity: number;
  ribbonOpacity: number;
  streakStretch: number;
}

export interface SandMechContext {
  mechX: number;
  mechY: number; // height above local ground (0 when grounded)
  mechZ: number;
  moveSpeed: number;
  grounded: boolean;
}

export interface SandParticleField {
  count: number;
  halfExtent: number;
  positions: Float32Array; // xyz
  layerIds: Float32Array; // 0, 1, 2
  sizes: Float32Array; // base world size
  seeds: Float32Array; // 0..2PI phase
  speeds: Float32Array; // per-particle speed multiplier
  alphas: Float32Array; // per-particle dynamic alpha
  heightOffsets: Float32Array; // preferred height above local terrain
}

export const DEFAULT_SAND_MECH_CONTEXT: SandMechContext = {
  mechX: 0,
  mechY: 0,
  mechZ: 0,
  moveSpeed: 0,
  grounded: true,
};

export function getSandAtmosphereProfile(preset: AtmospherePreset): SandAtmosphereProfile {
  if (preset === 'dusk') {
    return {
      preset,
      windX: 16.5,
      windZ: 5.2,
      gustAmplitude: 6.4,
      gustFrequency: 0.62,
      turbulence: 1.4,
      baseColorHex: 0xe8a05c,
      highlightColorHex: 0xffe0aa,
      ribbonColorHex: 0xf2b578,
      opacity: 0.84,
      ribbonOpacity: 0.34,
      streakStretch: 1.85,
    };
  }
  if (preset === 'storm') {
    return {
      preset,
      windX: 28.0,
      windZ: 8.8,
      gustAmplitude: 10.5,
      gustFrequency: 0.95,
      turbulence: 2.35,
      baseColorHex: 0xd4b68c,
      highlightColorHex: 0xf6ebd6,
      ribbonColorHex: 0xdec7a4,
      opacity: 0.92,
      ribbonOpacity: 0.44,
      streakStretch: 2.2,
    };
  }
  // 'sunbreak' default
  return {
    preset: 'sunbreak',
    windX: 13.5,
    windZ: 3.8,
    gustAmplitude: 4.8,
    gustFrequency: 0.48,
    turbulence: 1.05,
    baseColorHex: 0xebb978,
    highlightColorHex: 0xfff0cc,
    ribbonColorHex: 0xf3cc93,
    opacity: 0.8,
    ribbonOpacity: 0.3,
    streakStretch: 1.7,
  };
}

function wrapAroundCenter(val: number, center: number, halfExtent: number): number {
  const span = halfExtent * 2;
  let rel = val - center;
  if (rel > halfExtent || rel < -halfExtent) {
    rel = ((((rel + halfExtent) % span) + span) % span) - halfExtent;
  }
  return center + rel;
}

/**
 * Allocates a deterministic multi-layer blowing desert sand particle pool
 * calibrated for clear visual readability at the 64m mech / 105m drone scale.
 */
export function createSandParticleField(
  count: number,
  seed: number,
  groundHeightFn: (x: number, z: number) => number,
  halfExtent = 86,
): SandParticleField {
  const positions = new Float32Array(count * 3);
  const layerIds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const speeds = new Float32Array(count);
  const alphas = new Float32Array(count);
  const heightOffsets = new Float32Array(count);

  let s = seed >>> 0 || 4219;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let i = 0; i < count; i++) {
    const rRoll = rand();
    let layer: SandLayerId;
    if (rRoll < 0.46) {
      layer = 0; // Low ground-skimming saltation sheets & billowing sand wisps
    } else if (rRoll < 0.86) {
      layer = 1; // Mid-altitude blowing sand streams wrapping around mech
    } else {
      layer = 2; // Upper canyon sunlit dust & fine grit
    }

    // Concentrate ~65% of particles within 56m of the mech so blowing sand richly frames the chassis
    const radialBias = rand() < 0.65 ? 0.62 : 1.0;
    const x = (rand() * 2 - 1) * halfExtent * radialBias;
    const z = (rand() * 2 - 1) * halfExtent * radialBias;
    const groundY = groundHeightFn(x, z);

    let hOffset: number;
    let size: number;
    let speed: number;
    let baseAlpha: number;

    if (layer === 0) {
      // Mix of visible blowing grit grains and soft wind-sheared dune wisps
      const isWisp = rand() < 0.28;
      hOffset = isWisp ? 1.2 + Math.pow(rand(), 1.3) * 7.0 : 0.35 + Math.pow(rand(), 1.6) * 6.5;
      size = isWisp ? 6.8 + rand() * 7.2 : 1.15 + rand() * 1.45;
      speed = isWisp ? 0.88 + rand() * 0.45 : 1.1 + rand() * 0.65;
      baseAlpha = isWisp ? 0.34 + rand() * 0.22 : 0.72 + rand() * 0.26;
    } else if (layer === 1) {
      const isCloud = rand() < 0.22;
      hOffset = 5.5 + Math.pow(rand(), 1.1) * 42.0;
      size = isCloud ? 5.2 + rand() * 5.0 : 1.05 + rand() * 1.35;
      speed = 0.92 + rand() * 0.58;
      baseAlpha = isCloud ? 0.28 + rand() * 0.18 : 0.68 + rand() * 0.28;
    } else {
      hOffset = 36.0 + rand() * 42.0;
      size = 1.2 + rand() * 1.65;
      speed = 0.5 + rand() * 0.42;
      baseAlpha = 0.48 + rand() * 0.3;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = groundY + hOffset;
    positions[i * 3 + 2] = z;

    layerIds[i] = layer;
    sizes[i] = size;
    seeds[i] = rand() * Math.PI * 2;
    speeds[i] = speed;
    alphas[i] = baseAlpha;
    heightOffsets[i] = hOffset;
  }

  return {
    count,
    halfExtent,
    positions,
    layerIds,
    sizes,
    seeds,
    speeds,
    alphas,
    heightOffsets,
  };
}

/**
 * Advances all sand particles in-place with zero allocations:
 * - Cross-canyon wind + oscillating desert gusts
 * - Terrain-following ground saltation
 * - Aerodynamic swirl/deflection around the 64m mech torso & legs
 * - Footstep & thruster downwash sand kickup around the mech's base
 */
export function stepSandParticleField(
  field: SandParticleField,
  deltaSec: number,
  elapsedSec: number,
  profile: SandAtmosphereProfile,
  mech: SandMechContext,
  groundHeightFn: (x: number, z: number) => number,
): void {
  const dt = Math.min(Math.max(deltaSec, 0), 0.1);
  if (dt <= 0) return;

  const {
    count,
    halfExtent,
    positions,
    layerIds,
    sizes,
    seeds,
    speeds,
    alphas,
    heightOffsets,
  } = field;

  // Global gust wave rolling across the canyon
  const globalGust =
    1.0 +
    (profile.gustAmplitude / Math.max(profile.windX, 1)) *
      (0.6 * Math.sin(elapsedSec * profile.gustFrequency) +
        0.4 * Math.sin(elapsedSec * profile.gustFrequency * 2.17 + 1.3));

  const windXBase = profile.windX * globalGust;
  const windZBase = profile.windZ * globalGust;
  const turb = profile.turbulence;

  // Thruster downwash / footstep kick intensity
  const speedRatio = Math.min(1.5, Math.abs(mech.moveSpeed) / 14);
  const downwashBoost = (!mech.grounded ? 1.45 : 0) + speedRatio * 0.85;
  const mechBodyRadius = 15.5;
  const mechWakeRadius = 29.0;
  const groundAtMech = groundHeightFn(mech.mechX, mech.mechZ);
  const mechAltAtten = Math.max(0.25, 1 - Math.max(0, mech.mechY) / 28);

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    let x = positions[idx];
    let y = positions[idx + 1];
    let z = positions[idx + 2];

    const layer = layerIds[i];
    const phase = seeds[i];
    const pSpeed = speeds[i];
    const isLargeWisp = sizes[i] > 4.2;

    // Local gust ribbon modulation so sand moves in coherent sweeping waves
    const waveCoord = x * 0.038 - z * 0.024 - elapsedSec * 1.35;
    const localGust = 0.78 + 0.38 * Math.sin(waveCoord + phase * 0.25);

    // Height-dependent wind shear (fastest in mid/ground streaks, slower high motes)
    const layerWindScale = layer === 0 ? 1.12 : layer === 1 ? 0.96 : 0.58;
    let vx = windXBase * pSpeed * layerWindScale * localGust;
    let vz = windZBase * pSpeed * layerWindScale * localGust;
    let vy = Math.sin(elapsedSec * 1.45 + phase + x * 0.04) * 0.9 * turb;

    // Cross-wind curl turbulence
    vz += Math.cos(elapsedSec * 0.92 + phase + x * 0.05) * 1.85 * turb;

    // Aerodynamic deflection & vortex swirl around the 64m mech
    const dx = x - mech.mechX;
    const dz = z - mech.mechZ;
    const distSq = dx * dx + dz * dz;
    const heightAboveGround = y - groundAtMech;
    const relMechY = heightAboveGround - mech.mechY;

    if (distSq > 0.25 && distSq < mechWakeRadius * mechWakeRadius && heightAboveGround > -2 && heightAboveGround < 68) {
      const dist = Math.sqrt(distSq);
      const invDist = 1 / dist;
      const nx = dx * invDist;
      const nz = dz * invDist;

      if (dist < mechBodyRadius && relMechY > -2 && relMechY < 66) {
        // Deflect sand smoothly around the mech chassis with tangential swirl
        const proximity = 1 - dist / mechBodyRadius;
        const swirlDir = phase > Math.PI ? 1 : -1;
        vx += (nx * 10.5 - nz * swirlDir * 9.0) * proximity;
        vz += (nz * 10.5 + nx * swirlDir * 9.0) * proximity;
        vy += 2.6 * proximity;
      }

      // Footstep & jump-thruster radial ground sand blast (works even when mech is airborne above ground sand)
      if (downwashBoost > 0.05 && heightAboveGround < 20) {
        const wakeFalloff = (1 - dist / mechWakeRadius) * (1 - Math.max(0, heightAboveGround) / 20);
        const blast = downwashBoost * mechAltAtten * wakeFalloff * 22.0;
        vx += nx * blast;
        vz += nz * blast;
        vy += downwashBoost * mechAltAtten * wakeFalloff * 9.5;
      }
    }

    x += vx * dt;
    z += vz * dt;
    y += vy * dt;

    // Keep particle volume centered around the mech as it walks through the canyon
    x = wrapAroundCenter(x, mech.mechX, halfExtent);
    z = wrapAroundCenter(z, mech.mechZ, halfExtent);

    const localGroundY = groundHeightFn(x, z);
    const targetY = localGroundY + heightOffsets[i];

    // Gently pull height back toward the particle's layer band above local dune contour
    const pullRate = layer === 0 ? 2.6 : layer === 1 ? 1.15 : 0.45;
    y += (targetY - y) * Math.min(1, dt * pullRate);

    // Never sink beneath the desert dunes
    const minY = localGroundY + 0.16;
    if (y < minY) {
      y = minY + (heightOffsets[i] % 1.2) * 0.25;
    }

    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;

    // Soft edge fade near volume perimeter so wrapping is completely invisible
    const rx = Math.abs(x - mech.mechX) / halfExtent;
    const rz = Math.abs(z - mech.mechZ) / halfExtent;
    const edgeDist = Math.max(rx, rz);
    const edgeFade = edgeDist > 0.78 ? Math.max(0, 1 - (edgeDist - 0.78) / 0.22) : 1;

    // Soft billowing alpha for large low wisps, crisp higher alpha for blowing sand grains
    const baseLayerAlpha = isLargeWisp
      ? (layer === 0 ? 0.34 : 0.26)
      : (layer === 0 ? 0.82 : layer === 1 ? 0.74 : 0.56);
    const gustLift = 0.85 + 0.25 * localGust + (downwashBoost > 0.2 && distSq < 900 ? 0.22 : 0);
    alphas[i] = Math.min(1, baseLayerAlpha * gustLift * edgeFade);
  }
}
