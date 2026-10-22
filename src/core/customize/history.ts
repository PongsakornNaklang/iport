/**
 * Undo and redo for the look of the iPod: colors, finish, options, case,
 * stickers, engraving, presets applied, and the backdrop.
 *
 * Every change to the customize store's appearances or scene saves what was
 * there before. Changes that come in a stream (dragging a sticker, a
 * slider, the color picker) make one step: a change within a moment of the
 * last one, or while a gesture holds the history, joins the step already
 * saved. The appearances are immutable, so a step is just references.
 */
import { create } from 'zustand';
import { useCustomize } from './store';

type Snap = { modelId: string; appearances: ReturnType<typeof useCustomize.getState>['appearances']; scene: ReturnType<typeof useCustomize.getState>['scene'] };

/** changes closer together than this are one step */
const JOIN_MS = 600;
const LIMIT = 100;

interface HistoryState {
  past: Snap[];
  future: Snap[];
  canUndo: boolean;
  canRedo: boolean;
}

export const useHistory = create<HistoryState>(() => ({ past: [], future: [], canUndo: false, canRedo: false }));

let applying = false;
let held = 0;
let last = 0;
/** the next change starts a new step (a gesture has just begun) */
let fresh = false;

const snap = (s: Snap): Snap => ({ modelId: s.modelId, appearances: s.appearances, scene: s.scene });
const publish = (past: Snap[], future: Snap[]) => useHistory.setState({ past, future, canUndo: past.length > 0, canRedo: future.length > 0 });

useCustomize.subscribe((s, prev) => {
  if (applying || (s.appearances === prev.appearances && s.scene === prev.scene)) return;
  const now = performance.now();
  const { past } = useHistory.getState();
  const join = past.length > 0 && !fresh && (held > 0 || now - last < JOIN_MS);
  fresh = false;
  last = now;
  publish(join ? past : [...past, snap(prev)].slice(-LIMIT), []);
});

/** While held (a drag, a pinch), every change belongs to one step. */
export function holdHistory(on: boolean) {
  if (on && held === 0) fresh = true;
  held = Math.max(0, held + (on ? 1 : -1));
  if (!on && held === 0) {
    fresh = false;
    last = 0; // the next change is a new step
  }
}

function restore(to: Snap) {
  const cur = useCustomize.getState();
  // show the iPod that changes
  const changed = Object.keys(to.appearances).find((k) => to.appearances[k] !== cur.appearances[k]);
  applying = true;
  useCustomize.setState({ appearances: to.appearances, scene: to.scene, ...(changed ? { modelId: changed } : {}) });
  applying = false;
  last = 0;
}

export function undo() {
  const { past, future } = useHistory.getState();
  const to = past[past.length - 1];
  if (!to) return;
  const cur = snap(useCustomize.getState());
  restore(to);
  publish(past.slice(0, -1), [...future, cur]);
}

export function redo() {
  const { past, future } = useHistory.getState();
  const to = future[future.length - 1];
  if (!to) return;
  const cur = snap(useCustomize.getState());
  restore(to);
  publish([...past, cur], future.slice(0, -1));
}
