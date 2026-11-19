'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import MechViewport, { MechActionKey, TelemetrySnapshot } from '@/components/MechViewport';
import ControlDock from '@/components/ControlDock';
import { AtmospherePreset, CameraMode } from '@/lib/scene/cameraRig';
import { createEmptyInput, MechInputState } from '@/lib/scene/mechController';
import { MechStyleId, getMechStyleConfig } from '@/lib/scene/mechStyles';

export default function HomePage() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit360');
  const [atmosphere, setAtmosphere] = useState<AtmospherePreset>('sunbreak');
  const [mechStyle, setMechStyle] = useState<MechStyleId>('apex');
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    azimuthDeg: 8,
    altitudeM: 31,
    distanceM: 98,
    mechX: 0,
    mechY: 0,
    mechZ: 0,
    speedMs: 0,
    grounded: true,
    activeAction: 'STANDBY',
  });

  const virtualInputRef = useRef<MechInputState>(createEmptyInput());

  // Keyboard shortcuts: P (Play/Pause Orbit), V (Toggle Cockpit), H (Hide/Show HUD)
  // Note: Space is reserved for Mech Jump inside MechViewport
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyP') {
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'KeyV') {
        setCameraMode((prev) => (prev === 'cockpit' ? 'orbit360' : 'cockpit'));
      } else if (e.key === 'h' || e.key === 'H') {
        setIsCollapsed((prev) => !prev);
      }
    };
    const clearVirtualInput = () => {
      const inp = virtualInputRef.current;
      (Object.keys(inp) as MechActionKey[]).forEach((k) => {
        inp[k] = false;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', clearVirtualInput);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', clearVirtualInput);
    };
  }, []);

  const handleActionHold = useCallback((action: MechActionKey, active: boolean) => {
    virtualInputRef.current[action] = active;
  }, []);

  const handleUserDragStart = useCallback(() => {
    setCameraMode('free');
  }, []);

  const handleSelectCameraMode = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    if (mode === 'orbit360') {
      setIsPlaying(true);
    }
  }, []);

  const handleResetOrbit = useCallback(() => {
    setCameraMode('orbit360');
    setIsPlaying(true);
    setResetTrigger((n) => n + 1);
  }, []);

  const activeStyleConfig = getMechStyleConfig(mechStyle);

  return (
    <main
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#181411]"
      data-camera-mode={cameraMode}
      data-orbit-playing={String(isPlaying)}
      data-mech-style={mechStyle}
      data-azimuth={telemetry.azimuthDeg}
      data-mech-x={telemetry.mechX}
      data-mech-y={telemetry.mechY}
      data-mech-z={telemetry.mechZ}
      data-mech-action={telemetry.activeAction}
      data-grounded={String(telemetry.grounded)}
    >
      {/* Full-Viewport 3D Canvas */}
      <MechViewport
        isPlaying={isPlaying}
        speed={speed}
        cameraMode={cameraMode}
        atmosphere={atmosphere}
        mechStyle={mechStyle}
        resetTrigger={resetTrigger}
        virtualInputRef={virtualInputRef}
        onUserDragStart={handleUserDragStart}
        onTelemetryUpdate={setTelemetry}
      />

      {/* Minimal Top-Left Scene Identity */}
      <header className="fixed top-4 left-5 z-10 pointer-events-none">
        <h1 className="font-display text-lg sm:text-xl font-semibold tracking-wide text-stone-50 [text-shadow:0_2px_10px_rgba(0,0,0,0.95)]">
          KRONOS-VII · {activeStyleConfig.label}
        </h1>
        <p className="text-xs text-stone-100/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.98)]">
          {activeStyleConfig.subtitle} · 64m Scale
        </p>
      </header>

      {/* Quiet Top-Right Tabular Drone & Mech Telemetry */}
      <aside
        aria-label="Drone and mech telemetry"
        className="fixed top-4 right-5 z-10 pointer-events-none text-right hidden sm:block"
      >
        <div
          data-testid="azimuth-readout"
          className="font-mono-tabular text-xs font-medium text-stone-50 [text-shadow:0_1px_8px_rgba(0,0,0,0.98),0_0_16px_rgba(0,0,0,0.85)]"
        >
          Az {String(telemetry.azimuthDeg).padStart(3, '0')}° · Alt {telemetry.altitudeM}m ·{' '}
          {telemetry.speedMs.toFixed(1)}m/s · {telemetry.activeAction}
        </div>
        <div className="text-[11px] text-stone-100/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.98),0_0_14px_rgba(0,0,0,0.8)]">
          WASD Move · Space Jump · Q/E/Z/C/1/2 Limbs · V Cockpit · P Orbit · H Zen
        </div>
      </aside>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <ControlDock
        isPlaying={isPlaying}
        onTogglePlay={() => {
          if (cameraMode !== 'orbit360') {
            setCameraMode('orbit360');
            setIsPlaying(true);
          } else {
            setIsPlaying((p) => !p);
          }
        }}
        speed={speed}
        onSelectSpeed={(s) => {
          setSpeed(s);
          if (cameraMode !== 'orbit360') {
            setCameraMode('orbit360');
          }
          setIsPlaying(true);
        }}
        cameraMode={cameraMode}
        onSelectCameraMode={handleSelectCameraMode}
        atmosphere={atmosphere}
        onSelectAtmosphere={setAtmosphere}
        mechStyle={mechStyle}
        onSelectMechStyle={setMechStyle}
        onResetOrbit={handleResetOrbit}
        onActionHold={handleActionHold}
        activeActionLabel={telemetry.activeAction}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((c) => !c)}
      />
    </main>
  );
}
