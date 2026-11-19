/**
 * Realistic heroic combat-mech proportion blueprint (64m total stature).
 *
 * Calibrated to cinema-grade real-robot proportions (~9 heads tall):
 * - Legs occupy ~54% of total stature (hip at y = 34.4m, knee at y = 18.8m, soles flush at y = 0)
 * - Compact predatory Valkyrie head (~7.0m tall, ~11% of total height)
 * - Athletic V-taper torso with elbow aligned at waist height (y = 38.4m)
 *   and fingertips resting naturally at mid-thigh (y = 22.8m)
 */
export interface MechProportionSpec {
  totalHeightM: number;
  headHeightM: number;
  headCenterY: number;
  neckBaseY: number;
  torsoBaseY: number;
  shoulderLocalY: number;
  shoulderHalfSpanX: number;
  upperArmLengthM: number;
  forearmLengthM: number;
  handLengthM: number;
  pelvisCenterY: number;
  hipHalfSpanX: number;
  hipY: number;
  thighLengthM: number;
  shinLengthM: number;
  footHeightM: number;
}

export const HEROIC_MECH_PROPORTIONS: MechProportionSpec = {
  totalHeightM: 64.0,
  headHeightM: 7.0,
  headCenterY: 58.2,
  neckBaseY: 54.2,
  torsoBaseY: 37.8,
  shoulderLocalY: 14.0, // world y = 51.8m
  shoulderHalfSpanX: 12.0,
  upperArmLengthM: 11.8, // elbow at world y = 38.4m (natural waist alignment)
  forearmLengthM: 11.4, // wrist at world y = 27.0m
  handLengthM: 4.2, // fingertips at world y = 22.8m (natural mid-thigh reach)
  pelvisCenterY: 35.6,
  hipHalfSpanX: 6.4,
  hipY: 34.4, // 53.75% of total 64m stature
  thighLengthM: 15.6, // knee at world y = 18.8m
  shinLengthM: 15.8, // ankle at world y = 3.0m
  footHeightM: 3.0, // sole dead flush at y = 0.0m
};

export interface DerivedAnatomyMetrics {
  headToBodyRatio: number; // ~8.0 - 9.8 for heroic real-robot stature
  legToBodyRatio: number; // ~0.50 - 0.56 for athletic realistic legs
  shoulderWorldY: number;
  elbowWorldY: number;
  fingertipWorldY: number;
  kneeWorldY: number;
  soleWorldY: number;
  shoulderToHipWidthRatio: number; // V-taper > 1.5
}

export function computeAnatomyMetrics(
  spec: MechProportionSpec = HEROIC_MECH_PROPORTIONS,
): DerivedAnatomyMetrics {
  const shoulderWorldY = spec.torsoBaseY + spec.shoulderLocalY;
  const armAnchorY = shoulderWorldY - 1.6;
  const elbowWorldY = armAnchorY - spec.upperArmLengthM;
  const fingertipWorldY = elbowWorldY - spec.forearmLengthM - spec.handLengthM;
  const kneeWorldY = spec.hipY - spec.thighLengthM;
  const soleWorldY = kneeWorldY - spec.shinLengthM - spec.footHeightM;

  return {
    headToBodyRatio: spec.totalHeightM / spec.headHeightM,
    legToBodyRatio: spec.hipY / spec.totalHeightM,
    shoulderWorldY,
    elbowWorldY,
    fingertipWorldY,
    kneeWorldY,
    soleWorldY,
    shoulderToHipWidthRatio: spec.shoulderHalfSpanX / spec.hipHalfSpanX,
  };
}
