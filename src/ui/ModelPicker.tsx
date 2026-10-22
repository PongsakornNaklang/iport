import { useEffect } from 'react';
import { useCustomize } from '../core/customize/store';
import { getModel, MODELS } from '../devices/registry';
import type { DeviceModel } from '../devices/types';
import { isTypingTarget } from '../shell/keyboard';
import { switchModel, useModelSwitch } from '../shell/modelSwitch';
import { toggleOverview, useOverview } from '../shell/overview';
import { ModelArt } from './ModelArt';

/** Tiny line drawing of each model for the picker. */
export function ModelThumb({ model, color, size = 44 }: { model: DeviceModel; color?: string; size?: number }) {
  const c = color ?? model.finishes[0].swatch;
  const h = size;
  const stroke = 'rgba(0,0,0,0.18)';
  if (model.family === 'clickwheel')
    return (
      <svg width={h * 0.62} height={h} viewBox="0 0 31 50">
        <rect x="0.5" y="0.5" width="30" height="49" rx="4" fill={c} stroke={stroke} />
        <rect x="3.5" y="3.5" width="24" height="18" rx="1" fill="#1d2a38" />
        <circle cx="15.5" cy="35" r="9.5" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.15)" />
        <circle cx="15.5" cy="35" r="3.6" fill={c} stroke="rgba(0,0,0,0.15)" />
      </svg>
    );
  if (model.family === 'shuffle')
    return (
      <svg width={h * 0.7} height={h * 0.76} viewBox="0 0 29 32">
        <rect x="0.5" y="0.5" width="28" height="31" rx="3" fill={c} stroke={stroke} />
        <circle cx="14.5" cy="17" r="9" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.12)" />
        <circle cx="14.5" cy="17" r="3.2" fill={c} />
      </svg>
    );
  if (model.family === 'nano-touch')
    return (
      <svg width={h * 0.5} height={h} viewBox="0 0 25 50">
        <rect x="0.5" y="0.5" width="24" height="49" rx="3" fill={c} stroke={stroke} />
        <rect x="2.5" y="6" width="20" height="35" rx="1" fill="#141a22" />
        <circle cx="12.5" cy="45" r="2.4" fill="none" stroke="rgba(0,0,0,0.35)" />
      </svg>
    );
  return (
    <svg width={h * 0.48} height={h} viewBox="0 0 24 50">
      <rect x="0.5" y="0.5" width="23" height="49" rx="3.6" fill={c} stroke={stroke} />
      <rect x="1.8" y="7" width="20.4" height="36" rx="0.6" fill="#141a22" />
      <circle cx="12" cy="46.5" r="2" fill="none" stroke="rgba(120,120,120,0.6)" />
    </svg>
  );
}

/**
 * The iPod's name in the top bar. Click it and every iPod floats up on the
 * stage to choose from (shell/overview.ts). Shift ← → steps to the
 * previous or next iPod at any time.
 */
export function ModelPicker() {
  const modelId = useCustomize((s) => s.modelId);
  const appearance = useCustomize((s) => s.appearances[s.modelId]);
  const open = useOverview((s) => s.open);
  const model = getModel(modelId);

  // Ahead of the iPod's own keys (the Click Wheel uses ← →), so take them first.
  useEffect(() => {
    const taken = new Set<string>();
    const down = (e: KeyboardEvent) => {
      if (useOverview.getState().open || !e.shiftKey || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!d) return;
      if (!e.repeat) step(d);
      taken.add(e.key);
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const up = (e: KeyboardEvent) => {
      if (taken.delete(e.key)) e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, []);

  return (
    <div className="model-picker">
      <button
        className="model-picker-btn"
        onClick={toggleOverview}
        aria-expanded={open}
        aria-label={`${model.name}: choose an iPod`}
        title={`${model.name} · ${model.generation} · ${model.year}\nChoose an iPod (Shift ← →)`}
      >
        <ModelArt model={model} appearance={appearance} height={28} />
      </button>
    </div>
  );
}

/** where quick presses are heading, so they step on from there, not from the iPod still turning away */
let aim: string | null = null;
function step(d: number) {
  const cur = useCustomize.getState().modelId;
  const from = MODELS.findIndex((m) => m.id === (aim && useModelSwitch.getState().leaving ? aim : cur));
  aim = MODELS[(from + d + MODELS.length) % MODELS.length].id;
  switchModel(aim);
}
