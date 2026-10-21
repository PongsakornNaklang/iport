/**
 * Pointer = finger. Helpers so mouse drags behave like touches on the
 * simulated screen: gesture claiming between nested scrollers, converting
 * client coordinates into screen points (the device is scaled/rotated in 3D),
 * long-press, and click suppression after a drag.
 */
import { useEffect, useRef } from 'react';

/** pointerId → element that owns the gesture */
const claims = new Map<number, Element>();

export function claim(pointerId: number, el: Element): boolean {
  const c = claims.get(pointerId);
  if (c && c !== el) return false;
  claims.set(pointerId, el);
  return true;
}
export function claimedBy(pointerId: number): Element | undefined {
  return claims.get(pointerId);
}
export function isClaimed(pointerId: number, el?: Element): boolean {
  const c = claims.get(pointerId);
  return !!c && c !== el;
}
if (typeof window !== 'undefined') {
  const clear = (e: PointerEvent) => {
    // let element handlers run first
    setTimeout(() => claims.delete(e.pointerId), 0);
  };
  window.addEventListener('pointerup', clear, true);
  window.addEventListener('pointercancel', clear, true);
}

/** screen-points per client pixel for an element (handles the stage zoom). */
export function unitScale(el: Element): { kx: number; ky: number } {
  const r = el.getBoundingClientRect();
  const h = el as HTMLElement;
  const kx = r.width > 0 && h.offsetWidth ? h.offsetWidth / r.width : 1;
  const ky = r.height > 0 && h.offsetHeight ? h.offsetHeight / r.height : 1;
  return { kx, ky };
}

/** pointer position in the element's own (untransformed) coordinates */
export function localPoint(el: Element, clientX: number, clientY: number): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const h = el as HTMLElement;
  return {
    x: ((clientX - r.left) * (h.offsetWidth || r.width)) / (r.width || 1),
    y: ((clientY - r.top) * (h.offsetHeight || r.height)) / (r.height || 1),
  };
}

let suppressUntil = 0;
/** Swallow the click that follows a drag/long-press. */
export function suppressNextClick(ms = 400) {
  suppressUntil = performance.now() + ms;
}
if (typeof window !== 'undefined') {
  window.addEventListener(
    'click',
    (e) => {
      if (performance.now() < suppressUntil) {
        e.stopPropagation();
        e.preventDefault();
        suppressUntil = 0;
      }
    },
    true,
  );
}

export const IOS_EASE = 'cubic-bezier(0.25, 0.9, 0.3, 1)';
export const IOS_SPRING = 'cubic-bezier(0.2, 1.1, 0.35, 1)';

export function rubber(over: number, dim: number): number {
  const c = 0.55;
  const s = Math.sign(over);
  const a = Math.abs(over);
  return s * (1 - 1 / ((a * c) / dim + 1)) * dim;
}

/**
 * Long press: calls `onLong` after `ms` if the pointer stays put.
 * Returns pointer handlers to spread on the element.
 */
export function useLongPress(onLong: (e: { clientX: number; clientY: number; target: Element }) => void, ms = 480) {
  const st = useRef<{ t: number; x: number; y: number; id: number } | null>(null);
  const cbRef = useRef(onLong);
  cbRef.current = onLong;
  useEffect(() => () => {
    if (st.current) window.clearTimeout(st.current.t);
  }, []);
  const cancel = () => {
    if (st.current) window.clearTimeout(st.current.t);
    st.current = null;
  };
  return {
    onPointerDown(e: React.PointerEvent) {
      if (e.button !== 0) return;
      cancel();
      const target = e.currentTarget as Element;
      const { clientX, clientY } = e;
      const t = window.setTimeout(() => {
        if (st.current && !isClaimed(st.current.id)) {
          suppressNextClick(600);
          cbRef.current({ clientX, clientY, target });
        }
        st.current = null;
      }, ms);
      st.current = { t, x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerMove(e: React.PointerEvent) {
      const s = st.current;
      if (!s) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(e: React.MouseEvent) {
      e.preventDefault();
    },
  };
}

/** requestAnimationFrame-driven tween; returns a cancel fn */
export function tween(
  from: number,
  to: number,
  ms: number,
  onFrame: (v: number) => void,
  ease: (k: number) => number = (k) => 1 - Math.pow(1 - k, 3),
  onDone?: () => void,
): () => void {
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    onFrame(from + (to - from) * ease(k));
    if (k < 1) raf = requestAnimationFrame(step);
    else onDone?.();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** A damped spring that overshoots a little (iOS rubber band settle). */
export function springEase(k: number): number {
  return 1 - Math.exp(-6 * k) * Math.cos(4.2 * k * 1.2) * (1 - k) - 0 * k;
}
