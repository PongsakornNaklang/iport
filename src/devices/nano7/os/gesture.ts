import { useRef } from 'react';

/**
 * Touch helpers. On the nano the mouse pointer is a finger: everything is
 * driven by pointer events (drag to scroll, swipe to page / go back).
 */

/** Device CSS px per client px for an element inside the scaled 3D stage. */
export function unscale(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  const sx = r.width / Math.max(1, el.offsetWidth);
  const sy = r.height / Math.max(1, el.offsetHeight);
  const s = Math.max(sx, sy) || 1;
  return 1 / s;
}

/** iOS-style rubber band: how far content moves when dragged `over` px past an edge. */
export function rubber(over: number, dim: number): number {
  const c = 0.55;
  const s = Math.sign(over);
  const o = Math.abs(over);
  return s * (1 - 1 / ((o * c) / dim + 1)) * dim;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Tracks recent pointer samples and returns velocity in px/ms. */
export class VelocityTracker {
  private s: { t: number; v: number }[] = [];
  reset(v: number) {
    this.s = [{ t: performance.now(), v }];
  }
  add(v: number) {
    const t = performance.now();
    this.s.push({ t, v });
    while (this.s.length > 2 && t - this.s[0].t > 100) this.s.shift();
  }
  velocity(): number {
    if (this.s.length < 2) return 0;
    const a = this.s[0];
    const b = this.s[this.s.length - 1];
    const dt = b.t - a.t;
    if (dt <= 0 || performance.now() - b.t > 80) return 0;
    return (b.v - a.v) / dt;
  }
}

/** Animate a value with requestAnimationFrame. Returns a cancel function. */
export function tween(from: number, to: number, ms: number, onUpdate: (v: number) => void, onDone?: () => void, ease = easeOut): () => void {
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    onUpdate(from + (to - from) * ease(k));
    if (k < 1) raf = requestAnimationFrame(step);
    else onDone?.();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * A simple horizontal/vertical drag recogniser for components that only need
 * one axis (sliders, the radio tuner, pagers). Returns pointer handlers.
 */
export interface DragInfo {
  dx: number;
  dy: number;
  /** device px per client px */
  k: number;
  x0: number;
  y0: number;
  /** pointer position in element-local device px */
  lx: number;
  ly: number;
  velocity: number;
  event: PointerEvent | React.PointerEvent;
}

export interface DragOpts {
  axis: 'x' | 'y' | 'both';
  onStart?: (d: DragInfo) => void;
  onMove?: (d: DragInfo) => void;
  onEnd?: (d: DragInfo, moved: boolean) => void;
  /** start immediately on press (sliders) instead of after a few px */
  immediate?: boolean;
  threshold?: number;
}

type DragState = { id: number; x0: number; y0: number; k: number; started: boolean; el: HTMLElement; vt: VelocityTracker; rect: DOMRect };

/** Hook form: handlers are stable across renders and always call the latest callbacks. */
export function useDrag(o: DragOpts) {
  const optsRef = useRef(o);
  optsRef.current = o;
  const handlers = useRef<ReturnType<typeof makeDrag> | null>(null);
  if (!handlers.current) handlers.current = makeDrag(() => optsRef.current);
  return handlers.current;
}

function makeDrag(getOpts: () => DragOpts) {
  let st: DragState | null = null;
  const info = (e: React.PointerEvent | PointerEvent): DragInfo => {
    const s = st!;
    const dx = (e.clientX - s.x0) * s.k;
    const dy = (e.clientY - s.y0) * s.k;
    return {
      dx,
      dy,
      k: s.k,
      x0: s.x0,
      y0: s.y0,
      lx: (e.clientX - s.rect.left) * s.k,
      ly: (e.clientY - s.rect.top) * s.k,
      velocity: s.vt.velocity() * s.k,
      event: e,
    };
  };
  return {
    onPointerDown(e: React.PointerEvent) {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const vt = new VelocityTracker();
      vt.reset(getOpts().axis === 'y' ? e.clientY : e.clientX);
      st = { id: e.pointerId, x0: e.clientX, y0: e.clientY, k: unscale(el), started: false, el, vt, rect: el.getBoundingClientRect() };
      if (getOpts().immediate) {
        st.started = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        getOpts().onStart?.(info(e));
        e.stopPropagation();
      }
    },
    onPointerMove(e: React.PointerEvent) {
      if (!st || e.pointerId !== st.id) return;
      st.vt.add(getOpts().axis === 'y' ? e.clientY : e.clientX);
      const d = info(e);
      if (!st.started) {
        const th = getOpts().threshold ?? 6;
        const ax = Math.abs(d.dx);
        const ay = Math.abs(d.dy);
        if (getOpts().axis === 'x' && ax > th && ax > ay) st.started = true;
        else if (getOpts().axis === 'y' && ay > th && ay > ax) st.started = true;
        else if (getOpts().axis === 'both' && Math.max(ax, ay) > th) st.started = true;
        else if (Math.max(ax, ay) > th) {
          st = null; // wrong direction: let someone else handle it
          return;
        }
        if (!st.started) return;
        try {
          st.el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        getOpts().onStart?.(d);
      }
      e.stopPropagation();
      getOpts().onMove?.(d);
    },
    onPointerUp(e: React.PointerEvent) {
      if (!st || e.pointerId !== st.id) return;
      const d = info(e);
      const moved = st.started;
      st = null;
      getOpts().onEnd?.(d, moved);
      if (moved) e.stopPropagation();
    },
    onPointerCancel(e: React.PointerEvent) {
      if (!st || e.pointerId !== st.id) return;
      const d = info(e);
      const moved = st.started;
      st = null;
      getOpts().onEnd?.(d, moved);
    },
  };
}
