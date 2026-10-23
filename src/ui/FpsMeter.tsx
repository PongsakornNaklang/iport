import { useEffect, useState } from 'react';
import { create } from 'zustand';

const KEY = 'iport.fps';

/** Whether the frame counter shows: `?fps` in the address, or Help ▸ Show frame rate (remembered). */
export const useFps = create<{ on: boolean; toggle(): void }>((set, get) => ({
  on: (() => {
    try {
      return new URLSearchParams(location.search).has('fps') || localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  })(),
  toggle() {
    const on = !get().on;
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      /* private mode: just for now */
    }
    set({ on });
  },
}));

/**
 * A frame counter for checking how smoothly the stage runs on a device:
 * frames per second over the last half second, and the slowest frame in it.
 */
export function FpsMeter() {
  const on = useFps((s) => s.on);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = performance.now();
    let start = last;
    let n = 0;
    let worst = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      worst = Math.max(worst, now - last);
      last = now;
      n++;
      if (now - start >= 500) {
        setText(`${Math.round((n * 1000) / (now - start))} fps · slowest ${Math.round(worst)} ms`);
        start = now;
        n = 0;
        worst = 0;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  if (!on) return null;
  return (
    <div className="fps-meter" aria-hidden="true">
      {text || '…'}
    </div>
  );
}
