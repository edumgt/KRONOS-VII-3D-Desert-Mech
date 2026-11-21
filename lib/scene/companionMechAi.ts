import {
  MechInputState,
  MechSimulationState,
  createEmptyInput,
  createInitialMechState,
  stepMechKinematics,
} from './mechController';

export interface CompanionUnitSpec {
  id: string;
  scale: number;
  startX: number;
  startZ: number;
  startYaw: number;
  orbitRadius: number;
  orbitSpeedRad: number; // rad/s around patrol arc
  baseAngleRad: number;
  arcSpanRad: number; // > 0 oscillates along flank arc, <= 0 orbits full 360 loop
  jumpPeriodSec: number;
  jumpPhaseOffsetSec: number;
  scanPeriodSec: number;
}

export interface CompanionAgentState {
  spec: CompanionUnitSpec;
  sim: MechSimulationState;
  input: MechInputState;
  patrolTime: number;
  lastJumpSlot: number;
}

export interface HeroAnchor {
  x: number;
  z: number;
}

export const COMPANION_HERO_CLEARANCE = 32;
export const COMPANION_PEER_CLEARANCE = 24;
export const COMPANION_MAX_ARENA_RADIUS = 96;

/**
 * Three autonomous sibling combat mechs patrolling around the 64m KRONOS-VII commander:
 * - VANGUARD-02 (Left flank): visible in opening shot, sweeps left desert corridor
 * - STRIKER-03  (Right flank): visible in opening shot, sweeps right desert corridor
 * - RECON-04    (Rear perimeter): circles the deep canyon basin behind the commander
 */
export const DEFAULT_COMPANION_SPECS: CompanionUnitSpec[] = [
  {
    id: 'vanguard-02',
    scale: 0.74,
    startX: -43,
    startZ: -18,
    startYaw: 0.36,
    orbitRadius: 48,
    orbitSpeedRad: 0.24,
    baseAngleRad: -Math.PI * 0.66, // left-rear to left-mid flank
    arcSpanRad: 0.72,
    jumpPeriodSec: 12.5,
    jumpPhaseOffsetSec: 3.0,
    scanPeriodSec: 9.0,
  },
  {
    id: 'striker-03',
    scale: 0.72,
    startX: 45,
    startZ: -22,
    startYaw: -0.44,
    orbitRadius: 51,
    orbitSpeedRad: 0.21,
    baseAngleRad: Math.PI * 0.64, // right-rear to right-mid flank
    arcSpanRad: 0.76,
    jumpPeriodSec: 14.0,
    jumpPhaseOffsetSec: 7.5,
    scanPeriodSec: 10.5,
  },
  {
    id: 'recon-04',
    scale: 0.66,
    startX: -12,
    startZ: -56,
    startYaw: 1.45,
    orbitRadius: 62,
    orbitSpeedRad: 0.16,
    baseAngleRad: Math.PI, // broad rear-canyon full patrol loop
    arcSpanRad: 0,
    jumpPeriodSec: 16.5,
    jumpPhaseOffsetSec: 11.0,
    scanPeriodSec: 12.0,
  },
];

function wrapAnglePi(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createCompanionSquadronState(
  groundHeightFn: (x: number, z: number) => number,
  specs: CompanionUnitSpec[] = DEFAULT_COMPANION_SPECS,
): CompanionAgentState[] {
  return specs.map((spec) => {
    const sim = createInitialMechState();
    sim.x = spec.startX;
    sim.z = spec.startZ;
    sim.y = groundHeightFn(spec.startX, spec.startZ);
    sim.yaw = spec.startYaw;
    return {
      spec,
      sim,
      input: createEmptyInput(),
      patrolTime: 0,
      lastJumpSlot: -1,
    };
  });
}

function resetInput(inp: MechInputState): void {
  inp.forward = false;
  inp.backward = false;
  inp.turnLeft = false;
  inp.turnRight = false;
  inp.jump = false;
  inp.sprint = false;
  inp.crouch = false;
  inp.raiseLeftArm = false;
  inp.raiseRightArm = false;
  inp.punchLeft = false;
  inp.punchRight = false;
  inp.kickLeft = false;
  inp.kickRight = false;
}

/**
 * Advances autonomous patrolling, collision avoidance, thruster jumps, and limb kinematics
 * for the entire companion mech squadron with zero per-frame allocations.
 */
export function stepCompanionSquadron(
  agents: CompanionAgentState[],
  hero: HeroAnchor,
  deltaSec: number,
  groundHeightFn: (x: number, z: number) => number,
): void {
  const dt = Math.min(Math.max(deltaSec, 0), 0.1);
  if (dt <= 0) return;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const { spec, sim, input } = agent;
    agent.patrolTime += dt;
    resetInput(input);

    // 1. Compute dynamic patrol waypoint relative to the commander's current position
    const angle =
      spec.arcSpanRad > 0
        ? spec.baseAngleRad + Math.sin(agent.patrolTime * spec.orbitSpeedRad) * spec.arcSpanRad
        : spec.baseAngleRad + agent.patrolTime * spec.orbitSpeedRad;

    let targetX = hero.x + Math.sin(angle) * spec.orbitRadius;
    let targetZ = hero.z + Math.cos(angle) * spec.orbitRadius;

    // Keep waypoint clear of foreground human scout viewing ridge (z in [36..64], |x| < 26)
    if (targetZ > 36 && targetZ < 66 && Math.abs(targetX) < 26) {
      targetX = (targetX >= 0 ? 1 : -1) * 30;
    }

    // Clamp waypoint inside safe desert valley basin
    const wpR = Math.hypot(targetX, targetZ);
    if (wpR > COMPANION_MAX_ARENA_RADIUS) {
      const s = COMPANION_MAX_ARENA_RADIUS / wpR;
      targetX *= s;
      targetZ *= s;
    }

    // 2. Desired vector toward patrol waypoint + repulsion from hero & peers
    let steerX = targetX - sim.x;
    let steerZ = targetZ - sim.z;
    const distToWp = Math.hypot(steerX, steerZ);
    if (distToWp > 0.001) {
      steerX /= distToWp;
      steerZ /= distToWp;
    }

    // Repel smoothly from hero commander if too close
    const hx = sim.x - hero.x;
    const hz = sim.z - hero.z;
    const heroDist = Math.hypot(hx, hz);
    if (heroDist < COMPANION_HERO_CLEARANCE && heroDist > 0.01) {
      const push = ((COMPANION_HERO_CLEARANCE - heroDist) / COMPANION_HERO_CLEARANCE) * 2.6;
      steerX += (hx / heroDist) * push;
      steerZ += (hz / heroDist) * push;
    }

    // Repel smoothly from peer companion mechs
    for (let j = 0; j < agents.length; j++) {
      if (i === j) continue;
      const peer = agents[j].sim;
      const px = sim.x - peer.x;
      const pz = sim.z - peer.z;
      const peerDist = Math.hypot(px, pz);
      if (peerDist < COMPANION_PEER_CLEARANCE && peerDist > 0.01) {
        const push = ((COMPANION_PEER_CLEARANCE - peerDist) / COMPANION_PEER_CLEARANCE) * 2.4;
        steerX += (px / peerDist) * push;
        steerZ += (pz / peerDist) * push;
      }
    }

    // 3. Convert desired steering vector into natural mech yaw + stride controls
    const desiredYaw = Math.atan2(steerX, steerZ);
    const yawDiff = wrapAnglePi(desiredYaw - sim.yaw);

    if (yawDiff > 0.09) {
      input.turnLeft = true;
    } else if (yawDiff < -0.09) {
      input.turnRight = true;
    }

    if (distToWp > 3.5 || heroDist < COMPANION_HERO_CLEARANCE) {
      // Stride forward whenever reasonably aligned with desired heading
      if (Math.abs(yawDiff) < 1.25) {
        input.forward = true;
      }
      // Sprint boost when catching up to commander or crossing long arcs
      if (distToWp > 26 && Math.abs(yawDiff) < 0.55) {
        input.sprint = true;
      }
    }

    // 4. Periodic autonomous thruster jump & tactical sensor arm sweep
    const jumpClock = agent.patrolTime + spec.jumpPhaseOffsetSec;
    const jumpSlot = Math.floor(jumpClock / spec.jumpPeriodSec);
    if (jumpSlot > agent.lastJumpSlot && sim.grounded && Math.abs(yawDiff) < 0.7) {
      agent.lastJumpSlot = jumpSlot;
      input.jump = true;
      input.sprint = true;
    }

    const scanPhase = (agent.patrolTime + spec.jumpPhaseOffsetSec) % spec.scanPeriodSec;
    if (scanPhase < 1.6 && sim.grounded) {
      if (i % 2 === 0) {
        input.raiseRightArm = true;
      } else {
        input.raiseLeftArm = true;
      }
    }

    // 5. Step full weighted mech physics & limb kinematics
    stepMechKinematics(sim, input, dt, groundHeightFn);

    // 6. Hard safety clamp so companion never enters commander's core footprint
    const postHx = sim.x - hero.x;
    const postHz = sim.z - hero.z;
    const postHeroDist = Math.hypot(postHx, postHz);
    const hardMinHero = 24;
    if (postHeroDist < hardMinHero && postHeroDist > 0.001) {
      const k = hardMinHero / postHeroDist;
      sim.x = hero.x + postHx * k;
      sim.z = hero.z + postHz * k;
      if (sim.grounded) {
        sim.y = groundHeightFn(sim.x, sim.z);
      }
    }
  }
}
