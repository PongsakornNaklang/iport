/**
 * Click-wheel OS core: input routing, navigation stack and the hooks screens
 * use to talk to the OS. Everything here is model-independent so the same OS
 * can run on the iPod classic, video, nano 3G… with different screen sizes
 * and capability flags.
 */
import { createContext, useContext, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { WheelEvent } from '../../shared/clickwheel/bus';

// ------------------------------------------------------------------ input

/** Return true to consume the event. */
export type InputHandler = (e: WheelEvent) => boolean | void;

/**
 * The OS routes every wheel event through this stack (newest handler first),
 * after its own power / backlight handling and before the global fallbacks
 * (Menu = back, Play = play/pause, ⏮/⏭ = skip, hold ⏮/⏭ = scan).
 */
export class InputStack {
  private handlers: InputHandler[] = [];
  add(h: InputHandler): () => void {
    this.handlers.unshift(h);
    return () => {
      this.handlers = this.handlers.filter((x) => x !== h);
    };
  }
  dispatch(e: WheelEvent): boolean {
    for (const h of [...this.handlers]) if (h(e) === true) return true;
    return false;
  }
}

// ------------------------------------------------------------------ config

export interface OSCaps {
  /** Videos menu and video playback */
  video: boolean;
  photos: boolean;
  coverFlow: boolean;
  genius: boolean;
  /** main menu with the artwork panel on the right */
  splitMenu: boolean;
  games: boolean;
  voiceMemos: boolean;
  podcasts: boolean;
  search: boolean;
}

export const FULL_CAPS: OSCaps = {
  video: true,
  photos: true,
  coverFlow: true,
  genius: true,
  splitMenu: true,
  games: true,
  voiceMemos: true,
  podcasts: true,
  search: true,
};

export interface DeviceInfo {
  /** product name, "iPod classic" */
  product: string;
  /** the name shown in About (what iTunes calls the iPod) */
  name: string;
  capacity: string;
  capacityBytes: number;
  version: string;
  model: string;
  serial: string;
  format: string;
}

export type ThemeName = 'classic' | 'graphite' | 'red' | 'green';
export type HeaderStyle = 'light' | 'dark' | 'hidden';

// ------------------------------------------------------------------ navigation

export interface ScreenSpec {
  title: string;
  el: ReactElement;
  header?: HeaderStyle;
  /** identifies special screens ('main', 'nowplaying'…) */
  kind?: string;
}

export interface Entry extends ScreenSpec {
  id: number;
}

export interface Nav {
  push(spec: ScreenSpec): void;
  /** Back one level (Menu). */
  pop(): void;
  /** Back to the main menu. */
  root(): void;
  /** Show Now Playing (no-op when it is already on top). */
  nowPlaying(): void;
  update(id: number, patch: Partial<ScreenSpec>): void;
  depth(): number;
  topKind(): string | undefined;
}

export interface MediaRequest {
  visible: boolean;
  style?: CSSProperties;
  fit?: 'contain' | 'cover';
}

export interface MenuOption {
  label: string;
  action?: () => void;
}

export interface ContextMenuSpec {
  title?: string;
  options: MenuOption[];
}

export interface OSApi {
  width: number;
  height: number;
  /** status bar height */
  hdr: number;
  /** list row height */
  row: number;
  color: boolean;
  theme: ThemeName;
  caps: OSCaps;
  info: DeviceInfo;
  modelId: string;
  input: InputStack;
  nav: Nav;
  setMedia(owner: number, m: MediaRequest | null): void;
  menu(spec: ContextMenuSpec): void;
  hud(text: string, icon?: ReactNode): void;
  lockScreen(): void;
  /** Run a game full screen (the OS hands it a private WheelBus). */
  runGame(id: string): void;
}

export const OSContext = createContext<OSApi | null>(null);

export function useOS(): OSApi {
  const v = useContext(OSContext);
  if (!v) throw new Error('useOS outside ClickWheelOS');
  return v;
}

export function useNav(): Nav {
  return useOS().nav;
}

export interface ScreenInfo {
  id: number;
  /** on top of the stack (receives input) */
  active: boolean;
}

export const ScreenContext = createContext<ScreenInfo>({ id: -1, active: true });

export function useScreen(): ScreenInfo {
  return useContext(ScreenContext);
}

/** Receive wheel events while this screen is on top (and `enabled`). */
export function useInput(handler: InputHandler, enabled = true): void {
  const { input } = useOS();
  const { active } = useScreen();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active || !enabled) return;
    return input.add((e) => ref.current(e));
  }, [active, enabled, input]);
}

/** Set this screen's title (dynamic titles like the album name). */
export function useTitle(title: string): void {
  const { nav } = useOS();
  const { id } = useScreen();
  useEffect(() => {
    if (id >= 0) nav.update(id, { title });
  }, [id, title, nav]);
}

/** Change this screen's status bar style. */
export function useHeader(header: HeaderStyle): void {
  const { nav } = useOS();
  const { id } = useScreen();
  useEffect(() => {
    if (id >= 0) nav.update(id, { header });
  }, [id, header, nav]);
}

/** Ask the OS to show the media layer (video) while this screen is on top. */
export function useMedia(req: MediaRequest | null): void {
  const os = useOS();
  const { id, active } = useScreen();
  const key = JSON.stringify(req);
  useEffect(() => {
    if (!active || !req) return;
    os.setMedia(id, req);
    return () => os.setMedia(id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, id]);
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
