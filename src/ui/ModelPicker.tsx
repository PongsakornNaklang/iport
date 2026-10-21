import { useEffect, useRef, useState } from 'react';
import { useCustomize } from '../core/customize/store';
import { getModel, MODELS } from '../devices/registry';
import type { DeviceModel } from '../devices/types';
import { IconChevronDown } from './icons';

/** Tiny line drawing of each model for the picker. */
export function ModelThumb({ model, color, size = 44 }: { model: DeviceModel; color?: string; size?: number }) {
  const c = color ?? model.finishes[0].swatch;
  const h = size;
  const stroke = 'rgba(255,255,255,0.35)';
  if (model.family === 'clickwheel')
    return (
      <svg width={h * 0.62} height={h} viewBox="0 0 31 50">
        <rect x="0.5" y="0.5" width="30" height="49" rx="4" fill={c} stroke={stroke} />
        <rect x="3.5" y="3.5" width="24" height="18" rx="1" fill="#1d2a38" />
        <circle cx="15.5" cy="35" r="9.5" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.15)" />
        <circle cx="15.5" cy="35" r="3.6" fill={c} stroke="rgba(0,0,0,0.15)" />
      </svg>
    );
  if (model.family === 'shuffle')
    return (
      <svg width={h * 0.7} height={h * 0.76} viewBox="0 0 29 32">
        <rect x="0.5" y="0.5" width="28" height="31" rx="3" fill={c} stroke={stroke} />
        <circle cx="14.5" cy="17" r="9" fill="rgba(255,255,255,0.85)" />
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

export function ModelPicker() {
  const modelId = useCustomize((s) => s.modelId);
  const setModel = useCustomize((s) => s.setModel);
  const appearances = useCustomize((s) => s.appearances);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const model = getModel(modelId);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const swatchOf = (m: DeviceModel) => {
    const a = appearances[m.id];
    const f = m.finishes.find((x) => x.id === a?.finishId);
    return f?.swatch ?? Object.values(a?.colors ?? {})[0] ?? m.finishes[0].swatch;
  };

  return (
    <div className="model-picker" ref={ref}>
      <button className="model-picker-btn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <ModelThumb model={model} color={swatchOf(model)} size={28} />
        <div>
          <div className="mp-name">{model.name}</div>
          <div className="mp-gen">
            {model.generation} · {model.year}
          </div>
        </div>
        <IconChevronDown width={14} height={14} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div className="model-menu" role="listbox">
          {MODELS.map((m) => (
            <button
              key={m.id}
              role="option"
              aria-selected={m.id === modelId}
              className={`model-item ${m.id === modelId ? 'selected' : ''}`}
              onClick={() => {
                setModel(m.id);
                setOpen(false);
              }}
            >
              <div className="mi-thumb">
                <ModelThumb model={m} color={swatchOf(m)} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="mi-name">{m.name}</div>
                <div className="mi-meta">{m.generation}</div>
                <div className="mi-blurb">{m.blurb}</div>
              </div>
              <div className="mi-year">{m.year}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
