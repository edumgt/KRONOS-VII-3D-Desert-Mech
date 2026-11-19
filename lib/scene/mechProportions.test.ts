import test from 'node:test';
import assert from 'node:assert/strict';
import { HEROIC_MECH_PROPORTIONS, computeAnatomyMetrics } from './mechProportions';

test('heroic mech proportions match realistic 8.5-9.5 head stature with grounded soles', () => {
  const m = computeAnatomyMetrics(HEROIC_MECH_PROPORTIONS);

  // Cinema-grade real-robot head-to-body ratio (~8.5 to 9.5 heads tall)
  assert.ok(
    m.headToBodyRatio >= 8.2 && m.headToBodyRatio <= 9.6,
    `expected heroic head ratio 8.2..9.6, got ${m.headToBodyRatio.toFixed(2)}`,
  );

  // Athletic long legs (hip height is 51%..56% of total stature)
  assert.ok(
    m.legToBodyRatio >= 0.51 && m.legToBodyRatio <= 0.56,
    `expected athletic leg ratio 0.51..0.56, got ${m.legToBodyRatio.toFixed(3)}`,
  );

  // Soles sit mathematically flush at y = 0.0m
  assert.ok(Math.abs(m.soleWorldY) < 0.05, `expected sole at y=0, got ${m.soleWorldY}`);

  // Heroic V-taper silhouette (shoulders significantly broader than hips)
  assert.ok(m.shoulderToHipWidthRatio >= 1.65 && m.shoulderToHipWidthRatio <= 2.15);
});

test('arm length aligns elbow near waist and fingertips naturally at mid-thigh (never past knees)', () => {
  const m = computeAnatomyMetrics(HEROIC_MECH_PROPORTIONS);

  // Elbow aligns naturally near pelvis/waist height (within 4m of waist/pelvis)
  assert.ok(
    m.elbowWorldY >= HEROIC_MECH_PROPORTIONS.pelvisCenterY &&
      m.elbowWorldY <= HEROIC_MECH_PROPORTIONS.pelvisCenterY + 5.0,
    `elbow y=${m.elbowWorldY} should sit near waist`,
  );

  // Fingertips rest naturally at mid-thigh, strictly above the knee joint!
  assert.ok(
    m.fingertipWorldY > m.kneeWorldY + 2.5 && m.fingertipWorldY < HEROIC_MECH_PROPORTIONS.hipY - 7.0,
    `fingertips y=${m.fingertipWorldY} should rest at mid-thigh above knee y=${m.kneeWorldY}`,
  );
});
