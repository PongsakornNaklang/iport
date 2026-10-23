/**
 * Moving an iPod Sock up and down the iPod, and pulling it off. It behaves
 * like fabric:
 *
 * - Pulled down, the opening slides down the iPod while the part still on it
 *   gathers towards the bottom; the fabric that leaves the iPod narrows at
 *   once below it and makes the toe longer. Let go far enough down (or with
 *   a flick) and it slides off.
 * - Pushed up, the opening climbs the iPod and the toe widens around it, so
 *   less hangs below, until the toe's end reaches the iPod's bottom.
 *
 * Otherwise it springs back when let go. The sock's own elements are moved
 * directly (Cover.tsx marks them), so a drag doesn't restyle the whole iPod.
 */
import { useCallback, useRef, type RefObject } from 'react';
import { useCustomize } from '../../core/customize/store';
import { toast } from '../../ui/toast';
import { liveOrientation } from '../stageStore';

/** the length (px) of the toe's stretchable piece at scale 1 (Cover.tsx) */
export const PULL_FILL = 100;
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

/** The sock's sizes (iPod px) the pull needs. */
export interface SockSpan {
  /** the iPod's height */
  height: number;
  /** how much of the sock is on the iPod: its opening to the iPod's bottom */
  sleeve: number;
  /** how much hangs below the iPod: its bottom to the toe's end */
  below: number;
}

/**
 * `start(pointerId, y0)` hands a pointer that went down at height y0 to the
 * pull; it follows that pointer on the window until it lifts. `scale` is
 * screen px per iPod px.
 */
export function useSockPull(root: RefObject<HTMLElement | null>, scale: RefObject<number>, span: SockSpan, device?: RefObject<HTMLElement | null>) {
  const busy = useRef(false);
  const size = useRef(span);
  size.current = span;
  return useCallback(
    (id: number, y0: number) => {
      const r = root.current;
      const gather = r?.querySelector<HTMLElement>('.cv-sock-sleeve');
      const rest = r?.querySelector<HTMLElement>('.cv-sock:not(.cv-sock-sleeve)');
      const below = rest?.querySelector<HTMLElement>('.cv-pull-below');
      if (!r || !gather || !rest || !below || busy.current) return;
      busy.current = true;
      // the rim of the opening may be drawn with the iPod rather than the sock (Stage.tsx)
      const mouth = device?.current?.querySelector<HTMLElement>('.cv-sock-mouth') ?? null;
      const shift = [...rest.querySelectorAll<HTMLElement>('.cv-pull-shift'), ...(mouth?.querySelectorAll<HTMLElement>('.cv-pull-shift') ?? [])];
      const toe = [...rest.querySelectorAll<HTMLElement>('.cv-pull-toe')];
      const fill = [...rest.querySelectorAll<HTMLElement>('.cv-pull-fill')];
      const moving = [gather, rest, below, ...shift, ...toe, ...fill];
      const { height: H, sleeve: L, below: B } = size.current;
      // screen px per iPod px along the iPod's length (shorter as it tilts away)
      const k = Math.max(0.05, scale.current * Math.max(0.35, Math.cos((liveOrientation.rx * Math.PI) / 180)));
      const px = (n: number) => `translate3d(0, ${n.toFixed(1)}px, 0)`;
      /** the opening `d` px down the iPod (up when negative), and the whole sock `off` px further down */
      const show = (d: number, off = 0) => {
        const down = Math.max(0, Math.min(d, L * 0.96));
        const up = Math.max(0, Math.min(-d, B * 0.97));
        gather.style.transform = `${px(off)} scaleY(${((L - down + up) / L).toFixed(4)})`;
        rest.style.transform = px(off);
        below.style.transform = `scaleY(${((B - up) / B).toFixed(4)})`;
        shift.forEach((el) => (el.style.transform = px(down - up)));
        toe.forEach((el) => (el.style.transform = px(down)));
        fill.forEach((el) => {
          el.style.transform = `scaleY(${(down / PULL_FILL).toFixed(4)})`;
          if (down > 0) el.style.visibility = 'visible';
        });
      };
      moving.forEach((el) => (el.style.transition = 'none'));
      let d = 0;
      let v = 0;
      let lastY = y0;
      let lastT = performance.now();
      const move = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        d = (e.clientY - y0) / k;
        const now = performance.now();
        v = 0.6 * v + 0.4 * ((e.clientY - lastY) / Math.max(1, now - lastT));
        lastY = e.clientY;
        lastT = now;
        show(d);
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        if (performance.now() - lastT > 100) v = 0;
        const off = e.type === 'pointerup' && (d > OFF_AT * H || (v > FLICK && d > 0.06 * H));
        moving.forEach((el) => (el.style.transition = `transform 300ms ${EASE}`));
        if (off) {
          // it slides off the bottom, fading as it goes
          show(L, H * 0.6);
          gather.classList.add('cv-leaving');
          rest.classList.add('cv-leaving');
          mouth?.classList.add('cv-leaving');
          window.setTimeout(() => {
            busy.current = false;
            const c = useCustomize.getState();
            const color = c.appearances[c.modelId]?.cover?.color ?? '#000';
            c.setCover({ kind: 'none', color });
            toast('Sock off. Put it back in Customize.');
          }, 280);
        } else {
          show(0);
          window.setTimeout(() => {
            busy.current = false;
            moving.forEach((el) => {
              el.style.transition = '';
              el.style.transform = '';
            });
            fill.forEach((el) => (el.style.visibility = ''));
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
