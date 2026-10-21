/**
 * The click-wheel "clicker" and other UI sounds, synthesized with Web Audio
 * (no audio files needed).
 */
import { getAudioContext } from '../player/audioGraph';
import { useSettings } from '../settings/store';

let clickBuffer: AudioBuffer | null = null;

function ctx(): AudioContext | null {
  try {
    const c = getAudioContext();
    if (c.state === 'suspended') void c.resume();
    return c;
  } catch {
    return null;
  }
}

function makeClick(c: AudioContext): AudioBuffer {
  // A very short, bright tick: decaying noise burst + a little 4 kHz ping.
  const len = Math.floor(c.sampleRate * 0.012);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / c.sampleRate;
    const env = Math.exp(-t * 900);
    d[i] = ((Math.random() * 2 - 1) * 0.55 + Math.sin(2 * Math.PI * 4200 * t) * 0.45) * env;
  }
  return b;
}

/** The scroll tick. Respects the Clicker setting. */
export function playClick(volume = 0.35): void {
  const mode = useSettings.getState().clicker;
  if (mode === 'off') return;
  const c = ctx();
  if (!c) return;
  clickBuffer ??= makeClick(c);
  const src = c.createBufferSource();
  src.buffer = clickBuffer;
  const g = c.createGain();
  g.gain.value = volume;
  src.connect(g).connect(c.destination);
  src.start();
}

/** Generic short UI tone (alarms, keyboard taps, lock sound…). */
export function playTone(freq: number, durationMs: number, opts: { type?: OscillatorType; volume?: number; delayMs?: number } = {}): void {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + (opts.delayMs ?? 0) / 1000;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.value = freq;
  const v = opts.volume ?? 0.2;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(v, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + durationMs / 1000 + 0.02);
}

/** iOS-style keyboard tap. */
export function playTap(): void {
  playTone(1800, 25, { type: 'triangle', volume: 0.08 });
}

/** iOS-style lock "click". */
export function playLock(): void {
  playTone(900, 40, { type: 'square', volume: 0.05 });
  playTone(600, 50, { type: 'square', volume: 0.05, delayMs: 30 });
}

let alarmTimer: number | undefined;
/** Repeating alarm tone until stopAlarmSound(). */
export function startAlarmSound(): void {
  stopAlarmSound();
  const ring = () => {
    for (let i = 0; i < 4; i++) playTone(i % 2 ? 1320 : 990, 120, { type: 'square', volume: 0.12, delayMs: i * 150 });
  };
  ring();
  alarmTimer = window.setInterval(ring, 1100);
}
export function stopAlarmSound(): void {
  if (alarmTimer) window.clearInterval(alarmTimer);
  alarmTimer = undefined;
}
