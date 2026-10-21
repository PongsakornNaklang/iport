/**
 * The 320×568 screen: every layer of the simulated iOS lives here.
 */
import { useRef, type CSSProperties } from 'react';
import type { Appearance } from '../../types';
import { MediaLayer } from '../../../core/player/MediaLayer';
import { useSettings } from '../../../core/settings/store';
import { formatClock } from '../../../core/util/format';
import { useBattery, useNow } from '../../../core/util/hooks';
import { useLibrary } from '../../../core/library/store';
import { APPS } from '../apps/registry';
import { AppHost } from './AppHost';
import { ControlCenter } from './ControlCenter';
import { claim, localPoint } from './gesture';
import { Glyph } from './glyphs';
import { HomeScreen } from './HomeScreen';
import { LockScreen, NotificationCenter } from './LockScreen';
import { useMediaSlots } from './media';
import { AlarmOverlay, AlertOverlay, ContextMenuOverlay, SiriOverlay, ToastOverlay, VolumeHUD } from './Overlays';
import { usePrefs, useBarOverrides, useOS } from './store';
import { VideoPlayer } from '../apps/VideoPlayer';
import { useAlarmState } from '../../../core/alarms';
import { TimerWatcher } from '../apps/timerWatch';

export const SCREEN_W = 320;
export const SCREEN_H = 568;

export function Screen({ appearance }: { appearance: Appearance }) {
  const dark = !!appearance.options.darkMode;
  const wall = String(appearance.options.wallpaper ?? 'ios15');
  const screenOn = useOS((s) => s.screenOn);
  const landscape = useOS((s) => s.landscape);
  const brightness = useSettings((s) => s.brightness);
  const ref = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------- edge gestures
  const edge = useRef<{ id: number; kind: 'cc' | 'nc'; y0: number; k: number; on: boolean; t: number; p: number; v: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    edge.current = null;
    if (e.button !== 0) return;
    const st = useOS.getState();
    if (!st.screenOn || st.overlay || st.videoOpen || st.passcode || st.alert || st.menu) return;
    if (useAlarmState.getState().ringing) return;
    const el = ref.current!;
    const p = localPoint(el, e.clientX, e.clientY);
    const k = el.offsetHeight / (el.getBoundingClientRect().height || 1);
    if (p.y >= SCREEN_H - 22) edge.current = { id: e.pointerId, kind: 'cc', y0: e.clientY, k, on: false, t: performance.now(), p: 0, v: 0 };
    else if (p.y <= 22 && !st.locked) edge.current = { id: e.pointerId, kind: 'nc', y0: e.clientY, k, on: false, t: performance.now(), p: 0, v: 0 };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = edge.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = (e.clientY - g.y0) * g.k;
    const dist = g.kind === 'cc' ? -dy : dy;
    if (!g.on) {
      if (dist < 10) {
        if (dist < -12) edge.current = null;
        return;
      }
      if (!claim(e.pointerId, ref.current!)) {
        edge.current = null;
        return;
      }
      g.on = true;
      ref.current!.setPointerCapture(e.pointerId);
    }
    const p = Math.max(0, Math.min(1, dist / (SCREEN_H * 0.85)));
    const now = performance.now();
    g.v = (p - g.p) / Math.max(1, now - g.t);
    g.t = now;
    g.p = p;
    useOS.setState({ edgeDrag: { kind: g.kind, p } });
  };
  const onUp = (e: React.PointerEvent) => {
    const g = edge.current;
    edge.current = null;
    if (!g || g.id !== e.pointerId || !g.on) return;
    const open = g.p > 0.25 || g.v > 0.0015;
    useOS.setState(open ? { overlay: g.kind, edgeDrag: null, menu: null } : { edgeDrag: null });
  };

  // ---------------------------------------------------------------- media layer slot
  const slots = useMediaSlots((s) => s.slots);
  const slot = slots[slots.length - 1];
  let mediaStyle: CSSProperties | undefined;
  if (slot?.rect) {
    if (slot.landscape) {
      mediaStyle = {
        inset: 'auto',
        left: (SCREEN_W - SCREEN_H) / 2,
        top: (SCREEN_H - SCREEN_W) / 2,
        width: SCREEN_H,
        height: SCREEN_W,
        transform: 'rotate(90deg)',
        zIndex: slot.z,
      };
    } else {
      mediaStyle = { inset: 'auto', ...slot.rect, borderRadius: slot.radius, zIndex: slot.z };
    }
  }

  const dim = Math.max(0, Math.min(0.75, (1 - brightness) * 0.85));

  return (
    <div
      ref={ref}
      className={`t7-screen ${dark ? 't7-dark' : 't7-light'} ${landscape ? 'is-landscape' : ''}`}
      data-control=""
      onPointerDownCapture={onDown}
      onPointerMoveCapture={onMove}
      onPointerUpCapture={onUp}
      onPointerCancelCapture={onUp}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <HomeScreen wall={wall} dark={dark} />
      <AppHost wall={wall} dark={dark} />
      <MediaLayer visible={!!slot?.rect} style={mediaStyle} fit={slot?.fit ?? 'cover'} />
      <VideoPlayer />
      <NotificationCenter wall={wall} dark={dark} />
      <ControlCenter dark={dark} />
      <LockScreen wall={wall} dark={dark} />
      <SiriOverlay />
      <AlarmOverlay wall={wall} dark={dark} />
      <StatusBar dark={dark} />
      <ContextMenuOverlay />
      <AlertOverlay />
      <VolumeHUD />
      <ToastOverlay />
      <TimerWatcher />
      <div className="t7-bright" style={{ opacity: dim }} />
      <div className={`t7-off ${screenOn ? '' : 'on'}`} />
    </div>
  );
}

// ------------------------------------------------------------------ status bar

function StatusBar({ dark }: { dark: boolean }) {
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  const battery = useBattery();
  const pct = usePrefs((s) => s.batteryPercent);
  const wifi = usePrefs((s) => s.wifi);
  const airplane = usePrefs((s) => s.airplane);
  const rotLock = usePrefs((s) => s.rotationLock);
  const focus = usePrefs((s) => s.focus);
  const bt = usePrefs((s) => s.bluetooth);
  const locked = useOS((s) => s.locked);
  const app = useOS((s) => s.app);
  const overlay = useOS((s) => s.overlay);
  const edgeDrag = useOS((s) => s.edgeDrag);
  const videoOpen = useOS((s) => s.videoOpen);
  const landscape = useOS((s) => s.landscape);
  const passcode = useOS((s) => s.passcode);
  const overrides = useBarOverrides((s) => s.list);
  const alarmOn = useLibrary((s) => s.alarms.some((a) => a.enabled));
  const ringing = useAlarmState((s) => s.ringing);

  let style: 'light' | 'dark' | 'hidden' = 'light';
  if (locked || overlay || edgeDrag || ringing) style = 'light';
  else if (app) {
    const def = APPS[app];
    style = def?.status === 'auto' ? (dark ? 'light' : 'dark') : def?.status ?? 'dark';
    const o = [...overrides].reverse().find((x) => x.app === app);
    if (o) style = o.style;
  }
  if (overlay === 'cc' || (edgeDrag?.kind === 'cc' && edgeDrag.p > 0.5)) style = 'hidden';
  if (videoOpen || landscape) style = 'hidden';
  const lockGlyph = locked && !passcode && !ringing && overlay !== 'cc';
  const level = Math.round(battery.level * 100);

  return (
    <div className={`t7-status ${style}`}>
      <div className="t7-status-l">
        {airplane ? (
          <Glyph name="airplane" size={13} />
        ) : (
          <>
            <span className="t7-status-name">iPod</span>
            {wifi && <Glyph name="wifi" size={14} className="t7-status-wifi" />}
          </>
        )}
      </div>
      <div className="t7-status-c">{lockGlyph ? <Glyph name="lock.fill" size={12} /> : formatClock(now, use24h)}</div>
      <div className="t7-status-r">
        {focus && <Glyph name="moon.fill" size={11} />}
        {rotLock && <Glyph name="lock.rotation" size={13} />}
        {alarmOn && <Glyph name="alarm.fill" size={11} />}
        {bt && !airplane && <Glyph name="bluetooth" size={11} />}
        {pct && <span className="t7-status-pct">{level}%</span>}
        <span className={`t7-batt ${battery.charging ? 'charging' : ''} ${level <= 20 ? 'low' : ''}`}>
          <span className="t7-batt-fill" style={{ width: `${Math.max(4, level)}%` }} />
          {battery.charging && <Glyph name="bolt" size={9} className="t7-batt-bolt" />}
        </span>
      </div>
    </div>
  );
}
