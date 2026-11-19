import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MECH_STYLE_LIST,
  computeMechStyleDynamics,
  getMechStyleConfig,
} from './mechStyles';

test('all mech style presets expose distinct armor/emissive palettes and healthy material contrast', () => {
  assert.equal(MECH_STYLE_LIST.length, 3);
  const emissiveSet = new Set(MECH_STYLE_LIST.map((s) => s.emissiveColor));
  assert.equal(emissiveSet.size, 3, 'Each style must have a distinct emissive plasma hue');

  for (const style of MECH_STYLE_LIST) {
    const resolved = getMechStyleConfig(style.id);
    assert.equal(resolved.id, style.id);
    assert.ok(
      Math.abs(style.armorRoughness - style.accentRoughness) >= 0.2,
      `Style ${style.id} should maintain visible roughness contrast between armor and metallic accent`,
    );
  }
});

test('dorsal jet-wing flare, thruster scale, and plasma blades react strongly to jump, boost, and attacks', () => {
  const idle = computeMechStyleDynamics(false, true, false, 0, 1.0);
  const jumping = computeMechStyleDynamics(true, false, false, 12, 1.0);
  const attacking = computeMechStyleDynamics(false, true, true, 0, 1.0);

  assert.ok(
    jumping.wingSpreadRad > idle.wingSpreadRad + 0.4,
    'Wings should flare wider during airborne boost',
  );
  assert.ok(
    jumping.thrusterScaleY > idle.thrusterScaleY + 1.2,
    'Thruster plumes should elongate significantly during jump boost',
  );
  assert.ok(
    attacking.bladeExtend > idle.bladeExtend + 0.4,
    'Forearm plasma blades should extend fully during arm attacks',
  );
});
