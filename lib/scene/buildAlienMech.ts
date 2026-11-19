import * as THREE from 'three';
import { SceneMaterialLibrary } from './proceduralMaterials';
import { MechSimulationState } from './mechController';
import { computeMechStyleDynamics } from './mechStyles';
import { HEROIC_MECH_PROPORTIONS } from './mechProportions';

export interface AlienMechHandle {
  group: THREE.Group;
  applyPose: (sim: MechSimulationState, elapsedSec: number, groundY: number) => void;
  update: (elapsedSec: number) => void;
  dispose: () => void;
}

/**
 * Heroic Real-Proportion 64-meter KRONOS-VII APEX Custom Combat Mech (~9-head cinema stature):
 * - Compact, predatory Valkyrie-Manta armored helm (~7m tall) with twin swept gilded V-fin
 *   horns, fiercely recessed glowing optical V-eyes, mandible guard, and aero ear louvers
 * - Athletic V-taper battle torso (broad shoulders tapering into a sculpted armored waist)
 *   framing a dual-ring counter-rotating Hexagonal Arc Reactor Core
 * - Articulated 6-blade Dorsal Jet-Wing Thruster Pack with dynamic downward-tapering plasma cones
 * - Muscular, properly proportioned arms (elbows aligned at waist, fingertips reaching mid-thigh)
 *   with sleek horned shoulder pauldrons, buckler gauntlets, and retractable plasma energy blades
 * - Long, commanding athletic legs (54% of total stature) with sculpted thigh/shin greaves,
 *   aggressive knee-ram shields, calf aero fins, and grounded 3-talon mech feet flush at y=0
 */
export function buildAlienMech(mats: SceneMaterialLibrary): AlienMechHandle {
  const P = HEROIC_MECH_PROPORTIONS;
  const root = new THREE.Group();
  root.name = 'AlienMechColossus';

  const geometries: THREE.BufferGeometry[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  const makeMesh = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    castShadow = true,
    receiveShadow = true,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = castShadow;
    m.receiveShadow = receiveShadow;
    return m;
  };

  /**
   * Builds a clean mirrored ExtrudeGeometry without negative scaling so triangle
   * winding stays counter-clockwise and faces never invert on the opposite side.
   */
  const buildMirroredExtrude = (
    pts: [number, number][],
    side: -1 | 1,
    opts: THREE.ExtrudeGeometryOptions,
    center = true,
  ) => {
    const ordered = side === 1 ? pts : [...pts].reverse();
    const shape = new THREE.Shape();
    shape.moveTo(ordered[0][0] * side, ordered[0][1]);
    for (let i = 1; i < ordered.length; i++) {
      shape.lineTo(ordered[i][0] * side, ordered[i][1]);
    }
    shape.closePath();
    const geo = track(new THREE.ExtrudeGeometry(shape, opts));
    if (center) geo.center();
    return geo;
  };

  // =========================================================================
  // 1. LOWER BODY: ATHLETIC PELVIS, WAIST TASSETS & LONG HEROIC LEGS (y=0..38)
  // =========================================================================
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, P.pelvisCenterY, 0);
  root.add(pelvisGroup);

  const pelvisCore = makeMesh(
    track(new THREE.CylinderGeometry(4.1, 3.4, 4.6, 8)),
    mats.innerFrame,
  );
  pelvisGroup.add(pelvisCore);

  // Sharp beveled central codpiece armor with gilded accent V-crest
  const pelvicShape = new THREE.Shape();
  pelvicShape.moveTo(-2.7, 2.5);
  pelvicShape.lineTo(2.7, 2.5);
  pelvicShape.lineTo(1.9, -1.9);
  pelvicShape.lineTo(0, -4.4);
  pelvicShape.lineTo(-1.9, -1.9);
  pelvicShape.closePath();

  const pelvicPlateGeo = track(
    new THREE.ExtrudeGeometry(pelvicShape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.36,
      bevelSize: 0.28,
      bevelSegments: 2,
    }),
  );
  pelvicPlateGeo.center();

  const frontPelvis = makeMesh(pelvicPlateGeo, mats.armorExtrude);
  frontPelvis.position.set(0, -0.5, 3.5);
  frontPelvis.rotation.x = 0.12;
  pelvisGroup.add(frontPelvis);

  const groinAccent = makeMesh(
    track(new THREE.BoxGeometry(2.1, 0.85, 0.55)),
    mats.armorAccent,
  );
  groinAccent.position.set(0, 1.15, 4.35);
  groinAccent.rotation.x = 0.12;
  pelvisGroup.add(groinAccent);

  const groinLight = makeMesh(
    track(new THREE.BoxGeometry(0.85, 1.8, 0.36)),
    mats.cyanEmissive,
    false,
    false,
  );
  groinLight.position.set(0, -1.35, 4.3);
  groinLight.rotation.x = 0.12;
  pelvisGroup.add(groinLight);

  const rearPelvis = makeMesh(pelvicPlateGeo, mats.armorExtrude);
  rearPelvis.position.set(0, -0.2, -3.5);
  rearPelvis.rotation.x = -0.16;
  pelvisGroup.add(rearPelvis);

  // Sleek Front & Side Armored Waist Skirt Plates (Tassets, clean CCW winding)
  const frontSkirtPts: [number, number][] = [
    [0, 2.2],
    [3.5, 1.6],
    [4.2, -3.4],
    [0.6, -4.1],
  ];

  const sideSkirtShape = new THREE.Shape();
  sideSkirtShape.moveTo(-2.7, 2.4);
  sideSkirtShape.lineTo(2.7, 2.4);
  sideSkirtShape.lineTo(3.5, -3.6);
  sideSkirtShape.lineTo(0, -4.8);
  sideSkirtShape.lineTo(-3.5, -3.6);
  sideSkirtShape.closePath();

  const sideSkirtGeo = track(
    new THREE.ExtrudeGeometry(sideSkirtShape, {
      depth: 0.85,
      bevelEnabled: true,
      bevelThickness: 0.24,
      bevelSize: 0.2,
      bevelSegments: 2,
    }),
  );
  sideSkirtGeo.center();

  for (const side of [-1, 1] as const) {
    const fSkirtGeo = buildMirroredExtrude(frontSkirtPts, side, {
      depth: 0.9,
      bevelEnabled: true,
      bevelThickness: 0.26,
      bevelSize: 0.2,
      bevelSegments: 2,
    });
    const fSkirt = makeMesh(fSkirtGeo, mats.armorExtrude);
    fSkirt.position.set(side * 4.5, -0.8, 3.6);
    fSkirt.rotation.y = side * 0.24;
    fSkirt.rotation.x = -0.15;
    pelvisGroup.add(fSkirt);

    const fSkirtTrim = makeMesh(
      track(new THREE.BoxGeometry(2.6, 0.45, 0.5)),
      mats.armorAccent,
    );
    fSkirtTrim.position.set(side * 4.7, -3.3, 4.35);
    fSkirtTrim.rotation.y = side * 0.24;
    fSkirtTrim.rotation.z = -side * 0.14;
    pelvisGroup.add(fSkirtTrim);

    const sSkirt = makeMesh(sideSkirtGeo, mats.armorSecondary);
    sSkirt.position.set(side * 8.4, -0.5, 0.15);
    sSkirt.rotation.y = side * (Math.PI / 2);
    sSkirt.rotation.z = side * 0.18;
    pelvisGroup.add(sSkirt);

    const hipVent = makeMesh(
      track(new THREE.BoxGeometry(1.6, 0.4, 0.38)),
      mats.cyanEmissive,
      false,
      false,
    );
    hipVent.position.set(side * 2.2, 0.6, -4.2);
    hipVent.rotation.y = side * 0.26;
    pelvisGroup.add(hipVent);
  }

  const buildLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * P.hipHalfSpanX, P.hipY, 0);
    root.add(legGroup);

    // Heavy hip axle & bearing drum
    const hipSocket = makeMesh(
      track(new THREE.CylinderGeometry(2.2, 2.2, 4.2, 12)),
      mats.innerFrame,
    );
    hipSocket.rotation.z = Math.PI / 2;
    hipSocket.position.set(-side * 1.4, 0.2, 0);
    legGroup.add(hipSocket);

    // Long, athletic faceted heavy thigh core (world y = 34.4 -> 18.8m)
    const thighCore = makeMesh(
      track(new THREE.CylinderGeometry(3.85, 3.05, 16.0, 6)),
      mats.armorPrimary,
    );
    thighCore.scale.set(0.92, 1.0, 1.2);
    thighCore.position.set(side * 0.25, -7.8, 0.5);
    thighCore.rotation.x = -0.08;
    thighCore.rotation.y = Math.PI / 6;
    legGroup.add(thighCore);

    // Sculpted layered front quad armor cowl
    const quadShape = new THREE.Shape();
    quadShape.moveTo(-2.3, 6.4);
    quadShape.lineTo(2.3, 6.4);
    quadShape.lineTo(2.9, 1.6);
    quadShape.lineTo(1.9, -6.4);
    quadShape.lineTo(0, -7.3);
    quadShape.lineTo(-1.9, -6.4);
    quadShape.lineTo(-2.9, 1.6);
    quadShape.closePath();

    const quadGeo = track(
      new THREE.ExtrudeGeometry(quadShape, {
        depth: 1.35,
        bevelEnabled: true,
        bevelThickness: 0.36,
        bevelSize: 0.28,
        bevelSegments: 2,
      }),
    );
    quadGeo.center();
    const quadPlate = makeMesh(quadGeo, mats.armorExtrude);
    quadPlate.position.set(side * 0.25, -7.3, 3.8);
    quadPlate.rotation.x = -0.09;
    legGroup.add(quadPlate);

    // Sleek outer thigh armored booster pod + recessed plasma intake vents
    const outerThighPod = makeMesh(
      track(new THREE.BoxGeometry(1.75, 12.8, 4.3)),
      mats.armorSecondary,
    );
    outerThighPod.position.set(side * 3.7, -7.5, 0.3);
    outerThighPod.rotation.x = -0.08;
    outerThighPod.rotation.z = side * 0.05;
    legGroup.add(outerThighPod);

    const thighAccentBar = makeMesh(
      track(new THREE.BoxGeometry(0.45, 10.6, 0.85)),
      mats.armorAccent,
    );
    thighAccentBar.position.set(side * 4.65, -7.5, 1.05);
    thighAccentBar.rotation.x = -0.08;
    thighAccentBar.rotation.z = side * 0.05;
    legGroup.add(thighAccentBar);

    for (let v = 0; v < 3; v++) {
      const thighVent = makeMesh(
        track(new THREE.BoxGeometry(0.36, 0.42, 1.9)),
        mats.cyanEmissive,
        false,
        false,
      );
      thighVent.position.set(side * 4.65, -4.6 - v * 1.65, -0.5);
      thighVent.rotation.x = -0.08;
      legGroup.add(thighVent);
    }

    // Twin exposed chrome inner thigh hydraulic pistons
    for (const pz of [-2.0, -0.5]) {
      const thighPiston = makeMesh(
        track(new THREE.CylinderGeometry(0.36, 0.44, 13.8, 10)),
        mats.pistonChrome,
      );
      thighPiston.position.set(-side * 2.1, -7.8, pz);
      thighPiston.rotation.x = -0.06;
      legGroup.add(thighPiston);
    }

    // Articulated Knee Joint & Aggressive Knee-Ram Shield (world y = 18.8m)
    const kneePivot = new THREE.Group();
    kneePivot.position.set(side * 0.2, -P.thighLengthM, 1.1);
    legGroup.add(kneePivot);

    const kneeDrum = makeMesh(
      track(new THREE.CylinderGeometry(2.3, 2.3, 4.4, 12)),
      mats.innerFrame,
    );
    kneeDrum.rotation.z = Math.PI / 2;
    kneePivot.add(kneeDrum);

    const kneeCapAccent = makeMesh(
      track(new THREE.CylinderGeometry(1.25, 1.25, 4.9, 8)),
      mats.armorAccent,
    );
    kneeCapAccent.rotation.z = Math.PI / 2;
    kneePivot.add(kneeCapAccent);

    const kneeRamShape = new THREE.Shape();
    kneeRamShape.moveTo(-2.2, 2.9);
    kneeRamShape.lineTo(0, 4.9);
    kneeRamShape.lineTo(2.2, 2.9);
    kneeRamShape.lineTo(2.45, -1.0);
    kneeRamShape.lineTo(1.45, -3.2);
    kneeRamShape.lineTo(-1.45, -3.2);
    kneeRamShape.lineTo(-2.45, -1.0);
    kneeRamShape.closePath();

    const kneeRamGeo = track(
      new THREE.ExtrudeGeometry(kneeRamShape, {
        depth: 1.6,
        bevelEnabled: true,
        bevelThickness: 0.38,
        bevelSize: 0.28,
        bevelSegments: 2,
      }),
    );
    kneeRamGeo.center();
    const kneeShield = makeMesh(kneeRamGeo, mats.armorExtrude);
    kneeShield.position.set(0, 0.7, 2.75);
    kneeShield.rotation.x = 0.16;
    kneePivot.add(kneeShield);

    const kneeCrest = makeMesh(
      track(new THREE.BoxGeometry(0.92, 3.8, 0.58)),
      mats.armorAccent,
    );
    kneeCrest.position.set(0, 1.4, 3.75);
    kneeCrest.rotation.x = 0.16;
    kneePivot.add(kneeCrest);

    for (const ks of [-1, 1]) {
      const kneeSlit = makeMesh(
        track(new THREE.BoxGeometry(0.3, 1.65, 0.38)),
        mats.cyanEmissive,
        false,
        false,
      );
      kneeSlit.position.set(ks * 1.22, 0.65, 3.65);
      kneeSlit.rotation.x = 0.16;
      kneeSlit.rotation.z = ks * 0.14;
      kneePivot.add(kneeSlit);
    }

    // Long Athletic Faceted Shin Greave + Forward Armored Guard (world y = 18.8 -> 3.0m)
    const shinCore = makeMesh(
      track(new THREE.CylinderGeometry(2.9, 3.5, 15.4, 6)),
      mats.armorPrimary,
    );
    shinCore.scale.set(0.92, 1.0, 1.2);
    shinCore.position.set(side * 0.1, -7.7, -0.8);
    shinCore.rotation.x = 0.05;
    shinCore.rotation.y = Math.PI / 6;
    kneePivot.add(shinCore);

    const shinGuardShape = new THREE.Shape();
    shinGuardShape.moveTo(-1.95, 6.4);
    shinGuardShape.lineTo(1.95, 6.4);
    shinGuardShape.lineTo(2.7, -4.6);
    shinGuardShape.lineTo(1.6, -6.7);
    shinGuardShape.lineTo(-1.6, -6.7);
    shinGuardShape.lineTo(-2.7, -4.6);
    shinGuardShape.closePath();

    const shinGuardGeo = track(
      new THREE.ExtrudeGeometry(shinGuardShape, {
        depth: 1.25,
        bevelEnabled: true,
        bevelThickness: 0.32,
        bevelSize: 0.22,
        bevelSegments: 2,
      }),
    );
    shinGuardGeo.center();
    const shinFrontArmor = makeMesh(shinGuardGeo, mats.armorExtrude);
    shinFrontArmor.position.set(side * 0.1, -7.5, 2.15);
    shinFrontArmor.rotation.x = 0.06;
    kneePivot.add(shinFrontArmor);

    // Outer swept calf aerodynamic stabilizer fin + glowing ankle vents
    const calfFinPts: [number, number][] = [
      [0, 5.6],
      [2.3, 2.4],
      [1.8, -5.8],
      [0, -4.2],
    ];
    const calfFinGeo = buildMirroredExtrude(calfFinPts, side, {
      depth: 0.62,
      bevelEnabled: true,
      bevelThickness: 0.18,
      bevelSize: 0.14,
      bevelSegments: 2,
    });
    const outerCalfFin = makeMesh(calfFinGeo, mats.armorSecondary);
    outerCalfFin.position.set(side * 3.4, -7.4, -1.35);
    outerCalfFin.rotation.y = side * 0.24;
    kneePivot.add(outerCalfFin);

    for (let v = 0; v < 3; v++) {
      const sideAnkleVent = makeMesh(
        track(new THREE.BoxGeometry(0.34, 0.34, 1.75)),
        mats.cyanEmissive,
        false,
        false,
      );
      sideAnkleVent.position.set(side * 3.1, -10.8 - v * 0.95, -0.7);
      kneePivot.add(sideAnkleVent);
    }

    // Rear calf thruster housing + glowing vents
    const calfBooster = makeMesh(
      track(new THREE.BoxGeometry(3.2, 9.6, 2.9)),
      mats.armorSecondary,
    );
    calfBooster.position.set(side * 0.1, -6.4, -4.4);
    calfBooster.rotation.x = -0.15;
    kneePivot.add(calfBooster);

    for (let v = 0; v < 4; v++) {
      const calfVent = makeMesh(
        track(new THREE.BoxGeometry(1.95, 0.4, 0.34)),
        mats.cyanEmissive,
        false,
        false,
      );
      calfVent.position.set(side * 0.1, -3.6 - v * 1.45, -5.95);
      calfVent.rotation.x = -0.15;
      kneePivot.add(calfVent);
    }

    // Ankle hydraulic collar + Heavy 3-Talon Mechanical Mech Foot + Heel Spur (sole flush at y=0.00m)
    const ankleY = -(P.shinLengthM + 0.6); // -16.4
    const ankleGuard = makeMesh(
      track(new THREE.CylinderGeometry(2.15, 2.75, 2.4, 8)),
      mats.innerFrame,
    );
    ankleGuard.position.set(side * 0.1, ankleY, -0.45);
    kneePivot.add(ankleGuard);

    const soleY = -(P.shinLengthM + P.footHeightM); // -18.8 (exact world y = 0.00m)
    const footChassis = makeMesh(
      track(new THREE.BoxGeometry(5.2, 1.8, 7.0)),
      mats.armorSecondary,
    );
    footChassis.position.set(side * 0.2, soleY + 0.9, -0.15);
    kneePivot.add(footChassis);

    const footInstep = makeMesh(
      track(new THREE.BoxGeometry(3.8, 1.45, 4.5)),
      mats.armorPrimary,
    );
    footInstep.position.set(side * 0.2, soleY + 1.9, 1.35);
    footInstep.rotation.x = 0.26;
    kneePivot.add(footInstep);

    // 3 heavy armored front talons with gilded claw tips (bottom flush at soleY)
    for (let t = -1; t <= 1; t++) {
      const talon = makeMesh(track(new THREE.BoxGeometry(1.32, 1.6, 4.1)), mats.armorExtrude);
      talon.position.set(side * 0.2 + t * 1.95, soleY + 0.8, 3.85 - Math.abs(t) * 0.48);
      talon.rotation.x = 0.14;
      talon.rotation.y = t * 0.2;
      kneePivot.add(talon);

      const clawTip = makeMesh(track(new THREE.BoxGeometry(0.95, 0.8, 1.15)), mats.armorAccent);
      clawTip.position.set(side * 0.2 + t * 2.2, soleY + 0.4, 5.75 - Math.abs(t) * 0.48);
      clawTip.rotation.y = t * 0.2;
      kneePivot.add(clawTip);
    }

    // Rear armored heel stabilizer spur (bottom flush at soleY)
    const heelSpur = makeMesh(track(new THREE.BoxGeometry(2.75, 1.6, 3.5)), mats.armorPrimary);
    heelSpur.position.set(side * 0.2, soleY + 0.8, -4.6);
    heelSpur.rotation.x = -0.12;
    kneePivot.add(heelSpur);

    const footShadow = new THREE.Mesh(
      track(new THREE.CircleGeometry(9.0, 32)),
      mats.contactShadow,
    );
    footShadow.rotation.x = -Math.PI / 2;
    footShadow.position.set(side * (P.hipHalfSpanX + 0.35), 0.03, 1.1);
    root.add(footShadow);

    return { hipPivot: legGroup, kneePivot, footShadow };
  };

  const leftLegRig = buildLeg(1);
  const rightLegRig = buildLeg(-1);

  // =========================================================================
  // 2. HEROIC V-TAPER TORSO, ROTATING ARC REACTOR CORE & JET-WING PACK (y=37.8..54.8)
  // =========================================================================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, P.torsoBaseY, 0);
  root.add(torsoGroup);

  // Athletic Tapered Armored Abdomen over Dark Hydraulic Spine
  const waistCore = makeMesh(
    track(new THREE.CylinderGeometry(4.3, 3.4, 6.6, 12)),
    mats.innerFrame,
  );
  waistCore.position.set(0, 3.0, 0);
  torsoGroup.add(waistCore);

  for (let i = 0; i < 3; i++) {
    const abPlate = makeMesh(
      track(new THREE.BoxGeometry(5.8 + i * 0.75, 1.4, 1.9)),
      mats.armorPrimary,
    );
    abPlate.position.set(0, 1.1 + i * 1.75, 3.25 + i * 0.36);
    abPlate.rotation.x = -0.12;
    torsoGroup.add(abPlate);

    const abVent = makeMesh(
      track(new THREE.BoxGeometry(3.0 + i * 0.35, 0.3, 0.42)),
      mats.cyanEmissive,
      false,
      false,
    );
    abVent.position.set(0, 1.85 + i * 1.75, 4.15 + i * 0.36);
    torsoGroup.add(abVent);
  }

  for (let p = 0; p < 6; p++) {
    const ang = (p / 6) * Math.PI * 2 + 0.35;
    const px = Math.cos(ang) * 3.9;
    const pz = Math.sin(ang) * 3.2;
    const piston = makeMesh(
      track(new THREE.CylinderGeometry(0.34, 0.44, 6.6, 8)),
      mats.pistonChrome,
    );
    piston.position.set(px, 3.0, pz);
    piston.rotation.z = -px * 0.04;
    piston.rotation.x = pz * 0.04;
    torsoGroup.add(piston);
  }

  // Broad Upper Chest Reactor Chassis (athletic heroic V-taper)
  const chestCore = makeMesh(
    track(new THREE.CylinderGeometry(8.0, 4.6, 11.4, 8)),
    mats.innerFrame,
  );
  chestCore.scale.set(1.22, 1.0, 0.88);
  chestCore.position.set(0, 11.2, 0);
  chestCore.rotation.y = Math.PI / 8;
  torsoGroup.add(chestCore);

  // Swept biomechanical side ribs framing the lateral chest
  for (let r = 0; r < 4; r++) {
    const ry = 6.6 + r * 2.15;
    const spread = 6.9 + r * 0.58;
    for (const side of [-1, 1]) {
      const ribCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 3.6, ry + 0.4, 5.7),
        new THREE.Vector3(side * (spread * 0.92), ry - 0.1, 3.4),
        new THREE.Vector3(side * spread, ry - 0.65, -0.5),
        new THREE.Vector3(side * (spread * 0.72), ry - 0.95, -4.6),
      ]);
      const ribMesh = makeMesh(
        track(new THREE.TubeGeometry(ribCurve, 18, 0.38, 8, false)),
        mats.armorSecondary,
      );
      torsoGroup.add(ribMesh);
    }
  }

  // Sculpted Angled Left & Right Layered Pectoral Armor Plates (clean CCW winding)
  const pecPts: [number, number][] = [
    [0.6, 4.7],
    [7.2, 5.7],
    [8.8, 1.8],
    [6.6, -3.7],
    [1.9, -4.4],
    [0.3, -1.3],
  ];

  for (const side of [-1, 1] as const) {
    const pecGeo = buildMirroredExtrude(pecPts, side, {
      depth: 2.25,
      bevelEnabled: true,
      bevelThickness: 0.52,
      bevelSize: 0.38,
      bevelSegments: 2,
    });
    const pecPlate = makeMesh(pecGeo, mats.armorExtrude);
    pecPlate.position.set(side * 5.15, 11.9, 5.75);
    pecPlate.rotation.y = -side * 0.28;
    pecPlate.rotation.x = -0.14;
    torsoGroup.add(pecPlate);

    const pecCap = makeMesh(
      track(new THREE.BoxGeometry(5.5, 2.1, 1.15)),
      mats.armorSecondary,
    );
    pecCap.position.set(side * 5.45, 15.0, 6.5);
    pecCap.rotation.y = -side * 0.28;
    pecCap.rotation.z = side * 0.16;
    torsoGroup.add(pecCap);

    const pecAccent = makeMesh(
      track(new THREE.BoxGeometry(4.5, 0.68, 0.65)),
      mats.armorAccent,
    );
    pecAccent.position.set(side * 5.3, 14.0, 7.25);
    pecAccent.rotation.y = -side * 0.28;
    pecAccent.rotation.z = side * 0.16;
    torsoGroup.add(pecAccent);

    for (let v = 0; v < 3; v++) {
      const chestIntake = makeMesh(
        track(new THREE.BoxGeometry(2.75 - v * 0.3, 0.3, 0.45)),
        mats.cyanEmissive,
        false,
        false,
      );
      chestIntake.position.set(side * 4.8, 10.2 - v * 0.95, 7.35 - v * 0.14);
      chestIntake.rotation.y = -side * 0.28;
      torsoGroup.add(chestIntake);
    }

    // Raised armored collarbone cowl framing the sleek neck
    const collarFin = makeMesh(
      track(new THREE.BoxGeometry(2.7, 3.6, 6.0)),
      mats.armorExtrude,
    );
    collarFin.position.set(side * 4.85, 16.6, 0.9);
    collarFin.rotation.z = -side * 0.28;
    collarFin.rotation.x = 0.12;
    torsoGroup.add(collarFin);

    const collarAccent = makeMesh(
      track(new THREE.BoxGeometry(0.72, 3.9, 6.3)),
      mats.armorAccent,
    );
    collarAccent.position.set(side * 3.75, 17.2, 1.05);
    collarAccent.rotation.z = -side * 0.28;
    collarAccent.rotation.x = 0.12;
    torsoGroup.add(collarAccent);
  }

  // Central Rotating Hexagonal Arc Reactor Chest Core
  const reactorGroup = new THREE.Group();
  reactorGroup.position.set(0, 12.0, 7.2);
  reactorGroup.rotation.x = -0.12;
  torsoGroup.add(reactorGroup);

  const reactorHousing = makeMesh(
    track(new THREE.CylinderGeometry(2.95, 3.3, 1.45, 6)),
    mats.innerFrame,
  );
  reactorHousing.rotation.x = Math.PI / 2;
  reactorGroup.add(reactorHousing);

  const reactorRim = makeMesh(
    track(new THREE.TorusGeometry(2.68, 0.34, 8, 6)),
    mats.armorAccent,
  );
  reactorRim.position.z = 0.68;
  reactorGroup.add(reactorRim);

  const coreRingOuter = makeMesh(
    track(new THREE.TorusGeometry(1.96, 0.21, 8, 6)),
    mats.cyanEmissive,
    false,
    false,
  );
  coreRingOuter.position.z = 0.74;
  reactorGroup.add(coreRingOuter);

  const coreRingInner = makeMesh(
    track(new THREE.TorusGeometry(1.16, 0.18, 8, 6)),
    mats.pistonChrome,
  );
  coreRingInner.position.z = 0.82;
  reactorGroup.add(coreRingInner);

  const corePrism = makeMesh(
    track(new THREE.OctahedronGeometry(1.0, 0)),
    mats.cyanEmissive,
    false,
    false,
  );
  corePrism.scale.set(1, 1, 0.65);
  corePrism.position.z = 0.76;
  reactorGroup.add(corePrism);

  // =========================================================================
  // 2B. HEROIC DORSAL JET-WING THRUSTER PACK (BACKPACK + 6 WING BINDERS)
  // =========================================================================
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 11.4, -6.2);
  torsoGroup.add(backpackGroup);

  const spineChassis = makeMesh(
    track(new THREE.BoxGeometry(7.2, 11.2, 4.3)),
    mats.armorSecondary,
  );
  backpackGroup.add(spineChassis);

  for (let s = 0; s < 5; s++) {
    const vertebra = makeMesh(
      track(new THREE.CylinderGeometry(1.8 - s * 0.06, 2.05 - s * 0.06, 1.2, 6)),
      mats.armorPrimary,
    );
    vertebra.position.set(0, -3.8 + s * 1.85, -2.05);
    vertebra.rotation.x = 0.2;
    backpackGroup.add(vertebra);

    const spineLight = makeMesh(
      track(new THREE.BoxGeometry(1.25, 0.36, 0.45)),
      mats.cyanEmissive,
      false,
      false,
    );
    spineLight.position.set(0, -3.8 + s * 1.85, -3.75);
    backpackGroup.add(spineLight);
  }

  // Twin Main High-Output Jet Thruster Nozzles + Downward-Tapering Plasma Plumes
  const thrusterCones: THREE.Mesh[] = [];
  for (const side of [-1, 1] as const) {
    const nozzleGroup = new THREE.Group();
    nozzleGroup.position.set(side * 3.4, -4.3, -2.1);
    nozzleGroup.rotation.x = 0.42;
    nozzleGroup.rotation.z = side * 0.14;
    backpackGroup.add(nozzleGroup);

    const bellOuter = makeMesh(
      track(new THREE.CylinderGeometry(1.38, 2.05, 3.0, 12)),
      mats.innerFrame,
    );
    nozzleGroup.add(bellOuter);

    const bellRing = makeMesh(
      track(new THREE.TorusGeometry(1.96, 0.21, 8, 12)),
      mats.armorAccent,
    );
    bellRing.rotation.x = Math.PI / 2;
    bellRing.position.y = -1.45;
    nozzleGroup.add(bellRing);

    const flameGeo = track(new THREE.CylinderGeometry(1.48, 0.04, 8.0, 12, 1, true));
    flameGeo.translate(0, -4.0, 0);
    const flameCone = makeMesh(flameGeo, mats.plasmaBladeMat, false, false);
    flameCone.position.y = -1.35;
    nozzleGroup.add(flameCone);

    const coreFlameGeo = track(new THREE.CylinderGeometry(0.74, 0.02, 5.0, 10, 1, true));
    coreFlameGeo.translate(0, -2.5, 0);
    const coreFlame = makeMesh(coreFlameGeo, mats.cyanEmissive, false, false);
    flameCone.add(coreFlame);

    thrusterCones.push(flameCone);
  }

  // Swept Articulated Mechanical Jet-Wing Binder Assemblies (Wide & Swept Backward)
  const buildWingAssembly = (side: -1 | 1) => {
    const wingPivot = new THREE.Group();
    wingPivot.position.set(side * 3.9, 3.8, -2.0);
    backpackGroup.add(wingPivot);

    const pylonMount = makeMesh(
      track(new THREE.CylinderGeometry(1.4, 1.55, 3.2, 8)),
      mats.innerFrame,
    );
    pylonMount.rotation.z = Math.PI / 2;
    wingPivot.add(pylonMount);

    const bladeSpecs = [
      { len: 24.5, width: 3.5, angleZ: 0.66, sweepBackY: 0.26, yOff: 1.4, zOff: -0.5 },
      { len: 20.0, width: 2.9, angleZ: 0.3, sweepBackY: 0.32, yOff: -0.6, zOff: -1.3 },
      { len: 15.5, width: 2.4, angleZ: -0.06, sweepBackY: 0.38, yOff: -2.6, zOff: -2.0 },
    ];

    for (let b = 0; b < bladeSpecs.length; b++) {
      const spec = bladeSpecs[b];
      const featherGroup = new THREE.Group();
      featherGroup.position.set(side * 1.15, spec.yOff, spec.zOff);
      featherGroup.rotation.z = side * spec.angleZ;
      featherGroup.rotation.y = side * spec.sweepBackY;
      wingPivot.add(featherGroup);

      const bladePts: [number, number][] = [
        [0, -spec.width * 0.45],
        [spec.len * 0.78, -spec.width * 0.28],
        [spec.len, spec.width * 0.14],
        [spec.len * 0.86, spec.width * 0.52],
        [0, spec.width * 0.54],
      ];

      const bladeGeo = buildMirroredExtrude(
        bladePts,
        side,
        {
          depth: 0.8,
          bevelEnabled: true,
          bevelThickness: 0.22,
          bevelSize: 0.16,
          bevelSegments: 2,
        },
        false,
      );

      const mainFeather = makeMesh(
        bladeGeo,
        b === 0 ? mats.armorExtrude : mats.armorSecondary,
      );
      featherGroup.add(mainFeather);

      const leadTrim = makeMesh(
        track(new THREE.BoxGeometry(spec.len * 0.78, 0.5, 1.2)),
        mats.armorAccent,
      );
      leadTrim.position.set(side * (spec.len * 0.42), spec.width * 0.5, 0.4);
      featherGroup.add(leadTrim);

      const energyStrip = makeMesh(
        track(new THREE.BoxGeometry(spec.len * 0.86, 0.46, 0.55)),
        mats.cyanEmissive,
        false,
        false,
      );
      energyStrip.position.set(side * (spec.len * 0.45), -spec.width * 0.36, 0.4);
      featherGroup.add(energyStrip);
    }

    return wingPivot;
  };

  const leftWingPivot = buildWingAssembly(1);
  const rightWingPivot = buildWingAssembly(-1);

  // =========================================================================
  // 3. SLEEK HORNED PAULDRONS & PROPORTIONED MUSCULAR ARMS (world y=51.8..22.8)
  // =========================================================================
  const buildArm = (side: -1 | 1) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * P.shoulderHalfSpanX, P.shoulderLocalY, -0.2);
    torsoGroup.add(shoulderPivot);

    // Dark heavy turbine axle + armpit glowing cooling array
    const shoulderDrum = makeMesh(
      track(new THREE.CylinderGeometry(2.5, 2.5, 4.4, 12)),
      mats.innerFrame,
    );
    shoulderDrum.rotation.z = Math.PI / 2;
    shoulderDrum.position.set(-side * 2.0, -0.4, 0);
    shoulderPivot.add(shoulderDrum);

    for (let v = 0; v < 3; v++) {
      const pitVent = makeMesh(
        track(new THREE.BoxGeometry(2.0, 0.28, 0.95)),
        mats.cyanEmissive,
        false,
        false,
      );
      pitVent.position.set(-side * 3.0, -0.7 - v * 0.65, 1.85);
      shoulderPivot.add(pitVent);
    }

    // Sleek Multi-Layered Angular Shoulder Pauldron (clean CCW winding)
    const pauldronPts: [number, number][] = [
      [-3.5, 2.4],
      [1.8, 4.6],
      [5.5, 2.0],
      [4.5, -2.7],
      [1.3, -3.3],
      [-3.4, -1.2],
    ];
    const pauldronGeo = buildMirroredExtrude(pauldronPts, side, {
      depth: 6.8,
      bevelEnabled: true,
      bevelThickness: 0.65,
      bevelSize: 0.5,
      bevelSegments: 2,
    });
    const pauldronMain = makeMesh(pauldronGeo, mats.armorExtrude);
    pauldronMain.position.set(side * 0.95, 0.9, 0);
    pauldronMain.rotation.z = side * 0.08;
    shoulderPivot.add(pauldronMain);

    // Swept Upward Shoulder Horn Fin + Accent Trim
    const hornPts: [number, number][] = [
      [0, 0],
      [4.3, 3.8],
      [5.6, 3.1],
      [2.6, -1.6],
    ];
    const hornGeo = buildMirroredExtrude(hornPts, side, {
      depth: 1.75,
      bevelEnabled: true,
      bevelThickness: 0.28,
      bevelSize: 0.22,
      bevelSegments: 2,
    });
    const shoulderHorn = makeMesh(hornGeo, mats.armorSecondary);
    shoulderHorn.position.set(side * 3.8, 3.9, 0);
    shoulderPivot.add(shoulderHorn);

    const pauldronAccent = makeMesh(
      track(new THREE.BoxGeometry(5.2, 0.68, 7.4)),
      mats.armorAccent,
    );
    pauldronAccent.position.set(side * 1.55, 3.65, 0);
    pauldronAccent.rotation.z = side * 0.34;
    shoulderPivot.add(pauldronAccent);

    for (const fz of [-3.85, 3.85]) {
      const sVent = makeMesh(
        track(new THREE.BoxGeometry(3.4, 0.52, 0.38)),
        mats.cyanEmissive,
        false,
        false,
      );
      sVent.position.set(side * 1.55, 1.35, fz);
      sVent.rotation.z = side * 0.16;
      shoulderPivot.add(sVent);
    }

    // Compact inner-top micro-missile pod
    const missilePod = makeMesh(
      track(new THREE.BoxGeometry(2.35, 2.2, 3.3)),
      mats.armorSecondary,
    );
    missilePod.position.set(-side * 1.85, 3.5, -0.3);
    shoulderPivot.add(missilePod);

    for (let mr = 0; mr < 2; mr++) {
      for (let mc = 0; mc < 2; mc++) {
        const warhead = makeMesh(
          track(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8)),
          mats.armorAccent,
        );
        warhead.rotation.x = Math.PI / 2;
        warhead.position.set(-side * (1.4 + mc * 0.9), 3.05 + mr * 0.9, 1.4);
        shoulderPivot.add(warhead);
      }
    }

    // Articulated Muscular Arm Assembly (shoulder -> elbow = 11.8m, elbow aligned at waist!)
    const armAssembly = new THREE.Group();
    armAssembly.position.set(side * 0.9, -1.6, 0);
    armAssembly.rotation.z = side * 0.11;
    armAssembly.rotation.x = -0.05;
    shoulderPivot.add(armAssembly);

    const upperArmCore = makeMesh(
      track(new THREE.CylinderGeometry(2.1, 1.75, P.upperArmLengthM - 0.4, 8)),
      mats.innerFrame,
    );
    upperArmCore.position.set(0, -P.upperArmLengthM * 0.5, 0);
    armAssembly.add(upperArmCore);

    // Muscular layered hexagonal bicep armor shell (substantial heroic volume, not a thin tube)
    const upperArmPlate = makeMesh(
      track(new THREE.CylinderGeometry(2.85, 2.25, P.upperArmLengthM - 1.2, 6)),
      mats.armorPrimary,
    );
    upperArmPlate.scale.set(0.95, 1.0, 1.18);
    upperArmPlate.position.set(side * 0.4, -P.upperArmLengthM * 0.48, 0.15);
    upperArmPlate.rotation.y = Math.PI / 6;
    armAssembly.add(upperArmPlate);

    const upperArmOuterArmor = makeMesh(
      track(new THREE.BoxGeometry(1.15, P.upperArmLengthM - 2.4, 2.75)),
      mats.armorSecondary,
    );
    upperArmOuterArmor.position.set(side * 2.2, -P.upperArmLengthM * 0.48, 0.15);
    armAssembly.add(upperArmOuterArmor);

    for (const pz of [-1.5, 1.5]) {
      const armPiston = makeMesh(
        track(new THREE.CylinderGeometry(0.32, 0.34, P.upperArmLengthM - 1.4, 8)),
        mats.pistonChrome,
      );
      armPiston.position.set(-side * 1.1, -P.upperArmLengthM * 0.5, pz);
      armAssembly.add(armPiston);
    }

    const elbow = makeMesh(
      track(new THREE.CylinderGeometry(2.05, 2.05, 4.1, 12)),
      mats.innerFrame,
    );
    elbow.rotation.z = Math.PI / 2;
    elbow.position.set(0, -P.upperArmLengthM, 0);
    armAssembly.add(elbow);

    const elbowCap = makeMesh(
      track(new THREE.CylinderGeometry(1.1, 1.1, 4.6, 8)),
      mats.armorAccent,
    );
    elbowCap.rotation.z = Math.PI / 2;
    elbowCap.position.set(0, -P.upperArmLengthM, 0);
    armAssembly.add(elbowCap);

    // Forearm Heavy Armored Gauntlet + Retractable Plasma Blade (elbow -> wrist = 11.4m)
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -P.upperArmLengthM, 0);
    forearmGroup.rotation.x = -0.22;
    forearmGroup.rotation.z = -side * 0.06;
    armAssembly.add(forearmGroup);

    const forearmHousing = makeMesh(
      track(new THREE.CylinderGeometry(2.8, 1.85, P.forearmLengthM - 0.4, 6)),
      mats.armorPrimary,
    );
    forearmHousing.scale.set(0.96, 1.0, 1.24);
    forearmHousing.position.set(0, -P.forearmLengthM * 0.5, 0.3);
    forearmHousing.rotation.y = Math.PI / 6;
    forearmGroup.add(forearmHousing);

    // Layered beveled outer gauntlet buckler shield
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(-1.85, 4.9);
    shieldShape.lineTo(1.95, 4.0);
    shieldShape.lineTo(2.25, -3.7);
    shieldShape.lineTo(0, -5.6);
    shieldShape.lineTo(-2.1, -3.5);
    shieldShape.closePath();

    const shieldGeo = track(
      new THREE.ExtrudeGeometry(shieldShape, {
        depth: 0.95,
        bevelEnabled: true,
        bevelThickness: 0.28,
        bevelSize: 0.2,
        bevelSegments: 2,
      }),
    );
    shieldGeo.center();
    const gauntletShield = makeMesh(shieldGeo, mats.armorExtrude);
    gauntletShield.position.set(side * 2.15, -P.forearmLengthM * 0.5, 0.3);
    gauntletShield.rotation.y = side * (Math.PI / 2);
    forearmGroup.add(gauntletShield);

    // Recessed glowing 5-cell plasma conduit along outer shield
    for (let c = 0; c < 5; c++) {
      const conduitCell = makeMesh(
        track(new THREE.BoxGeometry(0.38, 0.95, 1.1)),
        mats.cyanEmissive,
        false,
        false,
      );
      conduitCell.position.set(side * 2.85, -2.5 - c * 1.45, 0.42);
      forearmGroup.add(conduitCell);
    }

    // Angular elbow spur blade fin
    const elbowSpur = makeMesh(
      track(new THREE.BoxGeometry(1.3, 7.2, 2.2)),
      mats.armorSecondary,
    );
    elbowSpur.position.set(0, -3.4, -2.05);
    elbowSpur.rotation.x = 0.14;
    forearmGroup.add(elbowSpur);

    const wristAccent = makeMesh(
      track(new THREE.CylinderGeometry(1.95, 1.78, 1.1, 6)),
      mats.armorAccent,
    );
    wristAccent.position.set(0, -P.forearmLengthM + 0.9, 0.3);
    forearmGroup.add(wristAccent);

    // Retractable Forearm Twin-Edge Plasma Energy Blade
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(1.25, -1.3);
    bladeShape.lineTo(0.95, -8.4);
    bladeShape.lineTo(0, -11.2);
    bladeShape.lineTo(-0.42, -7.6);
    bladeShape.closePath();

    const plasmaBladeGeo = track(
      new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.18,
        bevelEnabled: false,
      }),
    );
    plasmaBladeGeo.translate(0, 0, -0.09);
    const plasmaBlade = makeMesh(plasmaBladeGeo, mats.plasmaBladeMat, false, false);
    plasmaBlade.position.set(side * 2.95, -8.4, 0.4);
    plasmaBlade.rotation.y = side * (Math.PI / 2);
    forearmGroup.add(plasmaBlade);

    // Armored Hand Knuckle Guard + 4 Articulated Fingers + Opposable Thumb (fingertips at mid-thigh!)
    const wrist = makeMesh(
      track(new THREE.CylinderGeometry(1.42, 1.55, 1.6, 8)),
      mats.innerFrame,
    );
    wrist.position.set(0, -P.forearmLengthM, 0.3);
    forearmGroup.add(wrist);

    const palmGuard = makeMesh(
      track(new THREE.BoxGeometry(2.75, 2.0, 1.85)),
      mats.armorSecondary,
    );
    palmGuard.position.set(0, -P.forearmLengthM - 1.15, 0.45);
    forearmGroup.add(palmGuard);

    for (let f = -1.5; f <= 1.5; f += 1) {
      const finger = makeMesh(
        track(new THREE.BoxGeometry(0.54, 2.85, 0.72)),
        mats.armorPrimary,
      );
      finger.position.set(f * 0.72, -P.forearmLengthM - 2.95, 0.78 - Math.abs(f) * 0.18);
      finger.rotation.x = 0.24;
      forearmGroup.add(finger);
    }

    const thumb = makeMesh(track(new THREE.BoxGeometry(0.62, 2.15, 0.7)), mats.armorAccent);
    thumb.position.set(-side * 1.5, -P.forearmLengthM - 2.05, 1.15);
    thumb.rotation.z = -side * 0.46;
    thumb.rotation.x = 0.22;
    forearmGroup.add(thumb);

    return { shoulderPivot: armAssembly, elbowPivot: forearmGroup, plasmaBlade };
  };

  const leftArmRig = buildArm(1);
  const rightArmRig = buildArm(-1);

  // =========================================================================
  // 4. COMPACT REAL-PROPORTION VALKYRIE-MANTA HEAD (~7m TALL, world y=56..64)
  // =========================================================================
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, P.neckBaseY - P.torsoBaseY, 0.45);
  torsoGroup.add(neckGroup);

  const neckColumn = makeMesh(
    track(new THREE.CylinderGeometry(2.2, 2.95, 3.6, 10)),
    mats.innerFrame,
  );
  neckColumn.position.set(0, 1.35, -0.25);
  neckColumn.rotation.x = 0.12;
  neckGroup.add(neckColumn);

  for (const side of [-1, 1]) {
    const neckPiston = makeMesh(
      track(new THREE.CylinderGeometry(0.24, 0.3, 3.5, 8)),
      mats.pistonChrome,
    );
    neckPiston.position.set(side * 2.1, 1.35, 0.75);
    neckPiston.rotation.z = -side * 0.16;
    neckGroup.add(neckPiston);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, P.headCenterY - P.neckBaseY, 0.45);
  neckGroup.add(headGroup);

  // Sculpted Compact Angular Chin / Faceplate Mask (~5.2m wide x ~6.0m tall)
  const faceShape = new THREE.Shape();
  faceShape.moveTo(-2.9, 2.75);
  faceShape.lineTo(2.9, 2.75);
  faceShape.lineTo(2.3, -0.25);
  faceShape.lineTo(0.85, -3.15);
  faceShape.lineTo(0, -3.65);
  faceShape.lineTo(-0.85, -3.15);
  faceShape.lineTo(-2.3, -0.25);
  faceShape.closePath();

  const faceGeo = track(
    new THREE.ExtrudeGeometry(faceShape, {
      depth: 4.4,
      bevelEnabled: true,
      bevelThickness: 0.56,
      bevelSize: 0.44,
      bevelSegments: 2,
    }),
  );
  faceGeo.center();
  const faceMesh = makeMesh(faceGeo, mats.armorExtrude);
  faceMesh.position.set(0, -0.35, 0.9);
  faceMesh.rotation.x = 0.18;
  headGroup.add(faceMesh);

  // Deeply Recessed Dark Optical Visor Chamber + Fierce Glowing V-Eyes
  const visorChamber = makeMesh(track(new THREE.BoxGeometry(4.8, 1.75, 0.95)), mats.visorLens);
  visorChamber.position.set(0, 0.45, 3.4);
  visorChamber.rotation.x = 0.14;
  headGroup.add(visorChamber);

  for (const side of [-1, 1] as const) {
    const eyeBar = makeMesh(
      track(new THREE.BoxGeometry(2.0, 0.44, 0.42)),
      mats.cyanEmissive,
      false,
      false,
    );
    eyeBar.position.set(side * 1.18, 0.52, 3.95);
    eyeBar.rotation.z = side * 0.25;
    eyeBar.rotation.y = side * 0.22;
    headGroup.add(eyeBar);

    const mandible = makeMesh(
      track(new THREE.BoxGeometry(1.25, 2.7, 3.1)),
      mats.armorSecondary,
    );
    mandible.position.set(side * 2.75, -1.0, 2.0);
    mandible.rotation.y = side * 0.32;
    mandible.rotation.z = side * 0.2;
    headGroup.add(mandible);

    for (let slit = 0; slit < 3; slit++) {
      const cheekSlit = makeMesh(
        track(new THREE.BoxGeometry(1.4 - slit * 0.18, 0.18, 0.3)),
        mats.cyanEmissive,
        false,
        false,
      );
      cheekSlit.position.set(side * (1.45 - slit * 0.16), -0.72 - slit * 0.5, 3.7 - slit * 0.2);
      cheekSlit.rotation.y = side * 0.36;
      cheekSlit.rotation.z = -side * 0.24;
      headGroup.add(cheekSlit);
    }
  }

  // Central forehead armored crown housing + glowing diamond sensor jewel
  const foreheadCrest = makeMesh(
    track(new THREE.BoxGeometry(1.85, 1.85, 2.5)),
    mats.armorSecondary,
  );
  foreheadCrest.position.set(0, 1.95, 3.15);
  foreheadCrest.rotation.x = 0.16;
  headGroup.add(foreheadCrest);

  const foreheadGem = makeMesh(
    track(new THREE.OctahedronGeometry(0.68, 0)),
    mats.cyanEmissive,
    false,
    false,
  );
  foreheadGem.scale.set(0.85, 1.38, 0.65);
  foreheadGem.position.set(0, 1.9, 4.45);
  headGroup.add(foreheadGem);

  // Sleek Sculpted Predatory Valkyrie Helmet Dome
  const helmDome = makeMesh(
    track(new THREE.CylinderGeometry(2.55, 4.25, 3.3, 6)),
    mats.armorExtrude,
  );
  helmDome.scale.set(1.06, 1.0, 1.34);
  helmDome.position.set(0, 3.2, -0.35);
  helmDome.rotation.x = 0.12;
  helmDome.rotation.y = Math.PI / 6;
  headGroup.add(helmDome);

  const browPeak = makeMesh(
    track(new THREE.BoxGeometry(5.1, 0.85, 2.6)),
    mats.armorSecondary,
  );
  browPeak.position.set(0, 1.6, 2.7);
  browPeak.rotation.x = 0.24;
  headGroup.add(browPeak);

  // Upper beveled dorsal mohawk spine crest (peaking cleanly at world y ~63.5m)
  const crownRidge = makeMesh(
    track(new THREE.BoxGeometry(1.9, 2.0, 9.4)),
    mats.armorSecondary,
  );
  crownRidge.position.set(0, 4.5, -0.6);
  crownRidge.rotation.x = 0.16;
  headGroup.add(crownRidge);

  for (let i = 0; i < 9; i++) {
    const spineCell = makeMesh(
      track(new THREE.BoxGeometry(0.75, 0.24, 0.48)),
      mats.cyanEmissive,
      false,
      false,
    );
    spineCell.position.set(0, 5.45 - i * 0.12, 3.1 - i * 0.92);
    spineCell.rotation.x = 0.16;
    headGroup.add(spineCell);
  }

  // Twin Razor-Sharp Gilded V-Fin Crown Horns + Swept Side Aero Ear-Blades (clean CCW!)
  const vFinPts: [number, number][] = [
    [0, 0],
    [7.2, 3.5],
    [8.4, 2.8],
    [1.5, -1.0],
  ];

  const earBladePts: [number, number][] = [
    [0, 0.9],
    [4.0, 2.25],
    [5.0, 0.7],
    [3.5, -1.55],
    [0, -0.95],
  ];

  for (const side of [-1, 1] as const) {
    const finGeo = buildMirroredExtrude(
      vFinPts,
      side,
      {
        depth: 0.48,
        bevelEnabled: true,
        bevelThickness: 0.14,
        bevelSize: 0.12,
        bevelSegments: 2,
      },
      false,
    );
    const vFin = makeMesh(finGeo, mats.armorAccent);
    vFin.position.set(side * 0.5, 2.15, 4.0);
    vFin.rotation.y = side * 0.36;
    vFin.rotation.x = -0.14;
    headGroup.add(vFin);

    const earGeo = buildMirroredExtrude(
      earBladePts,
      side,
      {
        depth: 1.2,
        bevelEnabled: true,
        bevelThickness: 0.26,
        bevelSize: 0.2,
        bevelSegments: 2,
      },
      false,
    );
    const earFin = makeMesh(earGeo, mats.armorExtrude);
    earFin.position.set(side * 3.4, 1.95, 0.8);
    earFin.rotation.y = side * 0.58;
    earFin.rotation.z = side * 0.2;
    headGroup.add(earFin);

    for (let g = 0; g < 4; g++) {
      const gillBar = makeMesh(
        track(new THREE.BoxGeometry(0.3, 0.6, 0.48)),
        mats.cyanEmissive,
        false,
        false,
      );
      gillBar.position.set(side * (4.25 + g * 0.58), 1.85 + g * 0.22, 1.05 - g * 0.58);
      gillBar.rotation.y = side * 0.58;
      gillBar.rotation.z = side * 0.2;
      headGroup.add(gillBar);
    }
  }

  // Rear occipital exhaust manifold
  const rearHeadExhaust = makeMesh(
    track(new THREE.BoxGeometry(4.5, 1.8, 2.4)),
    mats.armorSecondary,
  );
  rearHeadExhaust.position.set(0, 2.55, -5.2);
  rearHeadExhaust.rotation.x = -0.2;
  headGroup.add(rearHeadExhaust);

  for (let i = -2; i <= 2; i++) {
    const rearSlot = makeMesh(
      track(new THREE.BoxGeometry(0.48, 1.05, 0.34)),
      mats.cyanEmissive,
      false,
      false,
    );
    rearSlot.position.set(i * 0.82, 2.55, -6.5);
    rearSlot.rotation.x = -0.2;
    headGroup.add(rearSlot);
  }

  // Subtle plasma wisps venting off the swept crest horn
  const wispGroup = new THREE.Group();
  wispGroup.position.set(-8.6, 4.1, -0.9);
  headGroup.add(wispGroup);
  const wispPlanes: THREE.Mesh[] = [];
  for (let w = 0; w < 3; w++) {
    const wisp = new THREE.Mesh(track(new THREE.PlaneGeometry(3.8, 5.2)), mats.cyanWispMat);
    wisp.position.set(-w * 1.15, w * 1.5, -w * 0.6);
    wisp.rotation.z = 0.45 + w * 0.15;
    wispGroup.add(wisp);
    wispPlanes.push(wisp);
  }

  // =========================================================================
  // 5. LIVING HYDRAULIC BREATHING, WING FLARE, BLADE EXTEND & POSE ARTICULATION
  // =========================================================================
  const baseTorsoY = torsoGroup.position.y;
  const baseHeadY = headGroup.position.y;

  const animateCoreAndWings = (
    boostActive: boolean,
    grounded: boolean,
    armAttackActive: boolean,
    moveSpeedAbs: number,
    elapsedSec: number,
  ) => {
    const dyn = computeMechStyleDynamics(
      boostActive,
      grounded,
      armAttackActive,
      moveSpeedAbs,
      elapsedSec,
    );

    coreRingOuter.rotation.z = dyn.coreSpinRad;
    coreRingInner.rotation.z = -dyn.coreSpinRad * 1.45;
    corePrism.rotation.y = dyn.coreSpinRad * 0.8;

    leftWingPivot.rotation.y = dyn.wingSpreadRad * 0.55;
    leftWingPivot.rotation.z = dyn.wingSpreadRad * 0.28;
    rightWingPivot.rotation.y = -dyn.wingSpreadRad * 0.55;
    rightWingPivot.rotation.z = -dyn.wingSpreadRad * 0.28;

    for (let i = 0; i < thrusterCones.length; i++) {
      const tc = thrusterCones[i];
      tc.scale.set(
        0.85 + (boostActive || !grounded ? 0.32 : 0),
        dyn.thrusterScaleY,
        0.85 + (boostActive || !grounded ? 0.32 : 0),
      );
    }

    leftArmRig.plasmaBlade.scale.set(1, dyn.bladeExtend, 1);
    rightArmRig.plasmaBlade.scale.set(1, dyn.bladeExtend, 1);

    const boostMult = boostActive ? 1.55 : 1.0;
    const pulse = (1.55 + Math.sin(elapsedSec * 2.6) * 0.24) * boostMult;
    mats.cyanEmissive.emissiveIntensity = pulse;
    mats.plasmaBladeMat.opacity = Math.min(0.95, 0.65 + dyn.bladeExtend * 0.28);
    mats.cyanGlowHalo.opacity = 0.28 + Math.sin(elapsedSec * 2.5) * 0.06;

    for (let i = 0; i < wispPlanes.length; i++) {
      const wp = wispPlanes[i];
      wp.position.y = i * 1.5 + Math.sin(elapsedSec * 1.4 + i) * 0.45;
      wp.rotation.y = elapsedSec * 0.15 + i;
    }
  };

  const update = (elapsedSec: number) => {
    const breath = Math.sin(elapsedSec * 1.05);
    torsoGroup.position.y = baseTorsoY + breath * 0.14;
    headGroup.position.y = baseHeadY + breath * 0.08;
    headGroup.rotation.x = Math.sin(elapsedSec * 0.52) * 0.02;
    headGroup.rotation.y = Math.sin(elapsedSec * 0.34) * 0.035;

    animateCoreAndWings(false, true, false, 0, elapsedSec);
  };

  const applyPose = (sim: MechSimulationState, elapsedSec: number, groundY: number) => {
    root.position.set(sim.x, sim.y, sim.z);
    root.rotation.y = sim.yaw;

    const breath = Math.sin(elapsedSec * 1.05);
    const strideBob =
      sim.grounded && Math.abs(sim.moveSpeed) > 0.5
        ? Math.abs(Math.sin(sim.walkPhase)) * 0.45
        : 0;
    const squashOffset = sim.landingImpact * 1.35;

    torsoGroup.position.y = baseTorsoY + breath * 0.14 + strideBob - squashOffset;
    torsoGroup.rotation.x = sim.torsoPitch;
    torsoGroup.rotation.y = sim.torsoYaw;

    headGroup.position.y = baseHeadY + breath * 0.08;
    headGroup.rotation.x = Math.sin(elapsedSec * 0.52) * 0.02;
    headGroup.rotation.y = sim.headYaw + Math.sin(elapsedSec * 0.34) * 0.03;

    // Articulated arms (natural heroic resting stance + pilot offsets)
    leftArmRig.shoulderPivot.rotation.x = -0.05 + sim.leftShoulderPitch;
    leftArmRig.shoulderPivot.rotation.z = 0.11 + sim.leftShoulderRoll;
    leftArmRig.elbowPivot.rotation.x = -0.22 + sim.leftElbowPitch;

    rightArmRig.shoulderPivot.rotation.x = -0.05 + sim.rightShoulderPitch;
    rightArmRig.shoulderPivot.rotation.z = -0.11 - sim.rightShoulderRoll;
    rightArmRig.elbowPivot.rotation.x = -0.22 + sim.rightElbowPitch;

    // Articulated legs (hips + knees)
    leftLegRig.hipPivot.rotation.x = sim.leftHipPitch;
    leftLegRig.kneePivot.rotation.x = sim.leftKneePitch;

    rightLegRig.hipPivot.rotation.x = sim.rightHipPitch;
    rightLegRig.kneePivot.rotation.x = sim.rightKneePitch;

    // Grounded contact shadows track desert sand underneath during jump
    const altitude = Math.max(0, sim.y - groundY);
    const shadowY = groundY - sim.y + 0.04;
    const shadowScale = Math.max(0.45, 1.0 - altitude * 0.03);
    leftLegRig.footShadow.position.y = shadowY;
    leftLegRig.footShadow.scale.setScalar(shadowScale);
    rightLegRig.footShadow.position.y = shadowY;
    rightLegRig.footShadow.scale.setScalar(shadowScale);

    const armAttackActive =
      sim.leftShoulderPitch < -0.7 || sim.rightShoulderPitch < -0.7;
    animateCoreAndWings(
      sim.boostActive,
      sim.grounded,
      armAttackActive,
      Math.abs(sim.moveSpeed),
      elapsedSec,
    );
  };

  return {
    group: root,
    applyPose,
    update,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}
