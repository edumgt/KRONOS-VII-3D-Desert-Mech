export type MechStyleId = 'apex' | 'stealth' | 'sovereign';

export interface MechStyleConfig {
  id: MechStyleId;
  label: string;
  subtitle: string;
  armorPrimaryColor: number;
  armorSecondaryColor: number;
  armorExtrudeColor: number;
  armorAccentColor: number;
  innerFrameColor: number;
  emissiveColor: number;
  emissiveGlowColor: number;
  wispColor: number;
  hudPrimaryHex: string;
  hudSecondaryHex: string;
  armorRoughness: number;
  armorMetalness: number;
  accentRoughness: number;
  accentMetalness: number;
}

export const MECH_STYLES: Record<MechStyleId, MechStyleConfig> = {
  apex: {
    id: 'apex',
    label: '에이펙스',
    subtitle: 'Tactical Titanium · Cyan Plasma',
    armorPrimaryColor: 0x707d8c,
    armorSecondaryColor: 0x3b4450,
    armorExtrudeColor: 0x4b5664,
    armorAccentColor: 0xe3b45a,
    innerFrameColor: 0x161b21,
    emissiveColor: 0x00ecff,
    emissiveGlowColor: 0x00b4ff,
    wispColor: 0x4aeaff,
    hudPrimaryHex: '#00ecff',
    hudSecondaryHex: '#8ef0ff',
    armorRoughness: 0.44,
    armorMetalness: 0.82,
    accentRoughness: 0.2,
    accentMetalness: 0.95,
  },
  stealth: {
    id: 'stealth',
    label: '발키리',
    subtitle: 'Obsidian Carbon · Crimson Plasma',
    armorPrimaryColor: 0x3f444e,
    armorSecondaryColor: 0x1e222a,
    armorExtrudeColor: 0x252a33,
    armorAccentColor: 0xc8323e,
    innerFrameColor: 0x101216,
    emissiveColor: 0xff2b4a,
    emissiveGlowColor: 0xff1436,
    wispColor: 0xff5a6e,
    hudPrimaryHex: '#ff3b5c',
    hudSecondaryHex: '#ff96a6',
    armorRoughness: 0.52,
    armorMetalness: 0.78,
    accentRoughness: 0.22,
    accentMetalness: 0.92,
  },
  sovereign: {
    id: 'sovereign',
    label: '소버린',
    subtitle: 'Pearl Ceramic · Imperial Gold',
    armorPrimaryColor: 0xe4dfd4,
    armorSecondaryColor: 0x313a4a,
    armorExtrudeColor: 0xd0c9ba,
    armorAccentColor: 0xf4be48,
    innerFrameColor: 0x171b22,
    emissiveColor: 0xffb830,
    emissiveGlowColor: 0xff8c1a,
    wispColor: 0xffcf6b,
    hudPrimaryHex: '#ffb830',
    hudSecondaryHex: '#ffe099',
    armorRoughness: 0.42,
    armorMetalness: 0.65,
    accentRoughness: 0.18,
    accentMetalness: 0.96,
  },
};

export const MECH_STYLE_LIST: MechStyleConfig[] = [
  MECH_STYLES.apex,
  MECH_STYLES.stealth,
  MECH_STYLES.sovereign,
];

export function getMechStyleConfig(id: MechStyleId): MechStyleConfig {
  return MECH_STYLES[id] ?? MECH_STYLES.apex;
}

export interface WingFlareOutput {
  wingSpreadRad: number;
  thrusterScaleY: number;
  bladeExtend: number;
  coreSpinRad: number;
}

/**
 * Pure kinematic calculation for dorsal jet-wing binder spread, thruster flame length,
 * forearm plasma blade extension, and reactor core rotation.
 */
export function computeMechStyleDynamics(
  boostActive: boolean,
  grounded: boolean,
  armAttackActive: boolean,
  moveSpeedAbs: number,
  elapsedSec: number,
): WingFlareOutput {
  const speedRatio = Math.min(1, Math.max(0, moveSpeedAbs / 24));
  const airborneBoost = grounded ? 0 : 1;
  const boostFactor = boostActive ? 1 : 0;

  const wingSpreadRad =
    0.18 +
    speedRatio * 0.22 +
    boostFactor * 0.28 +
    airborneBoost * 0.24 +
    Math.sin(elapsedSec * 1.4) * 0.025;

  const thrusterScaleY =
    0.55 +
    speedRatio * 0.45 +
    boostFactor * 0.85 +
    airborneBoost * 0.75 +
    Math.sin(elapsedSec * 18.0) * 0.08;

  const bladeExtend = armAttackActive ? 1.0 : 0.48 + boostFactor * 0.22;
  const coreSpinRad = elapsedSec * (1.2 + boostFactor * 2.6 + airborneBoost * 1.8);

  return {
    wingSpreadRad,
    thrusterScaleY: Math.max(0.3, thrusterScaleY),
    bladeExtend,
    coreSpinRad,
  };
}
