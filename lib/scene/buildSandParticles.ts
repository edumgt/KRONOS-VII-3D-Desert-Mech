import * as THREE from 'three';
import { AtmospherePreset } from './cameraRig';
import { groundHeightAt } from './desertTerrain';
import {
  DEFAULT_SAND_MECH_CONTEXT,
  SandAtmosphereProfile,
  SandMechContext,
  createSandParticleField,
  getSandAtmosphereProfile,
  stepSandParticleField,
} from './sandParticleSim';

export interface SandParticlesHandle {
  object: THREE.Group;
  setAtmosphere: (preset: AtmospherePreset, fogColorHex: number, fogDensity: number) => void;
  update: (elapsedSec: number, deltaSec: number, mech?: SandMechContext) => void;
  dispose: () => void;
}

const SAND_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aSeed;
  attribute float aLayer;
  attribute float aAlpha;

  uniform float uPixelRatio;
  uniform float uViewportHeight;
  uniform float uTime;

  varying float vSeed;
  varying float vLayer;
  varying float vAlpha;
  varying float vFogDepth;
  varying float vIsWisp;

  void main() {
    vSeed = aSeed;
    vLayer = aLayer;
    vAlpha = aAlpha;
    vIsWisp = step(4.2, aSize);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mvPosition.z, 1.0);
    vFogDepth = dist;

    float pulse = 0.92 + 0.08 * sin(uTime * 1.9 + aSeed);
    float pointPx = aSize * pulse * (uViewportHeight * 0.68 / dist) * uPixelRatio;

    float minPx = mix(2.2, 10.0, vIsWisp) * uPixelRatio;
    float maxPx = mix(20.0, 96.0, vIsWisp) * uPixelRatio;
    gl_PointSize = clamp(pointPx, minPx, maxPx);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SAND_FRAGMENT_SHADER = `
  uniform vec3 uColorBase;
  uniform vec3 uColorHighlight;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uOpacity;
  uniform float uStretch;

  varying float vSeed;
  varying float vLayer;
  varying float vAlpha;
  varying float vFogDepth;
  varying float vIsWisp;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;

    // Slight wind-tilted streak orientation
    float angle = -0.1 + sin(vSeed) * 0.08;
    float ca = cos(angle);
    float sa = sin(angle);
    vec2 rotP = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);

    // Anisotropic stretch: elongated streaks for low/mid sand, rounder sunlit motes up high
    float stretchY = vLayer < 1.5 ? uStretch : 1.15;
    vec2 shaped = vec2(rotP.x, rotP.y * stretchY);
    float r2 = dot(shaped, shaped);
    if (r2 > 1.0) discard;

    // Soft smoky falloff for large low sand wisps; crisp dense core for fine blowing grains
    float falloff = exp(-r2 * mix(2.05, 1.85, vIsWisp));
    float edgeMask = smoothstep(1.0, 0.08, r2);
    float wispDetail = mix(1.0, 0.78 + 0.22 * sin(rotP.x * 5.0 + vSeed * 4.0) * cos(rotP.y * 4.0), vIsWisp);

    float alpha = falloff * edgeMask * vAlpha * uOpacity * wispDetail;
    if (alpha < 0.01) discard;

    float litMix = clamp(fract(vSeed * 3.17) * 0.62 + (0.45 - rotP.y) * 0.3, 0.0, 1.0);
    vec3 sandCol = mix(uColorBase, uColorHighlight, litMix);

    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    vec3 finalCol = mix(sandCol, uFogColor, clamp(fogFactor * 0.65, 0.0, 0.78));

    gl_FragColor = vec4(finalCol, alpha * (1.0 - fogFactor * 0.32));
  }
`;

// Elongated sweeping wind-sheared desert sand ribbon shader (InstancedMesh)
const RIBBON_VERTEX_SHADER = `
  varying vec2 vUv;
  varying float vFogDepth;
  varying float vSeed;

  attribute float aRibbonSeed;
  attribute float aRibbonAlpha;
  varying float vRibbonAlpha;

  void main() {
    vUv = uv;
    vSeed = aRibbonSeed;
    vRibbonAlpha = aRibbonAlpha;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vFogDepth = max(-mvPos.z, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const RIBBON_FRAGMENT_SHADER = `
  uniform vec3 uRibbonColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uRibbonOpacity;
  uniform float uTime;

  varying vec2 vUv;
  varying float vFogDepth;
  varying float vSeed;
  varying float vRibbonAlpha;

  void main() {
    // Taper smoothly along both ends (length X) and top/bottom edges (height Y)
    float along = sin(vUv.x * 3.14159265);
    float across = sin(vUv.y * 3.14159265);

    // Flowing fibrous wind-streaks inside each sand ribbon
    float w1 = 0.55 + 0.45 * sin(vUv.x * 11.0 - uTime * 4.2 + vSeed * 6.0 + vUv.y * 5.0);
    float w2 = 0.65 + 0.35 * cos(vUv.x * 23.0 - uTime * 6.5 - vSeed * 3.0 - vUv.y * 9.0);
    float density = pow(along, 1.35) * pow(across, 1.85) * w1 * w2;

    float alpha = density * vRibbonAlpha * uRibbonOpacity;
    if (alpha < 0.008) discard;

    vec3 col = mix(uRibbonColor, uHighlightColor, clamp(vUv.y * 0.55 + w1 * 0.3, 0.0, 1.0));
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    vec3 finalCol = mix(col, uFogColor, clamp(fogFactor * 0.65, 0.0, 0.78));

    gl_FragColor = vec4(finalCol, alpha * (1.0 - fogFactor * 0.35));
  }
`;

// Reusable scratch transforms allocated once at module scope (zero GC in render loop)
const _ribbonDummy = new THREE.Object3D();

export function buildSandParticles(
  particleCount = 2400,
  pixelRatio = 1,
): SandParticlesHandle {
  const root = new THREE.Group();
  root.name = 'BlowingDesertSandSystem';

  const field = createSandParticleField(particleCount, 2026, groundHeightAt, 88);
  let activeProfile: SandAtmosphereProfile = getSandAtmosphereProfile('sunbreak');

  // -------------------------------------------------------------------------
  // Layer A: 2,400-particle multi-layer blowing sand grains & low dune wisps
  // -------------------------------------------------------------------------
  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(field.positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(field.alphas, 1);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('aSize', new THREE.BufferAttribute(field.sizes, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(field.seeds, 1));
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(field.layerIds, 1));
  geometry.setAttribute('aAlpha', alphaAttr);

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uViewportHeight: { value: typeof window !== 'undefined' ? window.innerHeight || 900 : 900 },
    uColorBase: { value: new THREE.Color(activeProfile.baseColorHex) },
    uColorHighlight: { value: new THREE.Color(activeProfile.highlightColorHex) },
    uFogColor: { value: new THREE.Color(0xd8c19f) },
    uFogDensity: { value: 0.0034 },
    uOpacity: { value: activeProfile.opacity },
    uStretch: { value: activeProfile.streakStretch },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SAND_VERTEX_SHADER,
    fragmentShader: SAND_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'BlowingDesertSandPoints';
  points.frustumCulled = false;
  points.renderOrder = 4;
  root.add(points);

  // -------------------------------------------------------------------------
  // Layer B: 170 sweeping wind-sheared desert sand ribbons (1 InstancedMesh)
  // -------------------------------------------------------------------------
  const ribbonCount = 170;
  const ribbonField = createSandParticleField(ribbonCount, 7711, groundHeightAt, 78);
  const ribbonLengths = new Float32Array(ribbonCount);
  const ribbonHeights = new Float32Array(ribbonCount);
  const ribbonTilts = new Float32Array(ribbonCount);

  let rSeed = 5193;
  const rRand = () => {
    rSeed = (rSeed * 16807) % 2147483647;
    return (rSeed - 1) / 2147483646;
  };
  for (let i = 0; i < ribbonCount; i++) {
    // Keep most ribbons skimming low over the dunes and sweeping across the mech's lower/mid silhouette
    const lowRibbon = i < ribbonCount * 0.65;
    ribbonField.layerIds[i] = lowRibbon ? 0 : 1;
    ribbonField.heightOffsets[i] = lowRibbon
      ? 1.1 + Math.pow(rRand(), 1.35) * 11.5
      : 12.0 + rRand() * 34.0;
    const rx = ribbonField.positions[i * 3];
    const rz = ribbonField.positions[i * 3 + 2];
    ribbonField.positions[i * 3 + 1] = groundHeightAt(rx, rz) + ribbonField.heightOffsets[i];
    ribbonLengths[i] = lowRibbon ? 11.0 + rRand() * 14.0 : 8.5 + rRand() * 11.0;
    ribbonHeights[i] = lowRibbon ? 1.1 + rRand() * 2.2 : 0.75 + rRand() * 1.4;
    ribbonTilts[i] = (rRand() - 0.5) * 0.42;
  }

  const ribbonGeo = new THREE.PlaneGeometry(1, 1);
  const ribbonSeedAttr = new THREE.InstancedBufferAttribute(ribbonField.seeds, 1);
  const ribbonAlphaAttr = new THREE.InstancedBufferAttribute(ribbonField.alphas, 1);
  ribbonAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  ribbonGeo.setAttribute('aRibbonSeed', ribbonSeedAttr);
  ribbonGeo.setAttribute('aRibbonAlpha', ribbonAlphaAttr);

  const ribbonUniforms = {
    uTime: { value: 0 },
    uRibbonColor: { value: new THREE.Color(activeProfile.ribbonColorHex) },
    uHighlightColor: { value: new THREE.Color(activeProfile.highlightColorHex) },
    uFogColor: { value: new THREE.Color(0xd8c19f) },
    uFogDensity: { value: 0.0034 },
    uRibbonOpacity: { value: activeProfile.ribbonOpacity },
  };

  const ribbonMat = new THREE.ShaderMaterial({
    uniforms: ribbonUniforms,
    vertexShader: RIBBON_VERTEX_SHADER,
    fragmentShader: RIBBON_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });

  const ribbonMesh = new THREE.InstancedMesh(ribbonGeo, ribbonMat, ribbonCount);
  ribbonMesh.name = 'BlowingSandRibbons';
  ribbonMesh.frustumCulled = false;
  ribbonMesh.renderOrder = 3;
  root.add(ribbonMesh);

  const syncRibbonMatrices = (elapsedSec: number) => {
    const windYaw = -Math.atan2(activeProfile.windZ, activeProfile.windX);
    const pos = ribbonField.positions;
    for (let i = 0; i < ribbonCount; i++) {
      const idx = i * 3;
      const sway = Math.sin(elapsedSec * 1.6 + ribbonField.seeds[i]) * 0.12;
      _ribbonDummy.position.set(pos[idx], pos[idx + 1], pos[idx + 2]);
      _ribbonDummy.rotation.set(ribbonTilts[i], windYaw + sway, sway * 0.35);
      _ribbonDummy.scale.set(ribbonLengths[i], ribbonHeights[i], 1);
      _ribbonDummy.updateMatrix();
      ribbonMesh.setMatrixAt(i, _ribbonDummy.matrix);
    }
    ribbonMesh.instanceMatrix.needsUpdate = true;
  };

  syncRibbonMatrices(0);

  const setAtmosphere = (
    preset: AtmospherePreset,
    fogColorHex: number,
    fogDensity: number,
  ) => {
    activeProfile = getSandAtmosphereProfile(preset);
    uniforms.uColorBase.value.setHex(activeProfile.baseColorHex);
    uniforms.uColorHighlight.value.setHex(activeProfile.highlightColorHex);
    uniforms.uFogColor.value.setHex(fogColorHex);
    uniforms.uFogDensity.value = fogDensity;
    uniforms.uOpacity.value = activeProfile.opacity;
    uniforms.uStretch.value = activeProfile.streakStretch;

    ribbonUniforms.uRibbonColor.value.setHex(activeProfile.ribbonColorHex);
    ribbonUniforms.uHighlightColor.value.setHex(activeProfile.highlightColorHex);
    ribbonUniforms.uFogColor.value.setHex(fogColorHex);
    ribbonUniforms.uFogDensity.value = fogDensity;
    ribbonUniforms.uRibbonOpacity.value = activeProfile.ribbonOpacity;
  };

  const update = (
    elapsedSec: number,
    deltaSec: number,
    mech: SandMechContext = DEFAULT_SAND_MECH_CONTEXT,
  ) => {
    uniforms.uTime.value = elapsedSec;
    ribbonUniforms.uTime.value = elapsedSec;
    if (typeof window !== 'undefined' && window.innerHeight > 0) {
      uniforms.uViewportHeight.value = window.innerHeight;
    }

    stepSandParticleField(
      field,
      deltaSec,
      elapsedSec,
      activeProfile,
      mech,
      groundHeightAt,
    );
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;

    stepSandParticleField(
      ribbonField,
      deltaSec,
      elapsedSec,
      activeProfile,
      mech,
      groundHeightAt,
    );
    syncRibbonMatrices(elapsedSec);
    ribbonAlphaAttr.needsUpdate = true;
  };

  return {
    object: root,
    setAtmosphere,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      ribbonGeo.dispose();
      ribbonMat.dispose();
    },
  };
}
