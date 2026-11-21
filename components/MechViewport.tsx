'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  AtmospherePreset,
  CameraMode,
  DEFAULT_DRONE_CONFIG,
  advanceOrbitAngle,
  computeCameraPose,
  normalizeAzimuthDeg,
} from '@/lib/scene/cameraRig';
import { groundHeightAt } from '@/lib/scene/desertTerrain';
import {
  MechInputState,
  createEmptyInput,
  createInitialMechState,
  stepMechKinematics,
} from '@/lib/scene/mechController';
import { createSceneMaterialLibrary } from '@/lib/scene/proceduralMaterials';
import { MechStyleId } from '@/lib/scene/mechStyles';
import { buildAlienMech } from '@/lib/scene/buildAlienMech';
import { buildCompanionSquadron } from '@/lib/scene/buildCompanionSquadron';
import { buildCockpitRig } from '@/lib/scene/buildCockpitRig';
import { buildDesertCanyon } from '@/lib/scene/buildDesertCanyon';

export type MechActionKey = keyof MechInputState;

export interface TelemetrySnapshot {
  azimuthDeg: number;
  altitudeM: number;
  distanceM: number;
  mechX: number;
  mechY: number;
  mechZ: number;
  speedMs: number;
  grounded: boolean;
  activeAction: string;
}

interface MechViewportProps {
  isPlaying: boolean;
  speed: number;
  cameraMode: CameraMode;
  atmosphere: AtmospherePreset;
  mechStyle: MechStyleId;
  resetTrigger: number;
  virtualInputRef: React.MutableRefObject<MechInputState>;
  onUserDragStart: () => void;
  onTelemetryUpdate: (snapshot: TelemetrySnapshot) => void;
}

// Reusable scratch vectors allocated once at module scope (zero GC in render loop)
const _targetVec = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _mergedInput = createEmptyInput();
const _sandMechCtx = {
  mechX: 0,
  mechY: 0,
  mechZ: 0,
  moveSpeed: 0,
  grounded: true,
};
const _heroAnchor = { x: 0, z: 0 };

function mapCodeToAction(code: string): MechActionKey | null {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'forward';
    case 'KeyS':
    case 'ArrowDown':
      return 'backward';
    case 'KeyA':
    case 'ArrowLeft':
      return 'turnLeft';
    case 'KeyD':
    case 'ArrowRight':
      return 'turnRight';
    case 'Space':
      return 'jump';
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'sprint';
    case 'KeyX':
    case 'ControlLeft':
      return 'crouch';
    case 'KeyQ':
      return 'raiseLeftArm';
    case 'KeyE':
      return 'raiseRightArm';
    case 'KeyZ':
      return 'punchLeft';
    case 'KeyC':
      return 'punchRight';
    case 'Digit1':
      return 'kickLeft';
    case 'Digit2':
      return 'kickRight';
    default:
      return null;
  }
}

function describeActiveAction(input: MechInputState, grounded: boolean, moveSpeed: number): string {
  if (!grounded) return 'JUMP BOOST';
  if (input.punchLeft || input.punchRight) return 'ARM STRIKE';
  if (input.kickLeft || input.kickRight) return 'LEG KICK';
  if (input.raiseLeftArm || input.raiseRightArm) return 'ARM LIFT';
  if (input.crouch) return 'CROUCH';
  if (Math.abs(moveSpeed) > 1.2) return input.sprint ? 'SPRINT' : 'WALKING';
  if (input.turnLeft || input.turnRight) return 'TURNING';
  return 'STANDBY';
}

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export default function MechViewport({
  isPlaying,
  speed,
  cameraMode,
  atmosphere,
  mechStyle,
  resetTrigger,
  virtualInputRef,
  onUserDragStart,
  onTelemetryUpdate,
}: MechViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Store reactive React props in refs so WebGLRenderer mounts once and never resets
  const propsRef = useRef({
    isPlaying,
    speed,
    cameraMode,
    atmosphere,
    mechStyle,
    onUserDragStart,
    onTelemetryUpdate,
  });
  useEffect(() => {
    propsRef.current = {
      isPlaying,
      speed,
      cameraMode,
      atmosphere,
      mechStyle,
      onUserDragStart,
      onTelemetryUpdate,
    };
  }, [isPlaying, speed, cameraMode, atmosphere, mechStyle, onUserDragStart, onTelemetryUpdate]);

  // Expose imperative handles for atmosphere, style updates & orbit/mech reset
  const sceneHooksRef = useRef<{
    applyAtmosphere?: (preset: AtmospherePreset) => void;
    applyMechStyle?: (styleId: MechStyleId) => void;
    resetOrbit?: () => void;
    notifyModeChange?: (mode: CameraMode) => void;
  }>({});

  useEffect(() => {
    sceneHooksRef.current.applyAtmosphere?.(atmosphere);
  }, [atmosphere]);

  useEffect(() => {
    sceneHooksRef.current.applyMechStyle?.(mechStyle);
  }, [mechStyle]);

  useEffect(() => {
    sceneHooksRef.current.notifyModeChange?.(cameraMode);
  }, [cameraMode]);

  useEffect(() => {
    if (resetTrigger > 0) {
      sceneHooksRef.current.resetOrbit?.();
    }
  }, [resetTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const forceBloom =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('bloom') === '1';

    const getSafeSize = () => {
      const rawW =
        container.clientWidth || window.innerWidth || document.documentElement.clientWidth;
      const rawH =
        container.clientHeight || window.innerHeight || document.documentElement.clientHeight;
      return {
        width: Math.max(rawW || 1280, 64),
        height: Math.max(rawH || 720, 64),
      };
    };

    const { width, height } = getSafeSize();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false });
      } catch {
        queueMicrotask(() => setContextLost(true));
        return;
      }
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('data-testid', 'mech-webgl-canvas');
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    // Scene & Camera (near=0.25 so 3D cockpit canopy & joysticks never clip)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      DEFAULT_DRONE_CONFIG.fovDeg,
      width / height,
      0.25,
      700,
    );
    scene.add(camera);

    // Studio IBL reflection environment for weathered bronze/steel armor (guarded)
    let envTarget: THREE.WebGLRenderTarget | null = null;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envTarget.texture;
      roomEnv.dispose();
      pmremGenerator.dispose();
    } catch {
      envTarget = null;
    }

    // Three-Point Cinematic Canyon Lighting Rig (1 shadow caster)
    const keyLight = new THREE.DirectionalLight(0xffe7bc, 3.35);
    keyLight.position.set(82, 66, -56);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 260;
    const d = 82;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.04;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x6b87a6, 0x9c6236, 0.95);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x7cc8e8, 1.25);
    rimLight.position.set(-72, 44, 52);
    scene.add(rimLight);

    // Build Procedural Materials, 64m Alien Mech, 3D Cockpit Interior, and Desert Canyon
    const mats = createSceneMaterialLibrary(renderer, isSoftwareGl);
    mats.applyMechStyle(propsRef.current.mechStyle);
    const mech = buildAlienMech(mats);
    scene.add(mech.group);

    const squadron = buildCompanionSquadron(mats);
    scene.add(squadron.group);

    const cockpitRig = buildCockpitRig(mats, renderer.capabilities.getMaxAnisotropy());
    camera.add(cockpitRig.group);

    const canyon = buildDesertCanyon(mats, renderer.getPixelRatio());
    scene.add(canyon.group);
    canyon.setAtmosphere(propsRef.current.atmosphere, scene, keyLight, hemiLight, rimLight);

    // Mech simulation & keyboard state
    const simState = createInitialMechState();
    simState.y = groundHeightAt(simState.x, simState.z);
    const keyboardInput = createEmptyInput();
    let queuedJump = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const action = mapCodeToAction(e.code);
      if (action) {
        if (e.code === 'Space' || e.code.startsWith('Arrow')) {
          e.preventDefault();
        }
        keyboardInput[action] = true;
        if (action === 'jump') {
          queuedJump = true;
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const action = mapCodeToAction(e.code);
      if (action) {
        keyboardInput[action] = false;
      }
    };
    const onWindowBlur = () => {
      (Object.keys(keyboardInput) as MechActionKey[]).forEach((k) => {
        keyboardInput[k] = false;
      });
      queuedJump = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    // OrbitControls for seamless Free Explore inspection
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 26;
    controls.maxDistance = 175;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.12;
    controls.target.set(0, DEFAULT_DRONE_CONFIG.targetY, 0);

    // Start facing front-three-quarter matching reference composition, then smoothly orbiting 360°
    let orbitAngle = 0.14;
    const initialPose = computeCameraPose(
      propsRef.current.cameraMode,
      orbitAngle,
      groundHeightAt,
      DEFAULT_DRONE_CONFIG,
      simState,
    );
    camera.position.set(initialPose.x, initialPose.y, initialPose.z);
    camera.lookAt(initialPose.targetX, initialPose.targetY, initialPose.targetZ);
    controls.update();

    let transitionAlpha = 1;
    let lastUserDragging = false;

    const handleControlStart = () => {
      lastUserDragging = true;
      if (propsRef.current.cameraMode !== 'free' && propsRef.current.cameraMode !== 'cockpit') {
        propsRef.current.onUserDragStart();
      }
    };
    const handleControlEnd = () => {
      lastUserDragging = false;
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('end', handleControlEnd);

    sceneHooksRef.current.applyAtmosphere = (preset: AtmospherePreset) => {
      canyon.setAtmosphere(preset, scene, keyLight, hemiLight, rimLight);
    };
    sceneHooksRef.current.applyMechStyle = (styleId: MechStyleId) => {
      mats.applyMechStyle(styleId);
    };
    sceneHooksRef.current.notifyModeChange = (mode: CameraMode) => {
      if (mode !== 'free') {
        transitionAlpha = 0;
      }
    };
    sceneHooksRef.current.resetOrbit = () => {
      orbitAngle = 0.14;
      Object.assign(simState, createInitialMechState());
      simState.y = groundHeightAt(simState.x, simState.z);
      squadron.reset();
      transitionAlpha = 0;
    };

    // Post-processing Bloom on GPU when HalfFloat FBOs are supported (clean fallback on error)
    let composer: EffectComposer | null = null;
    const supportsFloatRt =
      renderer.extensions.has('EXT_color_buffer_float') ||
      renderer.extensions.has('EXT_color_buffer_half_float');
    if ((!isSoftwareGl || forceBloom) && supportsFloatRt) {
      try {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          0.38,
          0.52,
          0.88,
        );
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass());
      } catch {
        composer?.dispose();
        composer = null;
      }
    }

    // Resize handling via both window resize and container ResizeObserver
    let disposed = false;
    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w < 2 || h < 2) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const dpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h);
      if (composer) {
        composer.setPixelRatio(dpr);
        composer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    // Animation loop with software-WebGL afterDraw pacing
    const startTimeMs = performance.now();
    let lastTimeMs = startTimeMs;
    let frameId = 0;
    let lastTelemetryPush = -1;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const nowMs = performance.now();
      const delta = Math.min((nowMs - lastTimeMs) / 1000, 0.5);
      lastTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;
      const { isPlaying: playing, speed: spd, cameraMode: mode } = propsRef.current;

      // Merge keyboard + on-screen cockpit button inputs without allocations
      const vInput = virtualInputRef.current;
      (Object.keys(_mergedInput) as MechActionKey[]).forEach((k) => {
        _mergedInput[k] = keyboardInput[k] || vInput[k];
      });
      if (queuedJump) {
        _mergedInput.jump = true;
        queuedJump = false;
      }

      // Step mech walking, jumping, and arm/leg articulation
      stepMechKinematics(simState, _mergedInput, delta, groundHeightAt);
      const terrainUnderMech = groundHeightAt(simState.x, simState.z);
      mech.applyPose(simState, elapsed, terrainUnderMech);
      _heroAnchor.x = simState.x;
      _heroAnchor.z = simState.z;
      squadron.update(elapsed, delta, _heroAnchor);
      _sandMechCtx.mechX = simState.x;
      _sandMechCtx.mechY = simState.y - terrainUnderMech;
      _sandMechCtx.mechZ = simState.z;
      _sandMechCtx.moveSpeed = simState.moveSpeed;
      _sandMechCtx.grounded = simState.grounded;
      canyon.update(elapsed, delta, _sandMechCtx);

      const inCockpit = mode === 'cockpit';
      controls.enabled = !inCockpit;
      cockpitRig.update(simState, _mergedInput, elapsed, inCockpit, propsRef.current.mechStyle);

      // Smooth FOV transition (wider 62° inside cockpit windshield, 45° outside)
      const targetFov = inCockpit ? 62 : DEFAULT_DRONE_CONFIG.fovDeg;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7.5, delta);
        camera.updateProjectionMatrix();
      }

      // Camera Choreography
      if (mode !== 'free' && !lastUserDragging) {
        if (mode === 'orbit360') {
          orbitAngle = advanceOrbitAngle(orbitAngle, delta, spd, playing, DEFAULT_DRONE_CONFIG);
        }
        const pose = computeCameraPose(
          mode,
          orbitAngle,
          groundHeightAt,
          DEFAULT_DRONE_CONFIG,
          simState,
        );
        _desiredPos.set(pose.x, pose.y, pose.z);
        _targetVec.set(pose.targetX, pose.targetY, pose.targetZ);

        const dampFactor = transitionAlpha < 0.99 ? 1 - Math.exp(-5.5 * delta) : 1.0;
        if (transitionAlpha < 0.99) {
          camera.position.lerp(_desiredPos, dampFactor);
          controls.target.lerp(_targetVec, dampFactor);
          if (camera.position.distanceTo(_desiredPos) < 0.35) {
            transitionAlpha = 1;
          }
        } else {
          camera.position.copy(_desiredPos);
          controls.target.copy(_targetVec);
        }
        camera.lookAt(controls.target);
        if (!inCockpit) {
          controls.update();
        }
      } else {
        controls.update();
        const floorY = groundHeightAt(camera.position.x, camera.position.z) + 2.2;
        if (camera.position.y < floorY) {
          camera.position.y = floorY;
        }
      }

      // Throttled telemetry update (~8Hz) so React never re-renders at 60Hz
      if (elapsed - lastTelemetryPush >= 0.12) {
        lastTelemetryPush = elapsed;
        const az = normalizeAzimuthDeg(
          Math.atan2(camera.position.x - simState.x, camera.position.z - simState.z),
        );
        const dist = Math.hypot(
          camera.position.x - controls.target.x,
          camera.position.z - controls.target.z,
        );
        propsRef.current.onTelemetryUpdate({
          azimuthDeg: Math.round(az),
          altitudeM: Math.round(camera.position.y),
          distanceM: Math.round(dist),
          mechX: Number(simState.x.toFixed(1)),
          mechY: Number((simState.y - terrainUnderMech).toFixed(1)),
          mechZ: Number(simState.z.toFixed(1)),
          speedMs: Number(Math.abs(simState.moveSpeed).toFixed(1)),
          grounded: simState.grounded,
          activeAction: describeActiveAction(_mergedInput, simState.grounded, simState.moveSpeed),
        });
      }

      if (composer) {
        try {
          composer.render();
        } catch {
          composer.dispose();
          composer = null;
          renderer.render(scene, camera);
        }
      } else {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('end', handleControlEnd);
      controls.dispose();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      cockpitRig.dispose();
      squadron.dispose();
      mech.dispose();
      canyon.dispose();
      mats.dispose();
      envTarget?.dispose();
      if (composer) composer.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, [virtualInputRef]);

  if (contextLost) {
    return (
      <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-[#181411] text-stone-200 p-6">
        <div className="max-w-md text-center space-y-4">
          <Image
            src="/assets/aistudio/image_3a9ca363.png"
            alt="Colossal alien robot mech in desert canyon"
            width={192}
            height={256}
            className="w-48 h-64 object-cover mx-auto rounded-xl border border-white/15"
            referrerPolicy="no-referrer"
          />
          <h2 className="font-display text-lg font-semibold text-white">
            WebGL Context Unavailable
          </h2>
          <p className="text-sm text-stone-400">
            Hardware or software WebGL rendering could not be initialized in this browser session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="mech-viewport-container"
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#181411]"
    />
  );
}
