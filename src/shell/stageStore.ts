import { create } from 'zustand';

/**
 * Camera state for the 3D stage. The stage component animates towards
 * `target` each frame; toolbar buttons just set a new target.
 */
interface StageState {
  zoom: number;
  /** px of the stage covered by side panels (the device re-centres in the rest) */
  inset: { left: number; right: number; bottom: number };
  setInset(left: number, right: number, bottom?: number): void;
  /** requested orientation; the stage tweens to it */
  target: { rx: number; ry: number; serial: number } | null;
  spinning: boolean;
  setZoom(z: number): void;
  view(rx: number, ry: number): void;
  front(): void;
  back(): void;
  side(): void;
  toggleSpin(): void;
  /** the iPod lying on its side, turned a quarter to the left (landscape) */
  roll: boolean;
  toggleRoll(): void;
  /**
   * A device turning itself for landscape content (video, Cover Flow) and
   * back. Turning back restores whatever the button had set.
   */
  autoRoll(on: boolean): void;
}

/** what `roll` was before a device turned itself (null: it hasn't) */
let beforeAuto: boolean | null = null;

export const useStage = create<StageState>((set, get) => ({
  zoom: 1,
  inset: { left: 0, right: 0, bottom: 0 },
  setInset(left, right, bottom = 0) {
    const cur = get().inset;
    if (cur.left !== left || cur.right !== right || cur.bottom !== bottom) set({ inset: { left, right, bottom } });
  },
  target: null,
  spinning: false,
  setZoom(z) {
    set({ zoom: Math.max(0.4, Math.min(2.5, z)) });
  },
  view(rx, ry) {
    set({ target: { rx, ry, serial: (get().target?.serial ?? 0) + 1 }, spinning: false });
  },
  front() {
    get().view(0, 0);
  },
  back() {
    get().view(0, 180);
  },
  side() {
    get().view(-12, 62);
  },
  toggleSpin() {
    set({ spinning: !get().spinning });
  },
  roll: false,
  toggleRoll() {
    beforeAuto = null;
    set({ roll: !get().roll });
  },
  autoRoll(on) {
    if (on) {
      if (beforeAuto === null) beforeAuto = get().roll;
      set({ roll: true });
    } else if (beforeAuto !== null) {
      set({ roll: beforeAuto });
      beforeAuto = null;
    }
  },
}));

/** The angle `roll` turns the iPod by (CSS rotateZ, degrees). */
export const ROLL_ANGLE = -90;

/**
 * Current device orientation in degrees, updated every frame by the stage
 * (not reactive). `roll` is the turn in the screen plane, 0 to ROLL_ANGLE.
 */
export const liveOrientation = { rx: 0, ry: 0, roll: 0 };
