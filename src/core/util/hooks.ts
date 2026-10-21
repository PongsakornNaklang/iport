import { useEffect, useState } from 'react';

/** Current time, re-rendering every `intervalMs` (aligned to the second). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t: number;
    const tick = () => {
      setNow(new Date());
      t = window.setTimeout(tick, intervalMs - (Date.now() % Math.min(intervalMs, 1000)));
    };
    t = window.setTimeout(tick, intervalMs - (Date.now() % Math.min(intervalMs, 1000)));
    return () => window.clearTimeout(t);
  }, [intervalMs]);
  return now;
}

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

/** Real battery level when the browser exposes it (Chrome), else a full charge. */
export function useBattery(): { level: number; charging: boolean } {
  const [state, setState] = useState({ level: 1, charging: false });
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (!nav.getBattery) return;
    let bm: BatteryManagerLike | null = null;
    const update = () => bm && setState({ level: bm.level, charging: bm.charging });
    nav.getBattery().then((b) => {
      bm = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    });
    return () => {
      bm?.removeEventListener('levelchange', update);
      bm?.removeEventListener('chargingchange', update);
    };
  }, []);
  return state;
}

/** Calls `fn` on an interval while `active`. */
export function useInterval(fn: () => void, ms: number, active = true): void {
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(fn, ms);
    return () => window.clearInterval(t);
  }, [fn, ms, active]);
}
