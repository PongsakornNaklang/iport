/**
 * Vortex — circular Breakout. The paddle rides a ring around the screen and
 * follows the wheel one-to-one (one turn of the wheel = one lap), so your
 * thumb's position matches the paddle's. Rings of bricks spin in the centre
 * around an indestructible core.
 */
import type { WheelEvent } from '../../clickwheel/bus';
import { GameCanvas, type GameEnv, type GameImpl } from '../kit/GameCanvas';
import { approach, clamp, drawCard, drawPrompt, drawTitle, Particles, Popups, rand, rrect, text, type Ctx } from '../kit/draw';
import { LCD, mix, uiPalette, type UiPalette } from '../kit/palette';
import { sfx, tone } from '../kit/sfx';
import { loadData, saveData } from '../kit/storage';
import type { GameProps } from '../types';

const TAU = Math.PI * 2;
const BALL_R = 3;
const PADDLE_T = 6;
const CORE_R = 11;
const HALF = 0.27;
const WIDE_HALF = 0.42;
const SEG_GAP = 0.035;
const STEP = TAU / 24; // one wheel click

const wrapPi = (a: number) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const wrap2Pi = (a: number) => ((a % TAU) + TAU) % TAU;

type Kind = 'normal' | 'hard' | 'steel';
interface Seg {
  hp: number;
  kind: Kind;
  flash: number;
  cool: number;
}
interface Ring {
  i: number;
  r0: number;
  r1: number;
  n: number;
  angle: number;
  omega: number;
  segs: Seg[];
}
interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  dead: boolean;
  trail: number[];
}
type CapType = 'W' | 'S' | 'M' | 'L';
interface Capsule {
  r: number;
  a: number;
  type: CapType;
}
interface Star {
  r: number;
  a: number;
  s: number;
}
type Phase = 'title' | 'play' | 'clear' | 'dead' | 'over';

interface Pal {
  bg: [string, string];
  stars: boolean;
  track: string;
  rings: string[];
  ringHi: string[];
  hard: string;
  steel: string;
  crack: string;
  core: [string, string];
  paddle: string;
  paddleGlow: string | null;
  ball: string;
  hud: string;
  hudDim: string;
  caps: Record<CapType, string>;
  capText: string;
}

function makePalette(color: boolean): Pal {
  if (!color) {
    return {
      bg: [LCD[0], LCD[0]],
      stars: false,
      track: LCD[1],
      rings: [LCD[3], LCD[2], LCD[3], LCD[2]],
      ringHi: [LCD[2], LCD[1], LCD[2], LCD[1]],
      hard: LCD[1],
      steel: LCD[3],
      crack: LCD[3],
      core: [LCD[3], LCD[2]],
      paddle: LCD[3],
      paddleGlow: null,
      ball: LCD[3],
      hud: LCD[3],
      hudDim: LCD[2],
      caps: { W: LCD[3], S: LCD[3], M: LCD[3], L: LCD[3] },
      capText: LCD[0],
    };
  }
  const rings = ['#ff4f8b', '#ffb347', '#4fe3c1', '#5aa9ff'];
  return {
    bg: ['#1d0f45', '#030208'],
    stars: true,
    track: 'rgba(150,130,255,0.28)',
    rings,
    ringHi: rings.map((c) => mix(c, '#ffffff', 0.5)),
    hard: '#e6e9f2',
    steel: '#737b8f',
    crack: '#30354a',
    core: ['#ffffff', '#c14bff'],
    paddle: '#5ce1ff',
    paddleGlow: 'rgba(92,225,255,0.8)',
    ball: '#ffffff',
    hud: '#ffffff',
    hudDim: '#a99fd8',
    caps: { W: '#5ce1ff', S: '#4fe37a', M: '#ffb347', L: '#ff4f8b' },
    capText: '#ffffff',
  };
}

const CAP_LABEL: Record<CapType, string> = { W: 'WIDE', S: 'SLOW', M: 'MULTI', L: '1UP' };
const RING_FREQ = [1175, 988, 784, 659];

function makeLevel(n: number): Ring[] {
  const count = Math.min(4, 2 + Math.floor(n / 2));
  const segCounts = [8, 12, 16, 20];
  const rings: Ring[] = [];
  for (let i = 0; i < count; i++) {
    const dir = i % 2 ? -1 : 1;
    const omega = dir * Math.min(1.25, 0.22 + 0.07 * n + 0.05 * i);
    const nSeg = segCounts[i];
    const segs: Seg[] = [];
    for (let j = 0; j < nSeg; j++) {
      let kind: Kind = 'normal';
      let hp = 1;
      if (n >= 3 && i === count - 1 && j % 2 === 0) kind = 'hard';
      if (n >= 4 && i === 0 && j % 4 === 0) kind = 'steel';
      if (n >= 6 && i === 1 && j % 3 === 0) kind = 'hard';
      // patterns with gaps
      if (n % 3 === 2 && i === count - 1 && j % 4 === 3) hp = 0;
      if (n % 3 === 0 && i === 1 && j % 3 === 1) hp = 0;
      if (hp) hp = kind === 'steel' ? Infinity : kind === 'hard' ? 2 : 1;
      segs.push({ hp, kind, flash: 0, cool: 0 });
    }
    const r0 = 20 + i * 13;
    rings.push({ i, r0, r1: r0 + 10, n: nSeg, angle: rand(0, TAU), omega, segs });
  }
  return rings;
}

class VortexGame implements GameImpl {
  help = ['Wheel · steer the paddle around', 'Center · launch    Play · pause'];
  private ui: UiPalette;
  private p: Pal;
  private parts: Particles;
  private pops = new Popups();
  private phase: Phase = 'title';
  private t = 0;
  private phaseT = 0;
  private cx: number;
  private cy: number;
  private R: number;
  private Rp: number;
  private rings: Ring[] = [];
  private balls: Ball[] = [];
  private caps: Capsule[] = [];
  private stars: Star[] = [];
  private attached = true;
  private attachT = 0;
  private pa = Math.PI / 2;
  private pTarget = Math.PI / 2;
  private half = HALF;
  private hold = 0;
  private holdWait = 0;
  private score = 0;
  private lives = 3;
  private level = 1;
  private hits = 0;
  private wideT = 0;
  private slowT = 0;
  private shake = 0;
  private coreFlash = 0;
  private paddleFlash = 0;
  private bonus = 0;
  private best: { high: number; level: number };
  private newBest = false;
  private aiOffset = 0;

  constructor(private env: GameEnv) {
    this.ui = uiPalette(env.color);
    this.p = makePalette(env.color);
    this.parts = new Particles(!env.color);
    this.best = loadData('vortex', { high: 0, level: 1 });
    this.cx = env.w / 2;
    this.cy = env.h / 2;
    this.R = Math.min(env.w, env.h) / 2 - 8;
    this.Rp = this.R - 5;
    for (let i = 0; i < 110; i++) this.stars.push({ r: rand(8, Math.hypot(env.w, env.h) / 2), a: rand(0, TAU), s: rand(0.3, 1) });
    this.rings = makeLevel(2);
    this.serve();
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  private get demo(): boolean {
    return this.phase === 'title';
  }

  private serve(): void {
    this.balls = [{ x: 0, y: 0, dx: 0, dy: 0, dead: false, trail: [] }];
    this.caps = [];
    this.attached = true;
    this.attachT = 0;
    this.wideT = 0;
    this.slowT = 0;
    this.placeOnPaddle();
  }

  private placeOnPaddle(): void {
    const b = this.balls[0];
    const rr = this.Rp - PADDLE_T / 2 - BALL_R - 0.5;
    b.x = this.cx + Math.cos(this.pa) * rr;
    b.y = this.cy + Math.sin(this.pa) * rr;
  }

  private startGame(): void {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.hits = 0;
    this.newBest = false;
    this.parts.clear();
    this.rings = makeLevel(1);
    this.serve();
    this.setPhase('play');
    sfx.start();
  }

  private speed(): number {
    if (this.demo) return 150;
    const base = Math.min(118 + (this.level - 1) * 10, 220);
    return base * (1 + Math.min(0.25, this.hits * 0.004)) * (this.slowT > 0 ? 0.62 : 1);
  }

  private launch(): void {
    if (!this.attached) return;
    const b = this.balls[0];
    const a = this.pa + Math.PI + rand(-0.3, 0.3);
    b.dx = Math.cos(a);
    b.dy = Math.sin(a);
    this.attached = false;
    if (!this.demo) tone(660, 60, { type: 'square', volume: 0.05 });
  }

  // ---------------------------------------------------------------- input

  input(e: WheelEvent): void {
    const ph = this.phase;
    if (e.type === 'scroll') {
      if (ph === 'title' || ph === 'over') return;
      // one wheel click = one click's worth of arc; only very fast spins get a boost
      const accel = 1 + clamp((e.velocity - 24) / 48, 0, 0.6);
      this.pTarget += e.steps * STEP * accel;
      return;
    }
    if (e.type === 'down' && (e.button === 'prev' || e.button === 'next')) {
      // a touch on the wheel's rim starts as a press and may turn into a swipe: wait a moment
      this.hold = e.button === 'prev' ? -1 : 1;
      this.holdWait = 0.15;
      return;
    }
    if (e.type === 'up' && (e.button === 'prev' || e.button === 'next')) {
      if (this.hold === (e.button === 'prev' ? -1 : 1)) this.hold = 0;
      return;
    }
    if (e.type !== 'click') return;
    if (e.button === 'select') {
      if (ph === 'title') this.startGame();
      else if (ph === 'over' && this.phaseT > 0.6) this.startGame();
      else if (ph === 'play') this.launch();
    } else if (e.button === 'play') {
      if (this.pausable()) this.env.pause();
      else if (ph === 'title') this.startGame();
    } else if (e.button === 'menu') {
      if (ph === 'title') this.env.exit();
      else if (ph === 'over') {
        this.rings = makeLevel(2);
        this.serve();
        this.setPhase('title');
      }
    }
  }

  pausable(): boolean {
    return this.phase === 'play' || this.phase === 'dead' || this.phase === 'clear';
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    this.parts.update(dt);
    this.pops.update(dt);
    this.shake = Math.max(0, this.shake - dt);
    this.coreFlash = Math.max(0, this.coreFlash - dt * 4);
    this.paddleFlash = Math.max(0, this.paddleFlash - dt * 5);
    // the vortex: stars swirl faster near the middle and drift inwards
    const maxR = Math.hypot(this.env.w, this.env.h) / 2;
    for (const s of this.stars) {
      s.a += (18 / (s.r + 12)) * dt * (0.5 + s.s);
      s.r -= (4 + 10 * s.s) * dt;
      if (s.r < 6) {
        s.r = maxR;
        s.a = rand(0, TAU);
      }
    }
    for (const r of this.rings) {
      r.angle += r.omega * dt * (this.phase === 'over' ? 0.3 : 1);
      for (const s of r.segs) {
        if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 6);
        if (s.cool > 0) s.cool -= dt;
      }
    }
    if (this.phase === 'over') return;

    if (this.demo) this.aiMove(dt);
    if (this.hold && (this.holdWait -= dt) <= 0) this.pTarget += this.hold * 4.2 * dt;
    this.pa += (this.pTarget - this.pa) * approach(30, dt);
    this.wideT = Math.max(0, this.wideT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.half += ((this.wideT > 0 ? WIDE_HALF : HALF) - this.half) * approach(10, dt);

    if (this.phase === 'clear') {
      if (this.phaseT > 2.4) {
        this.level++;
        this.rings = makeLevel(this.level);
        this.serve();
        this.setPhase('play');
      }
      return;
    }
    if (this.phase === 'dead') {
      if (this.phaseT > 1.2) {
        if (this.lives <= 0) this.gameOver();
        else {
          this.serve();
          this.setPhase('play');
        }
      }
      return;
    }

    if (this.attached) {
      this.attachT += dt;
      this.placeOnPaddle();
      this.balls[0].trail.length = 0;
      if (this.demo && this.attachT > 1) this.launch();
    } else this.stepBalls(dt);
    this.stepCapsules(dt);

    const left = this.rings.some((r) => r.segs.some((s) => s.hp > 0 && s.kind !== 'steel'));
    if (!left) {
      if (this.demo) {
        this.rings = makeLevel(Math.floor(rand(1, 7)));
      } else {
        this.bonus = 150 * this.level;
        this.score += this.bonus;
        this.caps = [];
        this.balls = [];
        this.setPhase('clear');
        sfx.levelUp();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          this.parts.burst(this.cx + Math.cos(a) * 40, this.cy + Math.sin(a) * 40, 16, this.p.rings, { speed: 150, life: 1.1, gravity: 0, drag: 1 });
        }
      }
    } else if (!this.attached && this.balls.length === 0) {
      if (this.demo) this.serve();
      else {
        this.lives--;
        this.shake = 0.35;
        this.setPhase('dead');
        sfx.lifeLost();
      }
    }
  }

  /** Attract mode: steer toward where the ball will cross the paddle's circle. */
  private aiMove(dt: number): void {
    let target = this.pa + Math.sin(this.t) * 0.02;
    for (const b of this.balls) {
      if (this.attached) break;
      const rx = b.x - this.cx;
      const ry = b.y - this.cy;
      // ray–circle intersection
      const bq = rx * b.dx + ry * b.dy;
      const c = rx * rx + ry * ry - this.Rp * this.Rp;
      const disc = bq * bq - c;
      if (disc < 0) continue;
      const tt = -bq + Math.sqrt(disc);
      target = Math.atan2(ry + b.dy * tt, rx + b.dx * tt) + this.aiOffset;
      break;
    }
    const d = wrapPi(target - this.pTarget);
    this.pTarget += clamp(d, -7 * dt, 7 * dt);
  }

  private stepBalls(dt: number): void {
    const sp = this.speed();
    for (const b of this.balls) {
      const dist = sp * dt;
      const n = Math.max(1, Math.ceil(dist / 2));
      for (let i = 0; i < n && !b.dead; i++) this.substep(b, dist / n);
      b.trail.push(b.x, b.y);
      if (b.trail.length > 18) b.trail.splice(0, 2);
    }
    this.balls = this.balls.filter((b) => !b.dead);
  }

  private reflect(b: Ball, nx: number, ny: number): void {
    const d = b.dx * nx + b.dy * ny;
    b.dx -= 2 * d * nx;
    b.dy -= 2 * d * ny;
  }

  private substep(b: Ball, st: number): void {
    const { cx, cy } = this;
    const ox = b.x;
    const oy = b.y;
    b.x += b.dx * st;
    b.y += b.dy * st;
    const rx = b.x - cx;
    const ry = b.y - cy;
    const d = Math.hypot(rx, ry) || 0.001;
    const ux = rx / d;
    const uy = ry / d;

    // core bumper
    if (d < CORE_R + BALL_R) {
      if (b.dx * ux + b.dy * uy < 0) this.reflect(b, ux, uy);
      const j = rand(-0.12, 0.12);
      const nx = b.dx * Math.cos(j) - b.dy * Math.sin(j);
      b.dy = b.dx * Math.sin(j) + b.dy * Math.cos(j);
      b.dx = nx;
      b.x = cx + ux * (CORE_R + BALL_R);
      b.y = cy + uy * (CORE_R + BALL_R);
      this.coreFlash = 1;
      if (!this.demo) {
        this.score += 5;
        tone(196, 60, { type: 'triangle', volume: 0.08, key: 'core' });
      }
      return;
    }

    // brick rings
    const th = Math.atan2(ry, rx);
    for (const ring of this.rings) {
      if (d + BALL_R <= ring.r0 || d - BALL_R >= ring.r1) continue;
      const segA = TAU / ring.n;
      const local = wrap2Pi(th - ring.angle);
      const aw = BALL_R / d;
      let idx = -1;
      for (const a of [local, local - aw, local + aw]) {
        const k = Math.floor(wrap2Pi(a) / segA) % ring.n;
        const s = ring.segs[k];
        if (s.hp > 0) {
          // inside the segment's angular span (minus its gap)?
          const off = wrap2Pi(a) - k * segA;
          if (off >= SEG_GAP * 0.5 && off <= segA - SEG_GAP * 0.5) {
            idx = k;
            break;
          }
        }
      }
      if (idx < 0) continue;
      const seg = ring.segs[idx];
      const od = Math.hypot(ox - cx, oy - cy);
      if (od - BALL_R >= ring.r1 - 0.5) {
        // hit the outer face
        if (b.dx * ux + b.dy * uy < 0) this.reflect(b, ux, uy);
      } else if (od + BALL_R <= ring.r0 + 0.5) {
        // hit the inner face
        if (b.dx * ux + b.dy * uy > 0) this.reflect(b, ux, uy);
      } else {
        // hit a side: push away from the segment's centre angle
        const centre = idx * segA + segA / 2;
        const side = wrapPi(local - centre) >= 0 ? 1 : -1;
        const tx = -uy * side;
        const ty = ux * side;
        if (b.dx * tx + b.dy * ty < 0) this.reflect(b, tx, ty);
      }
      b.x = ox;
      b.y = oy;
      if (seg.cool <= 0) this.damage(ring, idx, b);
      return;
    }

    // paddle
    const inner = this.Rp - PADDLE_T / 2;
    if (d + BALL_R >= inner && d - BALL_R <= this.Rp + PADDLE_T / 2 && b.dx * ux + b.dy * uy > 0) {
      const diff = wrapPi(th - this.pa);
      const half = this.half + BALL_R / this.Rp;
      if (Math.abs(diff) <= half) {
        const off = diff / half;
        const a = off * 0.95;
        // inward, deflected toward the side of the paddle that was hit
        const tx = -uy;
        const ty = ux;
        b.dx = -ux * Math.cos(a) + tx * Math.sin(a);
        b.dy = -uy * Math.cos(a) + ty * Math.sin(a);
        b.x = cx + ux * (inner - BALL_R);
        b.y = cy + uy * (inner - BALL_R);
        this.paddleFlash = 1;
        if (this.demo) this.aiOffset = rand(-0.7, 0.7) * this.half;
        else tone(392 + Math.abs(off) * 220, 45, { type: 'square', volume: 0.06, key: 'paddle' });
        return;
      }
    }
    if (d > this.R + 18) {
      b.dead = true;
      if (!this.demo) this.parts.burst(cx + ux * this.R, cy + uy * this.R, 16, this.p.ball, { speed: 70, life: 0.6, gravity: 0 });
    }
  }

  private segCentre(ring: Ring, idx: number): { x: number; y: number; a: number; r: number } {
    const a = ring.angle + (idx + 0.5) * (TAU / ring.n);
    const r = (ring.r0 + ring.r1) / 2;
    return { x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r, a, r };
  }

  private damage(ring: Ring, idx: number, b: Ball): void {
    const s = ring.segs[idx];
    s.flash = 1;
    s.cool = 0.06;
    if (s.kind === 'steel') {
      if (!this.demo) tone(1760, 30, { type: 'square', volume: 0.04, key: 'steel' });
      return;
    }
    s.hp--;
    const c = this.segCentre(ring, idx);
    const col = s.kind === 'hard' ? this.p.hard : this.p.rings[ring.i];
    if (s.hp > 0) {
      this.parts.burst(c.x, c.y, 5, [col, this.p.ringHi[ring.i]], { speed: 50, life: 0.4, gravity: 0 });
      if (!this.demo) tone(1319, 35, { type: 'triangle', volume: 0.06, key: 'brick' });
      return;
    }
    this.parts.burst(c.x, c.y, 14, [col, this.p.ringHi[ring.i]], {
      speed: 110,
      life: 0.8,
      gravity: 0,
      drag: 2,
      vx: Math.cos(c.a + Math.PI / 2) * ring.omega * c.r + b.dx * 30,
      vy: Math.sin(c.a + Math.PI / 2) * ring.omega * c.r + b.dy * 30,
    });
    if (this.demo) return;
    const pts = (s.kind === 'hard' ? 2 : 1) * (40 - ring.i * 10);
    this.score += pts;
    this.hits++;
    this.pops.add(c.x, c.y, `+${pts}`, this.env.color ? this.p.ringHi[ring.i] : LCD[3]);
    tone(RING_FREQ[ring.i] ?? 880, 50, { type: 'square', volume: 0.05, key: 'brick' });
    if (Math.random() < 0.12 && this.caps.length < 3) {
      const r = Math.random();
      const type: CapType = r < 0.36 ? 'W' : r < 0.62 ? 'S' : r < 0.92 ? 'M' : 'L';
      this.caps.push({ r: c.r, a: c.a, type });
    }
  }

  private stepCapsules(dt: number): void {
    for (const c of this.caps) {
      c.r += 40 * dt;
      if (Math.abs(c.r - this.Rp) < 6 && Math.abs(wrapPi(c.a - this.pa)) < this.half + 0.08) {
        c.r = Infinity;
        this.collect(c);
      }
    }
    this.caps = this.caps.filter((c) => c.r < this.R + 20);
  }

  private collect(c: Capsule): void {
    sfx.powerUp();
    this.score += 50;
    const px = this.cx + Math.cos(this.pa) * (this.Rp - 14);
    const py = this.cy + Math.sin(this.pa) * (this.Rp - 14);
    this.pops.add(px, py, CAP_LABEL[c.type], this.p.caps[c.type]);
    this.parts.burst(px, py, 12, this.p.caps[c.type], { speed: 90, life: 0.5, gravity: 0 });
    if (c.type === 'W') this.wideT = 15;
    else if (c.type === 'S') this.slowT = 10;
    else if (c.type === 'L') this.lives = Math.min(6, this.lives + 1);
    else if (c.type === 'M' && !this.attached && this.balls[0]) {
      const src = this.balls[0];
      for (const a of [-0.5, 0.5]) {
        this.balls.push({
          x: src.x,
          y: src.y,
          dx: src.dx * Math.cos(a) - src.dy * Math.sin(a),
          dy: src.dx * Math.sin(a) + src.dy * Math.cos(a),
          dead: false,
          trail: [],
        });
      }
    }
  }

  private gameOver(): void {
    this.setPhase('over');
    this.wideT = this.slowT = 0;
    sfx.gameOver();
    if (this.score > this.best.high) {
      this.best = { high: this.score, level: this.level };
      this.newBest = true;
      saveData('vortex', this.best);
      sfx.highScore();
    }
  }

  // ---------------------------------------------------------------- drawing

  draw(g: Ctx): void {
    const { w, h } = this.env;
    const { cx, cy, p } = this;
    if (this.env.color) {
      const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) / 2);
      bg.addColorStop(0, p.bg[0]);
      bg.addColorStop(1, p.bg[1]);
      g.fillStyle = bg;
    } else g.fillStyle = LCD[0];
    g.fillRect(0, 0, w, h);
    if (p.stars) {
      for (const s of this.stars) {
        const x = cx + Math.cos(s.a) * s.r;
        const y = cy + Math.sin(s.a) * s.r;
        g.globalAlpha = 0.25 + 0.6 * s.s * Math.min(1, s.r / 60);
        g.fillStyle = s.s > 0.8 ? '#cbb8ff' : '#ffffff';
        g.fillRect(x, y, s.s > 0.7 ? 1.5 : 1, s.s > 0.7 ? 1.5 : 1);
      }
      g.globalAlpha = 1;
    }

    g.save();
    if (this.shake > 0) g.translate(rand(-1, 1) * this.shake * 8, rand(-1, 1) * this.shake * 8);

    // track
    g.strokeStyle = p.track;
    g.lineWidth = 1;
    if (!this.env.color) g.setLineDash([2, 4]);
    g.beginPath();
    g.arc(cx, cy, this.Rp, 0, TAU);
    g.stroke();
    g.setLineDash([]);

    for (const ring of this.rings) this.drawRing(g, ring);
    this.drawCore(g);
    for (const c of this.caps) this.drawCapsule(g, c);
    this.drawPaddle(g);
    for (const b of this.balls) this.drawBall(g, b);
    this.parts.draw(g);
    this.pops.draw(g, !this.env.color);
    g.restore();

    this.drawHud(g);
    this.drawOverlay(g);
  }

  private sector(g: Ctx, r0: number, r1: number, a0: number, a1: number): void {
    g.beginPath();
    g.arc(this.cx, this.cy, r1, a0, a1);
    g.arc(this.cx, this.cy, r0, a1, a0, true);
    g.closePath();
  }

  private drawRing(g: Ctx, ring: Ring): void {
    const segA = TAU / ring.n;
    const p = this.p;
    const lcd = !this.env.color;
    ring.segs.forEach((s, k) => {
      if (s.hp <= 0) return;
      const a0 = ring.angle + k * segA + SEG_GAP / 2;
      const a1 = ring.angle + (k + 1) * segA - SEG_GAP / 2;
      const base = s.kind === 'steel' ? p.steel : s.kind === 'hard' ? p.hard : p.rings[ring.i];
      this.sector(g, ring.r0, ring.r1, a0, a1);
      g.fillStyle = base;
      g.fill();
      if (s.kind === 'hard' && lcd) {
        g.strokeStyle = LCD[3];
        g.lineWidth = 1;
        g.stroke();
      }
      // outer rim highlight
      if (s.kind !== 'steel') {
        g.strokeStyle = lcd ? (s.kind === 'hard' ? LCD[3] : p.ringHi[ring.i]) : s.kind === 'hard' ? '#ffffff' : p.ringHi[ring.i];
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(this.cx, this.cy, ring.r1 - 1, a0 + 0.01, a1 - 0.01);
        g.stroke();
      } else {
        const m = (a0 + a1) / 2;
        const rm = (ring.r0 + ring.r1) / 2;
        g.fillStyle = lcd ? LCD[1] : '#b4bbcb';
        g.fillRect(this.cx + Math.cos(m) * rm - 1, this.cy + Math.sin(m) * rm - 1, 2, 2);
      }
      if (s.kind === 'hard' && s.hp === 1) {
        const m = (a0 + a1) / 2;
        g.strokeStyle = p.crack;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(this.cx + Math.cos(m - 0.05) * ring.r0, this.cy + Math.sin(m - 0.05) * ring.r0);
        g.lineTo(this.cx + Math.cos(m + 0.03) * (ring.r0 + 5), this.cy + Math.sin(m + 0.03) * (ring.r0 + 5));
        g.lineTo(this.cx + Math.cos(m - 0.02) * ring.r1, this.cy + Math.sin(m - 0.02) * ring.r1);
        g.stroke();
      }
      if (s.flash > 0) {
        if (lcd) {
          if (s.flash > 0.5) {
            this.sector(g, ring.r0 + 2, ring.r1 - 2, a0 + 0.02, a1 - 0.02);
            g.fillStyle = LCD[0];
            g.fill();
          }
        } else {
          this.sector(g, ring.r0, ring.r1, a0, a1);
          g.fillStyle = `rgba(255,255,255,${s.flash * 0.85})`;
          g.fill();
        }
      }
    });
  }

  private drawCore(g: Ctx): void {
    const { cx, cy } = this;
    const pulse = 1 + Math.sin(this.t * 4) * 0.08 + this.coreFlash * 0.25;
    if (this.env.color) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, CORE_R * 2.2 * pulse);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, this.p.core[1]);
      gr.addColorStop(1, 'rgba(193,75,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(cx, cy, CORE_R * 2.2 * pulse, 0, TAU);
      g.fill();
      g.fillStyle = this.coreFlash > 0.3 ? '#ffffff' : '#f3dcff';
      g.beginPath();
      g.arc(cx, cy, CORE_R * 0.55, 0, TAU);
      g.fill();
    } else {
      g.fillStyle = LCD[3];
      g.beginPath();
      g.arc(cx, cy, CORE_R, 0, TAU);
      g.fill();
      g.fillStyle = this.coreFlash > 0.4 ? LCD[0] : LCD[1];
      g.beginPath();
      g.arc(cx, cy, CORE_R * 0.45 * pulse, 0, TAU);
      g.fill();
    }
  }

  private drawCapsule(g: Ctx, c: Capsule): void {
    const x = this.cx + Math.cos(c.a) * c.r;
    const y = this.cy + Math.sin(c.a) * c.r;
    g.fillStyle = this.p.caps[c.type];
    rrect(g, x - 7, y - 5, 14, 10, 4);
    g.fill();
    text(g, c.type, x, y + 0.5, { size: 7, weight: 900, color: this.p.capText, align: 'center', base: 'middle' });
  }

  private drawPaddle(g: Ctx): void {
    const { cx, cy } = this;
    g.save();
    g.lineCap = 'round';
    if (this.p.paddleGlow) {
      g.shadowColor = this.p.paddleGlow;
      g.shadowBlur = 10 + this.paddleFlash * 8;
    }
    g.strokeStyle = this.paddleFlash > 0.5 && this.env.color ? '#ffffff' : this.p.paddle;
    g.lineWidth = PADDLE_T;
    g.beginPath();
    g.arc(cx, cy, this.Rp, this.pa - this.half, this.pa + this.half);
    g.stroke();
    g.restore();
    // bright inner edge
    g.strokeStyle = this.env.color ? 'rgba(255,255,255,0.75)' : LCD[1];
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, this.Rp - 1, this.pa - this.half + 0.03, this.pa + this.half - 0.03);
    g.stroke();
  }

  private drawBall(g: Ctx, b: Ball): void {
    if (this.env.color && !this.attached) {
      const n = b.trail.length / 2;
      for (let i = 0; i < n; i++) {
        g.globalAlpha = ((i + 1) / n) * 0.3;
        g.fillStyle = '#9ff0ff';
        g.beginPath();
        g.arc(b.trail[i * 2], b.trail[i * 2 + 1], BALL_R * (0.4 + (0.6 * (i + 1)) / n), 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.save();
    if (this.env.color) {
      g.shadowColor = 'rgba(255,255,255,0.9)';
      g.shadowBlur = 6;
    }
    g.fillStyle = this.p.ball;
    g.beginPath();
    g.arc(b.x, b.y, BALL_R, 0, TAU);
    g.fill();
    g.restore();
  }

  private drawHud(g: Ctx): void {
    const { w, h } = this.env;
    const p = this.p;
    const sh = this.env.color ? 'rgba(0,0,0,0.6)' : null;
    if (this.demo) {
      text(g, 'HIGH SCORE', w - 6, 12, { size: 8, color: p.hudDim, align: 'right', shadow: sh });
      text(g, String(this.best.high), w - 6, 25, { size: 12, weight: 800, color: p.hud, align: 'right', shadow: sh });
      return;
    }
    text(g, 'SCORE', 6, 12, { size: 8, color: p.hudDim, shadow: sh });
    text(g, String(this.score), 6, 25, { size: 13, weight: 800, color: p.hud, shadow: sh });
    text(g, 'LEVEL', w - 6, 12, { size: 8, color: p.hudDim, align: 'right', shadow: sh });
    text(g, String(this.level), w - 6, 25, { size: 13, weight: 800, color: p.hud, align: 'right', shadow: sh });
    text(g, 'BALLS', 6, h - 18, { size: 8, color: p.hudDim, shadow: sh });
    for (let i = 0; i < Math.max(0, this.lives); i++) {
      g.fillStyle = p.ball;
      g.beginPath();
      g.arc(10 + i * 10, h - 9, 3, 0, TAU);
      g.fill();
    }
    text(g, 'HIGH', w - 6, h - 18, { size: 8, color: p.hudDim, align: 'right', shadow: sh });
    text(g, String(Math.max(this.best.high, this.score)), w - 6, h - 5, { size: 11, weight: 800, color: p.hud, align: 'right', shadow: sh });
    let tx = 50;
    for (const [tt, label, col] of [
      [this.wideT, 'W', p.caps.W],
      [this.slowT, 'S', p.caps.S],
    ] as [number, string, string][]) {
      if (tt <= 0) continue;
      if (tt > 2.5 || Math.floor(tt * 6) % 2 === 0) text(g, label, tx, 25, { size: 10, weight: 900, color: col, shadow: sh });
      tx += 11;
    }
  }

  private drawOverlay(g: Ctx): void {
    const { w, h } = this.env;
    const ui = this.ui;
    const ph = this.phase;
    if (ph === 'title') {
      if (ui.scrim) {
        g.fillStyle = 'rgba(3,2,10,0.5)';
        g.fillRect(0, 0, w, h);
      } else {
        g.fillStyle = LCD[0];
        rrect(g, w / 2 - 88, 74, 176, 92, 8);
        g.fill();
        g.strokeStyle = LCD[3];
        g.lineWidth = 2;
        g.stroke();
      }
      drawTitle(g, 'Vortex', w / 2, 104, ui, 38);
      text(g, 'Spin the wheel to steer', w / 2, 128, { size: 11, weight: 600, color: ui.textDim, align: 'center', base: 'middle', shadow: ui.shadow });
      drawPrompt(g, 'Press Center to start', w / 2, 150, this.t, ui, 12);
      return;
    }
    if (ph === 'play' && this.attached) {
      if (this.phaseT < 1.6) {
        text(g, `Level ${this.level}`, w / 2, 42, { size: 16, weight: 800, color: ui.text, align: 'center', base: 'middle', shadow: ui.shadow });
      }
      const lab = 'Press Center to launch';
      if (Math.sin(this.t * 8.8) > -0.3) text(g, lab, w / 2, h - 9, { size: 10, weight: 700, color: ui.text, align: 'center', base: 'middle', shadow: ui.shadow });
      return;
    }
    if (ph === 'clear') {
      drawCard(g, w, h, ui, `Level ${this.level} Clear!`, [{ s: `Bonus +${this.bonus}`, size: 13, accent: true }], undefined, 200);
      return;
    }
    if (ph === 'dead' && this.lives > 0) {
      text(g, this.lives === 1 ? 'Last ball!' : `${this.lives} balls left`, w / 2, h / 2 - 44, {
        size: 13,
        weight: 800,
        color: ui.text,
        align: 'center',
        base: 'middle',
        shadow: ui.shadow,
      });
      return;
    }
    if (ph === 'over') {
      drawCard(
        g,
        w,
        h,
        ui,
        'Game Over',
        [
          { s: `Score ${this.score}`, size: 16, weight: 800 },
          this.newBest ? { s: 'New High Score!', size: 12, accent: true } : { s: `High Score ${this.best.high}`, size: 11, dim: true },
          { s: `Reached level ${this.level}`, size: 11, dim: true },
        ],
        { s: 'Press Center to play again', t: this.t },
      );
    }
  }
}

const create = (env: GameEnv) => new VortexGame(env);

export default function Vortex(props: GameProps) {
  return <GameCanvas {...props} create={create} />;
}
