/**
 * The click-wheel iPod OS (modelled on iPod classic software 2.0.4).
 *
 * Reusable: give it a WheelBus, a screen size, color/monochrome and
 * capability flags. The iPod classic device renders it at 320×240.
 */
import { lazy, memo, Suspense, type ComponentType, type LazyExoticComponent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MediaLayer } from '../../../core/player/MediaLayer';
import { player } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { useAlarmState } from '../../../core/alarms';
import { WheelBus, type WheelButton, type WheelEvent } from '../../shared/clickwheel/bus';
import { GAMES } from '../../shared/games/registry';
import type { GameProps } from '../../shared/games/types';
import {
  FULL_CAPS,
  InputStack,
  OSContext,
  ScreenContext,
  useInput,
  type ContextMenuSpec,
  type DeviceInfo,
  type Entry,
  type MediaRequest,
  type Nav,
  type OSApi,
  type OSCaps,
  type ScreenSpec,
  type ThemeName,
} from './core';
import { StatusBar } from './StatusBar';
import { ContextMenu } from './ContextMenu';
import { AppleLogo, BigLock } from './glyphs';
import { MainMenu } from './screens/MainMenu';
import { R } from './routes';
import { AlarmRinging } from './screens/AlarmRinging';
import { LockScreen } from './screens/ScreenLock';
import './os.css';

export interface ClickWheelOSProps {
  bus: WheelBus;
  width?: number;
  height?: number;
  /** false for monochrome iPods (grey-blue LCD) */
  color?: boolean;
  theme?: ThemeName;
  /** Hold switch */
  hold?: boolean;
  modelId: string;
  info: DeviceInfo;
  caps?: Partial<OSCaps>;
  /** boot logo on black (classic) or on white (5G) */
  bootStyle?: 'dark' | 'light';
  /** play the boot animation when first mounted */
  boot?: boolean;
}

type Power = 'boot' | 'on' | 'sleep' | 'reboot';

const TRANSITION_MS = 290;

export function ClickWheelOS({
  bus,
  width = 320,
  height = 240,
  color = true,
  theme = 'classic',
  hold = false,
  modelId,
  info,
  caps: capsIn,
  bootStyle = 'dark',
  boot = true,
}: ClickWheelOSProps) {
  const scale = height / 240;
  const hdr = Math.round(22 * scale);
  const row = Math.floor((height - hdr) / 8);
  const caps = useMemo(() => ({ ...FULL_CAPS, ...capsIn }), [capsIn]);
  const input = useMemo(() => new InputStack(), []);

  // ---------------------------------------------------------------- navigation stack
  const nextId = useRef(1);
  const rootEntry = (): Entry => ({ id: 0, title: 'iPod', el: <MainMenu />, kind: 'main' });
  const [stack, setStack] = useState<Entry[]>(() => [rootEntry()]);
  const [leaving, setLeaving] = useState<Entry | null>(null);
  const [anim, setAnim] = useState<{ dir: 'push' | 'pop'; serial: number } | null>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const animTimer = useRef<number | undefined>(undefined);

  const startAnim = (dir: 'push' | 'pop') => {
    window.clearTimeout(animTimer.current);
    setAnim((a) => ({ dir, serial: (a?.serial ?? 0) + 1 }));
    animTimer.current = window.setTimeout(() => {
      setAnim(null);
      setLeaving(null);
    }, TRANSITION_MS + 20);
  };

  const nav: Nav = useMemo(
    () => ({
      push(spec: ScreenSpec) {
        const e: Entry = { ...spec, id: nextId.current++ };
        setLeaving(null);
        setStack((s) => [...s, e]);
        startAnim('push');
      },
      pop() {
        const s = stackRef.current;
        if (s.length <= 1) return;
        setLeaving(s[s.length - 1]);
        setStack(s.slice(0, -1));
        stackRef.current = s.slice(0, -1);
        startAnim('pop');
      },
      root() {
        const s = stackRef.current;
        if (s.length <= 1) return;
        setLeaving(s[s.length - 1]);
        setStack(s.slice(0, 1));
        stackRef.current = s.slice(0, 1);
        startAnim('pop');
      },
      nowPlaying() {
        const s = stackRef.current;
        if (s[s.length - 1]?.kind === 'nowplaying') return;
        nav.push(R.nowPlaying());
      },
      update(id, patch) {
        setStack((s) => {
          const i = s.findIndex((x) => x.id === id);
          if (i < 0) return s;
          const cur = s[i];
          if (Object.entries(patch).every(([k, v]) => (cur as unknown as Record<string, unknown>)[k] === v)) return s;
          const copy = s.slice();
          copy[i] = { ...cur, ...patch };
          return copy;
        });
      },
      depth() {
        return stackRef.current.length;
      },
      topKind() {
        const s = stackRef.current;
        return s[s.length - 1]?.kind;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---------------------------------------------------------------- media layer
  const [media, setMediaState] = useState<{ owner: number; req: MediaRequest } | null>(null);
  const setMedia = useCallback((owner: number, req: MediaRequest | null) => {
    setMediaState((cur) => {
      if (req) return { owner, req };
      if (cur && cur.owner === owner) return null;
      return cur;
    });
  }, []);

  // ---------------------------------------------------------------- modals
  const [menuSpec, setMenuSpec] = useState<ContextMenuSpec | null>(null);
  const [hudState, setHud] = useState<{ text: string; icon?: ReactNode; serial: number } | null>(null);
  const hudTimer = useRef<number | undefined>(undefined);
  const [locked, setLocked] = useState(false);
  const [game, setGame] = useState<string | null>(null);
  const ringing = useAlarmState((s) => s.ringing);

  // ---------------------------------------------------------------- power & backlight
  const [power, setPower] = useState<Power>(boot ? 'boot' : 'on');
  const powerRef = useRef(power);
  powerRef.current = power;
  const backlightSec = useSettings((s) => s.backlight);
  const brightness = useSettings((s) => s.brightness);
  const [lit, setLit] = useState(true);
  const lastInput = useRef(Date.now());
  const [lockFlash, setLockFlash] = useState(0);

  useEffect(() => {
    if (power !== 'boot') return;
    const t = window.setTimeout(() => setPower('on'), 2600);
    return () => window.clearTimeout(t);
  }, [power]);

  useEffect(() => {
    if (power !== 'reboot') return;
    const t = window.setTimeout(() => {
      setStack([rootEntry()]);
      setLeaving(null);
      setMenuSpec(null);
      setGame(null);
      setPower('boot');
    }, 1100);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [power]);

  const wake = useCallback(() => {
    lastInput.current = Date.now();
    setLit(true);
  }, []);

  /** video, slideshows and games keep the backlight on */
  const keepLit = useRef(false);
  useEffect(() => {
    if (!backlightSec) {
      setLit(true);
      return;
    }
    const t = window.setInterval(() => {
      if (keepLit.current) {
        lastInput.current = Date.now();
        setLit(true);
      } else if (Date.now() - lastInput.current > backlightSec * 1000) setLit(false);
    }, 400);
    return () => window.clearInterval(t);
  }, [backlightSec]);

  // alarms wake the iPod
  useEffect(() => {
    if (!ringing) return;
    wake();
    if (powerRef.current === 'sleep') setPower('on');
  }, [ringing, wake]);

  // Hold switch
  useEffect(() => {
    bus.locked = hold;
    if (hold) bus.releaseAll();
  }, [bus, hold]);
  useEffect(() => {
    bus.onAnyInput = () => {
      if (bus.locked && powerRef.current === 'on') {
        wake();
        setLockFlash((n) => n + 1);
      }
    };
    return () => {
      bus.onAnyInput = null;
    };
  }, [bus, wake]);
  useEffect(() => {
    if (!lockFlash) return;
    const t = window.setTimeout(() => setLockFlash(0), 1600);
    return () => window.clearTimeout(t);
  }, [lockFlash]);

  // ---------------------------------------------------------------- the input pipeline
  useEffect(() => {
    const down = new Set<WheelButton>();
    const swallow = new Set<WheelButton>();
    let rebootTimer: number | undefined;
    const off = bus.on((e: WheelEvent) => {
      const p = powerRef.current;
      // Menu + Select held for 6 seconds: reboot (works in any state, like the real thing)
      if (e.type === 'down') {
        down.add(e.button);
        if (down.has('menu') && down.has('select') && !rebootTimer) {
          rebootTimer = window.setTimeout(() => {
            rebootTimer = undefined;
            player.pause();
            setPower('reboot');
          }, 6000);
        }
      } else if (e.type === 'up') {
        down.delete(e.button);
        if (rebootTimer && !(down.has('menu') && down.has('select'))) {
          window.clearTimeout(rebootTimer);
          rebootTimer = undefined;
        }
      }
      if (p === 'boot' || p === 'reboot') return true;
      if (p === 'sleep') {
        // any button wakes the iPod; Play/Pause also resumes the music
        if (e.type === 'down') {
          swallow.add(e.button);
          wake();
          setPower('on');
          powerRef.current = 'on';
          if (e.button === 'play') player.play();
        }
        return true;
      }
      if ('button' in e && swallow.has(e.button)) {
        // swallow the rest of the waking press (up + click, or up after a hold)
        if (e.type === 'click' || (e.type === 'up' && e.held)) swallow.delete(e.button);
        return true;
      }
      // backlight: touching / pressing anything lights the screen; holding Menu toggles it
      if (e.type === 'hold' && e.button === 'menu') {
        if (Date.now() - lastInput.current < 300000) {
          setLit((l) => {
            if (l) lastInput.current = 0;
            else lastInput.current = Date.now();
            return !l;
          });
        }
        return true;
      }
      if (!(e.type === 'up' || (e.type === 'touch' && !e.active) || (e.type === 'repeat' && e.button === 'menu'))) wake();
      // Hold Play/Pause for ~2 s: sleep
      if ((e.type === 'hold' || e.type === 'repeat') && e.button === 'play') {
        if (e.type === 'repeat' && e.count === 14) {
          player.pause();
          setMenuSpec(null);
          setPower('sleep');
        }
        return true;
      }
      if (input.dispatch(e)) return true;
      fallback(e);
      return true;
    });
    const fallback = (e: WheelEvent) => {
      if (e.type === 'click') {
        if (e.button === 'menu') nav.pop();
        else if (e.button === 'play') player.toggle();
        else if (e.button === 'next') player.next();
        else if (e.button === 'prev') player.prev();
      } else if ((e.type === 'hold' || e.type === 'repeat') && (e.button === 'next' || e.button === 'prev')) {
        // scan with acceleration
        const n = e.type === 'hold' ? 0 : e.count;
        const rate = n < 20 ? 0.5 : n < 50 ? 1.2 : 3;
        player.seekBy((e.button === 'next' ? 1 : -1) * rate);
      }
    };
    return () => {
      off();
      window.clearTimeout(rebootTimer);
    };
  }, [bus, input, nav, wake]);

  // ---------------------------------------------------------------- api
  const api: OSApi = useMemo(
    () => ({
      width,
      height,
      hdr,
      row,
      color,
      theme,
      caps,
      info,
      modelId,
      input,
      nav,
      setMedia,
      menu: (spec) => setMenuSpec(spec),
      hud: (text, icon) => {
        window.clearTimeout(hudTimer.current);
        setHud((h) => ({ text, icon, serial: (h?.serial ?? 0) + 1 }));
        hudTimer.current = window.setTimeout(() => setHud(null), 1300);
      },
      lockScreen: () => setLocked(true),
      runGame: (id) => setGame(id),
    }),
    [width, height, hdr, row, color, theme, caps, info, modelId, input, nav, setMedia],
  );

  // ---------------------------------------------------------------- render
  const top = stack[stack.length - 1];
  const headerStyle = top.header ?? 'light';
  const entries = leaving ? [...stack, leaving] : stack;
  const mediaVisible = !!media?.req.visible && !anim && power === 'on' && !game && media.owner === top.id;
  const mediaUnder = mediaVisible && !!media?.req.under;
  keepLit.current = power === 'on' && (mediaUnder || !!game || top.kind === 'slideshow');

  const cls = (e: Entry, i: number): string => {
    const isTop = e === top;
    if (anim?.dir === 'push') {
      if (isTop) return 'cl-scr cl-in-right';
      if (i === stack.length - 2) return 'cl-scr cl-out-left';
    } else if (anim?.dir === 'pop') {
      if (e === leaving) return 'cl-scr cl-out-right';
      if (isTop) return 'cl-scr cl-in-left';
    }
    return isTop ? 'cl-scr' : 'cl-scr cl-hidden';
  };

  const rootStyle = {
    width,
    height,
    ['--hdr' as string]: `${hdr}px`,
    ['--row' as string]: `${row}px`,
    ['--fs' as string]: `${Math.round(15 * scale)}px`,
  } as CSSProperties;

  return (
    <OSContext.Provider value={api}>
      <div className={`cl-os cl-theme-${theme} ${color ? '' : 'cl-mono'} ${mediaUnder ? 'cl-media-under' : ''}`} style={rootStyle}>
        <MediaLayer
          visible={mediaVisible}
          style={mediaVisible ? { ...media!.req.style, ...(mediaUnder ? { zIndex: 0 } : null) } : undefined}
          fit={media?.req.fit ?? 'contain'}
        />
        <div className="cl-stack">
          {entries.map((e, i) => (
            <ScreenHost key={e.id} id={e.id} active={e === top && !game && !locked && !ringing} className={cls(e, i)} padTop={(e.header ?? 'light') === 'light' ? hdr : 0}>
              {e.el}
            </ScreenHost>
          ))}
        </div>
        {(!game || ringing) && (
          <StatusBar title={ringing ? 'Alarm' : top.title} style={ringing ? 'light' : headerStyle} hold={hold} height={hdr} z={ringing ? 29 : undefined} />
        )}
        {menuSpec && <ContextMenu spec={menuSpec} onClose={() => setMenuSpec(null)} />}
        {game && <GameHost id={game} width={width} height={height} color={color} onExit={() => setGame(null)} />}
        {locked && <LockScreen onUnlock={() => setLocked(false)} />}
        {ringing && <AlarmRinging alarm={ringing} />}
        {hudState && (
          <div className="cl-hud" key={hudState.serial}>
            {hudState.icon}
            <span>{hudState.text}</span>
          </div>
        )}
        {lockFlash > 0 && power === 'on' && (
          <div className="cl-lockflash" key={lockFlash}>
            <BigLock size={56} />
          </div>
        )}
        {/* LCD: brightness, backlight, power */}
        <div className="cl-lcd-dim" style={{ opacity: Math.max(0, 0.8 - brightness) * 0.6 }} />
        <div className={`cl-backlight ${lit ? '' : 'cl-backlight-off'}`} />
        {(power === 'boot' || power === 'reboot') && (
          <div className={`cl-boot cl-boot-${bootStyle} ${power === 'reboot' ? 'cl-boot-blank' : ''}`}>
            {power === 'boot' && <AppleLogo size={Math.round(78 * scale)} className="cl-boot-logo" />}
          </div>
        )}
        <div className={`cl-sleep ${power === 'sleep' ? 'cl-sleep-on' : ''}`} />
        <div className="cl-pixels" />
      </div>
    </OSContext.Provider>
  );
}

const ScreenHost = memo(function ScreenHost({
  id,
  active,
  className,
  padTop,
  children,
}: {
  id: number;
  active: boolean;
  className: string;
  padTop: number;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ id, active }), [id, active]);
  return (
    <ScreenContext.Provider value={value}>
      <div className={className}>
        <div className="cl-scr-body" style={{ top: padTop }}>
          {children}
        </div>
      </div>
    </ScreenContext.Provider>
  );
});

// ------------------------------------------------------------------ games

const gameCache = new Map<string, LazyExoticComponent<ComponentType<GameProps>>>();

function GameHost({ id, width, height, color, onExit }: { id: string; width: number; height: number; color: boolean; onExit: () => void }) {
  const gameBus = useMemo(() => new WheelBus(), []);
  const info = GAMES.find((g) => g.id === id);
  let Comp = gameCache.get(id);
  if (!Comp && info) {
    Comp = lazy(info.load);
    gameCache.set(id, Comp);
  }
  // forward everything to the game's private bus
  useInput((e) => {
    gameBus.emit(e);
    return true;
  });
  const exit = useCallback(() => onExit(), [onExit]);
  return (
    <div className="cl-game" style={{ width, height }}>
      {Comp ? (
        <Suspense fallback={<div className="cl-game-loading">Loading…</div>}>
          <Comp bus={gameBus} width={width} height={height} onExit={exit} color={color} />
        </Suspense>
      ) : (
        <div className="cl-game-loading">Game not found</div>
      )}
    </div>
  );
}
