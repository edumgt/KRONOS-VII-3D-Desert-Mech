import * as THREE from 'three';

export interface SceneMaterialLibrary {
  armorPrimary: THREE.MeshStandardMaterial;
  armorSecondary: THREE.MeshStandardMaterial;
  armorExtrude: THREE.MeshStandardMaterial;
  innerFrame: THREE.MeshStandardMaterial;
  pistonChrome: THREE.MeshStandardMaterial;
  visorLens: THREE.MeshPhysicalMaterial;
  cyanEmissive: THREE.MeshStandardMaterial;
  cyanGlowHalo: THREE.MeshBasicMaterial;
  cyanWispMat: THREE.MeshBasicMaterial;
  desertSand: THREE.MeshStandardMaterial;
  canyonRock: THREE.MeshStandardMaterial;
  boulderRock: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  dustSpriteTexture: THREE.CanvasTexture;
  dispose: () => void;
}

function createArmorMaps(maxAnisotropy: number) {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(size, size);

  // Fast ImageData synthesis: fine weathered gunmetal-bronze alloy with subtle dust oxidation (zero camo blotches)
  for (let y = 0; y < size; y++) {
    const ny = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * Math.PI * 2;
      const idx = (y * size + x) * 4;

      // Subtle broad oxidized tone shift + fine brushed steel grain
      const broadPatina =
        Math.sin(nx + 0.5) * Math.cos(ny - 0.3) * 0.14 +
        Math.sin(nx * 2 - ny) * 0.08 +
        0.5;
      const fineNoise =
        Math.sin(x * 1.37 + y * 2.13) * Math.cos(x * 2.71 - y * 1.69) * 0.14 +
        Math.sin(x * 4.3 + y * 0.9) * 0.06;
      const microBrush = Math.sin(y * 1.45 + Math.sin(x * 0.08) * 1.6) * 0.06 + 0.5;

      const rustBlend = Math.max(0, Math.min(1, broadPatina + fineNoise * 0.65));
      // Warm weathered titanium-bronze (#7e7264) to cool gunmetal slate (#585c61)
      const r = Math.round(92 + rustBlend * 44 + (microBrush - 0.5) * 12);
      const g = Math.round(94 + rustBlend * 30 + (microBrush - 0.5) * 11);
      const b = Math.round(98 + rustBlend * 14 + (microBrush - 0.5) * 10);

      aImg.data[idx] = Math.max(0, Math.min(255, r));
      aImg.data[idx + 1] = Math.max(0, Math.min(255, g));
      aImg.data[idx + 2] = Math.max(0, Math.min(255, b));
      aImg.data[idx + 3] = 255;

      const bumpVal = Math.max(
        0,
        Math.min(255, Math.round(128 + (microBrush - 0.5) * 28 + fineNoise * 65)),
      );
      bImg.data[idx] = bumpVal;
      bImg.data[idx + 1] = bumpVal;
      bImg.data[idx + 2] = bumpVal;
      bImg.data[idx + 3] = 255;

      const roughVal = Math.max(85, Math.min(220, Math.round(115 + rustBlend * 72)));
      rImg.data[idx] = roughVal;
      rImg.data[idx + 1] = roughVal;
      rImg.data[idx + 2] = roughVal;
      rImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  // Crisp subtle panel seam lines (fine alien mechanical seams)
  aCtx.strokeStyle = 'rgba(22, 24, 28, 0.34)';
  aCtx.lineWidth = 1.2;
  bCtx.strokeStyle = 'rgba(42, 42, 42, 0.52)';
  bCtx.lineWidth = 1.6;

  for (const s of [128, 256, 384]) {
    aCtx.beginPath();
    aCtx.moveTo(0, s);
    aCtx.lineTo(size, s);
    aCtx.stroke();

    bCtx.beginPath();
    bCtx.moveTo(0, s);
    bCtx.lineTo(size, s);
    bCtx.stroke();
  }

  // Fine worn metallic edge scratches & weathered dust streaks
  let seed = 7331;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 240; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 10 + rand() * 34;
    const ang = (rand() - 0.5) * 0.32;
    aCtx.strokeStyle =
      rand() > 0.4 ? 'rgba(218, 210, 198, 0.14)' : 'rgba(24, 26, 30, 0.16)';
    aCtx.lineWidth = 0.8;
    aCtx.beginPath();
    aCtx.moveTo(x, y);
    aCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    aCtx.stroke();
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(1, 1);
  albedo.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(1, 1);
  bump.anisotropy = maxAnisotropy;

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(1, 1);
  roughness.anisotropy = maxAnisotropy;

  return { albedo, bump, roughness };
}

function createSandMaps(maxAnisotropy: number) {
  const size = 256;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ny = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * Math.PI * 2;
      const idx = (y * size + x) * 4;

      const warp = Math.sin(nx * 2 + ny) * 1.1 + Math.cos(nx * 3 - ny * 2) * 0.6;
      const ripple = Math.sin(ny * 8 + nx * 2 + warp) * 0.5 + 0.5;
      const grain =
        Math.sin(x * 2.13 + y * 2.61) * Math.cos(x * 1.37 - y * 1.93) * 0.5 + 0.5;
      const shade = ripple * 0.45 + grain * 0.55;

      aImg.data[idx] = Math.round(196 + shade * 34);
      aImg.data[idx + 1] = Math.round(140 + shade * 30);
      aImg.data[idx + 2] = Math.round(86 + shade * 24);
      aImg.data[idx + 3] = 255;

      const bv = Math.round(90 + ripple * 85 + (grain - 0.5) * 44);
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(24, 24);
  albedo.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(24, 24);
  bump.anisotropy = maxAnisotropy;

  return { albedo, bump };
}

function createCliffMaps(maxAnisotropy: number) {
  const size = 256;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ny = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * Math.PI * 2;
      const idx = (y * size + x) * 4;

      // Craggy vertical & diagonal sandstone fissures + muted strata
      const fissure =
        Math.sin(nx * 4 + Math.sin(ny * 3) * 1.2) * 0.4 +
        Math.cos(nx * 9 - ny * 2) * 0.25 +
        0.5;
      const strata = Math.sin(ny * 6 + Math.cos(nx * 2) * 0.7) * 0.25 + 0.5;
      const grain = Math.sin(x * 1.9 + y * 2.7) * 0.12 + 0.5;
      const tone = Math.max(0, Math.min(1, fissure * 0.5 + strata * 0.35 + grain * 0.15));

      aImg.data[idx] = Math.round(92 + tone * 64);
      aImg.data[idx + 1] = Math.round(74 + tone * 48);
      aImg.data[idx + 2] = Math.round(58 + tone * 34);
      aImg.data[idx + 3] = 255;

      const bv = Math.round(55 + tone * 155);
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(2, 2);
  albedo.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 2);
  bump.anisotropy = maxAnisotropy;

  return { albedo, bump };
}

function createRadialSoftTexture(
  innerRgba: string,
  outerRgba: string,
  plateauStop = 0.35,
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, innerRgba);
  grad.addColorStop(plateauStop, innerRgba);
  grad.addColorStop(1, outerRgba);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSceneMaterialLibrary(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): SceneMaterialLibrary {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const armorMaps = createArmorMaps(maxAniso);
  const sandMaps = createSandMaps(maxAniso);
  const cliffMaps = createCliffMaps(maxAniso);
  const shadowTex = createRadialSoftTexture('rgba(16, 11, 8, 0.85)', 'rgba(16, 11, 8, 0)', 0.38);
  const dustTex = createRadialSoftTexture('rgba(255, 226, 184, 0.72)', 'rgba(255, 226, 184, 0)', 0.08);

  // Primary weathered bronze-slate outer armor plates
  const armorPrimary = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: armorMaps.albedo,
    bumpMap: armorMaps.bump,
    bumpScale: 0.12,
    roughnessMap: armorMaps.roughness,
    roughness: 0.56,
    metalness: 0.74,
    envMapIntensity: 1.05,
  });

  // Secondary darker oxidized steel/bronze trim
  const armorSecondary = new THREE.MeshStandardMaterial({
    color: 0x9b8e80,
    map: armorMaps.albedo,
    bumpMap: armorMaps.bump,
    bumpScale: 0.1,
    roughness: 0.46,
    metalness: 0.84,
    envMapIntensity: 1.12,
  });

  // UV-independent sculpted alloy for ExtrudeGeometry armor plates (prevents stretched UV seams)
  const armorExtrude = new THREE.MeshStandardMaterial({
    color: 0x766e64,
    roughness: 0.48,
    metalness: 0.82,
    envMapIntensity: 1.1,
  });

  // Inner skeletal dark obsidian-titanium frame & joints (smooth contrast >= 0.30)
  const innerFrame = new THREE.MeshStandardMaterial({
    color: 0x1d2328,
    roughness: 0.3,
    metalness: 0.9,
    envMapIntensity: 1.2,
  });

  // Brushed hydraulic piston rods
  const pistonChrome = new THREE.MeshStandardMaterial({
    color: 0xb7c2cc,
    roughness: 0.16,
    metalness: 0.96,
    envMapIntensity: 1.35,
  });

  // Optical visor / dark glass core
  const visorLens = new THREE.MeshPhysicalMaterial({
    color: 0x071620,
    roughness: 0.1,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    ior: 1.7,
    transparent: isSoftwareGl,
    opacity: 1,
  });

  // Saturated electric cyan-blue reactor vents (vibrant cyan on both GPU & Software WebGL)
  const cyanEmissive = new THREE.MeshStandardMaterial({
    color: 0x00e1ff,
    emissive: new THREE.Color(0x00bfff),
    emissiveIntensity: isSoftwareGl ? 1.45 : 2.1,
    roughness: 0.25,
    metalness: 0.05,
    toneMapped: isSoftwareGl,
  });

  const cyanGlowHalo = new THREE.MeshBasicMaterial({
    color: 0x00d8ff,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const cyanWispMat = new THREE.MeshBasicMaterial({
    color: 0x4aeaff,
    map: dustTex,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const desertSand = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sandMaps.albedo,
    bumpMap: sandMaps.bump,
    bumpScale: 0.14,
    roughness: 0.98,
    metalness: 0.0,
    envMapIntensity: 0.12,
  });

  const canyonRock = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: cliffMaps.albedo,
    bumpMap: cliffMaps.bump,
    bumpScale: 0.45,
    roughness: 0.95,
    metalness: 0.02,
    envMapIntensity: 0.14,
  });

  const boulderRock = new THREE.MeshStandardMaterial({
    color: 0xd0b192,
    map: cliffMaps.albedo,
    bumpMap: cliffMaps.bump,
    bumpScale: 0.3,
    roughness: 0.93,
    metalness: 0.02,
    envMapIntensity: 0.16,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });

  const allMaterials = [
    armorPrimary,
    armorSecondary,
    armorExtrude,
    innerFrame,
    pistonChrome,
    visorLens,
    cyanEmissive,
    cyanGlowHalo,
    cyanWispMat,
    desertSand,
    canyonRock,
    boulderRock,
    contactShadow,
  ];
  const allTextures = [
    armorMaps.albedo,
    armorMaps.bump,
    armorMaps.roughness,
    sandMaps.albedo,
    sandMaps.bump,
    cliffMaps.albedo,
    cliffMaps.bump,
    shadowTex,
    dustTex,
  ];

  return {
    armorPrimary,
    armorSecondary,
    armorExtrude,
    innerFrame,
    pistonChrome,
    visorLens,
    cyanEmissive,
    cyanGlowHalo,
    cyanWispMat,
    desertSand,
    canyonRock,
    boulderRock,
    contactShadow,
    dustSpriteTexture: dustTex,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
    },
  };
}
