import * as THREE from 'three';
import { SceneMaterialLibrary } from './proceduralMaterials';
import { groundHeightAt } from './desertTerrain';
import { computeMechStyleDynamics } from './mechStyles';
import { HEROIC_MECH_PROPORTIONS } from './mechProportions';
import {
  CompanionAgentState,
  DEFAULT_COMPANION_SPECS,
  HeroAnchor,
  createCompanionSquadronState,
  stepCompanionSquadron,
} from './companionMechAi';

export interface CompanionSquadronHandle {
  group: THREE.Group;
  update: (elapsedSec: number, deltaSec: number, hero: HeroAnchor) => void;
  reset: () => void;
  dispose: () => void;
}

interface CompanionVisualRig {
  root: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  baseTorsoY: number;
  baseHeadY: number;
  coreRingOuter: THREE.Mesh;
  leftWingPivot: THREE.Group;
  rightWingPivot: THREE.Group;
  thrusterCones: THREE.Mesh[];
  leftShoulderPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  leftBlade: THREE.Mesh;
  rightShoulderPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  rightBlade: THREE.Mesh;
  leftHipPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightHipPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  leftFootShadow: THREE.Mesh;
  rightFootShadow: THREE.Mesh;
}

/**
 * Builds an autonomous 3-unit sibling KRONOS combat mech squadron using shared geometries
 * and live-synced style materials so the companion mechs mirror the hero's realistic 9-head
 * Valkyrie silhouette while keeping draw calls and memory lean on both GPU and software WebGL.
 */
export function buildCompanionSquadron(mats: SceneMaterialLibrary): CompanionSquadronHandle {
  const P = HEROIC_MECH_PROPORTIONS;
  const squadronGroup = new THREE.Group();
  squadronGroup.name = 'AutonomousCompanionMechSquadron';

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
  // SHARED POOLED GEOMETRIES (allocated once, reused across all 3 companions)
  // =========================================================================
  const pelvisCoreGeo = track(new THREE.CylinderGeometry(4.0, 3.3, 4.6, 8));
  const codpieceShape = new THREE.Shape();
  codpieceShape.moveTo(-2.6, 2.4);
  codpieceShape.lineTo(2.6, 2.4);
  codpieceShape.lineTo(1.8, -1.8);
  codpieceShape.lineTo(0, -4.3);
  codpieceShape.lineTo(-1.8, -1.8);
  codpieceShape.closePath();
  const codpieceGeo = track(
    new THREE.ExtrudeGeometry(codpieceShape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.34,
      bevelSize: 0.25,
      bevelSegments: 1,
    }),
  );
  codpieceGeo.center();

  const hipSocketGeo = track(new THREE.CylinderGeometry(2.1, 2.1, 4.0, 10));
  const thighCoreGeo = track(new THREE.CylinderGeometry(3.8, 3.0, 15.8, 6));
  const thighPodGeo = track(new THREE.BoxGeometry(1.7, 12.2, 4.1));
  const kneeDrumGeo = track(new THREE.CylinderGeometry(2.2, 2.2, 4.3, 10));

  const kneeRamShape = new THREE.Shape();
  kneeRamShape.moveTo(-2.1, 2.8);
  kneeRamShape.lineTo(0, 4.7);
  kneeRamShape.lineTo(2.1, 2.8);
  kneeRamShape.lineTo(2.3, -1.0);
  kneeRamShape.lineTo(1.4, -3.0);
  kneeRamShape.lineTo(-1.4, -3.0);
  kneeRamShape.lineTo(-2.3, -1.0);
  kneeRamShape.closePath();
  const kneeShieldGeo = track(
    new THREE.ExtrudeGeometry(kneeRamShape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.32,
      bevelSize: 0.24,
      bevelSegments: 1,
    }),
  );
  kneeShieldGeo.center();

  const shinCoreGeo = track(new THREE.CylinderGeometry(2.85, 3.45, 15.2, 6));
  const ankleGuardGeo = track(new THREE.CylinderGeometry(2.15, 2.7, 3.0, 8));
  const calfBoosterGeo = track(new THREE.BoxGeometry(3.1, 9.2, 2.8));
  const calfGlowStripGeo = track(new THREE.BoxGeometry(1.8, 4.8, 0.32));
  const footChassisGeo = track(new THREE.BoxGeometry(5.1, 1.8, 7.2));
  const footTalonGeo = track(new THREE.BoxGeometry(1.4, 1.55, 4.0));
  const footHeelGeo = track(new THREE.BoxGeometry(2.7, 1.55, 3.4));
  const footShadowGeo = track(new THREE.CircleGeometry(8.5, 24));

  const waistCoreGeo = track(new THREE.CylinderGeometry(4.2, 3.3, 6.6, 10));
  const abStackGeo = track(new THREE.BoxGeometry(6.4, 5.0, 2.0));
  const abVentGeo = track(new THREE.BoxGeometry(3.2, 0.42, 0.4));
  const chestCoreGeo = track(new THREE.CylinderGeometry(7.9, 4.5, 11.2, 8));
  const collarFinGeo = track(new THREE.BoxGeometry(2.6, 3.4, 5.8));
  const reactorRimGeo = track(new THREE.TorusGeometry(2.55, 0.34, 8, 6));
  const reactorGlowGeo = track(new THREE.TorusGeometry(1.82, 0.22, 8, 6));
  const reactorPrismGeo = track(new THREE.OctahedronGeometry(0.95, 0));

  const pecPts: [number, number][] = [
    [0.6, 4.6],
    [7.0, 5.5],
    [8.5, 1.7],
    [6.4, -3.6],
    [1.8, -4.2],
    [0.3, -1.2],
  ];
  const pecGeoLeft = buildMirroredExtrude(pecPts, 1, {
    depth: 2.1,
    bevelEnabled: true,
    bevelThickness: 0.46,
    bevelSize: 0.34,
    bevelSegments: 1,
  });
  const pecGeoRight = buildMirroredExtrude(pecPts, -1, {
    depth: 2.1,
    bevelEnabled: true,
    bevelThickness: 0.46,
    bevelSize: 0.34,
    bevelSegments: 1,
  });
  const pecAccentGeo = track(new THREE.BoxGeometry(4.4, 0.65, 0.6));

  const backpackGeo = track(new THREE.BoxGeometry(7.0, 10.6, 4.2));
  const spineGlowGeo = track(new THREE.BoxGeometry(1.2, 7.2, 0.45));
  const nozzleBellGeo = track(new THREE.CylinderGeometry(1.35, 2.0, 2.9, 10));
  const flameGeo = track(new THREE.CylinderGeometry(1.4, 0.04, 7.6, 10, 1, true));
  flameGeo.translate(0, -3.8, 0);

  // Twin-tier swept wing blades per side (distinct nimble sibling silhouette)
  const wingBladePtsA: [number, number][] = [
    [0, -1.5],
    [16.8, -0.9],
    [21.5, 0.45],
    [18.5, 1.75],
    [0, 1.8],
  ];
  const wingBladePtsB: [number, number][] = [
    [0, -1.2],
    [13.0, -0.75],
    [16.8, 0.35],
    [14.2, 1.35],
    [0, 1.4],
  ];
  const wingGeoLeftA = buildMirroredExtrude(
    wingBladePtsA,
    1,
    { depth: 0.72, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 1 },
    false,
  );
  const wingGeoRightA = buildMirroredExtrude(
    wingBladePtsA,
    -1,
    { depth: 0.72, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 1 },
    false,
  );
  const wingGeoLeftB = buildMirroredExtrude(
    wingBladePtsB,
    1,
    { depth: 0.68, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.12, bevelSegments: 1 },
    false,
  );
  const wingGeoRightB = buildMirroredExtrude(
    wingBladePtsB,
    -1,
    { depth: 0.68, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.12, bevelSegments: 1 },
    false,
  );
  const wingStripGeoA = track(new THREE.BoxGeometry(18.0, 0.42, 0.5));
  const wingStripGeoB = track(new THREE.BoxGeometry(14.0, 0.38, 0.45));

  const pauldronPts: [number, number][] = [
    [-3.4, 2.3],
    [1.7, 4.4],
    [5.3, 1.9],
    [4.4, -2.6],
    [1.2, -3.1],
    [-3.3, -1.1],
  ];
  const pauldronGeoLeft = buildMirroredExtrude(pauldronPts, 1, {
    depth: 6.4,
    bevelEnabled: true,
    bevelThickness: 0.56,
    bevelSize: 0.44,
    bevelSegments: 1,
  });
  const pauldronGeoRight = buildMirroredExtrude(pauldronPts, -1, {
    depth: 6.4,
    bevelEnabled: true,
    bevelThickness: 0.56,
    bevelSize: 0.44,
    bevelSegments: 1,
  });
  const pauldronAccentGeo = track(new THREE.BoxGeometry(5.0, 0.62, 6.9));
  const shoulderDrumGeo = track(new THREE.CylinderGeometry(2.3, 2.3, 4.2, 10));
  const bicepGeo = track(new THREE.CylinderGeometry(2.75, 2.2, P.upperArmLengthM - 1.0, 6));
  const elbowDrumGeo = track(new THREE.CylinderGeometry(1.95, 1.95, 3.9, 10));
  const forearmGeo = track(new THREE.CylinderGeometry(2.7, 1.8, P.forearmLengthM - 0.4, 6));
  const bucklerGeo = track(new THREE.BoxGeometry(1.1, 9.6, 3.8));
  const forearmConduitGeo = track(new THREE.BoxGeometry(0.36, 7.2, 0.95));
  const handBlockGeo = track(new THREE.BoxGeometry(2.6, 4.1, 1.8));

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.lineTo(1.15, -1.2);
  bladeShape.lineTo(0.88, -7.8);
  bladeShape.lineTo(0, -10.4);
  bladeShape.lineTo(-0.38, -7.0);
  bladeShape.closePath();
  const bladeGeo = track(
    new THREE.ExtrudeGeometry(bladeShape, { depth: 0.16, bevelEnabled: false }),
  );
  bladeGeo.translate(0, 0, -0.08);

  // Compact heroic sibling Valkyrie-Manta head
  const neckGeo = track(new THREE.CylinderGeometry(2.15, 2.85, 3.6, 8));
  const faceShape = new THREE.Shape();
  faceShape.moveTo(-2.8, 2.65);
  faceShape.lineTo(2.8, 2.65);
  faceShape.lineTo(2.2, -0.2);
  faceShape.lineTo(0.8, -3.0);
  faceShape.lineTo(0, -3.5);
  faceShape.lineTo(-0.8, -3.0);
  faceShape.lineTo(-2.2, -0.2);
  faceShape.closePath();
  const faceGeo = track(
    new THREE.ExtrudeGeometry(faceShape, {
      depth: 4.2,
      bevelEnabled: true,
      bevelThickness: 0.48,
      bevelSize: 0.38,
      bevelSegments: 1,
    }),
  );
  faceGeo.center();
  const visorBoxGeo = track(new THREE.BoxGeometry(4.6, 1.6, 0.9));
  const eyeBarGeo = track(new THREE.BoxGeometry(1.9, 0.42, 0.4));
  const helmDomeGeo = track(new THREE.CylinderGeometry(2.45, 4.1, 3.2, 6));
  const crownRidgeGeo = track(new THREE.BoxGeometry(1.8, 1.9, 8.8));
  const vFinPts: [number, number][] = [
    [0, 0],
    [6.6, 3.2],
    [7.8, 2.5],
    [1.4, -0.9],
  ];
  const vFinGeoLeft = buildMirroredExtrude(
    vFinPts,
    1,
    { depth: 0.44, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 1 },
    false,
  );
  const vFinGeoRight = buildMirroredExtrude(
    vFinPts,
    -1,
    { depth: 0.44, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 1 },
    false,
  );

  // =========================================================================
  // INSTANTIATE EACH SIBLING COMPANION MECH RIG
  // =========================================================================
  const buildUnitRig = (scale: number): CompanionVisualRig => {
    const unitRoot = new THREE.Group();
    unitRoot.scale.setScalar(scale);

    // 1. Pelvis
    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.set(0, P.pelvisCenterY, 0);
    unitRoot.add(pelvisGroup);

    pelvisGroup.add(makeMesh(pelvisCoreGeo, mats.innerFrame));
    const frontPelvis = makeMesh(codpieceGeo, mats.armorExtrude);
    frontPelvis.position.set(0, -0.5, 3.4);
    frontPelvis.rotation.x = 0.12;
    pelvisGroup.add(frontPelvis);
    const rearPelvis = makeMesh(codpieceGeo, mats.armorSecondary);
    rearPelvis.position.set(0, -0.2, -3.4);
    rearPelvis.rotation.x = -0.16;
    pelvisGroup.add(rearPelvis);

    // 2. Legs (mathematically flush at y=0)
    const buildCompanionLeg = (side: -1 | 1) => {
      const hipPivot = new THREE.Group();
      hipPivot.position.set(side * P.hipHalfSpanX, P.hipY, 0);
      unitRoot.add(hipPivot);

      const hipSock = makeMesh(hipSocketGeo, mats.innerFrame);
      hipSock.rotation.z = Math.PI / 2;
      hipSock.position.set(-side * 1.4, 0.2, 0);
      hipPivot.add(hipSock);

      const thigh = makeMesh(thighCoreGeo, mats.armorPrimary);
      thigh.scale.set(0.92, 1.0, 1.2);
      thigh.position.set(side * 0.25, -7.8, 0.45);
      thigh.rotation.x = -0.08;
      thigh.rotation.y = Math.PI / 6;
      hipPivot.add(thigh);

      const thighPod = makeMesh(thighPodGeo, mats.armorSecondary);
      thighPod.position.set(side * 3.55, -7.5, 0.3);
      thighPod.rotation.x = -0.08;
      hipPivot.add(thighPod);

      const kneePivot = new THREE.Group();
      kneePivot.position.set(side * 0.2, -P.thighLengthM, 1.05);
      hipPivot.add(kneePivot);

      const kneeDrum = makeMesh(kneeDrumGeo, mats.innerFrame);
      kneeDrum.rotation.z = Math.PI / 2;
      kneePivot.add(kneeDrum);

      const kneeShield = makeMesh(kneeShieldGeo, mats.armorExtrude);
      kneeShield.position.set(0, 0.65, 2.65);
      kneeShield.rotation.x = 0.16;
      kneePivot.add(kneeShield);

      const shin = makeMesh(shinCoreGeo, mats.armorPrimary);
      shin.scale.set(0.92, 1.0, 1.2);
      shin.position.set(side * 0.1, -7.7, -0.8);
      shin.rotation.x = 0.05;
      shin.rotation.y = Math.PI / 6;
      kneePivot.add(shin);

      const calf = makeMesh(calfBoosterGeo, mats.armorSecondary);
      calf.position.set(side * 0.1, -6.4, -4.3);
      calf.rotation.x = -0.15;
      kneePivot.add(calf);

      const calfGlow = makeMesh(calfGlowStripGeo, mats.cyanEmissive, false, false);
      calfGlow.position.set(side * 0.1, -6.2, -5.85);
      calfGlow.rotation.x = -0.15;
      kneePivot.add(calfGlow);

      const soleY = -(P.shinLengthM + P.footHeightM);
      const ankle = makeMesh(ankleGuardGeo, mats.innerFrame);
      ankle.position.set(side * 0.15, soleY + 2.6, -0.4);
      kneePivot.add(ankle);

      const foot = makeMesh(footChassisGeo, mats.armorSecondary);
      foot.position.set(side * 0.2, soleY + 0.9, -0.15);
      kneePivot.add(foot);

      for (const t of [-1, 1]) {
        const talon = makeMesh(footTalonGeo, mats.armorExtrude);
        talon.position.set(side * 0.2 + t * 1.75, soleY + 0.78, 3.65);
        talon.rotation.y = t * 0.18;
        kneePivot.add(talon);
      }

      const heel = makeMesh(footHeelGeo, mats.armorPrimary);
      heel.position.set(side * 0.2, soleY + 0.78, -4.45);
      kneePivot.add(heel);

      const footShadow = new THREE.Mesh(footShadowGeo, mats.contactShadow);
      footShadow.rotation.x = -Math.PI / 2;
      footShadow.position.set(side * (P.hipHalfSpanX + 0.3), 0.04, 1.0);
      unitRoot.add(footShadow);

      return { hipPivot, kneePivot, footShadow };
    };

    const leftLeg = buildCompanionLeg(1);
    const rightLeg = buildCompanionLeg(-1);

    // 3. Torso + Reactor + Dorsal Jet-Wings
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, P.torsoBaseY, 0);
    unitRoot.add(torsoGroup);

    const waist = makeMesh(waistCoreGeo, mats.innerFrame);
    waist.position.set(0, 3.0, 0);
    torsoGroup.add(waist);

    const abs = makeMesh(abStackGeo, mats.armorPrimary);
    abs.position.set(0, 2.9, 3.3);
    abs.rotation.x = -0.1;
    torsoGroup.add(abs);

    const abGlow = makeMesh(abVentGeo, mats.cyanEmissive, false, false);
    abGlow.position.set(0, 3.6, 4.35);
    torsoGroup.add(abGlow);

    const chest = makeMesh(chestCoreGeo, mats.innerFrame);
    chest.scale.set(1.22, 1.0, 0.88);
    chest.position.set(0, 11.2, 0);
    chest.rotation.y = Math.PI / 8;
    torsoGroup.add(chest);

    for (const side of [-1, 1] as const) {
      const pec = makeMesh(side === 1 ? pecGeoLeft : pecGeoRight, mats.armorExtrude);
      pec.position.set(side * 5.05, 11.9, 5.6);
      pec.rotation.y = -side * 0.28;
      pec.rotation.x = -0.14;
      torsoGroup.add(pec);

      const pAccent = makeMesh(pecAccentGeo, mats.armorAccent);
      pAccent.position.set(side * 5.2, 14.0, 7.0);
      pAccent.rotation.y = -side * 0.28;
      pAccent.rotation.z = side * 0.16;
      torsoGroup.add(pAccent);

      const collar = makeMesh(collarFinGeo, mats.armorExtrude);
      collar.position.set(side * 4.75, 16.5, 0.85);
      collar.rotation.z = -side * 0.28;
      torsoGroup.add(collar);
    }

    const reactorGroup = new THREE.Group();
    reactorGroup.position.set(0, 12.0, 7.05);
    reactorGroup.rotation.x = -0.12;
    torsoGroup.add(reactorGroup);

    reactorGroup.add(makeMesh(reactorRimGeo, mats.armorAccent));
    const coreRingOuter = makeMesh(reactorGlowGeo, mats.cyanEmissive, false, false);
    coreRingOuter.position.z = 0.08;
    reactorGroup.add(coreRingOuter);
    const corePrism = makeMesh(reactorPrismGeo, mats.cyanEmissive, false, false);
    corePrism.scale.set(1, 1, 0.65);
    corePrism.position.z = 0.1;
    reactorGroup.add(corePrism);

    const backpack = new THREE.Group();
    backpack.position.set(0, 11.4, -6.0);
    torsoGroup.add(backpack);
    backpack.add(makeMesh(backpackGeo, mats.armorSecondary));
    const spineGlow = makeMesh(spineGlowGeo, mats.cyanEmissive, false, false);
    spineGlow.position.set(0, 0.2, -2.35);
    backpack.add(spineGlow);

    const thrusterCones: THREE.Mesh[] = [];
    for (const side of [-1, 1] as const) {
      const nozzle = new THREE.Group();
      nozzle.position.set(side * 3.2, -4.2, -2.0);
      nozzle.rotation.x = 0.42;
      nozzle.rotation.z = side * 0.14;
      backpack.add(nozzle);

      nozzle.add(makeMesh(nozzleBellGeo, mats.innerFrame));
      const cone = makeMesh(flameGeo, mats.plasmaBladeMat, false, false);
      cone.position.y = -1.3;
      nozzle.add(cone);
      thrusterCones.push(cone);
    }

    const buildWing = (side: -1 | 1) => {
      const wp = new THREE.Group();
      wp.position.set(side * 3.7, 3.6, -1.9);
      backpack.add(wp);

      const upper = new THREE.Group();
      upper.position.set(side * 1.0, 1.2, -0.4);
      upper.rotation.z = side * 0.62;
      upper.rotation.y = side * 0.28;
      upper.add(makeMesh(side === 1 ? wingGeoLeftA : wingGeoRightA, mats.armorExtrude));
      const stripA = makeMesh(wingStripGeoA, mats.cyanEmissive, false, false);
      stripA.position.set(side * 9.6, -1.15, 0.36);
      upper.add(stripA);
      wp.add(upper);

      const lower = new THREE.Group();
      lower.position.set(side * 1.0, -1.2, -1.3);
      lower.rotation.z = side * 0.22;
      lower.rotation.y = side * 0.34;
      lower.add(makeMesh(side === 1 ? wingGeoLeftB : wingGeoRightB, mats.armorSecondary));
      const stripB = makeMesh(wingStripGeoB, mats.cyanEmissive, false, false);
      stripB.position.set(side * 7.6, -0.95, 0.34);
      lower.add(stripB);
      wp.add(lower);

      return wp;
    };
    const leftWingPivot = buildWing(1);
    const rightWingPivot = buildWing(-1);

    // 4. Muscular Proportioned Arms
    const buildCompanionArm = (side: -1 | 1) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * P.shoulderHalfSpanX, P.shoulderLocalY, -0.2);
      torsoGroup.add(shoulder);

      const drum = makeMesh(shoulderDrumGeo, mats.innerFrame);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(-side * 1.9, -0.4, 0);
      shoulder.add(drum);

      const pauldron = makeMesh(
        side === 1 ? pauldronGeoLeft : pauldronGeoRight,
        mats.armorExtrude,
      );
      pauldron.position.set(side * 0.9, 0.9, 0);
      pauldron.rotation.z = side * 0.08;
      shoulder.add(pauldron);

      const pAcc = makeMesh(pauldronAccentGeo, mats.armorAccent);
      pAcc.position.set(side * 1.5, 3.55, 0);
      pAcc.rotation.z = side * 0.34;
      shoulder.add(pAcc);

      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.85, -1.6, 0);
      armPivot.rotation.z = side * 0.11;
      armPivot.rotation.x = -0.05;
      shoulder.add(armPivot);

      const bicep = makeMesh(bicepGeo, mats.armorPrimary);
      bicep.scale.set(0.95, 1.0, 1.18);
      bicep.position.set(side * 0.35, -P.upperArmLengthM * 0.48, 0.15);
      bicep.rotation.y = Math.PI / 6;
      armPivot.add(bicep);

      const elbowDrum = makeMesh(elbowDrumGeo, mats.innerFrame);
      elbowDrum.rotation.z = Math.PI / 2;
      elbowDrum.position.set(0, -P.upperArmLengthM, 0);
      armPivot.add(elbowDrum);

      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, -P.upperArmLengthM, 0);
      elbowPivot.rotation.x = -0.22;
      elbowPivot.rotation.z = -side * 0.06;
      armPivot.add(elbowPivot);

      const forearm = makeMesh(forearmGeo, mats.armorPrimary);
      forearm.scale.set(0.96, 1.0, 1.24);
      forearm.position.set(0, -P.forearmLengthM * 0.5, 0.3);
      forearm.rotation.y = Math.PI / 6;
      elbowPivot.add(forearm);

      const buckler = makeMesh(bucklerGeo, mats.armorExtrude);
      buckler.position.set(side * 2.1, -P.forearmLengthM * 0.5, 0.3);
      elbowPivot.add(buckler);

      const conduit = makeMesh(forearmConduitGeo, mats.cyanEmissive, false, false);
      conduit.position.set(side * 2.72, -P.forearmLengthM * 0.5, 0.4);
      elbowPivot.add(conduit);

      const blade = makeMesh(bladeGeo, mats.plasmaBladeMat, false, false);
      blade.position.set(side * 2.85, -8.2, 0.38);
      blade.rotation.y = side * (Math.PI / 2);
      elbowPivot.add(blade);

      const hand = makeMesh(handBlockGeo, mats.armorSecondary);
      hand.position.set(0, -P.forearmLengthM - 2.1, 0.5);
      elbowPivot.add(hand);

      return { shoulderPivot: armPivot, elbowPivot, blade };
    };

    const leftArm = buildCompanionArm(1);
    const rightArm = buildCompanionArm(-1);

    // 5. Compact Real-Proportion Sibling Valkyrie Head
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, P.neckBaseY - P.torsoBaseY, 0.45);
    torsoGroup.add(neckGroup);

    const neckCol = makeMesh(neckGeo, mats.innerFrame);
    neckCol.position.set(0, 1.35, -0.25);
    neckGroup.add(neckCol);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, P.headCenterY - P.neckBaseY, 0.45);
    neckGroup.add(headGroup);

    const face = makeMesh(faceGeo, mats.armorExtrude);
    face.position.set(0, -0.35, 0.85);
    face.rotation.x = 0.18;
    headGroup.add(face);

    const visor = makeMesh(visorBoxGeo, mats.visorLens);
    visor.position.set(0, 0.45, 3.25);
    visor.rotation.x = 0.14;
    headGroup.add(visor);

    for (const side of [-1, 1] as const) {
      const eye = makeMesh(eyeBarGeo, mats.cyanEmissive, false, false);
      eye.position.set(side * 1.12, 0.52, 3.8);
      eye.rotation.z = side * 0.25;
      eye.rotation.y = side * 0.22;
      headGroup.add(eye);

      const vFin = makeMesh(side === 1 ? vFinGeoLeft : vFinGeoRight, mats.armorAccent);
      vFin.position.set(side * 0.48, 2.05, 3.85);
      vFin.rotation.y = side * 0.36;
      vFin.rotation.x = -0.14;
      headGroup.add(vFin);
    }

    const dome = makeMesh(helmDomeGeo, mats.armorExtrude);
    dome.scale.set(1.06, 1.0, 1.32);
    dome.position.set(0, 3.1, -0.35);
    dome.rotation.y = Math.PI / 6;
    headGroup.add(dome);

    const crest = makeMesh(crownRidgeGeo, mats.armorSecondary);
    crest.position.set(0, 4.35, -0.55);
    crest.rotation.x = 0.16;
    headGroup.add(crest);

    squadronGroup.add(unitRoot);

    return {
      root: unitRoot,
      torsoGroup,
      headGroup,
      baseTorsoY: torsoGroup.position.y,
      baseHeadY: headGroup.position.y,
      coreRingOuter,
      leftWingPivot,
      rightWingPivot,
      thrusterCones,
      leftShoulderPivot: leftArm.shoulderPivot,
      leftElbowPivot: leftArm.elbowPivot,
      leftBlade: leftArm.blade,
      rightShoulderPivot: rightArm.shoulderPivot,
      rightElbowPivot: rightArm.elbowPivot,
      rightBlade: rightArm.blade,
      leftHipPivot: leftLeg.hipPivot,
      leftKneePivot: leftLeg.kneePivot,
      rightHipPivot: rightLeg.hipPivot,
      rightKneePivot: rightLeg.kneePivot,
      leftFootShadow: leftLeg.footShadow,
      rightFootShadow: rightLeg.footShadow,
    };
  };

  let agents: CompanionAgentState[] = createCompanionSquadronState(
    groundHeightAt,
    DEFAULT_COMPANION_SPECS,
  );
  const rigs: CompanionVisualRig[] = agents.map((a) => buildUnitRig(a.spec.scale));

  const applyRigPose = (rig: CompanionVisualRig, agent: CompanionAgentState, elapsedSec: number) => {
    const { sim, spec } = agent;
    const terrainY = groundHeightAt(sim.x, sim.z);

    rig.root.position.set(sim.x, sim.y, sim.z);
    rig.root.rotation.y = sim.yaw;

    const breath = Math.sin(elapsedSec * 1.15 + spec.jumpPhaseOffsetSec);
    const strideBob =
      sim.grounded && Math.abs(sim.moveSpeed) > 0.5
        ? Math.abs(Math.sin(sim.walkPhase)) * 0.42
        : 0;
    const squash = sim.landingImpact * 1.25;

    rig.torsoGroup.position.y = rig.baseTorsoY + breath * 0.14 + strideBob - squash;
    rig.torsoGroup.rotation.x = sim.torsoPitch;
    rig.torsoGroup.rotation.y = sim.torsoYaw;

    rig.headGroup.position.y = rig.baseHeadY + breath * 0.08;
    rig.headGroup.rotation.y = sim.headYaw + Math.sin(elapsedSec * 0.5 + spec.baseAngleRad) * 0.08;

    rig.leftShoulderPivot.rotation.x = -0.05 + sim.leftShoulderPitch;
    rig.leftShoulderPivot.rotation.z = 0.11 + sim.leftShoulderRoll;
    rig.leftElbowPivot.rotation.x = -0.22 + sim.leftElbowPitch;

    rig.rightShoulderPivot.rotation.x = -0.05 + sim.rightShoulderPitch;
    rig.rightShoulderPivot.rotation.z = -0.11 - sim.rightShoulderRoll;
    rig.rightElbowPivot.rotation.x = -0.22 + sim.rightElbowPitch;

    rig.leftHipPivot.rotation.x = sim.leftHipPitch;
    rig.leftKneePivot.rotation.x = sim.leftKneePitch;
    rig.rightHipPivot.rotation.x = sim.rightHipPitch;
    rig.rightKneePivot.rotation.x = sim.rightKneePitch;

    // Grounded contact shadows track terrain beneath each companion (in scaled local coords)
    const altitude = Math.max(0, sim.y - terrainY);
    const shadowLocalY = (terrainY - sim.y) / spec.scale + 0.05;
    const shadowScale = Math.max(0.45, 1.0 - altitude * 0.03);
    rig.leftFootShadow.position.y = shadowLocalY;
    rig.leftFootShadow.scale.setScalar(shadowScale);
    rig.rightFootShadow.position.y = shadowLocalY;
    rig.rightFootShadow.scale.setScalar(shadowScale);

    const armActive = sim.leftShoulderPitch < -0.7 || sim.rightShoulderPitch < -0.7;
    const dyn = computeMechStyleDynamics(
      sim.boostActive,
      sim.grounded,
      armActive,
      Math.abs(sim.moveSpeed),
      elapsedSec + spec.jumpPhaseOffsetSec,
    );

    rig.coreRingOuter.rotation.z = dyn.coreSpinRad;
    rig.leftWingPivot.rotation.y = dyn.wingSpreadRad * 0.55;
    rig.leftWingPivot.rotation.z = dyn.wingSpreadRad * 0.28;
    rig.rightWingPivot.rotation.y = -dyn.wingSpreadRad * 0.55;
    rig.rightWingPivot.rotation.z = -dyn.wingSpreadRad * 0.28;

    for (let t = 0; t < rig.thrusterCones.length; t++) {
      const tc = rig.thrusterCones[t];
      const wScale = 0.8 + (sim.boostActive || !sim.grounded ? 0.3 : 0);
      tc.scale.set(wScale, dyn.thrusterScaleY, wScale);
    }

    rig.leftBlade.scale.set(1, dyn.bladeExtend, 1);
    rig.rightBlade.scale.set(1, dyn.bladeExtend, 1);
  };

  // Position companions cleanly on frame 0
  for (let i = 0; i < agents.length; i++) {
    applyRigPose(rigs[i], agents[i], 0);
  }

  const update = (elapsedSec: number, deltaSec: number, hero: HeroAnchor) => {
    stepCompanionSquadron(agents, hero, deltaSec, groundHeightAt);
    for (let i = 0; i < agents.length; i++) {
      applyRigPose(rigs[i], agents[i], elapsedSec);
    }
  };

  const reset = () => {
    agents = createCompanionSquadronState(groundHeightAt, DEFAULT_COMPANION_SPECS);
    for (let i = 0; i < agents.length; i++) {
      applyRigPose(rigs[i], agents[i], 0);
    }
  };

  return {
    group: squadronGroup,
    update,
    reset,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}
