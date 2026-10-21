import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { player, useCurrentTrack, usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { formatTime } from '../../../core/util/format';
import { useNow } from '../../../core/util/hooks';
import { isTypingTarget } from '../../../shell/keyboard';
import { claim, suppressNextClick } from './gesture';
import { Glyph } from './glyphs';
import { AppIcon } from './icons';
import { os, useOS, type Notif } from './store';
import { Slider } from './ui';
import { Wallpaper } from './wallpapers';
import { playTap } from '../../../core/sound/click';

/** mount/unmount with enter/exit transitions */
export function usePresence(open: boolean, ms = 420): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  useLayoutEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);
  return { mounted, shown };
}

function bigTime(d: Date, use24h: boolean): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return use24h ? `${h.toString().padStart(2, '0')}:${m}` : `${h % 12 || 12}:${m}`;
}
function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function ago(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function LockScreen({ wall, dark }: { wall: string; dark: boolean }) {
  const locked = useOS((s) => s.locked);
  const passcode = useOS((s) => s.passcode);
  const screenOn = useOS((s) => s.screenOn);
  const overlay = useOS((s) => s.overlay);
  const { mounted, shown } = usePresence(locked, 460);
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  const notifs = useOS((s) => s.notifications);
  const hasTrack = usePlayer((s) => !!s.currentId);
  const ref = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [wakeKey, setWakeKey] = useState(0);
  useEffect(() => {
    if (screenOn) setWakeKey((k) => k + 1);
  }, [screenOn]);

  const drag = useRef<{ id: number; y0: number; k: number; on: boolean; dy: number; v: number; t: number } | null>(null);
  const setDy = (dy: number, anim: boolean) => {
    const c = content.current;
    if (!c) return;
    c.style.transition = anim ? 'transform 380ms cubic-bezier(0.2,0.9,0.3,1), opacity 380ms' : 'none';
    c.style.transform = dy ? `translate3d(0, ${dy}px, 0)` : '';
    c.style.opacity = dy ? String(Math.max(0, 1 + dy / 300)) : '';
  };

  if (!mounted) return null;
  return (
    <div
      ref={ref}
      className={`t7-lock ${shown ? 'shown' : ''} ${passcode ? 'with-passcode' : ''}`}
      onPointerDown={(e) => {
        if (e.button !== 0 || passcode) return;
        if ((e.target as HTMLElement).closest('button, .t7-slider, .t7-np-widget .t7-np-scrub')) return;
        const el = ref.current!;
        drag.current = { id: e.pointerId, y0: e.clientY, k: el.offsetHeight / (el.getBoundingClientRect().height || 1), on: false, dy: 0, v: 0, t: performance.now() };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dy = (e.clientY - d.y0) * d.k;
        if (!d.on) {
          if (dy > -10) return;
          if (!claim(e.pointerId, ref.current!)) {
            drag.current = null;
            return;
          }
          d.on = true;
          ref.current!.setPointerCapture(e.pointerId);
        }
        const now2 = performance.now();
        d.v = (dy - d.dy) / Math.max(1, now2 - d.t);
        d.t = now2;
        d.dy = Math.min(0, dy);
        setDy(d.dy, false);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d?.on) return;
        suppressNextClick();
        if (d.dy < -110 || d.v < -0.5) {
          setDy(-600, true);
          window.setTimeout(() => {
            os.unlock();
            setDy(0, false);
          }, 200);
        } else setDy(0, true);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDy(0, true);
      }}
    >
      <Wallpaper id={wall} dark={dark} dim={dark ? 0.12 : 0} className={passcode ? 'blurred' : ''} />
      <div ref={content} className={`t7-lock-content ${passcode || overlay === 'cc' ? 'faded' : ''}`}>
        <div className="t7-lock-clock" key={wakeKey}>
          <div className="t7-lock-time">{bigTime(now, use24h)}</div>
          <div className="t7-lock-date">{longDate(now)}</div>
        </div>
        <div className="t7-lock-list">
          {hasTrack && <NowPlayingWidget />}
          {notifs.map((n) => (
            <NotifCard key={n.id} n={n} />
          ))}
        </div>
        <div className="t7-lock-hint">Press home to unlock</div>
      </div>
      {passcode && <Passcode />}
    </div>
  );
}

function NotifCard({ n, onOpen }: { n: Notif; onOpen?: () => void }) {
  return (
    <div className="t7-notif" onClick={onOpen}>
      <AppIcon id={n.app} size={34} />
      <div className="t7-notif-main">
        <div className="t7-notif-top">
          <b>{n.title}</b>
          <span>{ago(n.time)}</span>
        </div>
        <div className="t7-notif-body">{n.body}</div>
      </div>
    </div>
  );
}

/** Lock-screen / Notification Center media controls. */
export function NowPlayingWidget() {
  const t = useCurrentTrack();
  const status = usePlayer((s) => s.status);
  const pos = usePlayer((s) => s.position);
  const dur = usePlayer((s) => s.duration);
  const vol = useSettings((s) => s.volume);
  const [scrub, setScrub] = useState<number | null>(null);
  if (!t) return null;
  const playing = status === 'playing' || status === 'loading';
  const d = dur || t.duration || 0;
  const p = scrub ?? (d ? pos / d : 0);
  return (
    <div className="t7-np-widget" onClick={(e) => e.stopPropagation()}>
      <div className="t7-npw-head">
        <Artwork src={t.artwork} size={44} radius={6} />
        <div className="t7-npw-text">
          <div className="t7-npw-title">{t.title}</div>
          <div className="t7-npw-artist">{t.artist}</div>
        </div>
        <Glyph name="airplayaudio" size={20} className="t7-npw-air" />
      </div>
      <Slider
        className="t7-np-scrub mini"
        value={p}
        thumb={false}
        onChange={(v) => setScrub(v)}
        onEnd={(v) => {
          setScrub(null);
          if (d) player.seek(v * d);
        }}
      />
      <div className="t7-npw-times">
        <span>{formatTime(p * d)}</span>
        <span>-{formatTime(Math.max(0, d - p * d))}</span>
      </div>
      <div className="t7-npw-ctrls">
        <button onClick={() => player.prev()} aria-label="Previous">
          <Glyph name="backward.fill" size={26} />
        </button>
        <button onClick={() => player.toggle()} aria-label={playing ? 'Pause' : 'Play'}>
          <Glyph name={playing ? 'pause.fill' : 'play.fill'} size={30} />
        </button>
        <button onClick={() => player.next()} aria-label="Next">
          <Glyph name="forward.fill" size={26} />
        </button>
      </div>
      <Slider className="t7-np-vol mini" value={vol} thumb={false} onChange={(v) => player.setVolume(v)} minGlyph="speaker.fill" maxGlyph="speaker.wave.3.fill" />
    </div>
  );
}

// ------------------------------------------------------------------ passcode

const KEYS: [string, string][] = [
  ['1', ''],
  ['2', 'A B C'],
  ['3', 'D E F'],
  ['4', 'G H I'],
  ['5', 'J K L'],
  ['6', 'M N O'],
  ['7', 'P Q R S'],
  ['8', 'T U V'],
  ['9', 'W X Y Z'],
];

function Passcode() {
  const code = useSettings((s) => s.lockCode);
  const [entry, setEntry] = useState('');
  const [shake, setShake] = useState(false);
  const len = Math.max(4, code.length);
  const press = (k: string) => {
    playTap();
    setEntry((e) => {
      const next = (e + k).slice(0, len);
      if (next.length === len) {
        window.setTimeout(() => {
          if (next === code) os.passcodeOK();
          else {
            setShake(true);
            window.setTimeout(() => {
              setShake(false);
              setEntry('');
            }, 450);
          }
        }, 120);
      }
      return next;
    });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setEntry((x) => x.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="t7-passcode">
      <Glyph name="lock.fill" size={16} />
      <div className="t7-pc-title">Enter Passcode</div>
      <div className={`t7-pc-dots ${shake ? 'shake' : ''}`}>
        {Array.from({ length: len }, (_, i) => (
          <span key={i} className={i < entry.length ? 'on' : ''} />
        ))}
      </div>
      <div className="t7-pc-keys">
        {KEYS.map(([n, l]) => (
          <button key={n} onClick={() => press(n)}>
            <b>{n}</b>
            {l && <small>{l}</small>}
          </button>
        ))}
        <span />
        <button onClick={() => press('0')}>
          <b>0</b>
        </button>
        <span />
      </div>
      <div className="t7-pc-bottom">
        <button onClick={() => os.toast('No SIM — iPod', 'info.circle')}>Emergency</button>
        <button onClick={() => (entry ? setEntry((x) => x.slice(0, -1)) : useOS.setState({ passcode: false }))}>{entry ? 'Delete' : 'Cancel'}</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Notification Center

export function NotificationCenter({ wall, dark }: { wall: string; dark: boolean }) {
  const overlay = useOS((s) => s.overlay);
  const edgeDrag = useOS((s) => s.edgeDrag);
  const notifs = useOS((s) => s.notifications);
  const open = overlay === 'nc';
  const dragging = edgeDrag?.kind === 'nc';
  const { mounted, shown } = usePresence(open || dragging, 420);
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  const hasTrack = usePlayer((s) => !!s.currentId);
  const ref = useRef<HTMLDivElement>(null);
  const [dy, setDy] = useState(0);
  const drag = useRef<{ id: number; y0: number; k: number; on: boolean; v: number; t: number; dy: number } | null>(null);
  if (!mounted) return null;
  const p = dragging ? edgeDrag!.p : open && shown ? 1 : 0;
  const y = -(1 - Math.min(1, p * 1.15)) * 100;
  return (
    <div
      ref={ref}
      className={`t7-nc ${dragging || drag.current?.on ? 'instant' : ''}`}
      style={{ transform: `translate3d(0, calc(${y}% + ${dy}px), 0)` }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const el = ref.current!;
        drag.current = { id: e.pointerId, y0: e.clientY, k: el.offsetHeight / (el.getBoundingClientRect().height || 1), on: false, v: 0, t: performance.now(), dy: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const ddy = (e.clientY - d.y0) * d.k;
        if (!d.on) {
          if (ddy > -10) return;
          if (!claim(e.pointerId, ref.current!)) return;
          d.on = true;
          ref.current!.setPointerCapture(e.pointerId);
        }
        const t2 = performance.now();
        d.v = (ddy - d.dy) / Math.max(1, t2 - d.t);
        d.t = t2;
        d.dy = Math.min(0, ddy);
        setDy(d.dy);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d?.on) return;
        suppressNextClick();
        setDy(0);
        if (d.dy < -100 || d.v < -0.5) os.setOverlay(null);
      }}
    >
      <Wallpaper id={wall} dark={dark} dim={0.25} className="blurred" />
      <div className="t7-lock-content">
        <div className="t7-lock-clock">
          <div className="t7-lock-time">{bigTime(now, use24h)}</div>
          <div className="t7-lock-date">{longDate(now)}</div>
        </div>
        <div className="t7-lock-list">
          {hasTrack && <NowPlayingWidget />}
          {notifs.length > 0 && (
            <div className="t7-nc-head">
              <span>Notification Center</span>
              <button onClick={() => os.clearNotifications()}>
                <Glyph name="xmark" size={10} />
              </button>
            </div>
          )}
          {notifs.map((n) => (
            <NotifCard
              key={n.id}
              n={n}
              onOpen={() => {
                os.setOverlay(null);
                os.openApp(n.app);
              }}
            />
          ))}
          {!notifs.length && <div className="t7-nc-empty">No Older Notifications</div>}
        </div>
      </div>
      <div className="t7-nc-grabber" />
    </div>
  );
}
