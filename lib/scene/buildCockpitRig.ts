import * as THREE from 'three';
import { MechInputState, MechSimulationState } from './mechController';
import { MechStyleId, getMechStyleConfig } from './mechStyles';
import { SceneMaterialLibrary } from './proceduralMaterials';

export interface CockpitRigHandle {
  group: THREE.Group;
  update: (
    sim: MechSimulationState,
    input: MechInputState,
    elapsedSec: number,
    visible: boolean,
    styleId: MechStyleId,
  ) => void;
  dispose: () => void;
}

/**
 * 3D Mech Pilot Cockpit Interior mounted in the cranial/chest bridge.
 * Features angled armored canopy roll-cage struts (leaving central windshield clear),
 * sloped tactical dash with procedural CanvasTexture attitude/limb telemetry screen,
 * dual glowing cyan thruster throttle levers, and articulated left/right flight joysticks.
 */
export function buildCockpitRig(
  mats: SceneMaterialLibrary,
  maxAnisotropy: number,
): CockpitRigHandle {
  const root = new THREE.Group();
  root.name = 'MechCockpitRig';
  root.visible = false;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Procedural CanvasTexture for Center Tactical Console Display (dynamic updates)
  const hudCanvas = document.createElement('canvas');
  hudCanvas.width = 512;
  hudCanvas.height = 256;
  const ctx = hudCanvas.getContext('2d')!;
  const hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.colorSpace = THREE.SRGBColorSpace;
  hudTexture.anisotropy = maxAnisotropy;
  textures.push(hudTexture);

  const hudMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: hudTexture,
      transparent: true,
      opacity: 0.94,
    }),
  );

  const canopyGlassMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x0b1f29,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const gripMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161a1e,
      roughness: 0.72,
      metalness: 0.25,
    }),
  );

  const amberEmissiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffb347,
      emissive: new THREE.Color(0xff8c1a),
      emissiveIntensity: 1.35,
      roughness: 0.3,
      metalness: 0.1,
    }),
  );

  const makePart = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  };

  // =========================================================================
  // 1. ARMORED CANOPY ROLL-CAGE STRUTS (framing edges, center clear)
  // =========================================================================
  const strutSpecs = [
    // Left & right angled windshield A-pillars
    { pos: [-0.68, 0.14, -0.78], rot: [0.32, 0.24, -0.28], size: [0.055, 1.08, 0.07] },
    { pos: [0.68, 0.14, -0.78], rot: [0.32, -0.24, 0.28], size: [0.055, 1.08, 0.07] },
    // Upper canopy brow header bar
    { pos: [0, 0.48, -0.62], rot: [0.16, 0, 0], size: [1.26, 0.055, 0.08] },
    // Lower cowling sill bar
    { pos: [0, -0.21, -0.9], rot: [-0.18, 0, 0], size: [1.46, 0.07, 0.15] },
    // Left & right side cockpit sill rails
    { pos: [-0.72, -0.16, -0.52], rot: [0, 0.12, 0], size: [0.09, 0.12, 0.75] },
    { pos: [0.72, -0.16, -0.52], rot: [0, -0.12, 0], size: [0.09, 0.12, 0.75] },
  ];

  for (const s of strutSpecs) {
    const strut = makePart(
      trackGeo(new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2])),
      mats.innerFrame,
    );
    strut.position.set(s.pos[0], s.pos[1], s.pos[2]);
    strut.rotation.set(s.rot[0], s.rot[1], s.rot[2]);
    root.add(strut);
  }

  // Thin cyan status accent strips along the inner A-pillars
  for (const side of [-1, 1]) {
    const pillarLight = makePart(
      trackGeo(new THREE.BoxGeometry(0.012, 0.44, 0.015)),
      mats.cyanEmissive,
    );
    pillarLight.position.set(side * 0.65, 0.14, -0.74);
    pillarLight.rotation.set(0.32, -side * 0.24, side * 0.28);
    root.add(pillarLight);
  }

  // Subtle holographic reticle frame floating near top-center glass
  const canopyTint = makePart(trackGeo(new THREE.PlaneGeometry(1.45, 0.85)), canopyGlassMat);
  canopyTint.position.set(0, 0.12, -0.88);
  root.add(canopyTint);

  // =========================================================================
  // 2. LOWER COCKPIT DASHBOARD CONSOLE & TACTICAL HUD SCREEN
  // =========================================================================
  const dashBody = makePart(trackGeo(new THREE.BoxGeometry(1.22, 0.22, 0.36)), mats.armorSecondary);
  dashBody.position.set(0, -0.27, -0.76);
  dashBody.rotation.x = 0.28;
  root.add(dashBody);

  const screenBezel = makePart(trackGeo(new THREE.BoxGeometry(0.54, 0.25, 0.04)), mats.innerFrame);
  screenBezel.position.set(0, -0.115, -0.68);
  screenBezel.rotation.x = -0.32;
  root.add(screenBezel);

  const screenSurface = makePart(trackGeo(new THREE.PlaneGeometry(0.49, 0.215)), hudMat);
  screenSurface.position.set(0, -0.112, -0.658);
  screenSurface.rotation.x = -0.32;
  root.add(screenSurface);

  // Lateral indicator gauges (amber & cyan reactor switches)
  for (let i = 0; i < 4; i++) {
    const swLeft = makePart(
      trackGeo(new THREE.BoxGeometry(0.036, 0.016, 0.025)),
      i === 0 ? amberEmissiveMat : mats.cyanEmissive,
    );
    swLeft.position.set(-0.46 + i * 0.048, -0.165, -0.74);
    swLeft.rotation.x = -0.38;
    root.add(swLeft);

    const swRight = makePart(
      trackGeo(new THREE.BoxGeometry(0.036, 0.016, 0.025)),
      i === 3 ? amberEmissiveMat : mats.cyanEmissive,
    );
    swRight.position.set(0.32 + i * 0.048, -0.165, -0.74);
    swRight.rotation.x = -0.38;
    root.add(swRight);
  }

  // =========================================================================
  // 3. DUAL ARTICULATED FLIGHT JOYSTICKS (LEFT & RIGHT CONTROL STICKS)
  // =========================================================================
  const buildJoystick = (side: -1 | 1) => {
    const baseMount = makePart(
      trackGeo(new THREE.CylinderGeometry(0.075, 0.095, 0.08, 12)),
      mats.innerFrame,
    );
    baseMount.position.set(side * 0.4, -0.24, -0.54);
    root.add(baseMount);

    const stickPivot = new THREE.Group();
    stickPivot.position.set(side * 0.4, -0.21, -0.54);
    root.add(stickPivot);

    const boot = makePart(
      trackGeo(new THREE.CylinderGeometry(0.032, 0.055, 0.06, 10)),
      gripMat,
    );
    boot.position.set(0, 0.025, 0);
    stickPivot.add(boot);

    const shaft = makePart(
      trackGeo(new THREE.CylinderGeometry(0.018, 0.022, 0.14, 10)),
      mats.pistonChrome,
    );
    shaft.position.set(0, 0.095, 0);
    stickPivot.add(shaft);

    const grip = makePart(
      trackGeo(new THREE.CylinderGeometry(0.028, 0.024, 0.11, 10)),
      gripMat,
    );
    grip.position.set(0, 0.175, -0.008);
    grip.rotation.x = 0.18;
    stickPivot.add(grip);

    const triggerRing = makePart(
      trackGeo(new THREE.BoxGeometry(0.028, 0.016, 0.032)),
      mats.cyanEmissive,
    );
    triggerRing.position.set(0, 0.215, -0.024);
    stickPivot.add(triggerRing);

    return stickPivot;
  };

  const leftStick = buildJoystick(-1);
  const rightStick = buildJoystick(1);

  // Center dual thruster throttle bar
  const throttleBase = makePart(
    trackGeo(new THREE.BoxGeometry(0.14, 0.05, 0.14)),
    mats.innerFrame,
  );
  throttleBase.position.set(-0.56, -0.22, -0.6);
  root.add(throttleBase);

  const throttleHandle = makePart(
    trackGeo(new THREE.BoxGeometry(0.1, 0.035, 0.045)),
    mats.armorPrimary,
  );
  throttleHandle.position.set(-0.56, -0.17, -0.6);
  root.add(throttleHandle);

  let lastHudDrawSec = -1;

  const drawHudScreen = (
    sim: MechSimulationState,
    input: MechInputState,
    styleId: MechStyleId,
  ) => {
    const style = getMechStyleConfig(styleId);
    const primary = style.hudPrimaryHex;
    const secondary = style.hudSecondaryHex;

    ctx.clearRect(0, 0, 512, 256);

    // Dark tactical CRT background
    ctx.fillStyle = '#071015';
    ctx.fillRect(0, 0, 512, 256);

    // Subtle gridlines
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = primary;
    ctx.lineWidth = 1;
    for (let x = 32; x < 512; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 32; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Left: Mech Silhouette / Limb Telemetry
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(14, 14, 484, 228);

    ctx.fillStyle = secondary;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`KRONOS-VII // ${styleId.toUpperCase()} LINK`, 28, 42);

    ctx.fillStyle = sim.boostActive ? '#ffb84d' : primary;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(
      sim.grounded
        ? `SPD ${Math.abs(sim.moveSpeed).toFixed(1)} m/s   ALT ${sim.y.toFixed(1)}m`
        : `AIRBORNE THRUST   ALT ${sim.y.toFixed(1)}m`,
      28,
      68,
    );

    // Limb active readouts
    const limbRow = (label: string, active: boolean, x: number, y: number) => {
      ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.2)' : 'rgba(18, 28, 36, 0.84)';
      ctx.fillRect(x, y, 134, 30);
      ctx.strokeStyle = active ? primary : 'rgba(255, 255, 255, 0.22)';
      ctx.strokeRect(x, y, 134, 30);
      ctx.fillStyle = active ? '#ffffff' : secondary;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(label, x + 10, y + 20);
    };

    limbRow('L-ARM [Q/Z]', input.raiseLeftArm || input.punchLeft, 28, 92);
    limbRow('R-ARM [E/C]', input.raiseRightArm || input.punchRight, 174, 92);
    limbRow('L-LEG [1]', input.kickLeft, 28, 132);
    limbRow('R-LEG [2]', input.kickRight, 174, 132);
    limbRow('JUMP [SPACE]', !sim.grounded || input.jump, 28, 172);
    limbRow('BOOST [SHIFT]', sim.boostActive, 174, 172);

    // Right: Mini Horizon / Canyon Compass Radar
    const cx = 408;
    const cy = 136;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = primary;
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Mech position dot inside canyon basin
    const mx = cx + (sim.x / 120) * 54;
    const mz = cy + (sim.z / 120) * 54;
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(-sim.yaw);
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(-6, -6);
    ctx.lineTo(6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = secondary;
    ctx.font = '12px monospace';
    ctx.fillText('CANYON RADAR', 362, 222);

    hudTexture.needsUpdate = true;
  };

  let lastDrawnStyle: MechStyleId = 'apex';

  const update = (
    sim: MechSimulationState,
    input: MechInputState,
    elapsedSec: number,
    visible: boolean,
    styleId: MechStyleId,
  ) => {
    root.visible = visible;
    if (!visible) return;

    // Subtle cockpit suspension shake on walk stride & landing impact
    const strideBob =
      sim.grounded && Math.abs(sim.moveSpeed) > 0.8
        ? Math.sin(sim.walkPhase * 2.0) * 0.009
        : 0;
    const impactDrop = sim.landingImpact * 0.032;
    root.position.set(0, strideBob - impactDrop, 0);

    // Animate dual joysticks directly from user inputs & arm/leg actions
    const moveTilt = (input.forward ? -0.22 : 0) + (input.backward ? 0.22 : 0);
    const turnRoll = (input.turnLeft ? 0.24 : 0) + (input.turnRight ? -0.24 : 0);

    leftStick.rotation.x =
      moveTilt + (input.raiseLeftArm ? -0.28 : 0) + (input.punchLeft ? -0.36 : 0);
    leftStick.rotation.z = turnRoll + (input.kickLeft ? 0.2 : 0);

    rightStick.rotation.x =
      moveTilt + (input.raiseRightArm ? -0.28 : 0) + (input.punchRight ? -0.36 : 0);
    rightStick.rotation.z = turnRoll + (input.kickRight ? -0.2 : 0);

    // Throttle lever slides forward when walking or boosting
    const throttleZ = -0.6 - (Math.abs(sim.moveSpeed) / 26.0) * 0.055;
    throttleHandle.position.z = throttleZ;

    // Refresh tactical CRT screen ~10Hz or immediately on style change
    if (elapsedSec - lastHudDrawSec >= 0.09 || styleId !== lastDrawnStyle) {
      lastHudDrawSec = elapsedSec;
      lastDrawnStyle = styleId;
      drawHudScreen(sim, input, styleId);
    }
  };

  return {
    group: root,
    update,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
