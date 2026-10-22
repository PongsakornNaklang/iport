/**
 * Changing iPods with a turn: the one on the stage spins away (`leaving`),
 * then the next one spins in (the stage's entry animation). Presses that
 * come while it spins away just change where it lands.
 */
import { create } from 'zustand';
import { useCustomize } from '../core/customize/store';
import { getModel } from '../devices/registry';

/** how long the iPod takes to spin away (matches .device-leave in app.css) */
export const LEAVE_MS = 260;

/** `turn` counts landings back on the same iPod, so it spins in again */
export const useModelSwitch = create<{ leaving: boolean; turn: number }>(() => ({ leaving: false, turn: 0 }));

let target: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function switchModel(id: string) {
  const next = getModel(id).id;
  target = next;
  if (timer) return; // already spinning away: it lands on the latest choice
  if (next === useCustomize.getState().modelId) return;
  if (reduced()) return useCustomize.getState().setModel(next);
  void getModel(next)
    .load()
    .catch(() => {}); // fetch while it spins
  useModelSwitch.setState({ leaving: true });
  timer = setTimeout(async () => {
    // wait for its code; a press meanwhile still changes where it lands
    let to = target!;
    for (;;) {
      await getModel(to)
        .load()
        .catch(() => {});
      if (to === target) break;
      to = target!;
    }
    timer = null;
    const same = to === useCustomize.getState().modelId;
    useCustomize.getState().setModel(to);
    useModelSwitch.setState((s) => ({ leaving: false, turn: same ? s.turn + 1 : s.turn }));
  }, LEAVE_MS);
}
