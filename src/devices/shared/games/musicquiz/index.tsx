/**
 * Music Quiz — a clip of a random song plays from a random point; pick its
 * title from five choices with the wheel before the points run out.
 * Ten rounds. Needs at least five songs that play through an <audio>
 * element (YouTube/SoundCloud tracks can't be clipped).
 */
import type { WheelEvent } from '../../clickwheel/bus';
import { useLibrary } from '../../../../core/library/store';
import { songs } from '../../../../core/library/selectors';
import { resolveArtwork } from '../../../../core/library/artwork';
import { effectiveVolume, player } from '../../../../core/player/player';
import { resolveStreamUrl } from '../../../../core/sources/resolve';
import type { Track } from '../../../../core/types';
import { GameCanvas, type GameEnv, type GameImpl } from '../kit/GameCanvas';
import { approach, blink, clamp, ellipsize, rand, rrect, text, vgrad, type Ctx } from '../kit/draw';
import { font, LCD } from '../kit/palette';
import { notes, sfx, tone } from '../kit/sfx';
import { loadData, saveData } from '../kit/storage';
import type { GameProps } from '../types';

const ROUNDS = 10;
const CHOICES = 5;
const ROUND_SECONDS = 10;
const MIN_SONGS = 5;
const HEADER = 20;

type Phase = 'wait' | 'empty' | 'title' | 'loading' | 'blocked' | 'question' | 'reveal' | 'results' | 'failed';

/** Songs a plain <audio> element can play. */
function playable(tracks: Record<string, Track>): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of songs(tracks)) {
    if (t.source === 'youtube' || t.source === 'soundcloud' || t.source === 'radio') continue;
    const key = t.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** A few ms of silence, played on the first press to unlock audio on strict browsers. */
function silentWav(): string {
  const n = 400;
  const bytes = new Uint8Array(44 + n);
  const v = new DataView(bytes.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => (bytes[o + i] = c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(bin)}`;
}

interface Pal {
  bg: string;
  header: [string, string];
  headerLine: string;
  headerText: string;
  text: string;
  dim: string;
  sep: string;
  sel: [string, string];
  selText: string;
  ok: [string, string];
  bad: [string, string];
  markText: string;
  footer: [string, string];
  bar: [string, string, string];
  barBg: string;
  accent: string;
}

function makePalette(color: boolean): Pal {
  return color
    ? {
        bg: '#ffffff',
        header: ['#fdfdfe', '#c6ccd5'],
        headerLine: '#8f96a1',
        headerText: '#111111',
        text: '#111111',
        dim: '#6b7280',
        sep: '#e6e8ec',
        sel: ['#5ea4f2', '#1e64cf'],
        selText: '#ffffff',
        ok: ['#5fd16f', '#279a3d'],
        bad: ['#ff6b61', '#cf2f27'],
        markText: '#ffffff',
        footer: ['#f4f5f7', '#dde1e7'],
        bar: ['#3ccf5a', '#ffc93c', '#ff5a4f'],
        barBg: '#c9ced6',
        accent: '#1e64cf',
      }
    : {
        bg: LCD[0],
        header: [LCD[1], LCD[1]],
        headerLine: LCD[3],
        headerText: LCD[3],
        text: LCD[3],
        dim: LCD[2],
        sep: LCD[1],
        sel: [LCD[3], LCD[3]],
        selText: LCD[0],
        ok: [LCD[3], LCD[3]],
        bad: [LCD[2], LCD[2]],
        markText: LCD[0],
        footer: [LCD[0], LCD[0]],
        bar: [LCD[3], LCD[3], LCD[3]],
        barBg: LCD[1],
        accent: LCD[3],
      };
}

class MusicQuizGame implements GameImpl {
  help = ['Wheel · choose a title', 'Center · answer'];
  private p: Pal;
  private phase: Phase = 'wait';
  private t = 0;
  private phaseT = 0;
  private pool: Track[] = [];
  private used = new Set<string>();
  private bad = new Set<string>();
  private round = 0;
  private choices: Track[] = [];
  private answer = 0;
  private sel = 0;
  private picked = -1;
  private qT = 0;
  private points = 100;
  private gained = 0;
  private score = 0;
  private correct = 0;
  private streak = 0;
  private best: { high: number };
  private newBest = false;
  private audio: HTMLAudioElement;
  private fade = 0;
  private fadeTo = 0;
  private token = 0;
  private retries = 0;
  private art: HTMLImageElement | null = null;
  private unsub: () => void;
  private silent = silentWav();

  constructor(private env: GameEnv) {
    this.p = makePalette(env.color);
    this.best = loadData('musicquiz', { high: 0 });
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.unsub = useLibrary.subscribe((s, prev) => {
      if (s.tracks !== prev.tracks || s.hydrated !== prev.hydrated) this.refreshPool();
    });
    this.refreshPool();
  }

  private refreshPool(): void {
    const s = useLibrary.getState();
    if (!s.hydrated) return;
    this.pool = playable(s.tracks).filter((t) => !this.bad.has(t.id));
    if (this.phase === 'wait' || this.phase === 'title' || this.phase === 'empty') {
      this.setPhase(this.pool.length >= MIN_SONGS ? 'title' : 'empty');
    }
  }

  private setPhase(p: Phase): void {
    if (p !== this.phase) this.phaseT = 0;
    this.phase = p;
  }

  dispose(): void {
    this.unsub();
    this.token++;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  pausable(): boolean {
    return this.phase === 'loading' || this.phase === 'question' || this.phase === 'reveal' || this.phase === 'blocked';
  }

  onPause(): void {
    this.audio.pause();
  }

  onResume(): void {
    if (this.phase === 'question' || this.phase === 'reveal') void this.audio.play().catch(() => {});
  }

  // ---------------------------------------------------------------- flow

  private start(): void {
    // unlock the audio element inside the user's press
    this.audio.src = this.silent;
    void this.audio.play().catch(() => {});
    player.pause();
    this.round = 0;
    this.score = 0;
    this.correct = 0;
    this.streak = 0;
    this.newBest = false;
    this.used.clear();
    sfx.start();
    void this.nextRound();
  }

  private async nextRound(): Promise<void> {
    this.pool = playable(useLibrary.getState().tracks).filter((t) => !this.bad.has(t.id));
    if (this.pool.length < MIN_SONGS) {
      this.audio.pause();
      this.setPhase(this.bad.size ? 'failed' : 'empty');
      return;
    }
    this.round++;
    if (this.round > ROUNDS) {
      this.finish();
      return;
    }
    let fresh = this.pool.filter((t) => !this.used.has(t.id));
    if (!fresh.length) {
      this.used.clear();
      fresh = this.pool;
    }
    const song = fresh[Math.floor(Math.random() * fresh.length)];
    this.used.add(song.id);
    const others = this.pool.filter((t) => t.id !== song.id);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    this.choices = [song, ...others.slice(0, CHOICES - 1)];
    for (let i = this.choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.choices[i], this.choices[j]] = [this.choices[j], this.choices[i]];
    }
    this.answer = this.choices.indexOf(song);
    this.sel = 0;
    this.picked = -1;
    this.qT = 0;
    this.points = 100;
    this.art = null;
    this.setPhase('loading');
    const token = ++this.token;
    void resolveArtwork(song.artwork).then((u) => {
      if (!u || token !== this.token) return;
      const img = new Image();
      img.onload = () => {
        if (token === this.token) this.art = img;
      };
      img.src = u;
    });

    const result = await this.loadClip(song, token);
    if (token !== this.token) return;
    if (result === 'ok') {
      this.retries = 0;
      this.fade = 0;
      this.fadeTo = 1;
      this.setPhase('question');
    } else if (result === 'blocked') {
      this.setPhase('blocked');
    } else {
      // couldn't play this one — drop it and try another song for this round
      this.bad.add(song.id);
      this.round--;
      if (++this.retries > 6) {
        this.setPhase('failed');
        return;
      }
      void this.nextRound();
    }
  }

  private async loadClip(song: Track, token: number): Promise<'ok' | 'blocked' | 'error'> {
    let url: string;
    try {
      url = await resolveStreamUrl(song);
    } catch {
      return 'error';
    }
    if (token !== this.token) return 'error';
    const a = this.audio;
    a.volume = 0;
    return new Promise((resolve) => {
      let done = false;
      const timer = window.setTimeout(() => finish('error'), 9000);
      const cleanup = () => {
        window.clearTimeout(timer);
        a.removeEventListener('loadedmetadata', onMeta);
        a.removeEventListener('error', onErr);
      };
      const finish = (r: 'ok' | 'blocked' | 'error') => {
        if (done) return;
        done = true;
        cleanup();
        resolve(r);
      };
      const onMeta = () => {
        if (token !== this.token) return finish('error');
        const d = a.duration;
        if (Number.isFinite(d) && d > 24) {
          try {
            a.currentTime = rand(d * 0.12, Math.min(d * 0.7, d - 14));
          } catch {
            /* not seekable: play from the start */
          }
        }
        a.play().then(
          () => finish('ok'),
          (err: unknown) => finish(err instanceof DOMException && err.name === 'NotAllowedError' ? 'blocked' : 'error'),
        );
      };
      const onErr = () => finish('error');
      a.addEventListener('loadedmetadata', onMeta);
      a.addEventListener('error', onErr);
      a.src = url;
      a.load();
    });
  }

  private choose(i: number): void {
    if (this.phase !== 'question') return;
    this.picked = i;
    const right = i === this.answer;
    if (right) {
      this.gained = Math.max(5, this.points) + (this.streak >= 2 ? 10 : 0);
      this.score += this.gained;
      this.correct++;
      this.streak++;
      notes([[784, 70], [1047, 140]], { type: 'square', volume: 0.06 });
    } else {
      this.gained = 0;
      this.streak = 0;
      sfx.error();
    }
    this.setPhase('reveal');
  }

  private timeUp(): void {
    this.picked = -1;
    this.gained = 0;
    this.streak = 0;
    notes([[330, 120], [262, 220]], { type: 'triangle', volume: 0.08 });
    this.setPhase('reveal');
  }

  private finish(): void {
    this.fadeTo = 0;
    this.setPhase('results');
    if (this.score > this.best.high) {
      this.best = { high: this.score };
      this.newBest = true;
      saveData('musicquiz', this.best);
      sfx.highScore();
    } else notes([[523, 90], [659, 90], [784, 180]], { type: 'triangle', volume: 0.07 });
  }

  // ---------------------------------------------------------------- input

  input(e: WheelEvent): void {
    const ph = this.phase;
    if (e.type === 'scroll') {
      if (ph === 'question' || ph === 'loading') this.sel = clamp(this.sel + Math.sign(e.steps), 0, CHOICES - 1);
      return;
    }
    if (e.type !== 'click') return;
    if (e.button === 'menu') {
      if (ph === 'results' || ph === 'failed') {
        this.refreshPool();
        this.setPhase(this.pool.length >= MIN_SONGS ? 'title' : 'empty');
      } else this.env.exit();
      return;
    }
    if (e.button === 'play') {
      if (this.pausable()) this.env.pause();
      else if (ph === 'title') this.start();
      return;
    }
    if (e.button === 'prev' && (ph === 'question' || ph === 'loading')) this.sel = Math.max(0, this.sel - 1);
    if (e.button === 'next' && (ph === 'question' || ph === 'loading')) this.sel = Math.min(CHOICES - 1, this.sel + 1);
    if (e.button !== 'select') return;
    if (ph === 'title') this.start();
    else if (ph === 'question') this.choose(this.sel);
    else if (ph === 'reveal' && this.phaseT > 0.4) this.advance();
    else if (ph === 'results' && this.phaseT > 0.8) this.start();
    else if (ph === 'blocked') {
      void this.audio.play().then(
        () => {
          this.fade = 0;
          this.fadeTo = 1;
          this.setPhase('question');
        },
        () => sfx.error(),
      );
    } else if (ph === 'failed') {
      this.bad.clear();
      this.refreshPool();
      this.setPhase(this.pool.length >= MIN_SONGS ? 'title' : 'empty');
    }
  }

  private advance(): void {
    this.fadeTo = 0;
    void this.nextRound();
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    if (this.phase === 'question') {
      this.qT += dt;
      this.points = Math.max(0, Math.ceil(100 * (1 - this.qT / ROUND_SECONDS)));
      if (this.qT >= ROUND_SECONDS) this.timeUp();
      else if (this.qT > ROUND_SECONDS - 3 && Math.floor(this.qT) !== Math.floor(this.qT - dt)) tone(1568, 40, { type: 'square', volume: 0.025 });
    }
    if (this.phase === 'reveal') {
      if (this.phaseT > 2.6) this.fadeTo = 0;
      if (this.phaseT > 3.2) this.advance();
    }
    // fade the clip in/out
    this.fade += (this.fadeTo - this.fade) * approach(this.fadeTo > this.fade ? 5 : 7, dt);
    if (Math.abs(this.fadeTo - this.fade) < 0.01) this.fade = this.fadeTo;
    const vol = clamp(effectiveVolume() * this.fade, 0, 1);
    if (this.phase !== 'loading' && Math.abs(this.audio.volume - vol) > 0.001) this.audio.volume = vol;
    if (this.fade === 0 && this.fadeTo === 0 && !this.audio.paused && this.phase !== 'loading') this.audio.pause();
  }

  // ---------------------------------------------------------------- drawing

  draw(g: Ctx): void {
    const { w, h } = this.env;
    const p = this.p;
    g.fillStyle = p.bg;
    g.fillRect(0, 0, w, h);
    const ph = this.phase;
    let right = '';
    if (ph === 'loading' || ph === 'question' || ph === 'reveal' || ph === 'blocked') right = `${this.round} of ${ROUNDS}`;
    this.drawHeader(g, 'Music Quiz', right);

    if (ph === 'wait') {
      text(g, 'Loading library…', w / 2, h / 2, { size: 13, weight: 600, color: p.dim, align: 'center', base: 'middle' });
      return;
    }
    if (ph === 'empty') {
      this.drawNotes(g, w / 2, 78, 1.1);
      text(g, `You need at least ${MIN_SONGS} songs`, w / 2, 132, { size: 15, weight: 800, color: p.text, align: 'center', base: 'middle' });
      text(g, 'to play Music Quiz.', w / 2, 152, { size: 13, weight: 600, color: p.text, align: 'center', base: 'middle' });
      text(g, `Songs in your library that can play here: ${this.pool.length}`, w / 2, 180, { size: 10, weight: 500, color: p.dim, align: 'center', base: 'middle' });
      text(g, 'Add music in the Library, then come back.', w / 2, 196, { size: 10, weight: 500, color: p.dim, align: 'center', base: 'middle' });
      text(g, 'Press Menu to go back', w / 2, h - 14, { size: 10, weight: 600, color: p.dim, align: 'center', base: 'middle' });
      return;
    }
    if (ph === 'failed') {
      this.drawNotes(g, w / 2, 80, 1);
      text(g, 'Couldn’t play enough songs', w / 2, 134, { size: 14, weight: 800, color: p.text, align: 'center', base: 'middle' });
      text(g, 'Some songs failed to load. Check your connection.', w / 2, 156, { size: 10, weight: 500, color: p.dim, align: 'center', base: 'middle' });
      if (blink(this.t)) text(g, 'Press Center to try again', w / 2, h - 16, { size: 11, weight: 700, color: p.text, align: 'center', base: 'middle' });
      return;
    }
    if (ph === 'title') {
      this.drawNotes(g, w / 2, 70, 1.15);
      text(g, 'Name That Tune', w / 2, 118, { size: 20, weight: 800, color: p.text, align: 'center', base: 'middle' });
      text(g, `${ROUNDS} rounds · pick the song that’s playing`, w / 2, 140, { size: 11, weight: 600, color: p.dim, align: 'center', base: 'middle' });
      text(g, 'The faster you answer, the more points you get.', w / 2, 155, { size: 10, weight: 500, color: p.dim, align: 'center', base: 'middle' });
      text(g, `${this.pool.length} songs · High Score ${this.best.high}`, w / 2, 180, { size: 11, weight: 700, color: p.accent, align: 'center', base: 'middle' });
      if (blink(this.t)) text(g, 'Press Center to start', w / 2, h - 18, { size: 12, weight: 700, color: p.text, align: 'center', base: 'middle' });
      return;
    }
    if (ph === 'results') {
      this.drawResults(g);
      return;
    }
    this.drawRows(g);
    this.drawFooter(g);
  }

  private drawHeader(g: Ctx, title: string, right: string): void {
    const { w } = this.env;
    const p = this.p;
    g.fillStyle = vgrad(g, 0, HEADER, [
      [0, p.header[0]],
      [1, p.header[1]],
    ]);
    g.fillRect(0, 0, w, HEADER);
    g.fillStyle = p.headerLine;
    g.fillRect(0, HEADER - 1, w, 1);
    text(g, title, w / 2, HEADER / 2 + 0.5, { size: 12, weight: 800, color: p.headerText, align: 'center', base: 'middle' });
    if (right) text(g, right, w - 7, HEADER / 2 + 0.5, { size: 10, weight: 700, color: p.headerText, align: 'right', base: 'middle' });
    if (this.phase !== 'title' && this.phase !== 'empty' && this.phase !== 'wait' && this.phase !== 'failed') {
      text(g, `Score ${this.score}`, 7, HEADER / 2 + 0.5, { size: 10, weight: 700, color: p.headerText, base: 'middle' });
    } else {
      // little play triangle like the iPod's status bar
      g.fillStyle = p.headerText;
      g.beginPath();
      g.moveTo(8, 6);
      g.lineTo(14, 10);
      g.lineTo(8, 14);
      g.fill();
    }
  }

  private drawRows(g: Ctx): void {
    const { w } = this.env;
    const p = this.p;
    const rowH = 30;
    const top = HEADER + 1;
    const reveal = this.phase === 'reveal';
    this.choices.forEach((c, i) => {
      const y = top + i * rowH;
      let fill: [string, string] | null = null;
      let mark: 'ok' | 'bad' | null = null;
      if (reveal) {
        if (i === this.answer) {
          fill = p.ok;
          mark = 'ok';
        } else if (i === this.picked) {
          fill = p.bad;
          mark = 'bad';
        }
      } else if (i === this.sel) fill = p.sel;
      if (fill) {
        g.fillStyle = vgrad(g, y, y + rowH, [
          [0, fill[0]],
          [1, fill[1]],
        ]);
        g.fillRect(0, y, w, rowH);
      } else {
        g.fillStyle = p.sep;
        g.fillRect(8, y + rowH - 1, w - 16, 1);
      }
      const on = !!fill;
      const dimRow = reveal && !fill;
      g.font = font(13, 700);
      const title = ellipsize(g, c.title, w - 44);
      text(g, title, 10, y + 13, { size: 13, weight: 700, color: on ? p.selText : dimRow ? p.dim : p.text });
      g.font = font(10, 500);
      const sub = ellipsize(g, [c.artist, c.album].filter(Boolean).join(' — ') || 'Unknown Artist', w - 44);
      text(g, sub, 10, y + 25, { size: 10, weight: 500, color: on ? p.selText : p.dim });
      if (mark) this.drawMark(g, w - 18, y + rowH / 2, mark, p.markText);
      else if (on && !reveal) {
        g.strokeStyle = p.selText;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(w - 20, y + 10);
        g.lineTo(w - 15, y + 15);
        g.lineTo(w - 20, y + 20);
        g.stroke();
      }
    });
  }

  private drawMark(g: Ctx, x: number, y: number, kind: 'ok' | 'bad', color: string): void {
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    if (kind === 'ok') {
      g.moveTo(x - 6, y);
      g.lineTo(x - 2, y + 4);
      g.lineTo(x + 6, y - 5);
    } else {
      g.moveTo(x - 5, y - 5);
      g.lineTo(x + 5, y + 5);
      g.moveTo(x + 5, y - 5);
      g.lineTo(x - 5, y + 5);
    }
    g.stroke();
    g.lineCap = 'butt';
  }

  private drawFooter(g: Ctx): void {
    const { w, h } = this.env;
    const p = this.p;
    const top = HEADER + 1 + CHOICES * 30;
    g.fillStyle = vgrad(g, top, h, [
      [0, p.footer[0]],
      [1, p.footer[1]],
    ]);
    g.fillRect(0, top, w, h - top);
    g.fillStyle = this.env.color ? '#c4c9d1' : LCD[3];
    g.fillRect(0, top, w, 1);
    const midY = top + (h - top - 12) / 2 + 1;

    // left: artwork on reveal, otherwise a little equalizer
    const ph = this.phase;
    if (ph === 'reveal' && this.art) {
      g.save();
      rrect(g, 10, midY - 19, 38, 38, 4);
      g.clip();
      g.drawImage(this.art, 10, midY - 19, 38, 38);
      g.restore();
    } else this.drawEq(g, 14, midY + 12, ph === 'question' || ph === 'reveal');

    if (ph === 'loading') {
      text(g, 'Cueing up a song…', w / 2, midY, { size: 13, weight: 700, color: p.dim, align: 'center', base: 'middle' });
    } else if (ph === 'blocked') {
      if (blink(this.t)) text(g, 'Press Center to hear the clip', w / 2, midY, { size: 12, weight: 700, color: p.text, align: 'center', base: 'middle' });
    } else if (ph === 'question') {
      text(g, String(this.points), w / 2, midY - 4, { size: 26, weight: 800, color: p.text, align: 'center', base: 'middle' });
      text(g, 'points', w / 2, midY + 15, { size: 9, weight: 600, color: p.dim, align: 'center', base: 'middle' });
    } else if (ph === 'reveal') {
      const right = this.picked === this.answer;
      const head = right ? `Correct! +${this.gained}` : this.picked < 0 ? 'Time’s up!' : 'Not quite!';
      text(g, head, w / 2 + 12, midY - 9, { size: 16, weight: 800, color: right ? (this.env.color ? '#1f8a36' : LCD[3]) : this.env.color ? '#cf2f27' : LCD[3], align: 'center', base: 'middle' });
      const song = this.choices[this.answer];
      g.font = font(10, 600);
      const s = ellipsize(g, `${song.title} — ${song.artist || 'Unknown Artist'}`, w - 120);
      text(g, s, w / 2 + 12, midY + 9, { size: 10, weight: 600, color: p.dim, align: 'center', base: 'middle' });
    }
    // streak on the right
    if (this.streak >= 2 && (ph === 'question' || ph === 'reveal')) {
      text(g, `${this.streak} in a row`, w - 10, midY - 4, { size: 10, weight: 800, color: p.accent, align: 'right', base: 'middle' });
      text(g, '+10 bonus', w - 10, midY + 9, { size: 9, weight: 600, color: p.dim, align: 'right', base: 'middle' });
    }
    // timer bar
    const bx = 10;
    const bw = w - 20;
    const by = h - 9;
    g.fillStyle = p.barBg;
    rrect(g, bx, by, bw, 4, 2);
    g.fill();
    const frac = ph === 'question' ? 1 - this.qT / ROUND_SECONDS : ph === 'reveal' ? 0 : 1;
    if (frac > 0) {
      g.fillStyle = frac > 0.5 ? p.bar[0] : frac > 0.25 ? p.bar[1] : p.bar[2];
      rrect(g, bx, by, bw * frac, 4, 2);
      g.fill();
    }
  }

  private drawEq(g: Ctx, x: number, base: number, live: boolean): void {
    const c = this.env.color ? this.p.accent : LCD[3];
    g.fillStyle = c;
    for (let i = 0; i < 5; i++) {
      const v = live ? 0.25 + 0.75 * Math.abs(Math.sin(this.t * (5 + i * 1.7) + i * 1.3)) * this.fade : 0.15;
      const bh = Math.max(2, 24 * v);
      g.fillRect(x + i * 6, base - bh, 4, bh);
    }
  }

  /** Two beamed eighth notes. */
  private drawNotes(g: Ctx, x: number, y: number, s: number): void {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.rotate(-0.08);
    if (this.env.color) {
      const gr = g.createLinearGradient(-20, -24, 20, 24);
      gr.addColorStop(0, '#6fb1ff');
      gr.addColorStop(1, '#1e4fc0');
      g.fillStyle = gr;
    } else g.fillStyle = LCD[3];
    g.beginPath();
    g.ellipse(-12, 16, 8, 6, -0.4, 0, Math.PI * 2);
    g.ellipse(14, 10, 8, 6, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-6, -22, 3.5, 38);
    g.fillRect(20, -28, 3.5, 38);
    g.beginPath();
    g.moveTo(-6, -22);
    g.lineTo(23.5, -28);
    g.lineTo(23.5, -19);
    g.lineTo(-6, -13);
    g.fill();
    g.restore();
  }

  private drawResults(g: Ctx): void {
    const { w, h } = this.env;
    const p = this.p;
    text(g, 'Quiz Complete', w / 2, 50, { size: 22, weight: 800, color: p.text, align: 'center', base: 'middle' });
    text(g, `${this.correct} of ${ROUNDS} correct`, w / 2, 80, { size: 13, weight: 700, color: p.dim, align: 'center', base: 'middle' });
    text(g, String(this.score), w / 2, 122, { size: 40, weight: 800, color: p.accent, align: 'center', base: 'middle' });
    text(g, 'points', w / 2, 148, { size: 11, weight: 600, color: p.dim, align: 'center', base: 'middle' });
    if (this.newBest) {
      if (blink(this.t, 2.2) || !this.env.color) text(g, 'New High Score!', w / 2, 174, { size: 14, weight: 800, color: this.env.color ? '#e08a00' : LCD[3], align: 'center', base: 'middle' });
    } else text(g, `High Score ${this.best.high}`, w / 2, 174, { size: 12, weight: 700, color: p.dim, align: 'center', base: 'middle' });
    const verdict = this.correct >= 9 ? 'Music genius!' : this.correct >= 7 ? 'Great ears!' : this.correct >= 4 ? 'Not bad!' : 'Keep listening!';
    text(g, verdict, w / 2, 196, { size: 11, weight: 600, color: p.dim, align: 'center', base: 'middle' });
    if (blink(this.t)) text(g, 'Press Center to play again', w / 2, h - 16, { size: 11, weight: 700, color: p.text, align: 'center', base: 'middle' });
  }
}

const create = (env: GameEnv) => new MusicQuizGame(env);

export default function MusicQuiz(props: GameProps) {
  return <GameCanvas {...props} create={create} />;
}
