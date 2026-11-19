import test from 'node:test';
import assert from 'node:assert/strict';
import { groundHeightAt } from './desertTerrain';
import {
  createSandParticleField,
  getSandAtmosphereProfile,
  stepSandParticleField,
} from './sandParticleSim';

test('atmosphere presets provide distinct sand wind speeds and desert palettes', () => {
  const sun = getSandAtmosphereProfile('sunbreak');
  const dusk = getSandAtmosphereProfile('dusk');
  const storm = getSandAtmosphereProfile('storm');

  assert.ok(storm.windX > dusk.windX && dusk.windX > sun.windX);
  assert.ok(storm.gustAmplitude > sun.gustAmplitude);
  assert.ok(storm.opacity > sun.opacity);
  assert.notEqual(sun.baseColorHex, dusk.baseColorHex);
  assert.notEqual(dusk.baseColorHex, storm.baseColorHex);
});

test('blowing sand advects downwind, stays above dunes, and wraps around moving mech', () => {
  const field = createSandParticleField(240, 2026, groundHeightAt, 80);
  const profile = getSandAtmosphereProfile('sunbreak');

  // Snapshot initial average X
  const initialSampleX = field.positions[0];

  const mech = {
    mechX: 0,
    mechY: 0,
    mechZ: 0,
    moveSpeed: 0,
    grounded: true,
  };

  for (let i = 0; i < 20; i++) {
    stepSandParticleField(field, 0.05, i * 0.05, profile, mech, groundHeightAt);
  }

  // Particle 0 should have moved from its starting X
  assert.notEqual(field.positions[0], initialSampleX);

  // Move mech far across the basin and verify particles wrap cleanly around the new mech position
  mech.mechX = 36;
  mech.mechZ = -24;
  stepSandParticleField(field, 0.05, 1.05, profile, mech, groundHeightAt);

  for (let i = 0; i < field.count; i++) {
    const x = field.positions[i * 3];
    const y = field.positions[i * 3 + 1];
    const z = field.positions[i * 3 + 2];
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
    assert.ok(Math.abs(x - mech.mechX) <= field.halfExtent + 0.01);
    assert.ok(Math.abs(z - mech.mechZ) <= field.halfExtent + 0.01);
    assert.ok(y >= groundHeightAt(x, z) + 0.1, `particle ${i} sank below desert terrain`);
    assert.ok(field.alphas[i] >= 0 && field.alphas[i] <= 1);
  }
});

test('airborne mech thruster downwash kicks nearby low sand radially outward and upward', () => {
  const fieldA = createSandParticleField(1, 77, () => 0, 80);
  const fieldB = createSandParticleField(1, 77, () => 0, 80);

  // Place single ground-level particle directly beside the mech's foot
  for (const f of [fieldA, fieldB]) {
    f.positions[0] = 8;
    f.positions[1] = 1.5;
    f.positions[2] = 0;
    f.layerIds[0] = 0;
    f.heightOffsets[0] = 1.5;
  }

  const profile = getSandAtmosphereProfile('sunbreak');
  stepSandParticleField(
    fieldA,
    0.05,
    0.5,
    profile,
    { mechX: 0, mechY: 0, mechZ: 0, moveSpeed: 0, grounded: true },
    () => 0,
  );
  stepSandParticleField(
    fieldB,
    0.05,
    0.5,
    profile,
    { mechX: 0, mechY: 4.5, mechZ: 0, moveSpeed: 12, grounded: false },
    () => 0,
  );

  // Airborne/sprinting mech must kick nearby sand further outward (+X) and higher (+Y)
  assert.ok(fieldB.positions[0] > fieldA.positions[0] + 0.4);
  assert.ok(fieldB.positions[1] > fieldA.positions[1] + 0.15);
});
