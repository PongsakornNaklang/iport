import { useEffect, useRef, useState } from 'react';
import { dismissAlarm, snoozeAlarm, useAlarmState } from '../../../core/alarms';
import { useLibrary } from '../../../core/library/store';
import { searchLibrary, songs, tracksOfArtist, artists, albums } from '../../../core/library/selectors';
import { player } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { formatClock } from '../../../core/util/format';
import { useNow } from '../../../core/util/hooks';
import { APPS } from '../apps/registry';
import { Glyph } from './glyphs';
import { NotifCard, usePresence } from './LockScreen';
import { APPLE_LOGO, AppIcon } from './icons';
import { SearchField } from './ui';
import { Artwork } from '../../../core/library/Artwork';
import { os, usePrefs, useOS } from './store';
import { Wallpaper } from './wallpapers';

// ------------------------------------------------------------------ context menu

export function ContextMenuOverlay() {
  const menu = useOS((s) => s.menu);
  const { mounted, shown } = usePresence(!!menu, 260);
  const last = useRef(menu);
  if (menu) last.current = menu;
  const m = menu ?? last.current;
  if (!mounted || !m) return null;
  const h = m.items.length * 44 + (m.title ? 34 : 0);
  const top = Math.max(40, Math.min(568 - h - 24, m.y));
  return (
    <div className={`t7-menu-wrap ${shown ? 'shown' : ''}`} onClick={() => os.closeMenu()}>
      <div className="t7-menu" style={{ top }} onClick={(e) => e.stopPropagation()}>
        {m.title && <div className="t7-menu-title">{m.title}</div>}
        {m.items.map((it, i) => (
          <button
            key={i}
            className={`t7-menu-item ${it.destructive ? 'destructive' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              os.closeMenu();
              window.setTimeout(() => it.onPress?.(), 60);
            }}
          >
            <span>{it.label}</span>
            {it.glyph && <Glyph name={it.glyph} size={18} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ alerts / action sheets

export function AlertOverlay() {
  const alert = useOS((s) => s.alert);
  const { mounted, shown } = usePresence(!!alert, 240);
  const last = useRef(alert);
  if (alert) last.current = alert;
  const a = alert ?? last.current;
  const [input, setInput] = useState('');
  const inRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (alert?.input) {
      setInput(alert.input.value ?? '');
      const t = window.setTimeout(() => inRef.current?.focus({ preventScroll: true }), 200);
      return () => window.clearTimeout(t);
    }
  }, [alert]);
  if (!mounted || !a) return null;
  const run = (fn?: (v?: string) => void) => {
    os.closeAlert();
    window.setTimeout(() => fn?.(input), 30);
  };
  if (a.sheet) {
    const cancel = a.actions.find((x) => x.style === 'cancel');
    const rest = a.actions.filter((x) => x !== cancel);
    return (
      <div className={`t7-alert-wrap sheet ${shown ? 'shown' : ''}`} onClick={() => run(cancel?.onPress)}>
        <div className="t7-asheet" onClick={(e) => e.stopPropagation()}>
          <div className="t7-asheet-group">
            {(a.title || a.message) && (
              <div className="t7-asheet-head">
                {a.title && <b>{a.title}</b>}
                {a.message && <span>{a.message}</span>}
              </div>
            )}
            {rest.map((x, i) => (
              <button key={i} className={x.style === 'destructive' ? 'destructive' : ''} onClick={() => run(x.onPress)}>
                {x.label}
              </button>
            ))}
          </div>
          {cancel && (
            <button className="t7-asheet-cancel" onClick={() => run(cancel.onPress)}>
              {cancel.label}
            </button>
          )}
        </div>
      </div>
    );
  }
  const row = a.actions.length === 2;
  return (
    <div className={`t7-alert-wrap ${shown ? 'shown' : ''}`}>
      <div className="t7-alert">
        <div className="t7-alert-body">
          {a.title && <b>{a.title}</b>}
          {a.message && <span>{a.message}</span>}
          {a.input && (
            <input
              ref={inRef}
              className="t7-alert-input"
              value={input}
              placeholder={a.input.placeholder}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run(a.actions.find((x) => x.style !== 'cancel')?.onPress);
              }}
            />
          )}
        </div>
        <div className={`t7-alert-btns ${row ? 'row' : 'col'}`}>
          {a.actions.map((x, i) => (
            <button key={i} className={`${x.style ?? ''}`} onClick={() => run(x.onPress)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ volume HUD

export function VolumeHUD() {
  const serial = useOS((s) => s.hudSerial);
  const vol = useSettings((s) => s.volume);
  const [phase, setPhase] = useState<'off' | 'big' | 'slim'>('off');
  useEffect(() => {
    if (!serial) return;
    setPhase('big');
    const a = window.setTimeout(() => setPhase('slim'), 1100);
    const b = window.setTimeout(() => setPhase('off'), 1900);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [serial]);
  return (
    <div className={`t7-vhud ${phase}`}>
      <div className="t7-vhud-fill" style={{ height: `${vol * 100}%` }} />
      <Glyph name={vol <= 0.001 ? 'speaker.slash.fill' : vol < 0.5 ? 'speaker.wave.2.fill' : 'speaker.wave.3.fill'} size={16} className="t7-vhud-g" />
    </div>
  );
}

// ------------------------------------------------------------------ toast HUD

export function ToastOverlay() {
  const toast = useOS((s) => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 1500);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className={`t7-toast ${show ? 'on' : ''}`}>
      <Glyph name={toast.glyph} size={44} />
      <span>{toast.text}</span>
    </div>
  );
}

// ------------------------------------------------------------------ alarm

export function AlarmOverlay({ wall, dark }: { wall: string; dark: boolean }) {
  const ringing = useAlarmState((s) => s.ringing);
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  useEffect(() => {
    if (ringing) {
      const st = useOS.getState();
      if (!st.screenOn) useOS.setState({ screenOn: true });
    }
  }, [ringing]);
  if (!ringing) return null;
  const t = formatClock(now, use24h).replace(/\s?[AP]M$/, '');
  return (
    <div className="t7-alarm">
      <Wallpaper id={wall} dark={dark} dim={0.35} className="blurred" />
      <div className="t7-alarm-in">
        <div className="t7-alarm-time">{t}</div>
        <div className="t7-alarm-label">{ringing.label || 'Alarm'}</div>
        <div className="t7-alarm-btns">
          <button
            className="snooze"
            onClick={() => {
              snoozeAlarm(9);
              os.notify('clock', ringing.label || 'Alarm', 'Snoozed for 9 minutes');
            }}
          >
            Snooze
          </button>
          <button className="stop" onClick={() => dismissAlarm()}>
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Siri

interface SR {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function say(text: string) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    s.speak(u);
  } catch {
    /* no speech synthesis */
  }
}

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, a: 1, an: 1 };

/** Understands a handful of Siri requests about music, time, alarms, timers and apps. */
export function handleSiri(raw: string): string {
  const q = raw.trim().toLowerCase().replace(/[.?!]+$/, '');
  const tracks = useLibrary.getState().tracks;
  if (!q) return 'What can I help you with?';
  if (/^(pause|stop)( (the )?(music|song|playing))?$/.test(q)) {
    player.pause();
    return 'OK, paused.';
  }
  if (/^(resume|continue|play( music)?|play the music)$/.test(q)) {
    player.play();
    return 'OK.';
  }
  if (/^(next|skip)( (song|track))?/.test(q)) {
    player.next();
    return 'OK.';
  }
  if (/^(previous|go back|last)( (song|track))?/.test(q)) {
    player.prev();
    return 'OK.';
  }
  if (/shuffle/.test(q)) {
    const ids = songs(tracks).map((t) => t.id);
    if (!ids.length) return 'There’s no music on your iPod yet.';
    player.playTracks(ids, 0, { shuffle: true });
    return 'Shuffling your music.';
  }
  if (/(turn|volume) (it )?up|louder/.test(q)) {
    player.volumeBy(0.15);
    os.volumeHud();
    return 'Volume up.';
  }
  if (/(turn|volume) (it )?down|quieter|softer/.test(q)) {
    player.volumeBy(-0.15);
    os.volumeHud();
    return 'Volume down.';
  }
  let m = q.match(/^play (.+?)(?: on music)?$/);
  if (m) {
    const term = m[1].replace(/^(some|the song|the album|songs by|music by|the artist)\s+/, '');
    const ar = artists(tracks).find((a) => a.name.toLowerCase() === term || a.name.toLowerCase().includes(term));
    if (ar) {
      player.playTracks(tracksOfArtist(tracks, ar.name), 0);
      return `Here’s ${ar.name}.`;
    }
    const al = albums(tracks).find((a) => a.title.toLowerCase().includes(term));
    if (al && al.title.toLowerCase() === term) {
      player.playTracks(al.trackIds, 0);
      return `Playing ${al.title} by ${al.artist}.`;
    }
    const res = searchLibrary(tracks, term, 50).filter((t) => t.mediaType === 'music' || t.mediaType === 'musicvideo' || t.mediaType === 'radio');
    if (res.length) {
      player.playTracks(res.map((t) => t.id), 0);
      return `Now playing “${res[0].title}” by ${res[0].artist}.`;
    }
    return `I couldn’t find “${term}” in your library.`;
  }
  if (/what time|time is it/.test(q)) {
    return `It’s ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`;
  }
  if (/what('s| is) (the )?date|what day/.test(q)) {
    return `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
  }
  m = q.match(/(?:set|create|make) (?:an |a )?alarm (?:for |at )?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3]?.replace(/\./g, '');
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    useLibrary.getState().upsertAlarm({ time: (h % 24) * 60 + min, label: 'Alarm', enabled: true, repeat: [] });
    const d = new Date();
    d.setHours(h % 24, min);
    return `Your alarm’s set for ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`;
  }
  m = q.match(/(?:set|start) (?:a |the )?timer (?:for )?(\w+) (second|minute|hour)s?/);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUM[m[1]] ?? 1;
    const secs = n * (m[2] === 'hour' ? 3600 : m[2] === 'minute' ? 60 : 1);
    const t = usePrefs.getState().timer;
    usePrefs.getState().set('timer', { ...t, duration: secs, endAt: Date.now() + secs * 1000, remaining: secs });
    return `${n} ${m[2]}${n === 1 ? '' : 's'}, and counting.`;
  }
  m = q.match(/^(?:open|launch|start|go to) (.+)$/);
  if (m) {
    const name = m[1];
    const app = Object.values(APPS).find((a) => a.name.toLowerCase() === name || a.name.toLowerCase().replace(/\s/g, '') === name.replace(/\s/g, ''));
    if (app) {
      window.setTimeout(() => os.openApp(app.id), 700);
      return `Opening ${app.name}…`;
    }
  }
  if (/weather|temperature|rain/.test(q)) {
    window.setTimeout(() => os.openApp('weather'), 700);
    return 'Here’s the forecast.';
  }
  if (/who are you|your name/.test(q)) return 'I’m Siri. But enough about me — how can I help you?';
  if (/hello|hi siri|hey/.test(q)) return 'Hi there!';
  if (/thank/.test(q)) return 'You’re welcome.';
  return `Sorry, I can’t help with “${raw.trim()}” on this iPod.`;
}

export function SiriOverlay() {
  const open = useOS((s) => s.overlay === 'siri');
  const { mounted, shown } = usePresence(open, 360);
  const [heard, setHeard] = useState('');
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState('');
  const [canSpeak, setCanSpeak] = useState(true);
  const rec = useRef<SR | null>(null);
  const inRef = useRef<HTMLInputElement>(null);

  const respond = (text: string) => {
    setHeard(text);
    const a = handleSiri(text);
    setAnswer(a);
    say(a);
  };

  useEffect(() => {
    if (!open) {
      rec.current?.abort();
      rec.current = null;
      setListening(false);
      return;
    }
    setHeard('');
    setAnswer('');
    setTyped('');
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setCanSpeak(false);
      window.setTimeout(() => inRef.current?.focus({ preventScroll: true }), 300);
      return;
    }
    setCanSpeak(true);
    try {
      const r = new Ctor();
      r.lang = 'en-US';
      r.interimResults = true;
      r.continuous = false;
      let finalText = '';
      r.onresult = (e) => {
        let txt = '';
        for (let i = 0; i < e.results.length; i++) {
          txt += e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText = txt;
        }
        setHeard(txt);
      };
      r.onerror = () => {
        setCanSpeak(false);
        setListening(false);
      };
      r.onend = () => {
        setListening(false);
        if (finalText) respond(finalText);
      };
      r.start();
      rec.current = r;
      setListening(true);
    } catch {
      setCanSpeak(false);
    }
    return () => {
      rec.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;
  return (
    <div className={`t7-siri ${shown ? 'shown' : ''}`} onClick={() => os.setOverlay(null)}>
      {answer && (
        <div className="t7-siri-card" onClick={(e) => e.stopPropagation()}>
          <div className="t7-siri-answer">{answer}</div>
        </div>
      )}
      <div className="t7-siri-bottom" onClick={(e) => e.stopPropagation()}>
        {heard ? <div className="t7-siri-heard">“{heard}”</div> : <div className="t7-siri-prompt">{canSpeak ? 'What can I help you with?' : 'Type to Siri'}</div>}
        {!canSpeak && (
          <input
            ref={inRef}
            className="t7-siri-input"
            value={typed}
            placeholder="Try “Play Queen” or “Set a timer for 5 minutes”"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && typed.trim()) {
                respond(typed);
                setTyped('');
              }
            }}
          />
        )}
        <button className={`t7-siri-orb ${listening ? 'listening' : ''}`} onClick={() => !canSpeak && typed.trim() && respond(typed)} aria-label="Siri">
          <span />
          <span />
          <span />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ power

const POWER_GLYPH = (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M12 3v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <path d="M7.2 6.2a7.5 7.5 0 1 0 9.6 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
  </svg>
);

/** Held Sleep/Wake: "slide to power off", with Cancel below. */
export function PowerOverlay() {
  const open = useOS((s) => s.power === 'menu');
  const { mounted, shown } = usePresence(open, 300);
  const [x, setX] = useState(0);
  const [off, setOff] = useState(false);
  const drag = useRef<{ id: number; x0: number; k: number } | null>(null);
  const TRACK = 250;
  const KNOB = 52;
  const max = TRACK - KNOB - 8;
  useEffect(() => {
    if (open) {
      setX(0);
      setOff(false);
    }
  }, [open]);
  if (!mounted) return null;
  const end = () => {
    drag.current = null;
    if (x >= max * 0.92) {
      setX(max);
      setOff(true);
      // a moment with the spinner, then dark
      window.setTimeout(() => {
        player.pause();
        os.powerOff();
      }, 1400);
    } else setX(0);
  };
  return (
    <div className={`t7-power ${shown ? 'on' : ''} ${off ? 'off' : ''}`}>
      <div className="t7-power-track" style={{ width: TRACK }}>
        <span className="t7-power-label" style={{ opacity: Math.max(0, 1 - x / (max * 0.6)) }}>
          slide to power off
        </span>
        <div
          className="t7-power-knob"
          style={{ width: KNOB, height: KNOB, transform: `translateX(${x}px)`, transition: drag.current ? 'none' : undefined }}
          onPointerDown={(e) => {
            if (off) return;
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            const el = e.currentTarget.parentElement!;
            drag.current = { id: e.pointerId, x0: e.clientX - x / (el.offsetWidth / (el.getBoundingClientRect().width || 1)), k: el.offsetWidth / (el.getBoundingClientRect().width || 1) };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            setX(Math.max(0, Math.min(max, (e.clientX - d.x0) * d.k)));
          }}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {POWER_GLYPH}
        </div>
      </div>
      {off && <div className="t7-power-spin" />}
      {!off && (
        <button className="t7-power-cancel" onClick={() => useOS.setState({ power: 'on' })}>
          <span className="t7-power-x">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          Cancel
        </button>
      )}
    </div>
  );
}

/** Starting up: the Apple on black, then the Lock Screen. */
export function BootOverlay() {
  const booting = useOS((s) => s.power === 'boot');
  if (!booting) return null;
  return (
    <div className="t7-boot">
      <svg viewBox="0 0 170 170" width="78" height="78" aria-hidden="true">
        <path fill="#fff" d={APPLE_LOGO} />
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ banners

/** A notification while the iPod is in use: it drops in at the top, tap to open, swipe up to put it away. */
export function BannerOverlay() {
  const banner = useOS((s) => s.banner);
  const [shown, setShown] = useState<typeof banner>(null);
  const [visible, setVisible] = useState(false);
  const drag = useRef<{ y0: number; k: number; dy: number } | null>(null);
  const [dy, setDy] = useState(0);
  useEffect(() => {
    if (!banner) {
      setVisible(false);
      return;
    }
    setShown(banner);
    setDy(0);
    const r = requestAnimationFrame(() => setVisible(true));
    const t = window.setTimeout(() => os.dismissBanner(), 5000);
    return () => {
      cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, [banner]);
  if (!shown) return null;
  return (
    <div
      className={`t7-banner ${visible ? 'on' : ''}`}
      style={dy ? { transform: `translateY(${Math.min(0, dy)}px)`, transition: 'none' } : undefined}
      onTransitionEnd={() => !visible && setShown(null)}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const el = e.currentTarget;
        drag.current = { y0: e.clientY, k: el.offsetHeight / (el.getBoundingClientRect().height || 1), dy: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.dy = (e.clientY - d.y0) * d.k;
        setDy(d.dy);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        setDy(0);
        if (!d) return;
        if (d.dy < -20) os.dismissBanner();
        else if (Math.abs(d.dy) < 6) {
          os.dismissBanner();
          os.openNotification(shown);
        }
      }}
    >
      <NotifCard n={shown} />
    </div>
  );
}

// ------------------------------------------------------------------ screenshots

/** The screen flashes white, then the picture shrinks to the corner for a few seconds. */
export function ShotOverlay() {
  const shot = useOS((s) => s.shot);
  const [flash, setFlash] = useState(0);
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!shot) return;
    setFlash((f) => f + 1);
    setThumb(shot.url);
    const t = window.setTimeout(() => setThumb(null), 4500);
    return () => window.clearTimeout(t);
  }, [shot]);
  return (
    <>
      {flash > 0 && <div key={flash} className="t7-shot t7-shot-flash" />}
      {thumb && (
        <button
          className="t7-shot t7-shot-thumb"
          onClick={() => {
            setThumb(null);
            os.openApp('photos');
          }}
        >
          <img src={thumb} alt="Screenshot" draggable={false} />
        </button>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Spotlight

const SUGGESTED = ['music', 'photos', 'camera', 'settings', 'clock', 'notes', 'safari', 'weather'];

/** Swipe down on the Home Screen: search apps, music, contacts and notes. */
export function SpotlightOverlay() {
  const open = useOS((s) => s.overlay === 'spotlight');
  const { mounted, shown } = usePresence(open, 320);
  const recents = useOS((s) => s.recents);
  const tracks = useLibrary((s) => s.tracks);
  const contacts = useLibrary((s) => s.contacts);
  const notes = useLibrary((s) => s.notes);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  if (!mounted) return null;
  const close = () => os.setOverlay(null);
  const go = (fn: () => void) => {
    close();
    fn();
  };
  const query = q.trim().toLowerCase();
  const suggested = [...new Set([...recents, ...SUGGESTED])].filter((id) => APPS[id]).slice(0, 8);
  const apps = query ? Object.values(APPS).filter((a) => a.name.toLowerCase().includes(query)) : [];
  const found = query ? searchLibrary(tracks, query, 6) : [];
  const people = query ? contacts.filter((c) => `${c.firstName} ${c.lastName} ${c.company ?? ''}`.toLowerCase().includes(query)).slice(0, 4) : [];
  const memo = query ? notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(query)).slice(0, 4) : [];
  const nothing = query && !apps.length && !found.length && !people.length && !memo.length;
  return (
    <div className={`t7-spot ${shown ? 'on' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="t7-spot-bar">
        <SearchField value={q} onChange={setQ} placeholder="Search" autoFocus />
        <button className="t7-spot-cancel" onClick={close}>
          Cancel
        </button>
      </div>
      <div className="t7-spot-body">
        {!query && (
          <>
            <div className="t7-spot-h">Siri Suggestions</div>
            <div className="t7-spot-apps">
              {suggested.map((id) => (
                <button key={id} onClick={() => go(() => os.openApp(id))}>
                  <AppIcon id={id} size={56} />
                  <span>{APPS[id].name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {apps.length > 0 && (
          <>
            <div className="t7-spot-h">Applications</div>
            <div className="t7-spot-apps">
              {apps.slice(0, 8).map((a) => (
                <button key={a.id} onClick={() => go(() => os.openApp(a.id))}>
                  <AppIcon id={a.id} size={56} />
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {found.length > 0 && (
          <>
            <div className="t7-spot-h">Music</div>
            <div className="t7-spot-list">
              {found.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() =>
                    go(() => {
                      player.playTracks(
                        found.map((x) => x.id),
                        i,
                      );
                      os.openApp('music');
                    })
                  }
                >
                  <Artwork src={t.artwork} size={40} radius={5} />
                  <span className="t7-spot-txt">
                    <b>{t.title}</b>
                    <small>
                      Song · {t.artist}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {people.length > 0 && (
          <>
            <div className="t7-spot-h">Contacts</div>
            <div className="t7-spot-list">
              {people.map((c) => (
                <button key={c.id} onClick={() => go(() => os.openApp('contacts'))}>
                  <AppIcon id="contacts" size={40} />
                  <span className="t7-spot-txt">
                    <b>{`${c.firstName} ${c.lastName}`.trim() || c.company}</b>
                    <small>{c.phones[0]?.value ?? c.emails[0]?.value ?? 'Contact'}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {memo.length > 0 && (
          <>
            <div className="t7-spot-h">Notes</div>
            <div className="t7-spot-list">
              {memo.map((n) => (
                <button key={n.id} onClick={() => go(() => os.openApp('notes'))}>
                  <AppIcon id="notes" size={40} />
                  <span className="t7-spot-txt">
                    <b>{n.title || 'New Note'}</b>
                    <small>{n.body.slice(0, 60)}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {nothing && <div className="t7-spot-none">No Results</div>}
      </div>
    </div>
  );
}
