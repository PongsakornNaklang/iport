/**
 * The screen has exactly one <MediaLayer>. Views that want to show the
 * picture (Now Playing artwork for YouTube, the video player) claim a "slot":
 * we measure their box relative to the screen every frame and position the
 * layer there.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { create } from 'zustand';

export interface MediaRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MediaSlot {
  owner: string;
  rect: MediaRect | null;
  radius: number;
  z: number;
  fit: 'contain' | 'cover';
  /** rotate +90° (landscape video inside a portrait screen) */
  landscape?: boolean;
}

export const useMediaSlots = create<{ slots: MediaSlot[] }>(() => ({ slots: [] }));

function upsert(slot: MediaSlot) {
  const cur = useMediaSlots.getState().slots;
  const i = cur.findIndex((s) => s.owner === slot.owner);
  if (i >= 0) {
    const old = cur[i];
    const same =
      old.radius === slot.radius &&
      old.z === slot.z &&
      old.fit === slot.fit &&
      old.landscape === slot.landscape &&
      ((!old.rect && !slot.rect) ||
        (!!old.rect && !!slot.rect && Math.abs(old.rect.left - slot.rect.left) < 0.5 && Math.abs(old.rect.top - slot.rect.top) < 0.5 && Math.abs(old.rect.width - slot.rect.width) < 0.5 && Math.abs(old.rect.height - slot.rect.height) < 0.5));
    if (same) return;
    const next = cur.slice();
    next[i] = slot;
    useMediaSlots.setState({ slots: next });
  } else useMediaSlots.setState({ slots: [...cur, slot] });
}

function remove(owner: string) {
  useMediaSlots.setState({ slots: useMediaSlots.getState().slots.filter((s) => s.owner !== owner) });
}

/** Box of `el` in screen points, ignoring CSS transforms but honoring scroll offsets. */
export function rectInScreen(el: HTMLElement): MediaRect | null {
  const root = el.closest('.t7-screen') as HTMLElement | null;
  if (!root) return null;
  let x = 0;
  let y = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    x += cur.offsetLeft;
    y += cur.offsetTop;
    const op = cur.offsetParent as HTMLElement | null;
    let p: HTMLElement | null = cur.parentElement;
    while (p && p !== op && p !== root) {
      x -= p.scrollLeft;
      y -= p.scrollTop;
      p = p.parentElement;
    }
    if (op && op !== root) {
      x -= op.scrollLeft;
      y -= op.scrollTop;
    }
    if (!op) break;
    cur = op;
  }
  return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
}

export function useMediaTarget(
  ref: RefObject<HTMLElement | null>,
  owner: string,
  enabled: boolean,
  opts: { radius?: number; z?: number; fit?: 'contain' | 'cover'; landscape?: boolean; delay?: number } = {},
) {
  const o = useRef(opts);
  o.current = opts;
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let alive = true;
    const start = performance.now() + (opts.delay ?? 0);
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (performance.now() < start) return;
      const el = ref.current;
      if (!el) return;
      upsert({
        owner,
        rect: rectInScreen(el),
        radius: o.current.radius ?? 0,
        z: o.current.z ?? 30,
        fit: o.current.fit ?? 'cover',
        landscape: o.current.landscape,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      remove(owner);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, owner]);
}
