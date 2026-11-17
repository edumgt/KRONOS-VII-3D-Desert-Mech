import * as THREE from 'three';
import { AtmospherePreset } from './cameraRig';
import { getForegroundHumanPlacements, groundHeightAt } from './desertTerrain';
import { SceneMaterialLibrary } from './proceduralMaterials';

export interface DesertCanyonHandle {
  group: THREE.Group;
  setAtmosphere: (preset: AtmospherePreset, scene: THREE.Scene, keyLight: THREE.DirectionalLight, hemiLight: THREE.HemisphereLight, rimLight: THREE.DirectionalLight) => void;
  update: (elapsedSec: number, deltaSec: number) => void;
  dispose: () => void;
}

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uCloudDark;
  uniform vec3 uCloudLit;
  uniform vec3 uSunGlow;
  varying vec3 vWorldDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.04 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float elev = clamp(dir.y, -0.1, 1.0);

    // Base atmospheric gradient
    vec3 sky = mix(uSkyHorizon, uSkyTop, pow(max(elev, 0.0), 0.55));

    // Projected cloud dome UVs above horizon
    vec2 cloudUv = dir.xz / (max(dir.y, 0.08) + 0.20);
    float n1 = fbm(cloudUv * 1.15 + vec2(uTime * 0.008, -uTime * 0.004));
    float n2 = fbm(cloudUv * 2.5 - vec2(uTime * 0.012, uTime * 0.005));
    float n3 = fbm(cloudUv * 4.4 + vec2(3.1, 1.4));
    float cloudDensity = smoothstep(0.28, 0.76, n1 * 0.62 + n2 * 0.28 + n3 * 0.14);

    // Dramatic sun break & silver/gold cloud lining
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float sunHalo = pow(sunDot, 8.0) * 0.8 + pow(sunDot, 48.0) * 1.6;
    float cloudEdge = smoothstep(0.24, 0.56, n1) * (1.0 - smoothstep(0.56, 0.86, n1));

    vec3 cloudColor = mix(uCloudDark, uCloudLit, smoothstep(0.16, 0.86, pow(sunDot, 1.35) * 0.92 + cloudEdge * 0.58));
    cloudColor += uSunGlow * pow(sunDot, 4.0) * 0.52;

    float horizonFade = smoothstep(0.0, 0.16, elev);
    sky = mix(sky, cloudColor, cloudDensity * horizonFade * 0.92);
    sky += uSunGlow * sunHalo * (1.0 - cloudDensity * 0.35);

    // Blend cleanly into horizon fog below y = 0.03
    sky = mix(uSkyHorizon, sky, smoothstep(-0.04, 0.1, dir.y));

    gl_FragColor = vec4(sky, 1.0);
  }
`;

const GODRAY_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const GODRAY_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    float edgeFade = pow(abs(dot(vNormalView, vViewDir)), 2.6);
    float verticalFade = smoothstep(0.0, 0.36, vUv.y) * smoothstep(1.0, 0.32, vUv.y);
    float alpha = edgeFade * verticalFade * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function buildDesertCanyon(mats: SceneMaterialLibrary): DesertCanyonHandle {
  const root = new THREE.Group();
  root.name = 'DesertCanyonEnvironment';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // =========================================================================
  // 1. CONTINUOUS SCULPTED DESERT DUNES & CANYON BASIN TERRAIN
  // =========================================================================
  const terrainSize = 420;
  const terrainSegs = 136;
  const terrainGeo = trackGeo(
    new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs),
  );
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const sandColor = new THREE.Color(0xdba063);
  const shadowDuneColor = new THREE.Color(0xb47944);
  const cliffTintColor = new THREE.Color(0x7c6049);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = groundHeightAt(x, z);
    posAttr.setY(i, y);

    // Subtle elevation-based vertex tinting (sand -> sandstone cliff foothills)
    const rockFactor = Math.min(1, Math.max(0, (y - 6.0) / 18.0));
    const duneShade = 0.5 + 0.5 * Math.sin(x * 0.055 + z * 0.032);
    tmpColor.copy(shadowDuneColor).lerp(sandColor, duneShade);
    tmpColor.lerp(cliffTintColor, rockFactor);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  mats.desertSand.vertexColors = true;
  mats.desertSand.needsUpdate = true;

  const terrainMesh = new THREE.Mesh(terrainGeo, mats.desertSand);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  root.add(terrainMesh);

  // =========================================================================
  // 2. TOWERING CANYON CLIFF FORMATIONS & INSTANCED BOULDERS
  // =========================================================================
  const createCliffPillarGeo = (seedOffset: number) => {
    const geo = new THREE.CylinderGeometry(9, 34, 128, 22, 14);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const angle = Math.atan2(vz, vx);
      const heightT = (vy + 64) / 128; // 0 at base, 1 at crest
      const strata = Math.sin(vy * 0.22 + seedOffset) * 1.15 + Math.cos(vy * 0.47) * 0.45;
      const ridge =
        Math.sin(angle * 3.0 + seedOffset * 1.7) * 4.8 +
        Math.cos(angle * 5.0 - vy * 0.07) * 2.9 +
        Math.sin(angle * 9.0 + vy * 0.13) * 1.4;
      const radialScale = (1 + (strata + ridge) * 0.046) * (1.06 - heightT * 0.16);
      // Slight inward canyon overhang lean at high elevation
      const lean = Math.pow(heightT, 1.8) * 3.2;
      pos.setX(i, vx * radialScale - Math.sign(vx || 1) * lean * 0.15);
      pos.setZ(i, vz * radialScale);
    }
    geo.computeVertexNormals();
    return trackGeo(geo);
  };

  const cliffGeoA = createCliffPillarGeo(0.4);
  const cliffGeoB = createCliffPillarGeo(2.9);

  const cliffSpecs = [
    // Left canyon wall formations (framing mech cleanly OUTSIDE the 105m drone orbit path)
    { x: -150, z: -28, sx: 1.75, sy: 1.25, sz: 2.35, ry: 0.35, geo: cliffGeoA },
    { x: -160, z: 58, sx: 1.8, sy: 1.12, sz: 2.1, ry: -0.6, geo: cliffGeoB },
    { x: -146, z: -112, sx: 2.1, sy: 1.32, sz: 2.4, ry: 1.1, geo: cliffGeoA },
    // Right canyon wall formations (dramatic backlit monolithic cliff on upper right)
    { x: 150, z: -26, sx: 1.8, sy: 1.3, sz: 2.35, ry: -0.5, geo: cliffGeoB },
    { x: 160, z: 60, sx: 1.65, sy: 1.06, sz: 2.0, ry: 0.8, geo: cliffGeoA },
    { x: 146, z: -114, sx: 2.05, sy: 1.35, sz: 2.25, ry: -1.2, geo: cliffGeoB },
  ];

  for (const spec of cliffSpecs) {
    const cliff = new THREE.Mesh(spec.geo, mats.canyonRock);
    cliff.scale.set(spec.sx, spec.sy, spec.sz);
    cliff.rotation.y = spec.ry;
    // Anchor base 22m beneath y=0 valley floor so wide bases never float on slopes
    cliff.position.set(spec.x, 64 * spec.sy - 22, spec.z);
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    root.add(cliff);
  }

  // Instanced desert boulders embedded cleanly in inner sand dunes (r = 26..84m, never floating on slopes)
  const boulderGeo = trackGeo(new THREE.DodecahedronGeometry(1.3, 1));
  const bPos = boulderGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bPos.count; i++) {
    const bx = bPos.getX(i);
    const by = bPos.getY(i);
    const bz = bPos.getZ(i);
    const n = 1 + 0.22 * Math.sin(bx * 2.7 + bz * 1.9) * Math.cos(by * 3.1);
    bPos.setXYZ(i, bx * n, by * 0.65 * n, bz * n);
  }
  boulderGeo.computeVertexNormals();

  const boulderCount = 46;
  const boulders = new THREE.InstancedMesh(boulderGeo, mats.boulderRock, boulderCount);
  boulders.castShadow = true;
  boulders.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const instanceColor = new THREE.Color();
  let bSeed = 9001;
  const bRand = () => {
    bSeed = (bSeed * 16807) % 2147483647;
    return (bSeed - 1) / 2147483646;
  };

  for (let i = 0; i < boulderCount; i++) {
    const angle = (i / boulderCount) * Math.PI * 2 + (bRand() - 0.5) * 0.25;
    const dist = 26 + bRand() * 58;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = groundHeightAt(x, z);
    const baseScale = 0.65 + bRand() * 0.85;
    const scaleJitter = 0.85 + bRand() * 0.3;

    // Embed firmly into sand (-0.32 * baseScale) so nothing ever appears floating
    dummy.position.set(x, y - baseScale * 0.32, z);
    dummy.rotation.set(bRand() * 0.3, bRand() * Math.PI * 2, bRand() * 0.3);
    dummy.scale.set(
      baseScale * scaleJitter * (0.9 + bRand() * 0.25),
      baseScale * scaleJitter * (0.65 + bRand() * 0.2),
      baseScale * scaleJitter * (0.9 + bRand() * 0.25),
    );
    dummy.updateMatrix();
    boulders.setMatrixAt(i, dummy.matrix);

    const tint = 0.86 + bRand() * 0.24;
    instanceColor.setRGB(tint, tint * 0.92, tint * 0.84);
    boulders.setColorAt(i, instanceColor);
  }
  boulders.instanceMatrix.needsUpdate = true;
  if (boulders.instanceColor) boulders.instanceColor.needsUpdate = true;
  boulders.computeBoundingSphere();
  root.add(boulders);

  // =========================================================================
  // 3. FOREGROUND HUMAN SCOUTS FOR EPIC SCALE (~1.9m TALL MULTI-PART GROUPS)
  // =========================================================================
  const placements = getForegroundHumanPlacements();
  const bootGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.15, 0.38, 8));
  const robeGeo = trackGeo(new THREE.ConeGeometry(0.42, 1.52, 10));
  const torsoGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.3, 0.68, 10));
  const headGeo = trackGeo(new THREE.SphereGeometry(0.16, 10, 10));
  const shadowDiscGeo = trackGeo(new THREE.CircleGeometry(0.85, 16));

  const bootMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1a140f, roughness: 0.9, metalness: 0.05 }),
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x8f6b51, roughness: 0.75, metalness: 0.0 }),
  );

  for (const p of placements) {
    const human = new THREE.Group();
    const gy = groundHeightAt(p.x, p.z);
    human.position.set(p.x, gy, p.z);
    human.rotation.y = p.yaw;
    human.scale.setScalar(p.scale * 1.12);

    const robeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: p.robeColorHex,
        roughness: 0.9,
        metalness: 0.02,
      }),
    );

    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(-0.12, 0.19, 0);
    leftBoot.castShadow = true;
    human.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0.12, 0.19, 0.05);
    rightBoot.castShadow = true;
    human.add(rightBoot);

    const robe = new THREE.Mesh(robeGeo, robeMat);
    robe.position.set(0, 0.9, 0);
    robe.castShadow = true;
    robe.receiveShadow = true;
    human.add(robe);

    const cloakShoulders = new THREE.Mesh(torsoGeo, robeMat);
    cloakShoulders.position.set(0, 1.44, 0);
    cloakShoulders.castShadow = true;
    human.add(cloakShoulders);

    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.88, 0);
    head.castShadow = true;
    human.add(head);

    const contactDisc = new THREE.Mesh(shadowDiscGeo, mats.contactShadow);
    contactDisc.rotation.x = -Math.PI / 2;
    contactDisc.position.set(0, 0.025, 0);
    human.add(contactDisc);

    root.add(human);
  }

  // =========================================================================
  // 4. DRAMATIC CLOUDY SKY DOME & VOLUMETRIC GOD-RAY SHAFTS
  // =========================================================================
  const skyUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.68, 0.42, -0.6).normalize() },
    uSkyTop: { value: new THREE.Color(0x3b4856) },
    uSkyHorizon: { value: new THREE.Color(0xd7be9d) },
    uCloudDark: { value: new THREE.Color(0x2e3944) },
    uCloudLit: { value: new THREE.Color(0xe6d9c3) },
    uSunGlow: { value: new THREE.Color(0xfff0cc) },
  };

  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  const skyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(320, 32, 24)), skyMat);
  root.add(skyDome);

  // Soft volumetric god-ray shafts slanting down from upper-right cloud break
  const godrayUniforms = {
    uColor: { value: new THREE.Color(0xffe7bd) },
    uOpacity: { value: 0.048 },
  };
  const godrayMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: godrayUniforms,
      vertexShader: GODRAY_VERTEX_SHADER,
      fragmentShader: GODRAY_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const shaftSpecs = [
    { x: 24, y: 58, z: -18, rTop: 6, rBot: 26, len: 135, rz: 0.48, rx: 0.24 },
    { x: -6, y: 66, z: -24, rTop: 8, rBot: 30, len: 145, rz: 0.46, rx: 0.22 },
    { x: 46, y: 50, z: 6, rTop: 5, rBot: 22, len: 120, rz: 0.5, rx: 0.18 },
  ];
  for (const s of shaftSpecs) {
    const shaft = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(s.rTop, s.rBot, s.len, 16, 1, true)),
      godrayMat,
    );
    shaft.position.set(s.x, s.y, s.z);
    shaft.rotation.z = s.rz;
    shaft.rotation.x = s.rx;
    root.add(shaft);
  }

  // =========================================================================
  // 5. DRIFTING DESERT DUST PARTICLES (subtle atmospheric motes)
  // =========================================================================
  const dustCount = 680;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = new Float32Array(dustCount);

  let dSeed = 2026;
  const dRand = () => {
    dSeed = (dSeed * 16807) % 2147483647;
    return (dSeed - 1) / 2147483646;
  };

  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (dRand() - 0.5) * 180;
    dustPositions[i * 3 + 1] = 1.0 + dRand() * 68;
    dustPositions[i * 3 + 2] = (dRand() - 0.5) * 180;
    dustSeeds[i] = dRand() * Math.PI * 2;
  }

  const dustGeo = trackGeo(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

  const dustMat = trackMat(
    new THREE.PointsMaterial({
      size: 0.44,
      map: mats.dustSpriteTexture,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffdeb0,
    }),
  );

  const dustPoints = new THREE.Points(dustGeo, dustMat);
  root.add(dustPoints);

  const setAtmosphere = (
    preset: AtmospherePreset,
    scene: THREE.Scene,
    keyLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight,
    rimLight: THREE.DirectionalLight,
  ) => {
    if (preset === 'sunbreak') {
      skyUniforms.uSunDir.value.set(0.68, 0.46, -0.57).normalize();
      skyUniforms.uSkyTop.value.setHex(0x283542);
      skyUniforms.uSkyHorizon.value.setHex(0xdbc5a4);
      skyUniforms.uCloudDark.value.setHex(0x252f3a);
      skyUniforms.uCloudLit.value.setHex(0xf2e6cf);
      skyUniforms.uSunGlow.value.setHex(0xfff4d6);

      godrayUniforms.uColor.value.setHex(0xffe7bd);
      godrayUniforms.uOpacity.value = 0.048;
      dustMat.color.setHex(0xffdeb0);

      keyLight.color.setHex(0xffe7bc);
      keyLight.intensity = 3.35;
      keyLight.position.set(82, 66, -56);

      hemiLight.color.setHex(0x6b87a6);
      hemiLight.groundColor.setHex(0x9c6236);
      hemiLight.intensity = 0.95;

      rimLight.color.setHex(0x7cc8e8);
      rimLight.intensity = 1.25;

      scene.fog = new THREE.FogExp2(0xd8c19f, 0.0034);
      scene.background = new THREE.Color(0xd8c19f);
    } else if (preset === 'dusk') {
      skyUniforms.uSunDir.value.set(0.75, 0.22, -0.62).normalize();
      skyUniforms.uSkyTop.value.setHex(0x1f283b);
      skyUniforms.uSkyHorizon.value.setHex(0xd9804b);
      skyUniforms.uCloudDark.value.setHex(0x282230);
      skyUniforms.uCloudLit.value.setHex(0xf2a165);
      skyUniforms.uSunGlow.value.setHex(0xffb56b);

      godrayUniforms.uColor.value.setHex(0xffae66);
      godrayUniforms.uOpacity.value = 0.095;
      dustMat.color.setHex(0xffb77d);

      keyLight.color.setHex(0xffa75e);
      keyLight.intensity = 3.3;
      keyLight.position.set(85, 34, -64);

      hemiLight.color.setHex(0x5d769e);
      hemiLight.groundColor.setHex(0x8f4e2b);
      hemiLight.intensity = 0.95;

      rimLight.color.setHex(0x45d8ff);
      rimLight.intensity = 1.35;

      scene.fog = new THREE.FogExp2(0xc77e52, 0.0044);
      scene.background = new THREE.Color(0xc77e52);
    } else {
      // 'storm' — dramatic overcast cyan-charged desert squall
      skyUniforms.uSunDir.value.set(0.45, 0.55, -0.68).normalize();
      skyUniforms.uSkyTop.value.setHex(0x1b2733);
      skyUniforms.uSkyHorizon.value.setHex(0x8d9699);
      skyUniforms.uCloudDark.value.setHex(0x1d2630);
      skyUniforms.uCloudLit.value.setHex(0x9fb2ba);
      skyUniforms.uSunGlow.value.setHex(0xd9f2f7);

      godrayUniforms.uColor.value.setHex(0xbbe8f2);
      godrayUniforms.uOpacity.value = 0.065;
      dustMat.color.setHex(0xc8d9de);

      keyLight.color.setHex(0xdbeaf0);
      keyLight.intensity = 2.4;
      keyLight.position.set(55, 74, -66);

      hemiLight.color.setHex(0x6d8ca3);
      hemiLight.groundColor.setHex(0x6e543e);
      hemiLight.intensity = 1.1;

      rimLight.color.setHex(0x2ee6ff);
      rimLight.intensity = 1.55;

      scene.fog = new THREE.FogExp2(0x8a9396, 0.0052);
      scene.background = new THREE.Color(0x8a9396);
    }
  };

  const update = (elapsedSec: number, deltaSec: number) => {
    skyUniforms.uTime.value = elapsedSec;

    const dt = Math.min(deltaSec, 0.1);
    const attr = dustGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i++) {
      let x = attr.getX(i) + dt * 2.4;
      let y = attr.getY(i) + Math.sin(elapsedSec * 0.7 + dustSeeds[i]) * dt * 0.45;
      const z = attr.getZ(i) + Math.cos(elapsedSec * 0.4 + dustSeeds[i]) * dt * 0.6;
      if (x > 90) x = -90;
      if (y > 70) y = 2;
      if (y < 1) y = 65;
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
  };

  return {
    group: root,
    setAtmosphere,
    update,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
