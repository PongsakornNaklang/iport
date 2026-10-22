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
import { holdHistory } from '../../core/customize/history';
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

  // The layer's axes on screen (layer px → screen px), from the markers,
  // and the way back. null when the side is seen edge-on.
  const frame = () => {
    const el = layer.current;
    if (!el) return null;
    const m = [...el.querySelectorAll<HTMLElement>('.dc-mark')].map((n) => n.getBoundingClientRect());
    const ax = { x: (m[1].left - m[0].left) / 100, y: (m[1].top - m[0].top) / 100 };
    const ay = { x: (m[2].left - m[0].left) / 100, y: (m[2].top - m[0].top) / 100 };
    const det = ax.x * ay.y - ax.y * ay.x;
    if (Math.abs(det) < 0.02) return null;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    /** a screen point → layer fractions (0–1) */
    const toLayer = (sx: number, sy: number) => {
      const dx = sx - m[0].left;
      const dy = sy - m[0].top;
      return { x: (dx * ay.y - dy * ay.x) / det / w, y: (ax.x * dy - ax.y * dx) / det / h, w, h };
    };
    return toLayer;
  };
  const update = (patch: Partial<Decal>) => useCustomize.getState().updateDecal(d.id, patch);
  const norm = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

  /** a gesture is under way on this decal */
  const busy = useRef(false);
  /** follow pointers on `target` until they're all up; one gesture = one undo step */
  const track = (e: React.PointerEvent, onMove: (pts: { x: number; y: number }[]) => void, onCount?: (pts: { x: number; y: number }[]) => void) => {
    const target = e.currentTarget as HTMLElement;
    const pts = new Map<number, { x: number; y: number }>([[e.pointerId, { x: e.clientX, y: e.clientY }]]);
    target.setPointerCapture(e.pointerId);
    holdHistory(true);
    busy.current = true;
    const down = (ev: PointerEvent) => {
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      target.setPointerCapture(ev.pointerId);
      onCount?.([...pts.values()]);
    };
    const move = (ev: PointerEvent) => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      onMove([...pts.values()]);
    };
    const up = (ev: PointerEvent) => {
      pts.delete(ev.pointerId);
      if (pts.size) return onCount?.([...pts.values()]);
      holdHistory(false);
      busy.current = false;
      target.removeEventListener('pointerdown', down);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointerdown', down);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  // Drag with one finger or the mouse; pinch and turn with two.
  const live = useRef(d);
  live.current = d;
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    useDecalSelection.getState().select(d.id);
    if (busy.current) return; // another finger: the gesture under way takes it
    const toLayer = frame();
    if (!toLayer) return;
    let base: { p: ReturnType<typeof toLayer>[]; d: Decal } | null = null;
    const begin = (pts: { x: number; y: number }[]) => {
      base = { p: pts.map((p) => toLayer(p.x, p.y)), d: { ...live.current } };
    };
    begin([{ x: e.clientX, y: e.clientY }]);
    track(
      e,
      (pts) => {
        if (!base) return;
        const now = pts.map((p) => toLayer(p.x, p.y));
        if (now.length >= 2 && base.p.length >= 2) {
          const [a0, b0] = base.p;
          const [a1, b1] = now;
          // in layer px, so turning is right on a wide or narrow back
          const v0 = { x: (b0.x - a0.x) * a0.w, y: (b0.y - a0.y) * a0.h };
          const v1 = { x: (b1.x - a1.x) * a1.w, y: (b1.y - a1.y) * a1.h };
          const k = Math.hypot(v1.x, v1.y) / Math.max(1, Math.hypot(v0.x, v0.y));
          const turn = ((Math.atan2(v1.y, v1.x) - Math.atan2(v0.y, v0.x)) * 180) / Math.PI;
          update({
            size: base.d.size * k,
            rotate: norm(base.d.rotate + turn),
            x: base.d.x + ((a1.x + b1.x) / 2 - (a0.x + b0.x) / 2),
            y: base.d.y + ((a1.y + b1.y) / 2 - (a0.y + b0.y) / 2),
          });
        } else {
          update({ x: base.d.x + (now[0].x - base.p[0].x), y: base.d.y + (now[0].y - base.p[0].y) });
        }
      },
      begin, // a finger added or lifted: carry on from here
    );
  };

  // The corner handle: drag it to resize and turn about the centre.
  const onHandle = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const toLayer = frame();
    if (!toLayer) return;
    const start = { ...live.current };
    const p0 = toLayer(e.clientX, e.clientY);
    const v0 = { x: (p0.x - start.x) * p0.w, y: (p0.y - start.y) * p0.h };
    track(e, (pts) => {
      const p = toLayer(pts[0].x, pts[0].y);
      const v = { x: (p.x - start.x) * p.w, y: (p.y - start.y) * p.h };
      update({
        size: (start.size * Math.hypot(v.x, v.y)) / Math.max(1, Math.hypot(v0.x, v0.y)),
        rotate: norm(start.rotate + ((Math.atan2(v.y, v.x) - Math.atan2(v0.y, v0.x)) * 180) / Math.PI),
      });
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const k = e.deltaY > 0 ? 1 / 1.06 : 1.06;
    if (e.shiftKey) update({ rotate: norm(d.rotate + (e.deltaY > 0 ? 5 : -5)) });
    else update({ size: d.size * k });
  };

  return (
    <div
      className={`dc-decal dc-${d.kind} ${on ? 'on' : ''}`}
      style={style}
      data-control=""
      title="Drag to move · pinch, scroll or the corner handle to resize and turn"
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      {on && (
        <>
          <span className="dc-handle dc-handle-size" onPointerDown={onHandle} title="Drag to resize and turn" />
          <span
            className="dc-handle dc-handle-remove"
            title="Remove"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              useCustomize.getState().removeDecal(d.id);
              useDecalSelection.getState().select(null);
            }}
          >
            ×
          </span>
        </>
      )}
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
