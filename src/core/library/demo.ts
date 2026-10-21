/**
 * First-run content. Four short original songs are synthesized right in the
 * browser (OfflineAudioContext → WAV) with generated cover art, plus a few
 * well-known YouTube videos so streaming works out of the box.
 */
import { putBlob } from '../db';
import { uid } from '../util/id';
import type { Track } from '../types';
import { useLibrary } from './store';

const SR = 22050;

interface SongSpec {
  title: string;
  bpm: number;
  bars: number;
  /** semitones from A2 (110 Hz) for each bar's chord root */
  roots: number[];
  minor: boolean;
  genre: string;
  lead: number[]; // scale degrees, -1 = rest (8th notes, loops)
  hue: number;
  swing?: number;
  style: 'electro' | 'chill' | 'pop' | 'lofi';
}

const SONGS: SongSpec[] = [
  { title: 'Click Wheel', bpm: 122, bars: 20, roots: [0, -4, 3, -2], minor: true, genre: 'Electronic', lead: [0, 2, 4, 2, 7, 4, 2, -1, 0, 2, 4, 5, 4, 2, 0, -1], hue: 205, style: 'electro' },
  { title: 'Cover Flow', bpm: 90, bars: 16, roots: [8, 5, 1, 3], minor: false, genre: 'Chillwave', lead: [4, -1, 2, 4, 5, -1, 4, 2, 0, -1, 2, -1, 4, 2, 1, -1], hue: 280, style: 'chill', swing: 0.12 },
  { title: 'Hold Switch', bpm: 128, bars: 20, roots: [3, 8, 0, 10], minor: false, genre: 'Pop', lead: [0, 0, 4, 4, 5, 4, 2, -1, 2, 2, 4, 2, 0, -1, -1, -1], hue: 340, style: 'pop' },
  { title: 'Shuffle Songs', bpm: 78, bars: 12, roots: [5, 3, 0, 0], minor: true, genre: 'Hip Hop', lead: [7, -1, 4, -1, 5, 4, 2, -1, 4, -1, 2, 0, -1, -1, 2, -1], hue: 30, style: 'lofi', swing: 0.2 },
  { title: 'On-The-Go', bpm: 104, bars: 16, roots: [0, 7, 9, 5], minor: false, genre: 'Pop', lead: [4, 4, 5, 7, -1, 7, 5, 4, 2, -1, 0, 2, 4, -1, 2, -1], hue: 160, style: 'chill', swing: 0.08 },
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

const hz = (semi: number) => 110 * Math.pow(2, semi / 12);

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

async function renderSong(s: SongSpec): Promise<AudioBuffer> {
  const beat = 60 / s.bpm;
  const bar = beat * 4;
  const length = s.bars * bar + 2;
  const ctx = new OfflineAudioContext(2, Math.ceil(length * SR), SR);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  const noise = noiseBuffer(ctx, 1);
  const scale = s.minor ? MINOR : MAJOR;

  // one echo for the whole song (a feedback loop per note is very slow to render)
  const leadBus = ctx.createGain();
  const delay = ctx.createDelay();
  delay.delayTime.value = (60 / s.bpm) * 0.75;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  leadBus.connect(master);
  leadBus.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(master);

  // fade in/out
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.8, 1.5);
  master.gain.setValueAtTime(0.8, length - 4);
  master.gain.linearRampToValueAtTime(0, length - 0.5);

  const sw = (i: number) => (i % 2 === 1 ? (s.swing ?? 0) * beat * 0.5 : 0);

  for (let b = 0; b < s.bars; b++) {
    const t0 = b * bar;
    const root = s.roots[b % s.roots.length];
    const third = s.minor ? 3 : 4;
    const section = b < 4 ? 0 : b >= s.bars - 2 ? 2 : 1; // intro / main / outro

    // pad chord
    for (const iv of [0, third, 7, 12]) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = s.style === 'lofi' ? 'triangle' : 'sawtooth';
        o.frequency.value = hz(root + iv + 12);
        o.detune.value = det;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = s.style === 'chill' ? 900 : s.style === 'lofi' ? 700 : 1500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.025, t0 + 0.15);
        g.gain.setValueAtTime(0.025, t0 + bar - 0.1);
        g.gain.linearRampToValueAtTime(0, t0 + bar);
        o.connect(f).connect(g).connect(master);
        o.start(t0);
        o.stop(t0 + bar + 0.05);
      }
    }

    // bass
    for (let i = 0; i < 8; i++) {
      if (s.style === 'lofi' && i % 2) continue;
      const t = t0 + i * (beat / 2) + sw(i);
      const o = ctx.createOscillator();
      o.type = s.style === 'electro' ? 'square' : 'sine';
      o.frequency.value = hz(root - 12 + (i === 6 && s.style === 'pop' ? 7 : 0));
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.45);
      o.connect(f).connect(g).connect(master);
      o.start(t);
      o.stop(t + beat * 0.5);
    }

    // lead melody (not in the intro), through the shared echo bus
    if (section === 1) {
      for (let i = 0; i < 8; i++) {
        const deg = s.lead[(b * 8 + i) % s.lead.length];
        if (deg < 0) continue;
        const t = t0 + i * (beat / 2) + sw(i);
        const o = ctx.createOscillator();
        o.type = s.style === 'chill' ? 'sine' : s.style === 'lofi' ? 'triangle' : 'square';
        o.frequency.value = hz(s.roots[0] + 24 + scale[deg % scale.length]);
        const g = ctx.createGain();
        const v = s.style === 'electro' || s.style === 'pop' ? 0.045 : 0.08;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.48);
        o.connect(g).connect(leadBus);
        o.start(t);
        o.stop(t + beat * 0.5);
      }
    }

    // drums
    if (section !== 0 || b >= 2) {
      for (let i = 0; i < 16; i++) {
        const t = t0 + i * (beat / 4) + (i % 2 ? (s.swing ?? 0) * beat * 0.25 : 0);
        const kick = s.style === 'lofi' ? i === 0 || i === 7 || i === 10 : i % 4 === 0;
        const snare = i === 4 || i === 12;
        const hat = s.style === 'lofi' ? i % 2 === 0 : true;
        if (kick) {
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(150, t);
          o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.9, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          o.connect(g).connect(master);
          o.start(t);
          o.stop(t + 0.32);
        }
        if (snare && section === 1) {
          const n = ctx.createBufferSource();
          n.buffer = noise;
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 1800;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.35, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          n.connect(f).connect(g).connect(master);
          n.start(t, Math.random() * 0.5, 0.2);
        }
        if (hat) {
          const n = ctx.createBufferSource();
          n.buffer = noise;
          const f = ctx.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 7000;
          const g = ctx.createGain();
          g.gain.setValueAtTime(i % 4 === 2 ? 0.12 : 0.06, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          n.connect(f).connect(g).connect(master);
          n.start(t, Math.random() * 0.5, 0.06);
        }
      }
    }
  }
  return ctx.startRendering();
}

function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  data.setUint32(4, 36 + len * ch * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  w(36, 'data');
  data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data.buffer], { type: 'audio/wav' });
}

async function coverArt(title: string, hue: number, idx: number): Promise<Blob | null> {
  const size = 600;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : null;
  if (!c) return null;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, `hsl(${hue}, 80%, 58%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 75%, 32%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  // concentric "click wheel" rings
  g.globalAlpha = 0.18;
  for (let r = 40; r < 520; r += 36) {
    g.beginPath();
    g.arc(size * (0.3 + idx * 0.12), size * 0.62, r, 0, Math.PI * 2);
    g.lineWidth = 10;
    g.strokeStyle = '#fff';
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.font = '700 64px -apple-system, Helvetica, Arial, sans-serif';
  g.fillText(title, 40, 110);
  g.font = '500 30px -apple-system, Helvetica, Arial, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillText('iPort Demo Band', 42, 156);
  g.font = '800 26px -apple-system, Helvetica, Arial, sans-serif';
  g.fillText('HELLO, IPOD', 42, size - 40);
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
}

const YOUTUBE_SEED: { id: string; title: string; artist: string; album: string; year: number; genre: string }[] = [
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', album: 'Whenever You Need Somebody', year: 1987, genre: 'Pop' },
  { id: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', year: 1975, genre: 'Rock' },
  { id: 'kXYiU_JCYtU', title: 'Numb', artist: 'Linkin Park', album: 'Meteora', year: 2003, genre: 'Rock' },
  { id: 'hT_nvWreIhg', title: 'Counting Stars', artist: 'OneRepublic', album: 'Native', year: 2013, genre: 'Pop' },
  { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio – beats to relax/study to', artist: 'Lofi Girl', album: 'Lofi Girl', year: 2022, genre: 'Hip Hop' },
];

let seeding = false;

export async function seedDemoLibrary(): Promise<void> {
  if (seeding) return;
  seeding = true;
  const lib = useLibrary.getState();
  lib.setSeeded(true);
  const now = Date.now();
  const tracks: Track[] = [];

  // YouTube first: instant.
  YOUTUBE_SEED.forEach((y, i) => {
    tracks.push({
      id: uid('t'),
      source: 'youtube',
      ref: y.id,
      mediaType: 'music',
      hasVideo: true,
      title: y.title,
      artist: y.artist,
      album: y.album,
      year: y.year,
      genre: y.genre,
      artwork: `https://i.ytimg.com/vi/${y.id}/hqdefault.jpg`,
      addedAt: now - 1000 * (i + 10),
      playCount: 0,
      skipCount: 0,
    });
  });
  lib.addTracks(tracks.splice(0));

  if (typeof OfflineAudioContext === 'undefined') return;
  try {
    let artKey: string | undefined;
    for (let i = 0; i < SONGS.length; i++) {
      const s = SONGS[i];
      const buf = await renderSong(s);
      const id = uid('t');
      const key = `media:${id}`;
      await putBlob(key, toWav(buf));
      if (i === 0) {
        const art = await coverArt('Hello, iPod', s.hue, 1);
        if (art) {
          artKey = `art:demo-hello-ipod`;
          await putBlob(artKey, art);
        }
      }
      useLibrary.getState().addTracks([{
        id,
        source: 'local',
        ref: key,
        mediaType: 'music',
        title: s.title,
        artist: 'iPort Demo Band',
        album: 'Hello, iPod',
        genre: s.genre,
        year: 2026,
        trackNo: i + 1,
        duration: buf.duration,
        artwork: artKey ? `idb:${artKey}` : undefined,
        addedAt: now - i,
        playCount: 0,
        skipCount: 0,
      }]);
    }
  } catch (e) {
    console.warn('[demo] could not synthesize demo songs', e);
  }
}
