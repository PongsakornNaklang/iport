/**
 * Pulling an iPod Sock off: grab it and drag down. It follows the finger;
 * let go far enough down (or with a flick) and it slides off, otherwise it
 * springs back. The sock's own elements are moved directly, so a drag
 * doesn't restyle the whole iPod.
 */
import { useCallback, useRef, type RefObject } from 'react';
import { useCustomize } from '../../core/customize/store';
import { toast } from '../../ui/toast';
import { liveOrientation } from '../stageStore';

/** how far down (a share of the iPod's height) a let-go takes the sock off */
const OFF_AT = 0.28;
/** a flick down this fast (screen px per ms) takes it off sooner */
const FLICK = 0.6;
const EASE = 'cubic-bezier(0.3, 0.7, 0.4, 1)';

/** Is (x, y) on the sock, as drawn on screen? */
export function onSock(root: HTMLElement | null, x: number, y: number): boolean {
  if (!root) return false;
  for (const f of root.querySelectorAll('.cv-sock .d3-facet')) {
    const r = f.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
  }
  return false;
}

/**
 * `start(pointerId, y0)` hands a pointer that went down at height y0 to
 * the pull; it follows that pointer on the window until it lifts.
 * `scale` is screen px per iPod px, `height` the iPod's height.
 */
export function useSockPull(root: RefObject<HTMLElement | null>, scale: RefObject<number>, height: number) {
  const busy = useRef(false);
  const heightRef = useRef(height);
  heightRef.current = height;
  return useCallback(
    (id: number, y0: number) => {
      const els = [...(root.current?.querySelectorAll<HTMLElement>('.cv-sock') ?? [])];
      if (!els.length || busy.current) return;
      busy.current = true;
      const H = heightRef.current;
      // screen px per iPod px along the iPod's length (shorter as it tilts away)
      const k = Math.max(0.05, scale.current * Math.max(0.35, Math.cos((liveOrientation.rx * Math.PI) / 180)));
      const set = (d: number, opacity = 1) =>
        els.forEach((el) => {
          el.style.transform = `translate3d(0, ${d.toFixed(1)}px, 0)`;
          el.style.opacity = String(opacity);
        });
      els.forEach((el) => (el.style.transition = 'none'));
      let d = 0;
      let v = 0;
      let lastY = y0;
      let lastT = performance.now();
      const move = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        const raw = (e.clientY - y0) / k;
        d = raw > 0 ? raw : raw * 0.15; // it doesn't go up past the iPod's top
        const now = performance.now();
        v = 0.6 * v + 0.4 * ((e.clientY - lastY) / Math.max(1, now - lastT));
        lastY = e.clientY;
        lastT = now;
        set(d);
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        if (performance.now() - lastT > 100) v = 0;
        const off = e.type === 'pointerup' && (d > OFF_AT * H || (v > FLICK && d > 0.06 * H));
        els.forEach((el) => (el.style.transition = `transform 300ms ${EASE}, opacity 300ms ease-in`));
        if (off) {
          set(d + H * 0.9, 0);
          window.setTimeout(() => {
            busy.current = false;
            const c = useCustomize.getState();
            const color = c.appearances[c.modelId]?.cover?.color ?? '#000';
            c.setCover({ kind: 'none', color });
            toast('Sock off. Put it back in Customize.');
          }, 280);
        } else {
          set(0);
          window.setTimeout(() => {
            busy.current = false;
            els.forEach((el) => {
              el.style.transition = '';
              el.style.transform = '';
              el.style.opacity = '';
            });
          }, 320);
        }
      };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    },
    [root, scale],
  );
}
