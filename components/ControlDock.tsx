'use client';

import React from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Pause,
  Play,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { AtmospherePreset, CameraMode } from '@/lib/scene/cameraRig';
import { MechActionKey } from './MechViewport';

export interface ControlDockProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSelectSpeed: (speed: number) => void;
  cameraMode: CameraMode;
  onSelectCameraMode: (mode: CameraMode) => void;
  atmosphere: AtmospherePreset;
  onSelectAtmosphere: (preset: AtmospherePreset) => void;
  onResetOrbit: () => void;
  onActionHold: (action: MechActionKey, active: boolean) => void;
  activeActionLabel: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const SPEED_OPTIONS = [
  { label: '0.5×', value: 0.5 },
  { label: '1.0×', value: 1.0 },
  { label: '1.8×', value: 1.8 },
  { label: '2.8×', value: 2.8 },
];

const CAMERA_OPTIONS: { label: string; value: CameraMode }[] = [
  { label: '360° Drone', value: 'orbit360' },
  { label: '조종관', value: 'cockpit' },
  { label: '파일럿', value: 'pilot3rd' },
  { label: 'Free', value: 'free' },
  { label: 'Scale', value: 'lowScale' },
  { label: 'Rear', value: 'rearSpine' },
];

const ATMOSPHERE_OPTIONS: { label: string; value: AtmospherePreset }[] = [
  { label: 'Sunbreak', value: 'sunbreak' },
  { label: 'Dusk', value: 'dusk' },
  { label: 'Storm', value: 'storm' },
];

const PILOT_CONTROLS: { keyHint: string; label: string; action: MechActionKey }[] = [
  { keyHint: 'W', label: '걷기', action: 'forward' },
  { keyHint: 'S', label: '후진', action: 'backward' },
  { keyHint: 'A', label: '좌회전', action: 'turnLeft' },
  { keyHint: 'D', label: '우회전', action: 'turnRight' },
  { keyHint: 'Space', label: '점프', action: 'jump' },
  { keyHint: 'Shift', label: '부스터', action: 'sprint' },
  { keyHint: 'Q', label: '왼팔', action: 'raiseLeftArm' },
  { keyHint: 'E', label: '오른팔', action: 'raiseRightArm' },
  { keyHint: 'Z', label: '왼펀치', action: 'punchLeft' },
  { keyHint: 'C', label: '오른펀치', action: 'punchRight' },
  { keyHint: '1', label: '왼발차기', action: 'kickLeft' },
  { keyHint: '2', label: '오른발차기', action: 'kickRight' },
];

export default function ControlDock({
  isPlaying,
  onTogglePlay,
  speed,
  onSelectSpeed,
  cameraMode,
  onSelectCameraMode,
  atmosphere,
  onSelectAtmosphere,
  onResetOrbit,
  onActionHold,
  activeActionLabel,
  isCollapsed,
  onToggleCollapse,
}: ControlDockProps) {
  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none max-w-[98vw]"
      data-testid="control-dock-wrapper"
    >
      {/* Collapse / Expand toggle attached cleanly to top edge of dock */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Show Controls' : 'Hide Controls'}
        className="pointer-events-auto mb-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-t-md rounded-b bg-[#12100e]/92 border border-white/15 text-[11px] font-medium text-stone-200 hover:text-white hover:border-cyan-400/50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        {isCollapsed ? (
          <>
            <ChevronUp className="w-3 h-3 text-cyan-400" aria-hidden="true" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3 text-cyan-400" aria-hidden="true" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {/* Compact collapsible bottom dock */}
      <div
        className={`pointer-events-auto transition-all duration-200 ease-out origin-bottom ${
          isCollapsed
            ? 'translate-y-8 opacity-0 pointer-events-none h-0 overflow-hidden'
            : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="flex flex-col items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#12100e]/92 border border-white/15 shadow-2xl">
          {/* Row 1: Orbit, Speed, Camera Views (including Cockpit/Pilot), Atmosphere */}
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-center gap-x-2 gap-y-1">
            {/* Play / Pause & Reset */}
            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause Drone Orbit' : 'Play Drone Orbit'}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Orbit</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onResetOrbit}
                aria-label="Reset Front View"
                title="Reset Position & View"
                className="inline-flex items-center justify-center p-1.5 rounded-md bg-white/5 border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Orbit Speed Selector */}
            <div
              role="group"
              aria-label="Drone Orbit Speed"
              className="flex items-center gap-0.5 pr-2 border-r border-white/10"
            >
              <span className="text-[11px] font-medium text-stone-400 mr-1 whitespace-nowrap shrink-0">
                Speed
              </span>
              {SPEED_OPTIONS.map((opt) => {
                const active = Math.abs(speed - opt.value) < 0.05;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => onSelectSpeed(opt.value)}
                    aria-pressed={active}
                    className={`px-1.5 py-1 rounded text-xs font-mono-tabular transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      active
                        ? 'bg-cyan-500 text-stone-950 font-semibold'
                        : 'text-stone-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Camera Views */}
            <div
              role="group"
              aria-label="Camera View Mode"
              className="flex items-center gap-0.5 pr-2 border-r border-white/10"
            >
              <Camera className="w-3.5 h-3.5 text-stone-400 mr-1 shrink-0" aria-hidden="true" />
              {CAMERA_OPTIONS.map((opt) => {
                const active = cameraMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelectCameraMode(opt.value)}
                    aria-pressed={active}
                    className={`px-1.5 sm:px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      active
                        ? 'bg-stone-100 text-stone-950 font-semibold'
                        : 'text-stone-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Atmosphere Presets */}
            <div
              role="group"
              aria-label="Atmosphere Preset"
              className="flex items-center gap-0.5"
            >
              <Sun className="w-3.5 h-3.5 text-amber-300/80 mr-1 shrink-0" aria-hidden="true" />
              {ATMOSPHERE_OPTIONS.map((opt) => {
                const active = atmosphere === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelectAtmosphere(opt.value)}
                    aria-pressed={active}
                    className={`px-1.5 sm:px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      active
                        ? 'bg-amber-400/25 text-amber-200 border border-amber-300/40 font-semibold'
                        : 'text-stone-300 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: Compact Pilot Control Pad (Keyboard Shortcuts + Click/Hold Buttons) */}
          <div
            role="group"
            aria-label="Mech Pilot Keyboard Controls"
            className="w-full pt-1 border-t border-white/10 flex flex-wrap lg:flex-nowrap items-center justify-center gap-1"
          >
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-cyan-300 mr-0.5 whitespace-nowrap shrink-0">
              <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{activeActionLabel}</span>
            </span>

            {PILOT_CONTROLS.map((ctrl) => (
              <button
                key={ctrl.action}
                type="button"
                onPointerDown={() => onActionHold(ctrl.action, true)}
                onPointerUp={() => onActionHold(ctrl.action, false)}
                onPointerLeave={() => onActionHold(ctrl.action, false)}
                onPointerCancel={() => onActionHold(ctrl.action, false)}
                aria-label={`${ctrl.label} (${ctrl.keyHint})`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] sm:text-[11px] text-stone-200 hover:bg-cyan-500/20 hover:border-cyan-400/50 active:bg-cyan-500/35 transition-colors whitespace-nowrap shrink-0 select-none"
              >
                <kbd className="px-1 py-px rounded bg-stone-900 border border-white/15 font-mono-tabular text-[9px] sm:text-[10px] text-cyan-300">
                  {ctrl.keyHint}
                </kbd>
                <span>{ctrl.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
