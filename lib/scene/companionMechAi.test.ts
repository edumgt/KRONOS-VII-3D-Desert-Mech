import test from 'node:test';
import assert from 'node:assert/strict';
import { groundHeightAt } from './desertTerrain';
import {
  DEFAULT_COMPANION_SPECS,
  createCompanionSquadronState,
  stepCompanionSquadron,
} from './companionMechAi';

test('companion squadron spawns clear of commander and walks autonomously across desert terrain', () => {
  const agents = createCompanionSquadronState(groundHeightAt, DEFAULT_COMPANION_SPECS);
  assert.equal(agents.length, 3);

  const initialPositions = agents.map((a) => ({ x: a.sim.x, z: a.sim.z }));

  // Step 8 seconds of autonomous patrolling
  for (let i = 0; i < 160; i++) {
    stepCompanionSquadron(agents, { x: 0, z: 0 }, 0.05, groundHeightAt);
  }

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const movedDist = Math.hypot(a.sim.x - initialPositions[i].x, a.sim.z - initialPositions[i].z);
    assert.ok(movedDist > 4.0, `companion ${a.spec.id} barely moved: ${movedDist.toFixed(2)}m`);

    // Must stay clear of commander footprint and inside open canyon basin
    const heroDist = Math.hypot(a.sim.x, a.sim.z);
    assert.ok(heroDist >= 23.5, `companion ${a.spec.id} collided with hero: dist=${heroDist}`);
    assert.ok(heroDist <= 116, `companion ${a.spec.id} left arena: dist=${heroDist}`);

    // Must stay grounded on or airborne above local desert terrain
    const gy = groundHeightAt(a.sim.x, a.sim.z);
    assert.ok(a.sim.y >= gy - 0.05, `companion ${a.spec.id} sank below terrain`);
  }
});

test('companion mechs execute periodic autonomous thruster jumps and avoid moving commander', () => {
  const agents = createCompanionSquadronState(groundHeightAt, DEFAULT_COMPANION_SPECS);
  let sawAirborne = false;

  // Move hero directly toward left companion to verify dynamic evasion + jump trigger
  for (let i = 0; i < 280; i++) {
    const hero = { x: -30 * Math.min(1, i / 120), z: -14 * Math.min(1, i / 120) };
    stepCompanionSquadron(agents, hero, 0.05, groundHeightAt);
    for (const a of agents) {
      if (!a.sim.grounded && a.sim.y > groundHeightAt(a.sim.x, a.sim.z) + 1.0) {
        sawAirborne = true;
      }
      const dist = Math.hypot(a.sim.x - hero.x, a.sim.z - hero.z);
      assert.ok(dist >= 23.5, `companion ${a.spec.id} clipped moving hero: dist=${dist}`);
    }
  }

  assert.equal(sawAirborne, true, 'expected at least one companion to execute an autonomous jump');
});
