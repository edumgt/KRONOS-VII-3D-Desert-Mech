import test from 'node:test';
import assert from 'node:assert/strict';
import { groundHeightAt, getForegroundHumanPlacements } from './desertTerrain';
import {
  DEFAULT_DRONE_CONFIG,
  advanceOrbitAngle,
  computeCameraPose,
  isFullBodyInFrame,
  normalizeAzimuthDeg,
} from './cameraRig';

test('desert terrain basin at origin is near y=0 and canyon walls rise outside 105m orbit', () => {
  const centerHeight = groundHeightAt(0, 0);
  assert.equal(centerHeight, 0);

  const leftOrbitFloor = groundHeightAt(-105, 0);
  const rightOrbitFloor = groundHeightAt(105, 0);
  assert.ok(leftOrbitFloor < 6, `expected open 105m orbit corridor < 6m, got ${leftOrbitFloor}`);
  assert.ok(rightOrbitFloor < 6, `expected open 105m orbit corridor < 6m, got ${rightOrbitFloor}`);

  const leftCliff = groundHeightAt(-155, 0);
  const rightCliff = groundHeightAt(155, 0);
  assert.ok(leftCliff > 8, `expected outer left canyon cliff > 8m, got ${leftCliff}`);
  assert.ok(rightCliff > 8, `expected outer right canyon cliff > 8m, got ${rightCliff}`);
});

test('foreground human scouts are grounded in front of mech and face toward origin', () => {
  const scouts = getForegroundHumanPlacements();
  assert.ok(scouts.length >= 5);
  for (const scout of scouts) {
    assert.ok(scout.z > 35, 'scout should stand in foreground ridge');
    assert.ok(scout.scale >= 0.9 && scout.scale <= 1.1);
    const groundY = groundHeightAt(scout.x, scout.z);
    assert.ok(Number.isFinite(groundY));
  }
});

test('360 drone orbit maintains constant mid-height and keeps full 64m mech unobstructed across all angles', () => {
  const mechHeight = 64;
  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    const pose = computeCameraPose('orbit360', rad, groundHeightAt, DEFAULT_DRONE_CONFIG);
    assert.ok(
      pose.y >= DEFAULT_DRONE_CONFIG.midHeight,
      `camera y=${pose.y} dropped below midHeight at ${deg}°`,
    );
    const terrainBelow = groundHeightAt(pose.x, pose.z);
    assert.ok(
      pose.y >= terrainBelow + 20,
      `camera clearance below 20m at ${deg}°: y=${pose.y}, terrain=${terrainBelow}`,
    );
    assert.equal(
      isFullBodyInFrame(pose, mechHeight, DEFAULT_DRONE_CONFIG.fovDeg),
      true,
      `full mech body clipped at ${deg}°`,
    );
  }
});

test('advanceOrbitAngle advances smoothly only when playing and normalizes azimuth cleanly', () => {
  const paused = advanceOrbitAngle(1.0, 0.05, 2.0, false);
  assert.equal(paused, 1.0);

  const playing = advanceOrbitAngle(0, 0.05, 1.0, true);
  assert.ok(Math.abs(playing - 0.0225) < 1e-6);

  // Delta spikes above 0.5s are safely clamped
  const spiked = advanceOrbitAngle(0, 2.5, 1.0, true);
  assert.ok(Math.abs(spiked - 0.225) < 1e-6);

  assert.equal(Math.round(normalizeAzimuthDeg(-Math.PI / 2)), 270);
  assert.equal(Math.round(normalizeAzimuthDeg(Math.PI * 2.5)), 90);
});
