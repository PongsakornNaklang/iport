/**
 * The model chooser: every iPod floats on the stage, live, in its own
 * colors, and you pick one. The iPod you have moves into its place in the
 * row; the one you pick flies to the middle (Stage.tsx).
 */
import { create } from 'zustand';
import { useCustomize } from '../core/customize/store';
import { MODELS } from '../devices/registry';
import { useStage } from './stageStore';

interface OverviewState {
  open: boolean;
  /** the others are fading out after a pick (the picked id) */
  closing: string | null;
  /** the iPod under the pointer or the arrow keys */
  hover: number;
}

export const useOverview = create<OverviewState>(() => ({ open: false, closing: null, hover: -1 }));

/** how long the others take to fade (matches .ov-out in app.css) */
const FADE_MS = 420;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

export function openOverview() {
  clearTimeout(fadeTimer);
  const i = MODELS.findIndex((m) => m.id === useCustomize.getState().modelId);
  useStage.getState().front();
  useOverview.setState({ open: true, closing: null, hover: i });
}

/** Choose an iPod (or none: keep the one you have) and leave the chooser. */
export function pickModel(id?: string) {
  const s = useOverview.getState();
  if (!s.open || s.closing) return;
  const cur = useCustomize.getState().modelId;
  const to = id ?? cur;
  // the picked one takes over on the stage where it floats, then flies to the middle
  if (to !== cur) useCustomize.getState().setModel(to);
  useOverview.setState({ closing: to });
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      useOverview.setState({ open: false });
      fadeTimer = setTimeout(() => useOverview.setState({ closing: null, hover: -1 }), FADE_MS);
    }),
  );
}

export function toggleOverview() {
  if (useOverview.getState().open) pickModel();
  else openOverview();
}
