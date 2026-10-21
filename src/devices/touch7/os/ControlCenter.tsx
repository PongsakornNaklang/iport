import { useRef, useState } from 'react';
import { useCustomize } from '../../../core/customize/store';
import { player, useCurrentTrack, usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { claim, suppressNextClick, unitScale } from './gesture';
import { Glyph } from './glyphs';
import { usePresence } from './LockScreen';
import { os, usePrefs, useOS, type Prefs } from './store';

const U = 62;
const G = 14;
const X0 = 15;
const Y0 = 62;
const col = (i: number) => X0 + i * (U + G);
const row = (i: number) => Y0 + i * (U + G);

export function ControlCenter({ dark }: { dark: boolean }) {
  const overlay = useOS((s) => s.overlay);
  const edgeDrag = useOS((s) => s.edgeDrag);
  const open = overlay === 'cc';
  const dragging = edgeDrag?.kind === 'cc';
  const { mounted, shown } = usePresence(open || dragging, 420);
  const [dy, setDy] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; y0: number; k: number; on: boolean; v: number; t: number; dy: number } | null>(null);
  if (!mounted) return null;
  const p = dragging ? edgeDrag!.p : open && shown ? 1 : 0;
  const k = Math.min(1, p * 1.2);
  const close = () => os.setOverlay(null);
  return (
    <div
      ref={ref}
      className={`t7-cc ${dragging || drag.current?.on ? 'instant' : ''}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const el = ref.current!;
        drag.current = { id: e.pointerId, y0: e.clientY, k: unitScale(el).ky, on: false, v: 0, t: performance.now(), dy: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const ddy = (e.clientY - d.y0) * d.k;
        if (!d.on) {
          if (ddy < 10) return;
          if (!claim(e.pointerId, ref.current!)) {
            drag.current = null;
            return;
          }
          d.on = true;
          ref.current!.setPointerCapture(e.pointerId);
        }
        const t2 = performance.now();
        d.v = (ddy - d.dy) / Math.max(1, t2 - d.t);
        d.t = t2;
        d.dy = Math.max(0, ddy);
        setDy(d.dy);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d?.on) return;
        suppressNextClick();
        setDy(0);
        if (d.dy > 110 || d.v > 0.5) close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('t7-cc-grid')) close();
      }}
    >
      <div className="t7-cc-bg" style={{ opacity: k * Math.max(0, 1 - dy / 500) }} />
      <div className="t7-cc-grid" style={{ transform: `translate3d(0, calc(${(1 - k) * 100}% + ${dy}px), 0)` }} data-dark={dark || undefined}>
        <button className="t7-cc-chevron" onClick={close} aria-label="Close">
          <Glyph name="chevron.down" size={26} />
        </button>
        <Connectivity />
        <NowPlayingModule />
        <ToggleModule x={col(0)} y={row(2)} k="rotationLock" glyph="lock.rotation" onColor="#fff" glyphOn="#ff3b30" />
        <MirrorModule />
        <VSlider x={col(2)} y={row(2)} kind="brightness" />
        <VSlider x={col(3)} y={row(2)} kind="volume" />
        <FocusModule />
        <Shortcut x={col(0)} y={row(4)} glyph="timer" onPress={() => os.openAppWith('clock', 'timer')} />
        <Shortcut x={col(1)} y={row(4)} glyph="calculator" onPress={() => os.openApp('calculator')} />
        <Shortcut x={col(2)} y={row(4)} glyph="camera.fill" onPress={() => os.openApp('camera')} />
        <DarkModeModule />
        <Shortcut x={col(0)} y={row(5)} glyph="alarm.fill" onPress={() => os.openAppWith('clock', 'alarm')} />
        <Shortcut x={col(1)} y={row(5)} glyph="stopwatch" onPress={() => os.openAppWith('clock', 'stopwatch')} />
        <Shortcut x={col(2)} y={row(5)} glyph="square.and.pencil" onPress={() => os.openAppWith('notes', 'new')} />
        <Shortcut x={col(3)} y={row(5)} glyph="waveform" onPress={() => os.openAppWith('voicememos', 'record')} />
      </div>
    </div>
  );
}

function Connectivity() {
  const airplane = usePrefs((s) => s.airplane);
  const wifi = usePrefs((s) => s.wifi);
  const bt = usePrefs((s) => s.bluetooth);
  const set = usePrefs((s) => s.set);
  const [airdrop, setAirdrop] = useState(false);
  const btn = (on: boolean, glyph: string, color: string, onPress: () => void, label: string) => (
    <button className={`t7-cc-round ${on ? 'on' : ''}`} style={on ? { background: color } : undefined} onClick={onPress} aria-label={label}>
      <Glyph name={glyph} size={22} />
    </button>
  );
  return (
    <div className="t7-cc-mod t7-cc-conn" style={{ left: col(0), top: row(0), width: 2 * U + G, height: 2 * U + G }}>
      {btn(airplane, 'airplane', '#ff9500', () => {
        const v = !airplane;
        set('airplane', v);
        if (v) {
          set('wifi', false);
          set('bluetooth', false);
        }
      }, 'Airplane Mode')}
      {btn(airdrop, 'airdrop', '#0a84ff', () => setAirdrop(!airdrop), 'AirDrop')}
      {btn(wifi, 'wifi', '#0a84ff', () => set('wifi', !wifi), 'Wi-Fi')}
      {btn(bt, 'bluetooth', '#0a84ff', () => set('bluetooth', !bt), 'Bluetooth')}
    </div>
  );
}

function NowPlayingModule() {
  const t = useCurrentTrack();
  const status = usePlayer((s) => s.status);
  const playing = status === 'playing' || status === 'loading';
  return (
    <div className="t7-cc-mod t7-cc-np" style={{ left: col(2), top: row(0), width: 2 * U + G, height: 2 * U + G }}>
      <Glyph name="airplayaudio" size={18} className="t7-cc-np-air" />
      <div className="t7-cc-np-text" onClick={() => t && os.openAppWith('music', 'nowplaying')}>
        <div className="t">{t ? t.title : 'Not Playing'}</div>
        {t && <div className="a">{t.artist}</div>}
      </div>
      <div className="t7-cc-np-ctrls">
        <button onClick={() => player.prev()} aria-label="Previous">
          <Glyph name="backward.fill" size={20} />
        </button>
        <button onClick={() => player.toggle()} aria-label="Play/Pause">
          <Glyph name={playing ? 'pause.fill' : 'play.fill'} size={24} />
        </button>
        <button onClick={() => player.next()} aria-label="Next">
          <Glyph name="forward.fill" size={20} />
        </button>
      </div>
    </div>
  );
}

function ToggleModule({ x, y, k, glyph, onColor, glyphOn }: { x: number; y: number; k: keyof Prefs; glyph: string; onColor: string; glyphOn: string }) {
  const on = usePrefs((s) => s[k]) as boolean;
  const set = usePrefs((s) => s.set);
  return (
    <button
      className={`t7-cc-mod t7-cc-btn ${on ? 'on' : ''}`}
      style={{ left: x, top: y, width: U, height: U, background: on ? onColor : undefined, color: on ? glyphOn : undefined }}
      onClick={() => {
        set(k, !on as never);
        if (k === 'rotationLock' && !on) os.setLandscape(false);
      }}
    >
      <Glyph name={glyph} size={26} />
    </button>
  );
}

function MirrorModule() {
  return (
    <button className="t7-cc-mod t7-cc-btn" style={{ left: col(1), top: row(2), width: U, height: U }} onClick={() => os.toast('Looking for Apple TV…', 'rectangle.on.rectangle')}>
      <Glyph name="rectangle.on.rectangle" size={24} />
    </button>
  );
}

function FocusModule() {
  const on = usePrefs((s) => s.focus);
  const set = usePrefs((s) => s.set);
  return (
    <button className={`t7-cc-mod t7-cc-focus ${on ? 'on' : ''}`} style={{ left: col(0), top: row(3), width: 2 * U + G, height: U }} onClick={() => set('focus', !on)}>
      <span className="ic">
        <Glyph name="moon.fill" size={18} />
      </span>
      <span className="lbl">
        {on ? 'Do Not Disturb' : 'Focus'}
        {on && <small>On</small>}
      </span>
    </button>
  );
}

function DarkModeModule() {
  const dark = useCustomize((s) => !!s.appearances[s.modelId]?.options?.darkMode);
  return (
    <button
      className={`t7-cc-mod t7-cc-btn ${dark ? 'on' : ''}`}
      style={{ left: col(3), top: row(4), width: U, height: U, background: dark ? '#fff' : undefined, color: dark ? '#000' : undefined }}
      onClick={() => useCustomize.getState().setOption('darkMode', !dark)}
      aria-label="Dark Mode"
    >
      <Glyph name="circle.lefthalf.filled" size={26} />
    </button>
  );
}

function Shortcut({ x, y, glyph, onPress }: { x: number; y: number; glyph: string; onPress: () => void }) {
  return (
    <button className="t7-cc-mod t7-cc-btn" style={{ left: x, top: y, width: U, height: U }} onClick={onPress}>
      <Glyph name={glyph} size={26} />
    </button>
  );
}

function VSlider({ x, y, kind }: { x: number; y: number; kind: 'brightness' | 'volume' }) {
  const value = useSettings((s) => (kind === 'brightness' ? s.brightness : s.volume));
  const st = useRef<{ y0: number; v0: number; k: number } | null>(null);
  const [active, setActive] = useState(false);
  const set = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    if (kind === 'brightness') useSettings.getState().set('brightness', Math.max(0.05, c));
    else player.setVolume(c);
  };
  const h = 2 * U + G;
  const glyph = kind === 'brightness' ? 'sun.max.fill' : value <= 0.01 ? 'speaker.slash.fill' : value < 0.5 ? 'speaker.wave.2.fill' : 'speaker.wave.3.fill';
  return (
    <div
      className={`t7-cc-mod t7-cc-vslider ${active ? 'active' : ''}`}
      style={{ left: x, top: y, width: U, height: h }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        claim(e.pointerId, e.currentTarget);
        e.currentTarget.setPointerCapture(e.pointerId);
        e.stopPropagation();
        st.current = { y0: e.clientY, v0: value, k: unitScale(e.currentTarget).ky };
        setActive(true);
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s) return;
        set(s.v0 - ((e.clientY - s.y0) * s.k) / h);
      }}
      onPointerUp={() => {
        st.current = null;
        setActive(false);
      }}
      onPointerCancel={() => {
        st.current = null;
        setActive(false);
      }}
    >
      <div className="t7-cc-vfill" style={{ height: `${value * 100}%` }} />
      <Glyph name={glyph} size={24} className="t7-cc-vglyph" />
    </div>
  );
}
