/**
 * iPod nano (7th generation) — device-local state.
 *
 *  - `useNano`      transient UI state (sleep, lock, open app, HUDs, sheets…)
 *  - `useNanoData`  persisted nano-only data (home layout, fitness, radio…)
 *  - `useClockState` stopwatch / timer that keep running while you use other apps
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReactNode } from 'react';

export type AppId =
  | 'music'
  | 'videos'
  | 'fitness'
  | 'podcasts'
  | 'photos'
  | 'radio'
  | 'settings'
  | 'clock'
  | 'audiobooks'
  | 'itunesu'
  | 'voicememos';

export const DEFAULT_ORDER: AppId[] = [
  'music',
  'videos',
  'fitness',
  'podcasts',
  'photos',
  'radio',
  'settings',
  'clock',
  'audiobooks',
  'itunesu',
  'voicememos',
];

export interface SheetAction {
  label: string;
  destructive?: boolean;
  onSelect: () => void;
}
export interface SheetSpec {
  title?: string;
  actions: SheetAction[];
  serial: number;
}

export interface UIState {
  asleep: boolean;
  locked: boolean;
  app: AppId | null;
  /** icon centre (screen px) the open app zooms from */
  origin: { x: number; y: number };
  homePage: number;
  /** jiggle mode on the home screen */
  editing: boolean;
  statusTheme: 'light' | 'dark';
  /** hides the status bar (video, photo viewer) */
  statusHidden: boolean;
  hud: { kind: 'volume'; serial: number } | null;
  /** Now Playing pages that currently show the artwork (MediaLayer host) */
  artClaims: number;
  /** landscape video player */
  video: boolean;
  sheet: SheetSpec | null;
  /** a pending "open Now Playing" request (consumed by the Music app) */
  npRequest: number;
  /** bumps when Home is pressed inside an app that should reset */
  homeSerial: number;
  toast: { text: string; serial: number } | null;
}

export const useNano = create<UIState>(() => ({
  asleep: false,
  locked: false,
  app: null,
  origin: { x: 120, y: 216 },
  homePage: 0,
  editing: false,
  statusTheme: 'light',
  statusHidden: false,
  hud: null,
  artClaims: 0,
  video: false,
  sheet: null,
  npRequest: 0,
  homeSerial: 0,
  toast: null,
}));

export const nano = {
  openApp(app: AppId, origin?: { x: number; y: number }) {
    useNano.setState({ app, origin: origin ?? useNano.getState().origin, editing: false });
  },
  goHome() {
    const s = useNano.getState();
    if (s.video) {
      useNano.setState({ video: false });
      return;
    }
    if (s.sheet) useNano.setState({ sheet: null });
    if (s.editing) {
      useNano.setState({ editing: false });
      return;
    }
    if (s.app) useNano.setState({ app: null, homeSerial: s.homeSerial + 1 });
    else if (s.homePage !== 0) useNano.setState({ homePage: 0 });
  },
  openNowPlaying() {
    const s = useNano.getState();
    useNano.setState({ app: 'music', npRequest: s.npRequest + 1, locked: false });
  },
  sheet(actions: SheetAction[], title?: string) {
    useNano.setState({ sheet: { actions, title, serial: Date.now() } });
  },
  closeSheet() {
    useNano.setState({ sheet: null });
  },
  showVolume() {
    useNano.setState({ hud: { kind: 'volume', serial: Date.now() } });
  },
  toast(text: string) {
    useNano.setState({ toast: { text, serial: Date.now() } });
  },
  claimArt(delta: 1 | -1) {
    useNano.setState({ artClaims: Math.max(0, useNano.getState().artClaims + delta) });
  },
};

// ---------------------------------------------------------------- persisted

export interface Workout {
  id: string;
  kind: 'walk' | 'run';
  goal: 'basic' | 'time' | 'distance' | 'calories';
  goalValue?: number;
  start: number;
  /** seconds */
  duration: number;
  /** metres */
  distance: number;
  calories: number;
  steps: number;
}

export type RadioRegion = 'americas' | 'europe' | 'asia' | 'japan' | 'australia';

export interface NanoData {
  order: AppId[];
  clockFace: number;
  groupCompilations: boolean;
  lyricsInfo: boolean;
  videoResume: boolean;
  captions: boolean;
  slideTime: number;
  slideTransition: 'dissolve' | 'push' | 'zoom' | 'random';
  slideRepeat: boolean;
  slideShuffle: boolean;
  bluetooth: boolean;
  btDevice: string | null;
  radioFreq: number;
  radioFavorites: number[];
  radioRecent: number[];
  radioRegion: RadioRegion;
  pedometer: boolean;
  stepGoal: number;
  weightKg: number;
  heightCm: number;
  steps: Record<string, number>;
  workouts: Workout[];
  serial: string;
  timerSeconds: number;
  timerAction: 'alarm' | 'sleep';
  invert: boolean;
  mono: boolean;
  turnForVideo: boolean;
  /** Fitness distance units */
  units: 'mi' | 'km';
}

function serialNo(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let s = 'CCQ';
  for (let i = 0; i < 9; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

const DATA_DEFAULTS: NanoData = {
  order: DEFAULT_ORDER,
  clockFace: 0,
  groupCompilations: true,
  lyricsInfo: true,
  videoResume: true,
  captions: false,
  slideTime: 3,
  slideTransition: 'dissolve',
  slideRepeat: true,
  slideShuffle: false,
  bluetooth: false,
  btDevice: null,
  radioFreq: 98.1,
  radioFavorites: [],
  radioRecent: [],
  radioRegion: 'americas',
  pedometer: true,
  stepGoal: 10000,
  weightKg: 68,
  heightCm: 172,
  steps: {},
  workouts: [],
  serial: serialNo(),
  timerSeconds: 15 * 60,
  timerAction: 'alarm',
  invert: false,
  mono: false,
  turnForVideo: true,
  units: typeof navigator !== 'undefined' && /^en-(US|LR|MM)$/i.test(navigator.language) ? 'mi' : 'km',
};

interface NanoDataActions {
  set<K extends keyof NanoData>(k: K, v: NanoData[K]): void;
  addSteps(n: number): void;
  resetSettings(): void;
}

export const useNanoData = create<NanoData & NanoDataActions>()(
  persist(
    (set, get) => ({
      ...DATA_DEFAULTS,
      set(k, v) {
        set({ [k]: v } as Partial<NanoData>);
      },
      addSteps(n) {
        const k = dayKey(new Date());
        const steps = get().steps;
        set({ steps: { ...steps, [k]: Math.round((steps[k] ?? 0) + n) } });
      },
      resetSettings() {
        const keep = get();
        set({
          ...DATA_DEFAULTS,
          steps: keep.steps,
          workouts: keep.workouts,
          serial: keep.serial,
          radioFavorites: keep.radioFavorites,
        });
      },
    }),
    {
      name: 'iport-nano7-v1',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<NanoData>;
        const merged = { ...current, ...p };
        // keep the layout valid if apps were added in an update
        const order = (p.order ?? []).filter((a) => DEFAULT_ORDER.includes(a));
        for (const a of DEFAULT_ORDER) if (!order.includes(a)) order.push(a);
        merged.order = order;
        return merged;
      },
    },
  ),
);

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- clock

export interface ClockState {
  swRunning: boolean;
  swStart: number;
  swAcc: number;
  laps: number[];
  /** epoch ms when the countdown ends (running), else null */
  timerEnd: number | null;
  /** remaining ms while paused */
  timerPaused: number | null;
  /** length of the running countdown, ms (for the progress ring) */
  timerTotal: number;
  timerRinging: boolean;
}

export const useClockState = create<ClockState>(() => ({
  swRunning: false,
  swStart: 0,
  swAcc: 0,
  laps: [],
  timerEnd: null,
  timerPaused: null,
  timerTotal: 0,
  timerRinging: false,
}));

export function stopwatchMs(s: ClockState, now = Date.now()): number {
  return s.swAcc + (s.swRunning ? now - s.swStart : 0);
}

/** Workout in progress (Fitness). Survives leaving the app. */
export interface WorkoutRun {
  kind: 'walk' | 'run';
  goal: Workout['goal'];
  goalValue?: number;
  start: number;
  /** accumulated active ms before the current segment */
  acc: number;
  segStart: number | null;
  steps: number;
  countdown: number;
  done?: boolean;
}

export const useWorkout = create<{ run: WorkoutRun | null }>(() => ({ run: null }));

export function workoutMs(r: WorkoutRun, now = Date.now()): number {
  return r.acc + (r.segStart ? now - r.segStart : 0);
}

/** Small helper so pages can declare their nav spec next to their node. */
export type Node = ReactNode;
