/**
 * Game sound effects: short synthesized tones (no audio files), scaled by
 * the iPod volume and rate-limited so a burst of collisions doesn't pile up
 * dozens of oscillators.
 */
import { playTone } from '../../../../core/sound/click';
import { useSettings } from '../../../../core/settings/store';

const last = new Map<string, number>();

function level(): number {
  const s = useSettings.getState();
  return Math.max(0, Math.min(s.volume, s.volumeLimit));
}

export interface ToneOpts {
  type?: OscillatorType;
  volume?: number;
  delayMs?: number;
  /** skip if the same key played less than `gapMs` ago */
  key?: string;
  gapMs?: number;
}

export function tone(freq: number, ms: number, opts: ToneOpts = {}): void {
  const v = level();
  if (v < 0.01) return;
  if (opts.key) {
    const now = performance.now();
    if (now - (last.get(opts.key) ?? -1e9) < (opts.gapMs ?? 35)) return;
    last.set(opts.key, now);
  }
  playTone(freq, ms, { type: opts.type ?? 'square', volume: (opts.volume ?? 0.07) * Math.sqrt(v), delayMs: opts.delayMs });
}

/** A run of notes: [frequency, duration ms][] played back to back (or with `step` ms spacing). */
export function notes(seq: [number, number][], opts: ToneOpts & { step?: number } = {}): void {
  let t = opts.delayMs ?? 0;
  for (const [f, d] of seq) {
    if (f > 0) tone(f, d, { ...opts, key: undefined, delayMs: t });
    t += opts.step ?? d;
  }
}

/** A rough explosion: a cluster of falling low square/sawtooth blips. */
export function boom(size = 1): void {
  const n = Math.round(4 + size * 3);
  for (let i = 0; i < n; i++) {
    tone(140 - i * 12 + Math.random() * 40, 70 + i * 10, { type: i % 2 ? 'sawtooth' : 'square', volume: 0.05 * size, delayMs: i * 28 });
  }
}

export const sfx = {
  select: () => tone(1320, 40, { type: 'triangle', volume: 0.06 }),
  start: () => notes([[523, 70], [659, 70], [784, 70], [1047, 140]], { type: 'square', volume: 0.05 }),
  pause: () => notes([[784, 50], [523, 80]], { type: 'triangle', volume: 0.06 }),
  resume: () => notes([[523, 50], [784, 80]], { type: 'triangle', volume: 0.06 }),
  error: () => notes([[196, 70], [147, 110]], { type: 'square', volume: 0.05 }),
  levelUp: () => notes([[523, 80], [659, 80], [784, 80], [1047, 80], [1319, 220]], { type: 'square', volume: 0.05 }),
  gameOver: () => notes([[392, 160], [330, 160], [262, 160], [196, 380]], { type: 'triangle', volume: 0.09 }),
  lifeLost: () => notes([[440, 90], [349, 90], [262, 220]], { type: 'square', volume: 0.05 }),
  powerUp: () => notes([[660, 50], [880, 50], [1320, 90]], { type: 'square', volume: 0.05 }),
  highScore: () => notes([[784, 90], [988, 90], [1175, 90], [1568, 260]], { type: 'triangle', volume: 0.08, delayMs: 700 }),
};
