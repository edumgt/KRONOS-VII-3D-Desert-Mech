/**
 * Pure kinematic & locomotion controller for the 64m alien mech.
 * Decoupled from Three.js scene objects and React DOM so all movement, jump physics,
 * terrain grounding, and arm/leg articulation can be unit-tested deterministically.
 */

export interface MechInputState {
  forward: boolean; // W / ArrowUp
  backward: boolean; // S / ArrowDown
  turnLeft: boolean; // A / ArrowLeft
  turnRight: boolean; // D / ArrowRight
  jump: boolean; // Space
  sprint: boolean; // Shift
  crouch: boolean; // Ctrl / X
  raiseLeftArm: boolean; // Q
  raiseRightArm: boolean; // E
  punchLeft: boolean; // Z
  punchRight: boolean; // C
  kickLeft: boolean; // 1
  kickRight: boolean; // 2
}

export interface MechSimulationState {
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  grounded: boolean;
  landingImpact: number; // 0..1 squash impulse on touchdown
  walkPhase: number;
  moveSpeed: number; // m/s signed forward velocity
  turnRate: number; // rad/s
  boostActive: boolean;

  // Articulated joint angles (radians)
  leftShoulderPitch: number;
  leftShoulderRoll: number;
  leftElbowPitch: number;
  rightShoulderPitch: number;
  rightShoulderRoll: number;
  rightElbowPitch: number;

  leftHipPitch: number;
  leftKneePitch: number;
  rightHipPitch: number;
  rightKneePitch: number;

  torsoPitch: number;
  torsoYaw: number;
  headYaw: number;
}

export const MECH_ARENA_RADIUS = 116; // Keep inside open desert basin well clear of flanking cliffs
export const MECH_GRAVITY = 42; // Weighted colossal scale gravity (m/s^2)
export const MECH_JUMP_VELOCITY = 28; // Peak jump ~9.3m

export function createEmptyInput(): MechInputState {
  return {
    forward: false,
    backward: false,
    turnLeft: false,
    turnRight: false,
    jump: false,
    sprint: false,
    crouch: false,
    raiseLeftArm: false,
    raiseRightArm: false,
    punchLeft: false,
    punchRight: false,
    kickLeft: false,
    kickRight: false,
  };
}

export function createInitialMechState(): MechSimulationState {
  return {
    x: 0,
    y: 0,
    z: 0,
    vy: 0,
    yaw: 0,
    grounded: true,
    landingImpact: 0,
    walkPhase: 0,
    moveSpeed: 0,
    turnRate: 0,
    boostActive: false,
    leftShoulderPitch: 0,
    leftShoulderRoll: 0,
    leftElbowPitch: 0,
    rightShoulderPitch: 0,
    rightShoulderRoll: 0,
    rightElbowPitch: 0,
    leftHipPitch: 0,
    leftKneePitch: 0,
    rightHipPitch: 0,
    rightKneePitch: 0,
    torsoPitch: 0,
    torsoYaw: 0,
    headYaw: 0,
  };
}

function dampValue(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function stepMechKinematics(
  state: MechSimulationState,
  input: MechInputState,
  deltaSec: number,
  terrainHeightFn: (x: number, z: number) => number,
): MechSimulationState {
  const dt = Math.min(Math.max(deltaSec, 0), 0.1);

  // 1. Yaw Steering (A / D)
  const turnInput = (input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0);
  const maxTurnSpeed = input.sprint ? 1.55 : 1.15;
  const targetTurnRate = turnInput * maxTurnSpeed;
  state.turnRate = dampValue(state.turnRate, targetTurnRate, 9.0, dt);
  state.yaw += state.turnRate * dt;

  // 2. Forward / Backward Stride Velocity (W / S + Shift sprint)
  const moveInput = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const maxWalkSpeed = input.sprint ? 26.0 : 14.5;
  const targetSpeed = moveInput * maxWalkSpeed * (input.crouch ? 0.55 : 1.0);
  state.moveSpeed = dampValue(state.moveSpeed, targetSpeed, 7.5, dt);

  // Forward direction in Three.js (+Z is front of mech at yaw = 0)
  const dirX = Math.sin(state.yaw);
  const dirZ = Math.cos(state.yaw);
  state.x += dirX * state.moveSpeed * dt;
  state.z += dirZ * state.moveSpeed * dt;

  // Clamp inside safe desert canyon basin
  const radialDist = Math.hypot(state.x, state.z);
  if (radialDist > MECH_ARENA_RADIUS) {
    const scale = MECH_ARENA_RADIUS / radialDist;
    state.x *= scale;
    state.z *= scale;
  }

  // 3. Jump & Vertical Grounding Physics (Space)
  const groundY = terrainHeightFn(state.x, state.z);

  if (input.jump && state.grounded) {
    state.vy = MECH_JUMP_VELOCITY * (input.sprint ? 1.15 : 1.0);
    state.grounded = false;
  }

  state.vy -= MECH_GRAVITY * dt;
  state.y += state.vy * dt;

  if (state.y <= groundY) {
    if (!state.grounded && state.vy < -8) {
      state.landingImpact = Math.min(1, Math.abs(state.vy) / 30);
    }
    state.y = groundY;
    state.vy = 0;
    state.grounded = true;
  } else if (state.y > groundY + 0.15) {
    state.grounded = false;
  }

  state.landingImpact = dampValue(state.landingImpact, 0, 7.5, dt);
  state.boostActive = !state.grounded || (input.sprint && Math.abs(state.moveSpeed) > 2.0);

  // 4. Procedural Walk Gait Cycle
  const absSpeed = Math.abs(state.moveSpeed);
  const isWalking = state.grounded && (absSpeed > 0.6 || Math.abs(state.turnRate) > 0.15);
  if (isWalking) {
    const strideFreq = (absSpeed / 14.5) * 4.4 + Math.abs(state.turnRate) * 1.8;
    const dirSign = state.moveSpeed >= -0.1 ? 1 : -1;
    state.walkPhase += strideFreq * dirSign * dt;
  } else {
    // Gently settle walk phase to nearest neutral stance (multiples of PI)
    const nearestNeutral = Math.round(state.walkPhase / Math.PI) * Math.PI;
    state.walkPhase = dampValue(state.walkPhase, nearestNeutral, 6.0, dt);
  }

  const walkBlend = state.grounded ? Math.min(1, absSpeed / 8.0 + Math.abs(state.turnRate) * 0.45) : 0;
  const sinPhase = Math.sin(state.walkPhase);

  // 5. Target Joint Angles (Legs: Walk + Jump Tuck + Kick + Crouch)
  let targetLHip = sinPhase * 0.42 * walkBlend;
  let targetLKnee = Math.max(0, -sinPhase) * 0.52 * walkBlend;
  let targetRHip = -sinPhase * 0.42 * walkBlend;
  let targetRKnee = Math.max(0, sinPhase) * 0.52 * walkBlend;

  if (!state.grounded) {
    // Airborne thruster knee-tuck pose
    targetLHip = -0.34;
    targetLKnee = 0.62;
    targetRHip = -0.22;
    targetRKnee = 0.46;
  } else if (input.crouch || state.landingImpact > 0.08) {
    const crouchAmt = input.crouch ? 0.52 : state.landingImpact * 0.45;
    targetLHip -= crouchAmt * 0.65;
    targetLKnee += crouchAmt * 1.15;
    targetRHip -= crouchAmt * 0.65;
    targetRKnee += crouchAmt * 1.15;
  }

  // Explicit Left / Right Kick overrides (1 / 2)
  if (input.kickLeft) {
    targetLHip = -1.05;
    targetLKnee = 0.18;
  }
  if (input.kickRight) {
    targetRHip = -1.05;
    targetRKnee = 0.18;
  }

  // 6. Target Joint Angles (Arms: Counter-swing + Raise Q/E + Punch Z/C)
  let targetLShoulderPitch = -sinPhase * 0.34 * walkBlend;
  let targetLShoulderRoll = input.sprint && absSpeed > 3 ? 0.12 : 0;
  let targetLElbow = -0.2 * walkBlend - (Math.max(0, sinPhase) * 0.28 * walkBlend);

  let targetRShoulderPitch = sinPhase * 0.34 * walkBlend;
  let targetRShoulderRoll = input.sprint && absSpeed > 3 ? -0.12 : 0;
  let targetRElbow = -0.2 * walkBlend - (Math.max(0, -sinPhase) * 0.28 * walkBlend);

  if (!state.grounded) {
    targetLShoulderPitch = -0.55;
    targetLShoulderRoll = 0.24;
    targetLElbow = -0.45;
    targetRShoulderPitch = -0.55;
    targetRShoulderRoll = -0.24;
    targetRElbow = -0.45;
  }

  if (input.raiseLeftArm) {
    targetLShoulderPitch = -1.42;
    targetLShoulderRoll = -0.22;
    targetLElbow = -0.52;
  }
  if (input.raiseRightArm) {
    targetRShoulderPitch = -1.42;
    targetRShoulderRoll = 0.22;
    targetRElbow = -0.52;
  }
  if (input.punchLeft) {
    targetLShoulderPitch = -1.48;
    targetLShoulderRoll = -0.28;
    targetLElbow = -0.18;
  }
  if (input.punchRight) {
    targetRShoulderPitch = -1.48;
    targetRShoulderRoll = 0.28;
    targetRElbow = -0.18;
  }

  // 7. Torso & Head Dynamic Counter-Lean
  let targetTorsoPitch = (state.moveSpeed / 26.0) * 0.14 + (input.crouch ? 0.18 : 0);
  if (state.landingImpact > 0.08) targetTorsoPitch += state.landingImpact * 0.16;

  let targetTorsoYaw = -sinPhase * 0.06 * walkBlend;
  if (input.punchLeft && !input.punchRight) targetTorsoYaw -= 0.22;
  if (input.punchRight && !input.punchLeft) targetTorsoYaw += 0.22;
  if (input.kickLeft && !input.kickRight) targetTorsoYaw -= 0.16;
  if (input.kickRight && !input.kickLeft) targetTorsoYaw += 0.16;

  const targetHeadYaw = state.turnRate * 0.22;

  // Smooth exponential joint damping
  const jSpeed = 12.0;
  state.leftShoulderPitch = dampValue(state.leftShoulderPitch, targetLShoulderPitch, jSpeed, dt);
  state.leftShoulderRoll = dampValue(state.leftShoulderRoll, targetLShoulderRoll, jSpeed, dt);
  state.leftElbowPitch = dampValue(state.leftElbowPitch, targetLElbow, jSpeed, dt);

  state.rightShoulderPitch = dampValue(state.rightShoulderPitch, targetRShoulderPitch, jSpeed, dt);
  state.rightShoulderRoll = dampValue(state.rightShoulderRoll, targetRShoulderRoll, jSpeed, dt);
  state.rightElbowPitch = dampValue(state.rightElbowPitch, targetRElbow, jSpeed, dt);

  state.leftHipPitch = dampValue(state.leftHipPitch, targetLHip, jSpeed, dt);
  state.leftKneePitch = dampValue(state.leftKneePitch, targetLKnee, jSpeed, dt);
  state.rightHipPitch = dampValue(state.rightHipPitch, targetRHip, jSpeed, dt);
  state.rightKneePitch = dampValue(state.rightKneePitch, targetRKnee, jSpeed, dt);

  state.torsoPitch = dampValue(state.torsoPitch, targetTorsoPitch, 9.0, dt);
  state.torsoYaw = dampValue(state.torsoYaw, targetTorsoYaw, 10.0, dt);
  state.headYaw = dampValue(state.headYaw, targetHeadYaw, 8.0, dt);

  return state;
}
