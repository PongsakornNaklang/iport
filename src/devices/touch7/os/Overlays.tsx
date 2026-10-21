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
import { usePresence } from './LockScreen';
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
