import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RepeatMode, ShuffleMode } from '../types';

export type ClickerMode = 'off' | 'speaker' | 'headphones' | 'both';
export type AudiobookSpeed = 'slower' | 'normal' | 'faster';

export interface Settings {
  // Playback
  volume: number; // 0..1
  volumeLimit: number; // 0..1 (1 = no limit)
  shuffle: ShuffleMode;
  repeat: RepeatMode;
  eq: string;
  soundCheck: boolean;
  crossfade: boolean;
  audiobookSpeed: AudiobookSpeed;

  // Device
  /** seconds; 0 = always on */
  backlight: number;
  brightness: number; // 0..1
  clicker: ClickerMode;
  use24h: boolean;
  timeInTitle: boolean;
  contactsSortBy: 'first' | 'last';
  language: string;
  /** 4-digit combination for Screen Lock (classic) / passcode (touch); '' = none */
  lockCode: string;

  // Classic-style menus: which items appear in the main / music menu.
  mainMenu: Record<string, boolean>;
  musicMenu: Record<string, boolean>;

  /** Free-form per-device settings, namespaced by model id. */
  device: Record<string, Record<string, unknown>>;
}

export interface SettingsActions {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  patch(p: Partial<Settings>): void;
  setDevice(modelId: string, key: string, value: unknown): void;
  reset(): void;
}

export const DEFAULT_MAIN_MENU: Record<string, boolean> = {
  Music: true,
  Videos: true,
  Photos: true,
  Podcasts: true,
  Extras: true,
  Settings: true,
  'Shuffle Songs': true,
  'Now Playing': true,
  Genius: false,
  'Genius Mixes': false,
  Playlists: false,
  Artists: false,
  Albums: false,
  'Cover Flow': false,
  Songs: false,
  Genres: false,
  Composers: false,
  Audiobooks: false,
  'iTunes U': false,
  Radio: false,
  Games: false,
  Clock: false,
  Contacts: false,
  Calendar: false,
  Notes: false,
  Search: false,
};

export const DEFAULT_MUSIC_MENU: Record<string, boolean> = {
  'Cover Flow': true,
  'Genius Mixes': true,
  Playlists: true,
  Artists: true,
  Albums: true,
  Compilations: true,
  Songs: true,
  Genres: true,
  Composers: true,
  Audiobooks: true,
  Search: true,
};

const DEFAULTS: Settings = {
  volume: 0.6,
  volumeLimit: 1,
  shuffle: 'off',
  repeat: 'off',
  eq: 'Off',
  soundCheck: false,
  crossfade: false,
  audiobookSpeed: 'normal',
  backlight: 10,
  brightness: 0.8,
  clicker: 'speaker',
  use24h: false,
  timeInTitle: false,
  contactsSortBy: 'last',
  language: 'English',
  lockCode: '',
  mainMenu: DEFAULT_MAIN_MENU,
  musicMenu: DEFAULT_MUSIC_MENU,
  device: {},
};

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (setState, getState) => ({
      ...DEFAULTS,
      set(key, value) {
        setState({ [key]: value } as Partial<Settings>);
      },
      patch(p) {
        setState(p);
      },
      setDevice(modelId, key, value) {
        const d = getState().device;
        setState({ device: { ...d, [modelId]: { ...(d[modelId] ?? {}), [key]: value } } });
      },
      reset() {
        setState({ ...DEFAULTS, volume: getState().volume });
      },
    }),
    {
      name: 'iport-settings-v1',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return {
          ...current,
          ...p,
          mainMenu: { ...DEFAULT_MAIN_MENU, ...(p.mainMenu ?? {}) },
          musicMenu: { ...DEFAULT_MUSIC_MENU, ...(p.musicMenu ?? {}) },
        };
      },
    },
  ),
);

export const settings = () => useSettings.getState();

/** Read a per-device setting with a default. */
export function useDeviceSetting<T>(modelId: string, key: string, fallback: T): [T, (v: T) => void] {
  const value = useSettings((s) => s.device[modelId]?.[key]) as T | undefined;
  const setDevice = useSettings((s) => s.setDevice);
  return [value === undefined ? fallback : value, (v: T) => setDevice(modelId, key, v)];
}

export const AUDIOBOOK_RATES: Record<AudiobookSpeed, number> = { slower: 0.75, normal: 1, faster: 1.5 };
