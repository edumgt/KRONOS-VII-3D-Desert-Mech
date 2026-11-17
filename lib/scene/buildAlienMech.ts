import * as THREE from 'three';
import { SceneMaterialLibrary } from './proceduralMaterials';

import { MechSimulationState } from './mechController';

export interface AlienMechHandle {
  group: THREE.Group;
  applyPose: (sim: MechSimulationState, elapsedSec: number, groundY: number) => void;
  update: (elapsedSec: number) => void;
  dispose: () => void;
}

/**
 * High-detail 64-meter colossal alien mech sculpted closely after the reference concept:
 * - Sculpted manta-ray / cobra cranial crest flowing into a pointed beak/faceplate
 * - Recessed dorsal cyan spine ridge cradled by twin armored brow rails
 * - Deep lateral wing cavities packed with crisp vertical cyan louver slats
 * - Curved segmented gorget collar + 7 pairs of swept TubeGeometry biomechanical ribs
 * - 14-bar cyan sternum core + exposed inner hydraulic actuators
 * - Angled heavy shoulders, tapered octagonal forearm gauntlets with recessed cyan channels
 * - Muscular sculpted thigh cowls, armored knee shields, greaves, and grounded feet
 * - Symmetrical rear spine column, twin dorsal fins & exhausts for full 360° inspection
 */
export function buildAlienMech(mats: SceneMaterialLibrary): AlienMechHandle {
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

  // =========================================================================
  // 1. LOWER BODY: PELVIS & HEAVY MUSCULAR LEGS (y = 0 .. 26)
  // =========================================================================
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 24.5, 0);
  root.add(pelvisGroup);

  const pelvisCore = makeMesh(
    track(new THREE.CylinderGeometry(5.2, 4.0, 5.4, 14)),
    mats.innerFrame,
  );
  pelvisGroup.add(pelvisCore);

  // Sculpted armored pelvic codpiece & rear sacral plate
  const pelvicShape = new THREE.Shape();
  pelvicShape.moveTo(-3.4, 2.6);
  pelvicShape.lineTo(3.4, 2.6);
  pelvicShape.lineTo(2.0, -2.8);
  pelvicShape.lineTo(0, -4.6);
  pelvicShape.lineTo(-2.0, -2.8);
  pelvicShape.closePath();

  const pelvicPlateGeo = track(
    new THREE.ExtrudeGeometry(pelvicShape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.45,
      bevelSize: 0.38,
      bevelSegments: 2,
    }),
  );
  pelvicPlateGeo.center();

  const frontPelvis = makeMesh(pelvicPlateGeo, mats.armorExtrude);
  frontPelvis.position.set(0, -0.6, 4.1);
  frontPelvis.rotation.x = 0.15;
  pelvisGroup.add(frontPelvis);

  const rearPelvis = makeMesh(pelvicPlateGeo, mats.armorExtrude);
  rearPelvis.position.set(0, -0.3, -4.2);
  rearPelvis.rotation.x = -0.18;
  pelvisGroup.add(rearPelvis);

  for (const side of [-1, 1]) {
    const hipVent = makeMesh(
      track(new THREE.BoxGeometry(1.7, 0.48, 0.45)),
      mats.cyanEmissive,
      false,
      false,
    );
    hipVent.position.set(side * 2.7, 0.7, -4.9);
    hipVent.rotation.y = side * 0.28;
    pelvisGroup.add(hipVent);
  }

  const buildLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 8.2, 23.0, 0);
    root.add(legGroup);

    // Hip socket axle & actuator housing
    const hipSocket = makeMesh(
      track(new THREE.CylinderGeometry(2.5, 2.5, 4.4, 16)),
      mats.innerFrame,
    );
    hipSocket.rotation.z = Math.PI / 2;
    hipSocket.position.set(-side * 1.4, 0.5, 0);
    legGroup.add(hipSocket);

    // Sculpted thigh armor shell (swept forward knee crest, tapered muscular profile)
    const thighPoints = [
      new THREE.Vector2(0.0, -10.8),
      new THREE.Vector2(3.6, -9.8),
      new THREE.Vector2(4.9, -4.2),
      new THREE.Vector2(5.1, 1.8),
      new THREE.Vector2(3.8, 5.2),
      new THREE.Vector2(0.0, 5.8),
    ];
    const thighGeo = track(new THREE.LatheGeometry(thighPoints, 20));
    thighGeo.scale(0.84, 1.0, 1.28);
    const thighMesh = makeMesh(thighGeo, mats.armorPrimary);
    thighMesh.position.set(side * 0.6, -5.6, 1.1);
    thighMesh.rotation.x = -0.18;
    thighMesh.rotation.z = side * 0.04;
    legGroup.add(thighMesh);

    // Outer thigh armor rib flange + inner hydraulic truss
    const outerThighFlange = makeMesh(
      track(new THREE.BoxGeometry(1.4, 10.6, 4.2)),
      mats.armorSecondary,
    );
    outerThighFlange.position.set(side * 4.2, -5.4, 0.8);
    outerThighFlange.rotation.x = -0.16;
    legGroup.add(outerThighFlange);

    const thighPiston = makeMesh(
      track(new THREE.CylinderGeometry(0.45, 0.55, 11.2, 10)),
      mats.pistonChrome,
    );
    thighPiston.position.set(-side * 2.2, -6.2, -1.5);
    thighPiston.rotation.x = -0.1;
    legGroup.add(thighPiston);

    // Knee drum & articulated knee pivot
    const kneePivot = new THREE.Group();
    kneePivot.position.set(side * 0.6, -11.4, 2.3);
    legGroup.add(kneePivot);

    const kneeJoint = makeMesh(
      track(new THREE.CylinderGeometry(2.6, 2.6, 4.6, 16)),
      mats.innerFrame,
    );
    kneeJoint.rotation.z = Math.PI / 2;
    kneePivot.add(kneeJoint);

    const kneeCowlShape = new THREE.Shape();
    kneeCowlShape.moveTo(-2.3, 2.8);
    kneeCowlShape.lineTo(0, 4.2);
    kneeCowlShape.lineTo(2.3, 2.8);
    kneeCowlShape.lineTo(1.8, -2.5);
    kneeCowlShape.lineTo(-1.8, -2.5);
    kneeCowlShape.closePath();

    const kneeCowlGeo = track(
      new THREE.ExtrudeGeometry(kneeCowlShape, {
        depth: 1.6,
        bevelEnabled: true,
        bevelThickness: 0.4,
        bevelSize: 0.3,
        bevelSegments: 2,
      }),
    );
    kneeCowlGeo.center();
    const kneeShield = makeMesh(kneeCowlGeo, mats.armorExtrude);
    kneeShield.position.set(0, 0.2, 2.9);
    kneeShield.rotation.x = 0.22;
    kneePivot.add(kneeShield);

    // Lower leg / Shin greave tapering into desert sand
    const shinCore = makeMesh(
      track(new THREE.CylinderGeometry(3.5, 4.2, 12.2, 16)),
      mats.armorPrimary,
    );
    shinCore.scale.set(0.88, 1.0, 1.2);
    shinCore.position.set(side * 0.3, -5.8, -1.5);
    shinCore.rotation.x = 0.08;
    kneePivot.add(shinCore);

    // Front vertical shin ridge + inner ankle cyan vents
    const shinCrest = makeMesh(
      track(new THREE.BoxGeometry(1.5, 9.6, 2.2)),
      mats.armorSecondary,
    );
    shinCrest.position.set(side * 0.3, -5.4, 1.9);
    shinCrest.rotation.x = 0.08;
    kneePivot.add(shinCrest);

    for (let v = 0; v < 3; v++) {
      const sideAnkleVent = makeMesh(
        track(new THREE.BoxGeometry(0.35, 0.34, 1.6)),
        mats.cyanEmissive,
        false,
        false,
      );
      sideAnkleVent.position.set(side * 3.3, -7.8 - v * 0.85, -1.5);
      kneePivot.add(sideAnkleVent);
    }

    // Rear calf thruster housing + glowing cyan vents
    const calfBooster = makeMesh(
      track(new THREE.BoxGeometry(3.6, 7.6, 3.2)),
      mats.armorSecondary,
    );
    calfBooster.position.set(side * 0.3, -4.8, -5.6);
    calfBooster.rotation.x = -0.18;
    kneePivot.add(calfBooster);

    for (let v = 0; v < 4; v++) {
      const calfVent = makeMesh(
        track(new THREE.BoxGeometry(2.1, 0.38, 0.35)),
        mats.cyanEmissive,
        false,
        false,
      );
      calfVent.position.set(side * 0.3, -2.8 - v * 1.1, -7.25);
      calfVent.rotation.x = -0.18;
      kneePivot.add(calfVent);
    }

    // Grounded mechanical foot + toes
    const footBase = makeMesh(
      track(new THREE.CylinderGeometry(4.2, 5.5, 2.8, 12)),
      mats.armorSecondary,
    );
    footBase.scale.set(0.88, 1.0, 1.32);
    footBase.position.set(side * 0.4, -10.2, -0.7);
    kneePivot.add(footBase);

    for (let t = -1; t <= 1; t++) {
      const toe = makeMesh(track(new THREE.BoxGeometry(1.4, 1.8, 3.6)), mats.armorPrimary);
      toe.position.set(side * 0.4 + t * 2.0, -10.7, 2.7);
      toe.rotation.x = 0.2;
      toe.rotation.y = t * 0.16;
      kneePivot.add(toe);
    }

    const footShadow = new THREE.Mesh(
      track(new THREE.CircleGeometry(10.5, 32)),
      mats.contactShadow,
    );
    footShadow.rotation.x = -Math.PI / 2;
    footShadow.position.set(side * 9.2, 0.03, 1.6);
    root.add(footShadow);

    return { hipPivot: legGroup, kneePivot, footShadow };
  };

  const leftLegRig = buildLeg(1);
  const rightLegRig = buildLeg(-1);

  // =========================================================================
  // 2. WAIST, SWEPT RIBCAGE, 14-BAR STERNUM & REAR SPINE (y = 26 .. 48)
  // =========================================================================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 27.5, 0);
  root.add(torsoGroup);

  const waistCore = makeMesh(
    track(new THREE.CylinderGeometry(5.4, 3.9, 6.4, 16)),
    mats.innerFrame,
  );
  waistCore.position.set(0, 2.3, 0);
  torsoGroup.add(waistCore);

  // Horizontal cyan abdominal core slits inside waist
  for (let i = 0; i < 4; i++) {
    const abVent = makeMesh(
      track(new THREE.BoxGeometry(3.2 - i * 0.2, 0.26, 0.5)),
      mats.cyanEmissive,
      false,
      false,
    );
    abVent.position.set(0, 1.0 + i * 0.95, 4.0 + i * 0.15);
    torsoGroup.add(abVent);
  }

  for (let p = 0; p < 6; p++) {
    const ang = (p / 6) * Math.PI * 2 + 0.35;
    const px = Math.cos(ang) * 4.5;
    const pz = Math.sin(ang) * 3.8;
    const piston = makeMesh(
      track(new THREE.CylinderGeometry(0.4, 0.52, 6.6, 8)),
      mats.pistonChrome,
    );
    piston.position.set(px, 2.4, pz);
    piston.rotation.z = -px * 0.04;
    piston.rotation.x = pz * 0.04;
    torsoGroup.add(piston);
  }

  // Upper chest inner reactor core
  const chestCore = makeMesh(
    track(new THREE.CylinderGeometry(8.8, 5.6, 13.6, 18)),
    mats.innerFrame,
  );
  chestCore.scale.set(1.16, 1.0, 0.92);
  chestCore.position.set(0, 11.4, 0);
  torsoGroup.add(chestCore);

  // 7 pairs of swept diagonal biomechanical ribs (CatmullRomCurve3 TubeGeometry)
  for (let r = 0; r < 7; r++) {
    const ry = 5.4 + r * 1.78;
    const spread = 7.4 + r * 0.65;
    const drop = 1.65;
    for (const side of [-1, 1]) {
      const ribCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 2.2, ry + 0.6, 7.6),
        new THREE.Vector3(side * (spread * 0.85), ry - 0.1, 5.2),
        new THREE.Vector3(side * spread, ry - drop * 0.55, 0.0),
        new THREE.Vector3(side * (spread * 0.72), ry - drop, -5.8),
        new THREE.Vector3(side * 2.2, ry - drop * 0.7, -6.8),
      ]);
      const ribGeo = track(new THREE.TubeGeometry(ribCurve, 22, 0.42 + r * 0.02, 8, false));
      const ribMesh = makeMesh(ribGeo, mats.armorSecondary);
      torsoGroup.add(ribMesh);
    }
  }

  // Recessed central sternum housing + 14 crisp cyan glowing reactor bars
  const sternumHousing = makeMesh(
    track(new THREE.BoxGeometry(3.8, 12.6, 2.4)),
    mats.armorPrimary,
  );
  sternumHousing.position.set(0, 11.4, 7.7);
  sternumHousing.rotation.x = -0.2;
  torsoGroup.add(sternumHousing);

  const sternumChannel = makeMesh(
    track(new THREE.BoxGeometry(2.3, 11.6, 0.8)),
    mats.innerFrame,
  );
  sternumChannel.position.set(0, 11.4, 8.7);
  sternumChannel.rotation.x = -0.2;
  torsoGroup.add(sternumChannel);

  for (let v = 0; v < 14; v++) {
    const ventBar = makeMesh(
      track(new THREE.BoxGeometry(1.9 - Math.abs(v - 6.5) * 0.06, 0.34, 0.55)),
      mats.cyanEmissive,
      false,
      false,
    );
    ventBar.position.set(0, 6.2 + v * 0.78, 9.05 - (v - 6.5) * 0.155);
    ventBar.rotation.x = -0.2;
    torsoGroup.add(ventBar);
  }

  // Sculpted Curved Gorget Collar Yoke sweeping down into the chest sternum
  const collarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-12.2, 16.4, -2.5),
    new THREE.Vector3(-10.2, 17.6, 3.8),
    new THREE.Vector3(-4.5, 16.2, 8.2),
    new THREE.Vector3(0, 15.2, 9.2),
    new THREE.Vector3(4.5, 16.2, 8.2),
    new THREE.Vector3(10.2, 17.6, 3.8),
    new THREE.Vector3(12.2, 16.4, -2.5),
  ]);
  const collarYoke = makeMesh(
    track(new THREE.TubeGeometry(collarCurve, 32, 1.85, 12, false)),
    mats.armorPrimary,
  );
  torsoGroup.add(collarYoke);

  const collarSubCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-11.4, 15.0, -1.0),
    new THREE.Vector3(-9.2, 15.4, 4.8),
    new THREE.Vector3(0, 13.6, 9.5),
    new THREE.Vector3(9.2, 15.4, 4.8),
    new THREE.Vector3(11.4, 15.0, -1.0),
  ]);
  const collarRim = makeMesh(
    track(new THREE.TubeGeometry(collarSubCurve, 28, 0.78, 10, false)),
    mats.armorSecondary,
  );
  torsoGroup.add(collarRim);

  // Symmetrical Rear Spine Column & Twin Dorsal Cooling Fins (for 360° orbit)
  const spineGroup = new THREE.Group();
  spineGroup.position.set(0, 11.2, -6.5);
  torsoGroup.add(spineGroup);

  for (let s = 0; s < 8; s++) {
    const vertebra = makeMesh(
      track(new THREE.CylinderGeometry(2.3 - s * 0.1, 2.5 - s * 0.1, 1.35, 8)),
      mats.armorSecondary,
    );
    vertebra.position.set(0, -5.5 + s * 1.75, -Math.sin(s * 0.35) * 1.0);
    vertebra.rotation.x = 0.22;
    spineGroup.add(vertebra);

    const spineLight = makeMesh(
      track(new THREE.BoxGeometry(1.4, 0.36, 0.5)),
      mats.cyanEmissive,
      false,
      false,
    );
    spineLight.position.set(0, -5.5 + s * 1.75, -Math.sin(s * 0.35) * 1.0 - 2.25);
    spineGroup.add(spineLight);
  }

  const finShape = new THREE.Shape();
  finShape.moveTo(0, -6);
  finShape.lineTo(3.6, -4.5);
  finShape.lineTo(5.4, 5.5);
  finShape.lineTo(1.2, 8.2);
  finShape.lineTo(0, 6);
  finShape.closePath();

  const finGeo = track(
    new THREE.ExtrudeGeometry(finShape, {
      depth: 1.6,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 0.28,
      bevelSegments: 2,
    }),
  );

  for (const side of [-1, 1]) {
    const fin = makeMesh(finGeo, mats.armorExtrude);
    fin.scale.x = side;
    fin.position.set(side * 4.5, 1.5, -1.5);
    fin.rotation.y = side * 0.42;
    fin.rotation.z = -side * 0.18;
    spineGroup.add(fin);

    for (let j = 0; j < 4; j++) {
      const slat = makeMesh(
        track(new THREE.BoxGeometry(0.45, 0.58, 2.2)),
        mats.cyanEmissive,
        false,
        false,
      );
      slat.position.set(side * (6.1 + j * 0.25), 0.5 + j * 1.5, -3.0);
      slat.rotation.y = side * 0.42;
      spineGroup.add(slat);
    }
  }

  // =========================================================================
  // 3. MASSIVE SHOULDERS & TAPERED ARTICULATED ARMS (L / R)
  // =========================================================================
  const buildArm = (side: -1 | 1) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 16.0, 17.5, -0.4);
    torsoGroup.add(shoulderPivot);

    // Dark inner shoulder turbine + cyan armpit radiator grilles
    const shoulderDrum = makeMesh(
      track(new THREE.CylinderGeometry(3.2, 3.2, 5.4, 16)),
      mats.innerFrame,
    );
    shoulderDrum.rotation.z = Math.PI / 2;
    shoulderDrum.position.set(-side * 2.5, -0.6, 0);
    shoulderPivot.add(shoulderDrum);

    for (let v = 0; v < 5; v++) {
      const pitVent = makeMesh(
        track(new THREE.BoxGeometry(2.6, 0.3, 1.2)),
        mats.cyanEmissive,
        false,
        false,
      );
      pitVent.position.set(-side * 3.8, -1.0 - v * 0.65, 2.3);
      shoulderPivot.add(pitVent);
    }

    // Layered Shoulder Pauldron Dome + Crescent Upper Cowl
    const pauldronGeo = track(
      new THREE.SphereGeometry(5.1, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.7),
    );
    pauldronGeo.scale(0.98, 1.18, 1.16);
    const pauldron = makeMesh(pauldronGeo, mats.armorPrimary);
    pauldron.position.set(side * 0.8, 0.6, 0);
    pauldron.rotation.z = -side * 0.28;
    shoulderPivot.add(pauldron);

    // Circular bearing housing on outer shoulder
    const medallion = makeMesh(
      track(new THREE.CylinderGeometry(2.3, 2.5, 1.2, 20)),
      mats.armorSecondary,
    );
    medallion.rotation.z = Math.PI / 2;
    medallion.position.set(side * 4.8, -0.5, 0);
    shoulderPivot.add(medallion);

    // Arm assembly angled naturally outward & slightly forward (matching reference silhouette)
    const armAssembly = new THREE.Group();
    armAssembly.position.set(side * 1.5, -2.5, 0);
    armAssembly.rotation.z = side * 0.16;
    armAssembly.rotation.x = -0.06;
    shoulderPivot.add(armAssembly);

    const upperArmCore = makeMesh(
      track(new THREE.CylinderGeometry(2.2, 1.85, 15.6, 12)),
      mats.innerFrame,
    );
    upperArmCore.position.set(0, -8.0, 0);
    armAssembly.add(upperArmCore);

    const upperArmPlate = makeMesh(
      track(new THREE.CylinderGeometry(2.9, 2.25, 13.8, 8)),
      mats.armorPrimary,
    );
    upperArmPlate.scale.set(0.88, 1.0, 1.18);
    upperArmPlate.position.set(side * 0.75, -7.8, 0.25);
    armAssembly.add(upperArmPlate);

    const upperArmRidge = makeMesh(
      track(new THREE.BoxGeometry(1.15, 11.8, 2.4)),
      mats.armorSecondary,
    );
    upperArmRidge.position.set(side * 2.25, -7.8, 0.2);
    armAssembly.add(upperArmRidge);

    for (const pz of [-1.7, 1.7]) {
      const armPiston = makeMesh(
        track(new THREE.CylinderGeometry(0.38, 0.38, 13.0, 8)),
        mats.pistonChrome,
      );
      armPiston.position.set(-side * 1.2, -8.2, pz);
      armAssembly.add(armPiston);
    }

    const elbow = makeMesh(
      track(new THREE.CylinderGeometry(2.4, 2.4, 4.6, 16)),
      mats.innerFrame,
    );
    elbow.rotation.z = Math.PI / 2;
    elbow.position.set(0, -16.4, 0);
    armAssembly.add(elbow);

    // Forearm Gauntlet reaching toward sand with recessed cyan energy channel
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -16.8, 0);
    forearmGroup.rotation.x = -0.2;
    forearmGroup.rotation.z = -side * 0.08;
    armAssembly.add(forearmGroup);

    const forearmHousing = makeMesh(
      track(new THREE.CylinderGeometry(3.2, 1.9, 17.6, 8)),
      mats.armorPrimary,
    );
    forearmHousing.scale.set(0.92, 1.0, 1.25);
    forearmHousing.position.set(0, -8.8, 0.4);
    forearmGroup.add(forearmHousing);

    const conduitBezel = makeMesh(
      track(new THREE.BoxGeometry(0.85, 10.6, 1.65)),
      mats.innerFrame,
    );
    conduitBezel.position.set(side * 2.15, -9.0, 0.8);
    forearmGroup.add(conduitBezel);

    for (let c = 0; c < 6; c++) {
      const conduitCell = makeMesh(
        track(new THREE.BoxGeometry(0.45, 1.25, 1.15)),
        mats.cyanEmissive,
        false,
        false,
      );
      conduitCell.position.set(side * 2.45, -4.8 - c * 1.65, 0.85);
      forearmGroup.add(conduitCell);
    }

    const forearmFin = makeMesh(
      track(new THREE.BoxGeometry(1.5, 10.8, 2.3)),
      mats.armorSecondary,
    );
    forearmFin.position.set(0, -6.8, -2.2);
    forearmGroup.add(forearmFin);

    const wrist = makeMesh(
      track(new THREE.CylinderGeometry(1.6, 1.8, 2.2, 12)),
      mats.innerFrame,
    );
    wrist.position.set(0, -18.2, 0.4);
    forearmGroup.add(wrist);

    for (let f = -1.5; f <= 1.5; f += 1) {
      const finger = makeMesh(
        track(new THREE.BoxGeometry(0.66, 4.4, 0.82)),
        mats.armorSecondary,
      );
      finger.position.set(f * 0.88, -20.6, 0.9 - Math.abs(f) * 0.25);
      finger.rotation.x = 0.22;
      forearmGroup.add(finger);
    }
    return { shoulderPivot: armAssembly, elbowPivot: forearmGroup };
  };

  const leftArmRig = buildArm(1);
  const rightArmRig = buildArm(-1);

  // =========================================================================
  // 4. NECK & SCULPTED MANTA/COBRA CREST HEAD (y = 46 .. 64)
  // =========================================================================
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 19.2, 1.0);
  torsoGroup.add(neckGroup);

  const neckColumn = makeMesh(
    track(new THREE.CylinderGeometry(4.0, 5.0, 6.2, 14)),
    mats.innerFrame,
  );
  neckColumn.position.set(0, 2.2, -0.5);
  neckColumn.rotation.x = 0.14;
  neckGroup.add(neckColumn);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 5.4, 1.4);
  neckGroup.add(headGroup);

  // Sculpted beak/faceplate tapering cleanly into the cranial hood (no boxy disconnect)
  const faceShape = new THREE.Shape();
  faceShape.moveTo(-5.8, 5.2);
  faceShape.lineTo(5.8, 5.2);
  faceShape.lineTo(3.4, -1.2);
  faceShape.lineTo(1.2, -5.6);
  faceShape.lineTo(0, -6.4);
  faceShape.lineTo(-1.2, -5.6);
  faceShape.lineTo(-3.4, -1.2);
  faceShape.closePath();

  const faceGeo = track(
    new THREE.ExtrudeGeometry(faceShape, {
      depth: 7.4,
      bevelEnabled: true,
      bevelThickness: 1.1,
      bevelSize: 0.9,
      bevelSegments: 3,
    }),
  );
  faceGeo.center();
  const faceMesh = makeMesh(faceGeo, mats.armorExtrude);
  faceMesh.position.set(0, -0.4, 1.8);
  faceMesh.rotation.x = 0.24;
  headGroup.add(faceMesh);

  // Dark optical visor groove & swept glowing cyan cheek ribs clearly visible on front bevel
  const visorPlate = makeMesh(track(new THREE.BoxGeometry(6.4, 2.8, 1.2)), mats.visorLens);
  visorPlate.position.set(0, 0.4, 6.2);
  visorPlate.rotation.x = 0.24;
  headGroup.add(visorPlate);

  for (let slit = 0; slit < 4; slit++) {
    for (const side of [-1, 1]) {
      const cheekSlit = makeMesh(
        track(new THREE.BoxGeometry(3.8 - slit * 0.5, 0.3, 0.55)),
        mats.cyanEmissive,
        false,
        false,
      );
      cheekSlit.position.set(
        side * (3.1 - slit * 0.38),
        1.1 - slit * 0.96,
        7.08 - slit * 0.55,
      );
      cheekSlit.rotation.y = side * 0.44;
      cheekSlit.rotation.z = -side * 0.24;
      headGroup.add(cheekSlit);
    }
  }

  // Broad Manta-Ray / Cobra Cranial Crest Hood (curved beveled aerodynamic dome)
  const crestPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(9.2, 0.1),
    new THREE.Vector2(14.2, 1.5),
    new THREE.Vector2(15.0, 3.0),
    new THREE.Vector2(12.2, 5.4),
    new THREE.Vector2(7.2, 7.8),
    new THREE.Vector2(2.4, 9.0),
    new THREE.Vector2(0.0, 9.3),
  ];
  const crestGeo = track(new THREE.LatheGeometry(crestPoints, 32));
  crestGeo.scale(1.14, 0.92, 0.82);
  const crestMesh = makeMesh(crestGeo, mats.armorPrimary);
  crestMesh.position.set(0, 2.5, -1.0);
  crestMesh.rotation.x = 0.14;
  headGroup.add(crestMesh);

  // Twin armored brow ridges cradling a RECESSED central glowing cyan dorsal groove
  for (const side of [-1, 1]) {
    const browRail = makeMesh(
      track(new THREE.TorusGeometry(9.05, 0.62, 10, 28, Math.PI * 0.92)),
      mats.armorSecondary,
    );
    browRail.rotation.y = Math.PI / 2;
    browRail.rotation.z = 0.12;
    browRail.scale.set(0.88, 1.0, 1.14);
    browRail.position.set(side * 1.05, 2.85, -0.7);
    headGroup.add(browRail);
  }

  // Central dark recessed channel between twin brow rails + flush cyan dorsal spine slats
  const centralGroove = makeMesh(
    track(new THREE.TorusGeometry(9.0, 0.52, 8, 28, Math.PI * 0.9)),
    mats.innerFrame,
  );
  centralGroove.rotation.y = Math.PI / 2;
  centralGroove.rotation.z = 0.12;
  centralGroove.scale.set(0.88, 1.0, 1.13);
  centralGroove.position.set(0, 2.8, -0.7);
  headGroup.add(centralGroove);

  for (let i = 0; i < 20; i++) {
    const theta = -Math.PI * 0.42 + (i / 19) * Math.PI * 0.9;
    const rY = Math.cos(theta) * 9.55 + 2.8;
    const rZ = Math.sin(theta) * 8.35 - 0.7;
    const spineCell = makeMesh(
      track(new THREE.BoxGeometry(1.1, 0.24, 0.6)),
      mats.cyanEmissive,
      false,
      false,
    );
    spineCell.position.set(0, rY, rZ);
    spineCell.rotation.x = -theta;
    headGroup.add(spineCell);
  }

  // Deep recessed lateral under-wing intake pods packed with 12 crisp vertical cyan louver slats
  // Positioned visibly along the front-lateral under-rim of the manta wings
  for (const side of [-1, 1]) {
    const intakeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 6.2, 2.45, 7.6),
      new THREE.Vector3(side * 11.4, 2.9, 5.2),
      new THREE.Vector3(side * 14.8, 3.45, 0.6),
      new THREE.Vector3(side * 12.6, 3.75, -5.0),
    ]);
    const gillBezel = makeMesh(
      track(new THREE.TubeGeometry(intakeCurve, 24, 0.95, 10, false)),
      mats.innerFrame,
    );
    headGroup.add(gillBezel);

    for (let g = 0; g < 12; g++) {
      const t = 0.08 + (g / 11) * 0.84;
      const pt = intakeCurve.getPoint(t);
      const tan = intakeCurve.getTangent(t);
      const gillBar = makeMesh(
        track(new THREE.BoxGeometry(0.42, 1.32, 0.82)),
        mats.cyanEmissive,
        false,
        false,
      );
      gillBar.position.set(pt.x + side * 0.42, pt.y - 0.15, pt.z + 0.42);
      gillBar.rotation.y = Math.atan2(tan.x, tan.z);
      gillBar.rotation.z = side * 0.18;
      headGroup.add(gillBar);
    }
  }

  // Rear occipital exhaust manifold
  const rearHeadExhaust = makeMesh(
    track(new THREE.BoxGeometry(6.8, 2.8, 3.6)),
    mats.armorSecondary,
  );
  rearHeadExhaust.position.set(0, 3.8, -8.2);
  rearHeadExhaust.rotation.x = -0.25;
  headGroup.add(rearHeadExhaust);

  for (let i = -2; i <= 2; i++) {
    const rearSlot = makeMesh(
      track(new THREE.BoxGeometry(0.75, 1.65, 0.5)),
      mats.cyanEmissive,
      false,
      false,
    );
    rearSlot.position.set(i * 1.25, 3.8, -10.15);
    rearSlot.rotation.x = -0.25;
    headGroup.add(rearSlot);
  }

  // Subtle ethereal cyan plasma wisps venting off the left crest edge (echoing reference image)
  const wispGroup = new THREE.Group();
  wispGroup.position.set(-14.2, 6.2, -1.6);
  headGroup.add(wispGroup);
  const wispPlanes: THREE.Mesh[] = [];
  for (let w = 0; w < 3; w++) {
    const wisp = new THREE.Mesh(track(new THREE.PlaneGeometry(5.5, 7.5)), mats.cyanWispMat);
    wisp.position.set(-w * 1.6, w * 2.1, -w * 0.8);
    wisp.rotation.z = 0.45 + w * 0.15;
    wispGroup.add(wisp);
    wispPlanes.push(wisp);
  }

  // =========================================================================
  // 5. LIVING HYDRAULIC BREATHING, ENERGY PULSE & REAL-TIME POSE ARTICULATION
  // =========================================================================
  const baseTorsoY = torsoGroup.position.y;
  const baseHeadY = headGroup.position.y;

  const update = (elapsedSec: number) => {
    const breath = Math.sin(elapsedSec * 1.05);
    torsoGroup.position.y = baseTorsoY + breath * 0.16;
    headGroup.position.y = baseHeadY + breath * 0.1;
    headGroup.rotation.x = Math.sin(elapsedSec * 0.52) * 0.02;
    headGroup.rotation.y = Math.sin(elapsedSec * 0.34) * 0.035;

    const pulse = 1.45 + Math.sin(elapsedSec * 2.5) * 0.22;
    mats.cyanEmissive.emissiveIntensity = pulse;
    mats.cyanGlowHalo.opacity = 0.28 + Math.sin(elapsedSec * 2.5) * 0.06;

    for (let i = 0; i < wispPlanes.length; i++) {
      const wp = wispPlanes[i];
      wp.position.y = i * 2.1 + Math.sin(elapsedSec * 1.4 + i) * 0.6;
      wp.rotation.y = elapsedSec * 0.15 + i;
    }
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

    torsoGroup.position.y = baseTorsoY + breath * 0.16 + strideBob - squashOffset;
    torsoGroup.rotation.x = sim.torsoPitch;
    torsoGroup.rotation.y = sim.torsoYaw;

    headGroup.position.y = baseHeadY + breath * 0.1;
    headGroup.rotation.x = Math.sin(elapsedSec * 0.52) * 0.02;
    headGroup.rotation.y = sim.headYaw + Math.sin(elapsedSec * 0.34) * 0.03;

    // Articulated arms (resting angles preserved + pilot offsets)
    leftArmRig.shoulderPivot.rotation.x = -0.06 + sim.leftShoulderPitch;
    leftArmRig.shoulderPivot.rotation.z = 0.16 + sim.leftShoulderRoll;
    leftArmRig.elbowPivot.rotation.x = -0.2 + sim.leftElbowPitch;

    rightArmRig.shoulderPivot.rotation.x = -0.06 + sim.rightShoulderPitch;
    rightArmRig.shoulderPivot.rotation.z = -0.16 - sim.rightShoulderRoll;
    rightArmRig.elbowPivot.rotation.x = -0.2 + sim.rightElbowPitch;

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

    const boostMult = sim.boostActive ? 1.55 : 1.0;
    const pulse = (1.45 + Math.sin(elapsedSec * 2.5) * 0.22) * boostMult;
    mats.cyanEmissive.emissiveIntensity = pulse;
    mats.cyanGlowHalo.opacity = 0.28 + Math.sin(elapsedSec * 2.5) * 0.06;

    for (let i = 0; i < wispPlanes.length; i++) {
      const wp = wispPlanes[i];
      wp.position.y = i * 2.1 + Math.sin(elapsedSec * 1.4 + i) * 0.6;
      wp.rotation.y = elapsedSec * 0.15 + i;
    }
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
