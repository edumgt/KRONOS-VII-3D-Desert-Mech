import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MECH_ARENA_RADIUS,
  createEmptyInput,
  createInitialMechState,
  stepMechKinematics,
} from './mechController';
import { groundHeightAt } from './desertTerrain';

test('walking forward moves mech along yaw, cycles walkPhase, and tracks terrain height', () => {
  const state = createInitialMechState();
  const input = createEmptyInput();
  input.forward = true;

  for (let i = 0; i < 40; i++) {
    stepMechKinematics(state, input, 0.05, groundHeightAt);
  }

  assert.ok(state.z > 10, `expected mech to walk forward (+z), got z=${state.z}`);
  assert.ok(state.walkPhase > 1.0, `expected walkPhase to advance, got ${state.walkPhase}`);
  assert.equal(state.grounded, true);
  assert.ok(
    Math.abs(state.y - groundHeightAt(state.x, state.z)) < 0.05,
    'walking mech must remain grounded on desert terrain',
  );
});

test('jump input launches mech airborne and lands cleanly on terrain', () => {
  const state = createInitialMechState();
  const input = createEmptyInput();
  input.jump = true;

  stepMechKinematics(state, input, 0.05, groundHeightAt);
  assert.equal(state.grounded, false);
  assert.ok(state.y > 0.5, `expected mech y > 0.5 after jump, got ${state.y}`);
  assert.ok(state.boostActive, 'thruster boost should activate mid-jump');

  input.jump = false;
  for (let i = 0; i < 60; i++) {
    stepMechKinematics(state, input, 0.05, groundHeightAt);
  }

  assert.equal(state.grounded, true);
  assert.ok(Math.abs(state.y - groundHeightAt(state.x, state.z)) < 0.05);
});

test('arm raise, punch, and leg kick keys articulate joints smoothly and return on release', () => {
  const state = createInitialMechState();
  const input = createEmptyInput();
  input.raiseLeftArm = true;
  input.punchRight = true;
  input.kickLeft = true;

  for (let i = 0; i < 20; i++) {
    stepMechKinematics(state, input, 0.05, groundHeightAt);
  }

  assert.ok(state.leftShoulderPitch < -1.2, `expected left arm raised, got ${state.leftShoulderPitch}`);
  assert.ok(state.rightShoulderPitch < -1.0, `expected right arm punching, got ${state.rightShoulderPitch}`);
  assert.ok(state.leftHipPitch < -0.7, `expected left leg kicking forward, got ${state.leftHipPitch}`);

  // Release all keys
  input.raiseLeftArm = false;
  input.punchRight = false;
  input.kickLeft = false;
  for (let i = 0; i < 40; i++) {
    stepMechKinematics(state, input, 0.05, groundHeightAt);
  }

  assert.ok(Math.abs(state.leftShoulderPitch) < 0.15);
  assert.ok(Math.abs(state.rightShoulderPitch) < 0.15);
  assert.ok(Math.abs(state.leftHipPitch) < 0.15);
});

test('mech movement clamps inside safe canyon arena radius', () => {
  const state = createInitialMechState();
  state.z = MECH_ARENA_RADIUS - 1;
  const input = createEmptyInput();
  input.forward = true;
  input.sprint = true;

  for (let i = 0; i < 40; i++) {
    stepMechKinematics(state, input, 0.05, groundHeightAt);
  }

  const r = Math.hypot(state.x, state.z);
  assert.ok(r <= MECH_ARENA_RADIUS + 1e-6, `expected clamped radius <= ${MECH_ARENA_RADIUS}, got ${r}`);
});
