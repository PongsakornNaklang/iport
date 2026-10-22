import { createContext, useContext, type ReactNode } from 'react';
import { toast } from '../ui/toast';

/**
 * Things the stage puts inside the device's own 3D root: the case or sock
 * it is wearing, and the EarPods' jack markers. Inside the root they turn
 * with the device when it turns itself (the touch and nano rotate for
 * landscape video).
 *
 * `before` is rendered first, before any of the device's own parts, and
 * `after` last (see shell/cover for which goes where, and why).
 *
 * `sockMouth`: when the iPod wears a sock, the y of its opening (px from the
 * body's centre). Everything below it is inside the fabric.
 */
export const BodySlotContext = createContext<{ before?: ReactNode; after?: ReactNode; sockMouth?: number | null }>({});

export function BodyExtras({ after = false }: { after?: boolean }) {
  const slot = useContext(BodySlotContext);
  return <>{after ? slot.after : slot.before}</>;
}

/** Where the sock's opening is (px from the body's centre), or null without one. */
export function useSockMouth(): number | null {
  return useContext(BodySlotContext).sockMouth ?? null;
}

const HINT_MS = 2200;
let lastHint = 0;
/** A short hint, at most once every couple of seconds. */
export function sockHint(message: string) {
  const now = performance.now();
  if (now - lastHint < HINT_MS) return;
  lastHint = now;
  toast(message, HINT_MS);
}

/**
 * Covers the part of a touch screen that is inside the sock: fabric over the
 * glass, so it doesn't respond. A tap there says why; a drag still turns the
 * iPod. `area` is the screen in the front face's px; `top` is how far the front
 * face sits in from the body's top edge.
 */
export function SockScreenGuard({ area, height, top = 0 }: { area: { left: number; top: number; width: number; height: number }; height: number; top?: number }) {
  const mouth = useSockMouth();
  if (mouth == null) return null;
  const from = Math.max(area.top, mouth + height / 2 - top);
  const to = area.top + area.height;
  if (from >= to) return null;
  return (
    <div
      className="sock-guard"
      style={{ position: 'absolute', left: area.left, top: from, width: area.width, height: to - from, zIndex: 50 }}
      onPointerDown={(e) => {
        // the stage may take the pointer to turn the iPod, so watch the release on the window
        const at = { x: e.clientX, y: e.clientY };
        const up = (u: PointerEvent) => {
          if (u.pointerId !== e.pointerId) return;
          window.removeEventListener('pointerup', up, true);
          if (Math.hypot(u.clientX - at.x, u.clientY - at.y) < 8) sockHint('Take off the sock to use the screen');
        };
        window.addEventListener('pointerup', up, true);
      }}
    />
  );
}
