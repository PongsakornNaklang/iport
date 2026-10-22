/**
 * Stickers on either side of an iPod, and engraved text on its back.
 *
 * Each device puts a <Decals> layer over its back and one over its front. You can drag a decal
 * right there on the 3D iPod: three hidden markers in the layer give the
 * layer's axes on screen, and the inverse of that maps a pointer move back
 * into the layer (the same trick the EarPods use to find the jack). Scroll
 * over a decal to resize it; Shift-scroll turns it.
 */
import { useRef, type CSSProperties } from 'react';
import { create } from 'zustand';
import { useCustomize } from '../../core/customize/store';
import type { Decal } from '../../devices/types';
import './decals.css';

/** which decal is being edited (Customize highlights it, the iPod outlines it) */
export const useDecalSelection = create<{ selected: string | null; select(id: string | null): void }>((set) => ({
  selected: null,
  select: (selected) => set({ selected }),
}));

export const DECAL_FONTS: Record<NonNullable<Decal['font']>, { label: string; family: string }> = {
  helvetica: { label: 'Helvetica', family: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  serif: { label: 'Serif', family: "Georgia, 'Times New Roman', serif" },
  script: { label: 'Script', family: "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive" },
  mono: { label: 'Mono', family: "'SF Mono', Menlo, Consolas, monospace" },
};

/**
 * The decals on one side. On the back, `ink` and `shadow` style engraved
 * text the way the device engraves (lighter on dark anodizing, darker on
 * light, etched into steel…). On the front, stickers sit on top of
 * everything, the screen included, as a real one would.
 */
export function Decals({ decals, side = 'back', ink, shadow }: { decals?: Decal[]; side?: 'front' | 'back'; ink?: string; shadow?: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const selected = useDecalSelection((s) => s.selected);
  const mine = decals?.filter((d) => (d.side ?? 'back') === side);
  if (!mine?.length) return null;
  return (
    <div ref={layer} className={`dc-layer dc-${side}`} style={{ ['--dc-ink' as string]: ink, ['--dc-shadow' as string]: shadow } as CSSProperties}>
      <i className="dc-mark" />
      <i className="dc-mark" style={{ left: 100 }} />
      <i className="dc-mark" style={{ top: 100 }} />
      {mine.map((d) => (
        <DecalView key={d.id} d={d} layer={layer} on={d.id === selected} />
      ))}
    </div>
  );
}

function DecalView({ d, layer, on }: { d: Decal; layer: React.RefObject<HTMLDivElement | null>; on: boolean }) {
  const style: CSSProperties = {
    left: `${d.x * 100}%`,
    top: `${d.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${d.rotate}deg)`,
  };
  if (d.kind === 'sticker') style.width = `${d.size * 100}%`;
  else {
    style.fontSize = `${d.size * 100}cqw`;
    style.fontFamily = DECAL_FONTS[d.font ?? 'helvetica'].family;
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = layer.current;
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    useDecalSelection.getState().select(d.id);
    // the layer's axes on screen, per layer px
    const m = [...el.querySelectorAll<HTMLElement>('.dc-mark')].map((n) => n.getBoundingClientRect());
    const ax = { x: (m[1].left - m[0].left) / 100, y: (m[1].top - m[0].top) / 100 };
    const ay = { x: (m[2].left - m[0].left) / 100, y: (m[2].top - m[0].top) / 100 };
    const det = ax.x * ay.y - ax.y * ay.x;
    if (Math.abs(det) < 0.02) return; // seen edge-on
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const start = { x: e.clientX, y: e.clientY, dx: d.x, dy: d.y };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const sx = ev.clientX - start.x;
      const sy = ev.clientY - start.y;
      // screen delta → layer delta (inverse of [ax ay])
      const lx = (sx * ay.y - sy * ay.x) / det;
      const ly = (ax.x * sy - ax.y * sx) / det;
      useCustomize.getState().updateDecal(d.id, { x: start.dx + lx / w, y: start.dy + ly / h });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const k = e.deltaY > 0 ? 1 / 1.06 : 1.06;
    if (e.shiftKey) useCustomize.getState().updateDecal(d.id, { rotate: ((d.rotate + (e.deltaY > 0 ? 5 : -5) + 540) % 360) - 180 });
    else useCustomize.getState().updateDecal(d.id, { size: d.size * k });
  };

  return (
    <div
      className={`dc-decal dc-${d.kind} ${on ? 'on' : ''}`}
      style={style}
      data-control=""
      title="Drag to move · scroll to resize · Shift-scroll to turn"
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      {d.kind === 'text' ? (
        <span>{d.text || ' '}</span>
      ) : d.image ? (
        <img src={d.image} alt="" draggable={false} />
      ) : (
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <text x="50" y="54" textAnchor="middle" dominantBaseline="central" fontSize="82">
            {d.emoji}
          </text>
        </svg>
      )}
    </div>
  );
}
