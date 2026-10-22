import { useEffect, useRef, useState } from 'react';
import { useCustomize } from '../core/customize/store';
import { getModel, MODELS } from '../devices/registry';
import type { DeviceModel } from '../devices/types';
import { isTypingTarget } from '../shell/keyboard';
import { switchModel } from '../shell/modelSwitch';
import { IconChevronDown, IconChevronLeft, IconChevronRight } from './icons';
import { ModelArt } from './ModelArt';

/** the tallest iPod's height on a shelf card; the others keep their real size next to it */
const SHELF_H = 148;
const TALLEST = Math.max(...MODELS.map((m) => m.size.height));

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
 * The model shelf: the iPod's name in the top bar opens a row of cards,
 * one per iPod in its current colors at their real sizes. Picking one turns
 * the iPod on the stage into it (shell/modelSwitch.ts).
 *
 * Keys: ← → step through the iPods while the shelf is open (Enter or Esc
 * closes it), and Shift ← → at any time.
 */
export function ModelPicker() {
  const modelId = useCustomize((s) => s.modelId);
  const appearances = useCustomize((s) => s.appearances);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const model = getModel(modelId);
  const index = MODELS.findIndex((m) => m.id === model.id);

  // where it is going, so quick presses step on from there, not from the iPod still turning away
  const aim = useRef(index);
  const step = (d: number) => {
    aim.current = (aim.current + d + MODELS.length) % MODELS.length;
    switchModel(MODELS[aim.current].id);
  };
  const stepRef = useRef(step);
  stepRef.current = step;
  const [aimed, setAimed] = useState(index);
  useEffect(() => {
    aim.current = index;
    setAimed(index);
  }, [index]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  // Ahead of the iPod's own keys (the Click Wheel uses ← →), so take them first.
  useEffect(() => {
    const taken = new Set<string>();
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (d && (open || e.shiftKey)) {
        if (!e.repeat) {
          stepRef.current(d);
          setAimed(aim.current);
        }
      } else if (open && (e.key === 'Escape' || e.key === 'Enter')) setOpen(false);
      else return;
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
  }, [open]);

  // keep the chosen card in view (the shelf scrolls on narrow screens)
  useEffect(() => {
    if (!open) return;
    const card = track.current?.children[aimed] as HTMLElement | undefined;
    card?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [open, aimed]);

  const go = (d: number) => {
    step(d);
    setAimed(aim.current);
  };

  return (
    <div className="model-picker" ref={ref}>
      <button className="model-picker-btn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} title="Choose an iPod (Shift ← →)">
        <span className="mp-art">
          <ModelArt model={model} appearance={appearances[model.id]} height={30} />
        </span>
        <div>
          <div className="mp-name">{model.name}</div>
          <div className="mp-gen">
            {model.generation} · {model.year}
          </div>
        </div>
        <IconChevronDown width={14} height={14} className={`mp-chev ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="model-shelf" role="listbox" aria-label="Choose an iPod">
          <div className="ms-head">
            <span>Choose your iPod</span>
            <small>
              <kbd>←</kbd>
              <kbd>→</kbd> to browse
            </small>
          </div>
          <div className="ms-row">
            <button className="ms-arrow" onClick={() => go(-1)} aria-label="Previous iPod">
              <IconChevronLeft width={18} height={18} />
            </button>
            <div className="ms-track" ref={track}>
              {MODELS.map((m, i) => (
                <ModelCard
                  key={m.id}
                  model={m}
                  appearance={appearances[m.id]}
                  selected={i === aimed}
                  onPick={() => {
                    aim.current = i;
                    setAimed(i);
                    switchModel(m.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
            <button className="ms-arrow" onClick={() => go(1)} aria-label="Next iPod">
              <IconChevronRight width={18} height={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModelCard({
  model,
  appearance,
  selected,
  onPick,
}: {
  model: DeviceModel;
  appearance?: Parameters<typeof ModelArt>[0]['appearance'];
  selected: boolean;
  onPick(): void;
}) {
  // tilt toward the pointer
  const tilt = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--ry', `${x * 26}deg`);
    e.currentTarget.style.setProperty('--rx', `${-y * 18}deg`);
    e.currentTarget.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
    e.currentTarget.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
  };
  const rest = (e: React.PointerEvent<HTMLButtonElement>) => {
    for (const k of ['--rx', '--ry', '--gx', '--gy']) e.currentTarget.style.removeProperty(k);
  };
  const finish = model.finishes.find((f) => f.id === appearance?.finishId);
  return (
    <button
      role="option"
      aria-selected={selected}
      className={`ms-card ${selected ? 'selected' : ''}`}
      onClick={onPick}
      onPointerMove={tilt}
      onPointerLeave={rest}
    >
      <span className="ms-stage">
        <span className="ms-art">
          <ModelArt model={model} appearance={appearance} height={(SHELF_H * model.size.height) / TALLEST} />
        </span>
        <span className="ms-floor" />
      </span>
      <span className="ms-name">{model.name}</span>
      <span className="ms-gen">
        {model.generation.split(' · ')[0]} · {model.year}
      </span>
      <span className="ms-dots" title={finish ? finish.name : 'Custom colors'}>
        {model.finishes.slice(0, 6).map((f) => (
          <i key={f.id} className={f.id === appearance?.finishId ? 'on' : ''} style={{ background: f.swatch }} />
        ))}
        {model.finishes.length > 6 && <em>+{model.finishes.length - 6}</em>}
      </span>
    </button>
  );
}
