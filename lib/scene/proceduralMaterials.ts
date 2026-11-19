import * as THREE from 'three';
import { MECH_STYLES, MechStyleId, getMechStyleConfig } from './mechStyles';

export interface SceneMaterialLibrary {
  armorPrimary: THREE.MeshStandardMaterial;
  armorSecondary: THREE.MeshStandardMaterial;
  armorExtrude: THREE.MeshStandardMaterial;
  armorAccent: THREE.MeshStandardMaterial;
  innerFrame: THREE.MeshStandardMaterial;
  pistonChrome: THREE.MeshStandardMaterial;
  visorLens: THREE.MeshPhysicalMaterial;
  cyanEmissive: THREE.MeshStandardMaterial;
  plasmaBladeMat: THREE.MeshBasicMaterial;
  cyanGlowHalo: THREE.MeshBasicMaterial;
  cyanWispMat: THREE.MeshBasicMaterial;
  desertSand: THREE.MeshStandardMaterial;
  canyonRock: THREE.MeshStandardMaterial;
  boulderRock: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  dustSpriteTexture: THREE.CanvasTexture;
  applyMechStyle: (styleId: MechStyleId) => void;
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

  // High-luminance neutral brushed alloy & subtle micro-grain so style tinting stays vivid and crisp
  for (let y = 0; y < size; y++) {
    const ny = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * Math.PI * 2;
      const idx = (y * size + x) * 4;

      const patina =
        Math.sin(nx * 2 + 0.4) * Math.cos(ny * 2 - 0.5) * 0.1 +
        Math.sin(nx - ny * 2) * 0.06 +
        0.5;
      const microBrush = Math.sin(y * 1.85 + Math.sin(x * 0.06) * 1.4) * 0.07 + 0.5;
      const fineGrain =
        Math.sin(x * 1.71 + y * 2.27) * Math.cos(x * 2.43 - y * 1.31) * 0.09;

      // Subtle hex-grid weave impression for futuristic composite armor
      const hexWave =
        Math.sin((x * 0.35 + y * 0.2)) * Math.sin((x * 0.35 - y * 0.2)) * 0.035;

      const shade = Math.max(0, Math.min(1, 0.78 + (patina - 0.5) * 0.16 + fineGrain + hexWave));
      const base = Math.round(168 + shade * 68 + (microBrush - 0.5) * 14);
      const r = Math.max(0, Math.min(255, base + 2));
      const g = Math.max(0, Math.min(255, base + 1));
      const b = Math.max(0, Math.min(255, base));

      aImg.data[idx] = r;
      aImg.data[idx + 1] = g;
      aImg.data[idx + 2] = b;
      aImg.data[idx + 3] = 255;

      const bumpVal = Math.max(
        0,
        Math.min(255, Math.round(132 + (microBrush - 0.5) * 32 + fineGrain * 72 + hexWave * 95)),
      );
      bImg.data[idx] = bumpVal;
      bImg.data[idx + 1] = bumpVal;
      bImg.data[idx + 2] = bumpVal;
      bImg.data[idx + 3] = 255;

      const roughVal = Math.max(76, Math.min(210, Math.round(110 + (1 - shade) * 85)));
      rImg.data[idx] = roughVal;
      rImg.data[idx + 1] = roughVal;
      rImg.data[idx + 2] = roughVal;
      rImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  // Crisp futuristic armor panel lines + diagonal chamfered tech seams + micro rivets
  const drawSeam = (x1: number, y1: number, x2: number, y2: number, width = 1.6) => {
    aCtx.strokeStyle = 'rgba(18, 22, 28, 0.52)';
    aCtx.lineWidth = width;
    aCtx.beginPath();
    aCtx.moveTo(x1, y1);
    aCtx.lineTo(x2, y2);
    aCtx.stroke();

    // Subtle specular bevel highlight beside seam
    aCtx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    aCtx.lineWidth = 0.9;
    aCtx.beginPath();
    aCtx.moveTo(x1, y1 + 1.6);
    aCtx.lineTo(x2, y2 + 1.6);
    aCtx.stroke();

    bCtx.strokeStyle = 'rgba(28, 28, 28, 0.72)';
    bCtx.lineWidth = width + 0.6;
    bCtx.beginPath();
    bCtx.moveTo(x1, y1);
    bCtx.lineTo(x2, y2);
    bCtx.stroke();
  };

  for (const s of [96, 256, 416]) {
    drawSeam(0, s, size, s, 1.8);
  }
  for (const x of [128, 384]) {
    drawSeam(x, 0, x, 96, 1.4);
    drawSeam(x, 256, x, 416, 1.4);
  }
  // Angled mecha panel cuts
  drawSeam(128, 96, 176, 144, 1.5);
  drawSeam(176, 144, 336, 144, 1.5);
  drawSeam(336, 144, 384, 96, 1.5);
  drawSeam(64, 256, 112, 208, 1.4);
  drawSeam(448, 256, 400, 208, 1.4);

  // Micro-fastener bolts along panel corners
  const bolts = [
    [24, 108],
    [116, 108],
    [140, 108],
    [372, 108],
    [396, 108],
    [488, 108],
    [24, 268],
    [116, 268],
    [140, 268],
    [372, 268],
    [396, 268],
    [488, 268],
    [24, 428],
    [256, 428],
    [488, 428],
  ];
  for (const [bx, by] of bolts) {
    aCtx.fillStyle = 'rgba(20, 24, 30, 0.55)';
    aCtx.beginPath();
    aCtx.arc(bx, by, 2.4, 0, Math.PI * 2);
    aCtx.fill();

    bCtx.fillStyle = 'rgba(220, 220, 220, 0.7)';
    bCtx.beginPath();
    bCtx.arc(bx, by, 2.6, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Fine worn metallic micro-scratches
  let seed = 7331;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 28;
    const ang = (rand() - 0.5) * 0.28;
    aCtx.strokeStyle =
      rand() > 0.45 ? 'rgba(245, 248, 252, 0.16)' : 'rgba(20, 24, 30, 0.18)';
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

  const initialStyle = MECH_STYLES.apex;

  // Primary outer armor plates (crisp panel-lined brushed titanium-gunmetal alloy)
  const armorPrimary = new THREE.MeshStandardMaterial({
    color: initialStyle.armorPrimaryColor,
    map: armorMaps.albedo,
    bumpMap: armorMaps.bump,
    bumpScale: 0.14,
    roughnessMap: armorMaps.roughness,
    roughness: initialStyle.armorRoughness,
    metalness: initialStyle.armorMetalness,
    envMapIntensity: 1.18,
  });

  // Secondary darker structural armor sub-plates
  const armorSecondary = new THREE.MeshStandardMaterial({
    color: initialStyle.armorSecondaryColor,
    map: armorMaps.albedo,
    bumpMap: armorMaps.bump,
    bumpScale: 0.11,
    roughness: 0.44,
    metalness: 0.86,
    envMapIntensity: 1.22,
  });

  // UV-independent sculpted bevel armor (ExtrudeGeometry wings, crest blades, tassets)
  const armorExtrude = new THREE.MeshStandardMaterial({
    color: initialStyle.armorExtrudeColor,
    roughness: 0.42,
    metalness: 0.84,
    envMapIntensity: 1.24,
  });

  // Anodized / Gilded high-contrast metallic accent trim (V-fins, reactor rim, pauldrons, knee crests)
  const armorAccent = new THREE.MeshStandardMaterial({
    color: initialStyle.armorAccentColor,
    roughness: initialStyle.accentRoughness,
    metalness: initialStyle.accentMetalness,
    envMapIntensity: 1.48,
  });

  // Inner skeletal dark obsidian-titanium frame & joints
  const innerFrame = new THREE.MeshStandardMaterial({
    color: initialStyle.innerFrameColor,
    roughness: 0.28,
    metalness: 0.92,
    envMapIntensity: 1.25,
  });

  // Mirror-brushed hydraulic piston rods
  const pistonChrome = new THREE.MeshStandardMaterial({
    color: 0xc5d0db,
    roughness: 0.14,
    metalness: 0.97,
    envMapIntensity: 1.45,
  });

  // Optical visor / dark glass housing
  const visorLens = new THREE.MeshPhysicalMaterial({
    color: 0x061018,
    roughness: 0.08,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    ior: 1.75,
    transparent: isSoftwareGl,
    opacity: 1,
  });

  // Saturated plasma reactor / visor / conduit emissive material
  const cyanEmissive = new THREE.MeshStandardMaterial({
    color: initialStyle.emissiveColor,
    emissive: new THREE.Color(initialStyle.emissiveGlowColor),
    emissiveIntensity: isSoftwareGl ? 1.55 : 2.3,
    roughness: 0.2,
    metalness: 0.05,
    toneMapped: isSoftwareGl,
  });

  // Luminous translucent forearm plasma blade & jet thruster flame material
  const plasmaBladeMat = new THREE.MeshBasicMaterial({
    color: initialStyle.emissiveColor,
    transparent: true,
    opacity: 0.78,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const cyanGlowHalo = new THREE.MeshBasicMaterial({
    color: initialStyle.emissiveGlowColor,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const cyanWispMat = new THREE.MeshBasicMaterial({
    color: initialStyle.wispColor,
    map: dustTex,
    transparent: true,
    opacity: 0.22,
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

  const applyMechStyle = (styleId: MechStyleId) => {
    const cfg = getMechStyleConfig(styleId);
    armorPrimary.color.setHex(cfg.armorPrimaryColor);
    armorPrimary.roughness = cfg.armorRoughness;
    armorPrimary.metalness = cfg.armorMetalness;

    armorSecondary.color.setHex(cfg.armorSecondaryColor);
    armorExtrude.color.setHex(cfg.armorExtrudeColor);

    armorAccent.color.setHex(cfg.armorAccentColor);
    armorAccent.roughness = cfg.accentRoughness;
    armorAccent.metalness = cfg.accentMetalness;

    innerFrame.color.setHex(cfg.innerFrameColor);

    cyanEmissive.color.setHex(cfg.emissiveColor);
    cyanEmissive.emissive.setHex(cfg.emissiveGlowColor);
    plasmaBladeMat.color.setHex(cfg.emissiveColor);
    cyanGlowHalo.color.setHex(cfg.emissiveGlowColor);
    cyanWispMat.color.setHex(cfg.wispColor);
  };

  const allMaterials = [
    armorPrimary,
    armorSecondary,
    armorExtrude,
    armorAccent,
    innerFrame,
    pistonChrome,
    visorLens,
    cyanEmissive,
    plasmaBladeMat,
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
    armorAccent,
    innerFrame,
    pistonChrome,
    visorLens,
    cyanEmissive,
    plasmaBladeMat,
    cyanGlowHalo,
    cyanWispMat,
    desertSand,
    canyonRock,
    boulderRock,
    contactShadow,
    dustSpriteTexture: dustTex,
    applyMechStyle,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
    },
  };
}
