/**
 * iPod touch OS state. Two stores:
 *  - `useOS`    runtime state (screen, lock, foreground app, overlays…)
 *  - `usePrefs` persisted touch-only preferences (home layout, toggles, timers…)
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { playLock, playTone } from '../../../core/sound/click';
import { useSettings } from '../../../core/settings/store';

export type Overlay = null | 'cc' | 'nc' | 'switcher' | 'siri' | 'spotlight';
/** running · "slide to power off" showing · switched off · starting up */
export type Power = 'on' | 'menu' | 'off' | 'boot';

export interface Notif {
  id: string;
  app: string;
  title: string;
  body: string;
  time: number;
}

export interface MenuItem {
  label: string;
  glyph?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export interface AlertAction {
  label: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (input?: string) => void;
}

export interface AlertSpec {
  title?: string;
  message?: string;
  input?: { placeholder?: string; value?: string };
  actions: AlertAction[];
  sheet?: boolean;
}

export interface OSState {
  screenOn: boolean;
  locked: boolean;
  passcode: boolean;
  /** foreground app id (null = Home Screen) */
  app: string | null;
  /** apps kept alive, most recent first */
  recents: string[];
  /** bumps when an app is launched from an icon (zoom animation) */
  launchSerial: number;
  launchFromIcon: boolean;
  overlay: Overlay;
  /** interactive edge drag progress 0..1 for cc / nc */
  edgeDrag: { kind: 'cc' | 'nc'; p: number } | null;
  /** float card position in the app switcher */
  switcherPos: number;
  hudSerial: number;
  landscape: boolean;
  homePage: number;
  jiggle: boolean;
  notifications: Notif[];
  videoOpen: boolean;
  menu: { title?: string; items: MenuItem[]; y: number } | null;
  alert: AlertSpec | null;
  toast: { text: string; glyph: string; serial: number } | null;
  /** Camera shutter requests (volume buttons take photos) */
  shutterSerial: number;
  /** pending deep link for an app, e.g. { app:'clock', tab:'timer' } */
  intent: { app: string; data: string; serial: number } | null;
  power: Power;
  /** a notification shown as a banner at the top while the iPod is in use */
  banner: Notif | null;
  /** the last screenshot: shown small in the corner for a moment */
  shot: { url: string; serial: number } | null;
}

export const useOS = create<OSState>(() => ({
  screenOn: true,
  locked: true,
  passcode: false,
  app: null,
  recents: [],
  launchSerial: 0,
  launchFromIcon: false,
  overlay: null,
  edgeDrag: null,
  switcherPos: 0,
  hudSerial: 0,
  landscape: false,
  homePage: 0,
  jiggle: false,
  notifications: [],
  videoOpen: false,
  menu: null,
  alert: null,
  toast: null,
  shutterSerial: 0,
  intent: null,
  power: 'on',
  banner: null,
  shot: null,
}));

const S = useOS.setState;
const G = useOS.getState;

// ------------------------------------------------------------------ prefs

export interface HomeLayout {
  pages: string[][];
  dock: string[];
}

export const DEFAULT_LAYOUT: HomeLayout = {
  pages: [
    [
      'facetime', 'calendar', 'photos', 'camera',
      'clock', 'maps', 'weather', 'reminders',
      'notes', 'books', 'appstore', 'podcasts',
      'tv', 'home', 'itunes', 'findmy',
      'contacts', 'calculator', 'voicememos', 'settings',
    ],
    ['files', 'shortcuts', 'translate', 'tips'],
  ],
  dock: ['messages', 'mail', 'safari', 'music'],
};

export interface Prefs {
  layout: HomeLayout;
  wifi: boolean;
  bluetooth: boolean;
  airplane: boolean;
  rotationLock: boolean;
  focus: boolean;
  /** minutes, 0 = never */
  autoLock: number;
  batteryPercent: boolean;
  keyboardClicks: boolean;
  /** the keyboard's language (the globe key switches) */
  kbLang: 'en' | 'th';
  lockSound: boolean;
  musicTab: string;
  /** Library categories hidden with Edit */
  musicHidden: string[];
  tvTab: string;
  clockTab: string;
  timer: { endAt: number | null; remaining: number; duration: number; sound: string };
  stopwatch: { startAt: number | null; acc: number; laps: number[] };
  weather: { at: number; data: unknown } | null;
  weatherUnit: 'C' | 'F';
  deviceName: string;
  reminders: { id: string; text: string; done: boolean; flagged?: boolean; due?: number; notes?: string }[];
  safariFavs: boolean;
}

const DEFAULT_PREFS: Prefs = {
  layout: DEFAULT_LAYOUT,
  wifi: true,
  bluetooth: true,
  airplane: false,
  rotationLock: false,
  focus: false,
  autoLock: 0,
  batteryPercent: false,
  keyboardClicks: true,
  kbLang: 'en',
  lockSound: true,
  musicTab: 'library',
  musicHidden: ['genres', 'compilations', 'composers'],
  tvTab: 'watch',
  clockTab: 'world',
  timer: { endAt: null, remaining: 0, duration: 15 * 60, sound: 'Radar' },
  stopwatch: { startAt: null, acc: 0, laps: [] },
  weather: null,
  weatherUnit: 'C',
  deviceName: 'iPod',
  reminders: [],
  safariFavs: true,
};

export const usePrefs = create<Prefs & { set: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void }>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      set: (k, v) => set({ [k]: v } as Partial<Prefs>),
    }),
    {
      name: 'iport-touch7-prefs',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Prefs>;
        const merged = { ...current, ...p };
        // make sure every app is still somewhere on the Home Screen
        const all = new Set([...DEFAULT_LAYOUT.pages.flat(), ...DEFAULT_LAYOUT.dock]);
        const lay = merged.layout && Array.isArray(merged.layout.pages) ? merged.layout : DEFAULT_LAYOUT;
        const seen = new Set([...lay.pages.flat(), ...lay.dock]);
        const missing = [...all].filter((x) => !seen.has(x));
        const pages = lay.pages.map((p2) => p2.filter((x) => all.has(x))).filter((p2, i) => p2.length || i === 0);
        if (missing.length) {
          const last = pages[pages.length - 1];
          if (last.length + missing.length <= 20) pages[pages.length - 1] = [...last, ...missing];
          else pages.push(missing);
        }
        merged.layout = { pages, dock: lay.dock.filter((x) => all.has(x)) };
        return merged;
      },
    },
  ),
);

export const prefs = () => usePrefs.getState();

// ------------------------------------------------------------------ actions

let notifSeq = 0;
let openAfterUnlock: Notif | null = null;
// the top and Home buttons, for holds and the screenshot chord
let topHeld = false;
let homeHeld = false;
let topUsed = false;
let homeUsed = false;
let topTimer: number | undefined;

function shotSound() {
  playTone(2400, 30, { volume: 0.12, type: 'square' });
  playTone(1200, 60, { volume: 0.08, delayMs: 40, type: 'triangle' });
}

export const os = {
  wake() {
    if (G().screenOn || G().power !== 'on') return;
    S({ screenOn: true });
  },
  sleep() {
    if (G().power === 'menu') S({ power: 'on' });
    if (!G().screenOn || G().power !== 'on') return;
    if (prefs().lockSound) playLock();
    S({ screenOn: false, locked: true, passcode: false, overlay: null, edgeDrag: null, menu: null, jiggle: false });
  },
  sleepWake() {
    if (G().screenOn) os.sleep();
    else os.wake();
  },
  unlock() {
    const code = useSettings.getState().lockCode;
    if (code && !G().passcode) {
      S({ passcode: true, overlay: null });
      return;
    }
    S({ locked: false, passcode: false, overlay: null });
  },
  /** after a correct passcode */
  passcodeOK() {
    S({ locked: false, passcode: false });
    if (openAfterUnlock) {
      const n = openAfterUnlock;
      openAfterUnlock = null;
      os.openNotification(n);
    }
  },
  /** a notification tapped on the Lock Screen: unlock (passcode first), then open its app */
  openFromLock(n: Notif) {
    openAfterUnlock = n;
    os.unlock();
    if (!G().locked) {
      openAfterUnlock = null;
      os.openNotification(n);
    }
  },
  openApp(id: string, fromIcon = false) {
    const st = G();
    const recents = [id, ...st.recents.filter((x) => x !== id)].slice(0, 8);
    S({
      app: id,
      recents,
      overlay: null,
      edgeDrag: null,
      jiggle: false,
      menu: null,
      launchSerial: st.launchSerial + 1,
      launchFromIcon: fromIcon,
    });
  },
  /** deep-link into an app (Control Center shortcuts, notifications) */
  openAppWith(id: string, data: string) {
    S({ intent: { app: id, data, serial: (G().intent?.serial ?? 0) + 1 } });
    os.openApp(id);
  },
  goHome() {
    S({ app: null, overlay: null, edgeDrag: null, menu: null, videoOpen: false, landscape: false });
  },
  closeRecent(id: string) {
    const st = G();
    S({ recents: st.recents.filter((x) => x !== id), app: st.app === id ? null : st.app });
  },
  setOverlay(o: Overlay) {
    S({ overlay: o, edgeDrag: null, menu: null });
  },
  openSwitcher() {
    const st = G();
    if (st.locked || !st.screenOn) return;
    // the switcher centres the previous app when coming from an app
    const n = st.recents.length;
    const pos = st.app ? Math.max(0, n - 2) : n - 1;
    S({ overlay: 'switcher', switcherPos: Math.max(0, pos), menu: null, jiggle: false, videoOpen: false, landscape: false });
  },
  volumeHud() {
    S({ hudSerial: G().hudSerial + 1 });
  },
  notify(app: string, title: string, body: string) {
    const n: Notif = { id: `n${++notifSeq}_${Date.now()}`, app, title, body, time: Date.now() };
    const st = G();
    // in use: it drops down as a banner (not over the app it comes from)
    const banner = st.screenOn && !st.locked && st.power === 'on' && st.app !== app ? n : st.banner;
    S({ notifications: [n, ...st.notifications].slice(0, 30), banner });
  },
  /** a notification tapped: its app (a message opens its conversation) */
  openNotification(n: Notif) {
    if (n.app === 'messages') os.openAppWith('messages', n.title);
    else os.openApp(n.app);
  },
  dismissBanner() {
    S({ banner: null });
  },

  // ---------------------------------------------------------------- top (Sleep/Wake) button
  /**
   * A press wakes the screen at once; a short press on a lit screen puts it
   * to sleep when let go. Held for about two seconds it offers "slide to
   * power off", and when the iPod is off it starts it up. Pressed together
   * with Home it takes a screenshot.
   */
  topDown() {
    topHeld = true;
    const st = G();
    if (homeHeld && st.power === 'on' && st.screenOn) {
      topUsed = homeUsed = true;
      void os.screenshot();
      return;
    }
    topUsed = false;
    window.clearTimeout(topTimer);
    if (st.power === 'boot') {
      topUsed = true;
      return;
    }
    if (st.power === 'off') {
      topUsed = true;
      topTimer = window.setTimeout(() => os.boot(), 2000);
      return;
    }
    if (!st.screenOn) {
      os.wake();
      topUsed = true;
    }
    topTimer = window.setTimeout(() => {
      topUsed = true;
      if (G().power === 'on') S({ power: 'menu', screenOn: true, overlay: null, menu: null, edgeDrag: null, jiggle: false, banner: null });
    }, 2200);
  },
  topUp() {
    topHeld = false;
    window.clearTimeout(topTimer);
    if (topUsed) return;
    if (G().power === 'menu') S({ power: 'on' });
    else if (G().power === 'on') os.sleep();
  },
  /** Home held down / let go (for the screenshot chord) */
  homePressed(on: boolean) {
    homeHeld = on;
    if (on && topHeld && G().power === 'on' && G().screenOn) {
      homeUsed = topUsed = true;
      void os.screenshot();
    }
  },
  /** true once: the Home press was part of a screenshot, so it does nothing else */
  homeConsumed() {
    const u = homeUsed;
    homeUsed = false;
    return u;
  },
  powerOff() {
    S({
      power: 'off',
      screenOn: false,
      locked: true,
      passcode: false,
      overlay: null,
      menu: null,
      alert: null,
      app: null,
      recents: [],
      banner: null,
      jiggle: false,
      videoOpen: false,
      landscape: false,
    });
  },
  boot() {
    S({ power: 'boot', screenOn: true });
    window.setTimeout(() => S({ power: 'on', locked: true, homePage: 0 }), 3400);
  },
  /** Home + Sleep/Wake: the screen flashes and the picture goes to Photos ▸ Screenshots */
  async screenshot() {
    const el = document.querySelector<HTMLElement>('.stage-center:not(.ov-item) .t7-screen');
    if (!el) return;
    shotSound();
    S({ shot: null });
    try {
      const { toCanvas } = await import('html-to-image');
      // the 7th generation's screen: 640 × 1136
      const canvas = await toCanvas(el, {
        pixelRatio: 2,
        skipFonts: true,
        filter: (n) => !(n instanceof Element && (n.classList.contains('t7-shot') || n.classList.contains('t7-off') || n.classList.contains('t7-bright'))),
      });
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) return;
      const [{ putBlob }, { useLibrary }, { uid }] = await Promise.all([import('../../../core/db'), import('../../../core/library/store'), import('../../../core/util/id')]);
      const id = uid('ph');
      const key = `photo:${id}`;
      await putBlob(key, blob);
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      useLibrary.getState().addPhotos([
        {
          id,
          name: `Screenshot ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} at ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}.png`,
          blobKey: key,
          width: canvas.width,
          height: canvas.height,
          addedAt: Date.now(),
          album: 'Screenshots',
        },
      ]);
      S({ shot: { url: URL.createObjectURL(blob), serial: (G().shot?.serial ?? 0) + 1 } });
    } catch {
      os.toast('Couldn’t take a screenshot', 'exclamationmark.triangle');
    }
  },
  clearNotifications() {
    S({ notifications: [] });
  },
  showMenu(items: MenuItem[], y: number, title?: string) {
    S({ menu: { items, y, title } });
  },
  closeMenu() {
    S({ menu: null });
  },
  alert(spec: AlertSpec) {
    S({ alert: spec });
  },
  closeAlert() {
    S({ alert: null });
  },
  toast(text: string, glyph = 'checkmark') {
    S({ toast: { text, glyph, serial: (G().toast?.serial ?? 0) + 1 } });
  },
  setLandscape(v: boolean) {
    if (v && prefs().rotationLock) return;
    S({ landscape: v });
  },

  // ---------------------------------------------------------------- Home button
  homeClick() {
    const st = G();
    if (st.power === 'menu') {
      S({ power: 'on' });
      return;
    }
    if (st.power !== 'on') return;
    if (!st.screenOn) {
      os.wake();
      return;
    }
    if (st.overlay === 'siri') {
      S({ overlay: null });
      return;
    }
    if (st.locked) {
      if (st.passcode) S({ passcode: false });
      else os.unlock();
      return;
    }
    if (st.alert) {
      S({ alert: null });
      return;
    }
    if (st.menu) {
      S({ menu: null });
      return;
    }
    if (st.overlay) {
      S({ overlay: null, edgeDrag: null });
      return;
    }
    if (st.jiggle) {
      S({ jiggle: false });
      return;
    }
    if (st.app) {
      os.goHome();
      return;
    }
    if (st.homePage !== 0) S({ homePage: 0 });
  },
  homeDouble() {
    const st = G();
    if (st.power !== 'on') return;
    if (!st.screenOn || st.locked) return;
    if (st.overlay === 'switcher') {
      S({ overlay: null });
      return;
    }
    os.openSwitcher();
  },
  homeLong() {
    const st = G();
    if (st.power !== 'on') return;
    if (!st.screenOn) S({ screenOn: true });
    S({ overlay: 'siri', menu: null, edgeDrag: null });
  },
};

// ------------------------------------------------------------------ status bar overrides


type BarStyle = 'light' | 'dark' | 'hidden';
let barSeq = 0;
export const useBarOverrides = create<{ list: { token: number; app: string; style: BarStyle }[] }>(() => ({ list: [] }));

/** While mounted (and `enabled`), force the status bar style for `app`. */
export function useStatusBar(app: string, style: BarStyle | null, enabled = true) {
  useEffect(() => {
    if (!enabled || !style) return;
    const token = ++barSeq;
    useBarOverrides.setState((s) => ({ list: [...s.list, { token, app, style }] }));
    return () => useBarOverrides.setState((s) => ({ list: s.list.filter((x) => x.token !== token) }));
  }, [app, style, enabled]);
}

// dev-only handle for automated UI checks
if (import.meta.env.DEV && typeof window !== 'undefined') {
  void Promise.all([
    import('../../../core/customize/store'),
    import('../../../shell/stageStore'),
    import('../../../core/library/store'),
    import('../../../core/player/player'),
  ]).then(([c, st, lib, pl]) => {
    (window as unknown as { __t7: unknown }).__t7 = {
      os,
      useOS,
      usePrefs,
      useSettings,
      useCustomize: c.useCustomize,
      useStage: st.useStage,
      useLibrary: lib.useLibrary,
      player: pl.player,
      usePlayer: pl.usePlayer,
    };
  });
}
