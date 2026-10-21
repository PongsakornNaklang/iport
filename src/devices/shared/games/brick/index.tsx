/**
 * Brick — the iPod's Breakout. The wheel slides the paddle (faster spins move
 * it further), Center launches the ball. The ball's angle depends on where it
 * meets the paddle. Clear the wall to advance; some bricks drop capsules.
 */
import type { WheelEvent } from '../../clickwheel/bus';
import { GameCanvas, type GameEnv, type GameImpl } from '../kit/GameCanvas';
import { approach, clamp, drawCard, drawPrompt, drawTitle, Particles, Popups, rand, rrect, text, vgrad, type Ctx } from '../kit/draw';
import { LCD, mix, uiPalette, type UiPalette } from '../kit/palette';
import { sfx, tone } from '../kit/sfx';
import { loadData, saveData } from '../kit/storage';
import type { GameProps } from '../types';

// 10 columns per row. 1–6 coloured bricks, H = hard (2 hits), S = steel (unbreakable), . = empty
const LAYOUTS: string[][] = [
  ['1111111111', '2222222222', '3333333333', '4444444444', '5555555555', '6666666666'],
  ['....11....', '...2222...', '..333333..', '.44444444.', '5555555555', '.66666666.', '..HHHHHH..'],
  ['H1H1H1H1H1', '2.2.2.2.2.', '.3.3.3.3.3', '4.4.4.4.4.', 'HHHHHHHHHH', '5555555555', '6666666666'],
  ['..1....1..', '...2..2...', '..333333..', '.44.44.44.', '5555555555', '6.666666.6', '6.6....6.6', '...HH.HH..'],
  ['HHHHHHHHHH', 'H11111111H', 'H2SS22SS2H', 'H33333333H', 'H44444444H', '5555..5555', '66......66'],
  ['1.1.1.1.1.', '.2.2.2.2.2', 'S3S3S3S3S3', '4H4H4H4H4H', '5555555555', 'HHHHHHHHHH'],
];

const HUD = 16;
const BALL_R = 3;
const PADDLE_H = 6;
const PADDLE_W = 46;
const WIDE_W = 72;
const STEEL = 8;
const HARD = 7;

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: number;
  hp: number;
  flash: number;
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
  x: number;
  y: number;
  type: CapType;
}
type Phase = 'title' | 'play' | 'clear' | 'dead' | 'over';

interface KindStyle {
  base: string;
  hi: string;
  lo: string;
}

interface Pal {
  bg: [string, string];
  grid: string | null;
  frame: string;
  hudBg: string;
  hudText: string;
  hudDim: string;
  kinds: KindStyle[];
  crack: string;
  rivet: string;
  paddle: [string, string];
  paddleCap: string;
  ball: string;
  trail: string | null;
  caps: Record<CapType, string>;
  capText: string;
}

function makePalette(color: boolean): Pal {
  if (!color) {
    const k = (base: string, hi: string, lo: string): KindStyle => ({ base, hi, lo });
    const dark = k(LCD[3], LCD[2], LCD[3]);
    const mid = k(LCD[2], LCD[1], LCD[3]);
    return {
      bg: [LCD[0], LCD[0]],
      grid: null,
      frame: LCD[3],
      hudBg: LCD[0],
      hudText: LCD[3],
      hudDim: LCD[2],
      kinds: [dark, dark, mid, dark, mid, dark, mid, k(LCD[1], LCD[0], LCD[3]), k(LCD[3], LCD[3], LCD[3])],
      crack: LCD[3],
      rivet: LCD[1],
      paddle: [LCD[3], LCD[3]],
      paddleCap: LCD[2],
      ball: LCD[3],
      trail: null,
      caps: { W: LCD[3], S: LCD[3], M: LCD[3], L: LCD[3] },
      capText: LCD[0],
    };
  }
  const rows = ['#ff5468', '#ff9f43', '#ffd84d', '#4fdc7b', '#3ec9ff', '#9a7bff'];
  const k = (base: string): KindStyle => ({ base, hi: mix(base, '#ffffff', 0.45), lo: mix(base, '#000000', 0.35) });
  return {
    bg: ['#0b1026', '#1b1240'],
    grid: 'rgba(120,140,255,0.06)',
    frame: '#3d4a7a',
    hudBg: 'rgba(0,0,0,0.38)',
    hudText: '#ffffff',
    hudDim: '#96a3cc',
    kinds: [k('#ffffff'), ...rows.map(k), k('#cfd6e4'), k('#6d7588')],
    crack: '#2a2f3d',
    rivet: '#a8b0c2',
    paddle: ['#f5f8ff', '#8b98c0'],
    paddleCap: '#3ec9ff',
    ball: '#ffffff',
    trail: '#8fd8ff',
    caps: { W: '#3ec9ff', S: '#4fdc7b', M: '#ff9f43', L: '#ff5468' },
    capText: '#ffffff',
  };
}

const CAP_LABEL: Record<CapType, string> = { W: 'WIDE', S: 'SLOW', M: 'MULTI', L: '1UP' };
const KIND_FREQ = [0, 988, 880, 784, 698, 622, 554, 466, 0];

class BrickGame implements GameImpl {
  help = ['Wheel · move paddle', 'Center · launch    Play · pause'];
  private ui: UiPalette;
  private p: Pal;
  private parts: Particles;
  private pops = new Popups();
  private phase: Phase = 'title';
  private t = 0;
  private phaseT = 0;
  private bricks: Brick[] = [];
  private balls: Ball[] = [];
  private caps: Capsule[] = [];
  private attached = true;
  private attachT = 0;
  private px: number;
  private pTarget: number;
  private pVel = 0;
  private pw = PADDLE_W;
  private py: number;
  private hold = 0;
  private score = 0;
  private lives = 3;
  private level = 1;
  private demoLevel = 1;
  private hits = 0;
  private wideT = 0;
  private slowT = 0;
  private shake = 0;
  private squash = 0;
  private aiOffset = 0;
  private best: { high: number; level: number };
  private newBest = false;
  private bonus = 0;
  private colW: number;
  private left: number;

  constructor(private env: GameEnv) {
    this.ui = uiPalette(env.color);
    this.p = makePalette(env.color);
    this.parts = new Particles(!env.color);
    this.best = loadData('brick', { high: 0, level: 1 });
    this.colW = Math.floor((env.w - 16 - 9 * 2) / 10);
    this.left = Math.round((env.w - (10 * this.colW + 9 * 2)) / 2);
    this.py = env.h - 18;
    this.px = this.pTarget = env.w / 2;
    this.buildLevel(1);
    this.serve();
  }

  // ---------------------------------------------------------------- setup

  private buildLevel(n: number): void {
    const layout = LAYOUTS[(n - 1) % LAYOUTS.length];
    const loop = Math.floor((n - 1) / LAYOUTS.length);
    const bh = 9;
    const top = HUD + 20;
    this.bricks = [];
    layout.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === '.') return;
        let kind = ch === 'H' ? HARD : ch === 'S' ? STEEL : Number(ch);
        if (loop > 0 && kind < HARD && Math.random() < 0.12 * loop) kind = HARD;
        this.bricks.push({
          x: this.left + c * (this.colW + 2),
          y: top + r * (bh + 2),
          w: this.colW,
          h: bh,
          kind,
          hp: kind === STEEL ? Infinity : kind === HARD ? 2 : 1,
          flash: 0,
        });
      });
    });
  }

  private serve(): void {
    this.balls = [{ x: this.px, y: this.py - BALL_R, dx: 0, dy: -1, dead: false, trail: [] }];
    this.caps = [];
    this.attached = true;
    this.attachT = 0;
    this.wideT = 0;
    this.slowT = 0;
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  private startGame(): void {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.hits = 0;
    this.newBest = false;
    this.parts.clear();
    this.buildLevel(1);
    this.serve();
    this.setPhase('play');
    sfx.start();
  }

  private toTitle(): void {
    this.demoLevel = 1;
    this.buildLevel(1);
    this.serve();
    this.setPhase('title');
  }

  private get demo(): boolean {
    return this.phase === 'title';
  }

  private speed(): number {
    if (this.demo) return 175;
    const base = Math.min(150 + (this.level - 1) * 12, 260);
    return base * (1 + Math.min(0.3, this.hits * 0.005)) * (this.slowT > 0 ? 0.62 : 1);
  }

  private launch(): void {
    if (!this.attached) return;
    const b = this.balls[0];
    const a = clamp(this.pVel / 900, -0.45, 0.45) + rand(-0.18, 0.18);
    b.dx = Math.sin(a);
    b.dy = -Math.cos(a);
    this.attached = false;
    if (!this.demo) tone(660, 60, { type: 'square', volume: 0.05 });
  }

  // ---------------------------------------------------------------- input

  input(e: WheelEvent): void {
    const ph = this.phase;
    if (e.type === 'scroll') {
      if (ph === 'title' || ph === 'over') return;
      const accel = 1 + Math.min(e.velocity, 48) / 16;
      this.pTarget += e.steps * 6 * accel;
      return;
    }
    if (e.type === 'down' && (e.button === 'prev' || e.button === 'next')) {
      this.hold = e.button === 'prev' ? -1 : 1;
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
      if (ph === 'play' || ph === 'dead' || ph === 'clear') this.env.pause();
      else if (ph === 'title') this.startGame();
    } else if (e.button === 'menu') {
      if (ph === 'title') this.env.exit();
      else if (ph === 'over') this.toTitle();
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
    this.squash = Math.max(0, this.squash - dt * 5);
    for (const k of this.bricks) if (k.flash > 0) k.flash = Math.max(0, k.flash - dt * 6);
    if (this.phase === 'over') return;

    const { w } = this.env;
    if (this.demo) this.aiMove();
    this.pTarget += this.hold * 380 * dt;
    this.wideT = Math.max(0, this.wideT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.pw += ((this.wideT > 0 ? WIDE_W : PADDLE_W) - this.pw) * approach(10, dt);
    this.pTarget = clamp(this.pTarget, this.pw / 2 + 3, w - this.pw / 2 - 3);
    const nx = this.px + (this.pTarget - this.px) * approach(30, dt);
    this.pVel = this.pVel * 0.6 + ((nx - this.px) / Math.max(dt, 1e-3)) * 0.4;
    this.px = nx;

    if (this.phase === 'clear') {
      if (this.phaseT > 2.4) {
        this.level++;
        this.buildLevel(this.level);
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
      const b = this.balls[0];
      b.x = this.px;
      b.y = this.py - BALL_R - 0.5;
      b.trail.length = 0;
      if (this.demo && this.attachT > 1.1) this.launch();
    } else {
      this.stepBalls(dt);
    }
    this.stepCapsules(dt);

    if (!this.bricks.some((k) => k.hp > 0 && k.kind !== STEEL)) {
      if (this.demo) {
        this.demoLevel = (this.demoLevel % LAYOUTS.length) + 1;
        this.buildLevel(this.demoLevel);
        this.serve();
      } else {
        this.bonus = 100 * this.level;
        this.score += this.bonus;
        this.caps = [];
        this.setPhase('clear');
        sfx.levelUp();
        for (let i = 0; i < 5; i++) {
          this.parts.burst(rand(40, w - 40), rand(60, 140), 18, this.p.kinds.slice(1, 7).map((k) => k.base), {
            speed: 140,
            life: 1.1,
            gravity: 120,
          });
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

  private aiMove(): void {
    // Attract mode: follow the lowest descending ball.
    let target = this.env.w / 2 + Math.sin(this.t * 1.3) * 70;
    let best = -Infinity;
    for (const b of this.balls) {
      if (!this.attached && b.dy > 0 && b.y > best) {
        best = b.y;
        target = b.x + this.aiOffset;
      }
    }
    this.pTarget += (target - this.pTarget) * 0.25;
  }

  private stepBalls(dt: number): void {
    const sp = this.speed();
    for (const b of this.balls) {
      const dist = sp * dt;
      const n = Math.max(1, Math.ceil(dist / 2));
      for (let i = 0; i < n && !b.dead; i++) this.substep(b, dist / n);
      b.trail.push(b.x, b.y);
      if (b.trail.length > 16) b.trail.splice(0, 2);
    }
    this.balls = this.balls.filter((b) => !b.dead);
  }

  private substep(b: Ball, st: number): void {
    const r = BALL_R;
    const { w, h } = this.env;
    const L = 3;
    const R = w - 3;
    const T = HUD + 3;
    b.x += b.dx * st;
    if (b.x - r < L) {
      b.x = L + r;
      b.dx = Math.abs(b.dx);
      this.wall();
    } else if (b.x + r > R) {
      b.x = R - r;
      b.dx = -Math.abs(b.dx);
      this.wall();
    } else {
      const k = this.hitBrick(b);
      if (k) {
        b.x -= b.dx * st;
        b.dx = -b.dx;
        this.damage(k, b);
      }
    }
    b.y += b.dy * st;
    if (b.y - r < T) {
      b.y = T + r;
      b.dy = Math.abs(b.dy);
      this.wall();
    } else {
      const k = this.hitBrick(b);
      if (k) {
        b.y -= b.dy * st;
        b.dy = -b.dy;
        this.damage(k, b);
      }
    }
    // paddle
    const top = this.py;
    const half = this.pw / 2 + r;
    if (b.dy > 0 && b.y + r >= top && b.y + r <= top + PADDLE_H + 3 && Math.abs(b.x - this.px) <= half) {
      const off = clamp((b.x - this.px) / half, -1, 1);
      const a = clamp(off * 1.05 + clamp(this.pVel / 2400, -0.18, 0.18), -1.15, 1.15);
      b.dx = Math.sin(a);
      b.dy = -Math.cos(a);
      b.y = top - r;
      this.squash = 1;
      if (this.demo) this.aiOffset = rand(-0.8, 0.8) * (this.pw / 2);
      else tone(392 + Math.abs(off) * 200, 45, { type: 'square', volume: 0.06, key: 'paddle' });
    }
    if (b.y - r > h + 4) b.dead = true;
  }

  private fixAngle(b: Ball): void {
    // never let the ball crawl almost horizontally
    if (Math.abs(b.dy) < 0.28) {
      b.dy = (b.dy < 0 ? -1 : 1) * 0.28;
      b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - 0.28 * 0.28);
    }
  }

  private wall(): void {
    if (!this.demo) tone(262, 25, { type: 'square', volume: 0.035, key: 'wall' });
  }

  private hitBrick(b: Ball): Brick | null {
    const r2 = BALL_R * BALL_R;
    for (const k of this.bricks) {
      if (k.hp <= 0) continue;
      const cx = clamp(b.x, k.x, k.x + k.w);
      const cy = clamp(b.y, k.y, k.y + k.h);
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy < r2) return k;
    }
    return null;
  }

  private damage(k: Brick, b: Ball): void {
    k.flash = 1;
    if (k.kind === STEEL) {
      // tiny deflection so the ball can't get stuck in a loop between steel bricks
      const a = rand(-0.06, 0.06);
      const dx = b.dx * Math.cos(a) - b.dy * Math.sin(a);
      b.dy = b.dx * Math.sin(a) + b.dy * Math.cos(a);
      b.dx = dx;
      this.fixAngle(b);
      if (!this.demo) tone(1760, 30, { type: 'square', volume: 0.04, key: 'steel' });
      return;
    }
    this.fixAngle(b);
    k.hp--;
    const st = this.p.kinds[k.kind];
    const cx = k.x + k.w / 2;
    const cy = k.y + k.h / 2;
    if (k.hp > 0) {
      this.parts.burst(cx, cy, 5, [st.hi, st.base], { speed: 60, life: 0.4, size: 2 });
      if (!this.demo) tone(1175, 35, { type: 'triangle', volume: 0.06, key: 'brick' });
      return;
    }
    this.parts.burst(cx, cy, 14, [st.base, st.hi, st.lo], { speed: 120, life: 0.75, size: 2.6, gravity: 240, vx: b.dx * 40, vy: b.dy * 40 });
    if (this.demo) return;
    const pts = k.kind === HARD ? 80 : (7 - k.kind) * 10;
    this.score += pts;
    this.hits++;
    this.pops.add(cx, cy, `+${pts}`, this.env.color ? st.hi : LCD[3]);
    tone(KIND_FREQ[k.kind] || 523, 50, { type: 'square', volume: 0.05, key: 'brick' });
    if (Math.random() < 0.11 && this.caps.length < 3) {
      const r = Math.random();
      const type: CapType = r < 0.36 ? 'W' : r < 0.62 ? 'S' : r < 0.92 ? 'M' : 'L';
      this.caps.push({ x: cx, y: cy, type });
    }
  }

  private stepCapsules(dt: number): void {
    for (const c of this.caps) {
      c.y += 62 * dt;
      if (c.y + 5 >= this.py && c.y - 5 <= this.py + PADDLE_H && Math.abs(c.x - this.px) <= this.pw / 2 + 9) {
        c.y = Infinity;
        this.collect(c);
      }
    }
    this.caps = this.caps.filter((c) => c.y < this.env.h + 10);
  }

  private collect(c: Capsule): void {
    sfx.powerUp();
    this.score += 50;
    this.pops.add(this.px, this.py - 12, CAP_LABEL[c.type], this.p.caps[c.type]);
    this.parts.burst(this.px, this.py, 12, this.p.caps[c.type], { speed: 90, life: 0.5, gravity: 0, angle: -Math.PI / 2, spread: 2.4 });
    if (c.type === 'W') this.wideT = 15;
    else if (c.type === 'S') this.slowT = 10;
    else if (c.type === 'L') this.lives = Math.min(6, this.lives + 1);
    else if (c.type === 'M') {
      const src = this.attached ? null : this.balls[0];
      if (!src) return;
      for (const a of [-0.45, 0.45]) {
        const dx = src.dx * Math.cos(a) - src.dy * Math.sin(a);
        const dy = src.dx * Math.sin(a) + src.dy * Math.cos(a);
        const b: Ball = { x: src.x, y: src.y, dx, dy, dead: false, trail: [] };
        this.fixAngle(b);
        this.balls.push(b);
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
      saveData('brick', this.best);
      sfx.highScore();
    }
  }

  // ---------------------------------------------------------------- drawing

  draw(g: Ctx): void {
    const { w, h } = this.env;
    const p = this.p;
    g.fillStyle = vgrad(g, 0, h, [
      [0, p.bg[0]],
      [1, p.bg[1]],
    ]);
    g.fillRect(0, 0, w, h);
    if (p.grid) {
      g.fillStyle = p.grid;
      for (let x = 8; x < w; x += 16) g.fillRect(x, HUD, 1, h - HUD);
      for (let y = HUD + 8; y < h; y += 16) g.fillRect(0, y, w, 1);
    }

    g.save();
    if (this.shake > 0) g.translate(rand(-1, 1) * this.shake * 8, rand(-1, 1) * this.shake * 8);
    // side walls + ceiling
    g.fillStyle = p.frame;
    g.fillRect(0, HUD, 2, h - HUD);
    g.fillRect(w - 2, HUD, 2, h - HUD);
    g.fillRect(0, HUD, w, 2);

    for (const k of this.bricks) if (k.hp > 0) this.drawBrick(g, k);
    for (const c of this.caps) this.drawCapsule(g, c);
    this.drawPaddle(g);
    for (const b of this.balls) this.drawBall(g, b);
    this.parts.draw(g);
    this.pops.draw(g, !this.env.color);
    g.restore();

    this.drawHud(g);
    this.drawOverlay(g);
  }

  private drawBrick(g: Ctx, k: Brick): void {
    const st = this.p.kinds[k.kind];
    const lcd = !this.env.color;
    g.fillStyle = st.base;
    g.fillRect(k.x, k.y, k.w, k.h);
    if (k.kind === STEEL) {
      g.fillStyle = lcd ? LCD[1] : st.hi;
      g.fillRect(k.x, k.y, k.w, 1);
      g.fillStyle = this.p.rivet;
      g.fillRect(k.x + 3, k.y + 3, 2, 2);
      g.fillRect(k.x + k.w - 5, k.y + 3, 2, 2);
    } else if (lcd) {
      g.fillStyle = k.kind === HARD ? LCD[3] : LCD[1];
      if (k.kind === HARD) {
        g.strokeStyle = LCD[3];
        g.lineWidth = 1;
        g.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1);
      } else g.fillRect(k.x + 1, k.y + 1, k.w - 2, 1);
    } else {
      g.fillStyle = st.hi;
      g.fillRect(k.x, k.y, k.w, 2);
      g.fillStyle = st.lo;
      g.fillRect(k.x, k.y + k.h - 1.5, k.w, 1.5);
      g.fillRect(k.x + k.w - 1, k.y, 1, k.h);
    }
    if (k.kind === HARD && k.hp === 1) {
      g.strokeStyle = this.p.crack;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(k.x + k.w * 0.3, k.y + 1);
      g.lineTo(k.x + k.w * 0.45, k.y + k.h * 0.55);
      g.lineTo(k.x + k.w * 0.38, k.y + k.h - 1);
      g.moveTo(k.x + k.w * 0.45, k.y + k.h * 0.55);
      g.lineTo(k.x + k.w * 0.7, k.y + k.h * 0.4);
      g.stroke();
    }
    if (k.flash > 0) {
      if (lcd) {
        if (k.flash > 0.5) {
          g.fillStyle = LCD[0];
          g.fillRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2);
        }
      } else {
        g.fillStyle = `rgba(255,255,255,${k.flash * 0.85})`;
        g.fillRect(k.x, k.y, k.w, k.h);
      }
    }
  }

  private drawCapsule(g: Ctx, c: Capsule): void {
    const col = this.p.caps[c.type];
    const wob = Math.sin(this.t * 10 + c.x) * 1;
    rrect(g, c.x - 10, c.y - 4 + wob, 20, 8, 4);
    g.fillStyle = col;
    g.fill();
    if (this.env.color) {
      g.fillStyle = 'rgba(255,255,255,0.45)';
      rrect(g, c.x - 8, c.y - 3 + wob, 16, 2.5, 1.2);
      g.fill();
    }
    text(g, c.type, c.x, c.y + 0.5 + wob, { size: 7, weight: 900, color: this.p.capText, align: 'center', base: 'middle' });
  }

  private drawPaddle(g: Ctx): void {
    const s = this.squash;
    const pw = this.pw + s * 4;
    const ph = PADDLE_H - s * 1.5;
    const x = this.px - pw / 2;
    const y = this.py + s * 1.5;
    if (this.env.color) {
      g.save();
      g.shadowColor = 'rgba(62,201,255,0.55)';
      g.shadowBlur = 8;
      g.fillStyle = vgrad(g, y, y + ph, [
        [0, this.p.paddle[0]],
        [1, this.p.paddle[1]],
      ]);
      rrect(g, x, y, pw, ph, 3);
      g.fill();
      g.restore();
      g.fillStyle = this.p.paddleCap;
      rrect(g, x, y, 6, ph, 3);
      g.fill();
      rrect(g, x + pw - 6, y, 6, ph, 3);
      g.fill();
    } else {
      g.fillStyle = LCD[3];
      rrect(g, x, y, pw, ph, 2);
      g.fill();
      g.fillStyle = LCD[1];
      g.fillRect(x + 6, y + 2, pw - 12, 1);
    }
  }

  private drawBall(g: Ctx, b: Ball): void {
    if (this.p.trail && !this.attached) {
      const n = b.trail.length / 2;
      for (let i = 0; i < n; i++) {
        g.globalAlpha = ((i + 1) / n) * 0.28;
        g.fillStyle = this.p.trail;
        g.beginPath();
        g.arc(b.trail[i * 2], b.trail[i * 2 + 1], BALL_R * (0.4 + (0.6 * (i + 1)) / n), 0, Math.PI * 2);
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
    g.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  private drawHud(g: Ctx): void {
    const { w } = this.env;
    const p = this.p;
    g.fillStyle = p.hudBg;
    g.fillRect(0, 0, w, HUD);
    if (!this.env.color) {
      g.fillStyle = LCD[3];
      g.fillRect(0, HUD - 1, w, 1);
    }
    if (this.demo) {
      text(g, `HIGH SCORE ${this.best.high}`, w / 2, 8.5, { size: 10, weight: 700, color: p.hudText, align: 'center', base: 'middle' });
      return;
    }
    text(g, 'SCORE', 6, 8.5, { size: 8, weight: 700, color: p.hudDim, base: 'middle' });
    text(g, String(this.score), 38, 8.5, { size: 11, weight: 800, color: p.hudText, base: 'middle' });
    text(g, `LEVEL ${this.level}`, w / 2, 8.5, { size: 10, weight: 800, color: p.hudText, align: 'center', base: 'middle' });
    // lives as little paddles
    for (let i = 0; i < Math.max(0, this.lives); i++) {
      const x = w - 18 - i * 15;
      g.fillStyle = this.env.color ? p.paddle[0] : LCD[3];
      rrect(g, x, 6, 12, 4, 2);
      g.fill();
      if (this.env.color) {
        g.fillStyle = p.paddleCap;
        g.fillRect(x, 6, 2.5, 4);
        g.fillRect(x + 9.5, 6, 2.5, 4);
      }
    }
    // active power-up timers
    let tx = w / 2 + 34;
    for (const [tt, label, col] of [
      [this.wideT, 'W', p.caps.W],
      [this.slowT, 'S', p.caps.S],
    ] as [number, string, string][]) {
      if (tt <= 0) continue;
      if (tt > 2.5 || Math.floor(tt * 6) % 2 === 0) text(g, label, tx, 8.5, { size: 9, weight: 900, color: col, base: 'middle' });
      tx += 10;
    }
  }

  private drawOverlay(g: Ctx): void {
    const { w, h } = this.env;
    const ui = this.ui;
    const ph = this.phase;
    if (ph === 'title') {
      if (ui.scrim) {
        g.fillStyle = 'rgba(5,8,20,0.55)';
        g.fillRect(0, HUD, w, h - HUD);
      } else {
        g.fillStyle = LCD[0];
        rrect(g, w / 2 - 92, 72, 184, 104, 8);
        g.fill();
        g.strokeStyle = LCD[3];
        g.lineWidth = 2;
        g.stroke();
      }
      drawTitle(g, 'Brick', w / 2, 104, ui, 40);
      if (this.env.color) {
        const cols = this.p.kinds.slice(1, 7);
        cols.forEach((c, i) => {
          g.fillStyle = c.base;
          g.fillRect(w / 2 - 51 + i * 17.5, 128, 15, 4);
        });
      }
      drawPrompt(g, 'Press Center to start', w / 2, 154, this.t, ui, 12);
      return;
    }
    if (ph === 'play' && this.attached) {
      if (this.phaseT < 1.6) {
        text(g, `Level ${this.level}`, w / 2, h * 0.56, { size: 20, weight: 800, color: ui.text, align: 'center', base: 'middle', shadow: ui.shadow });
      }
      drawPrompt(g, 'Press Center to launch', w / 2, h * 0.66, this.t, ui, 11);
      return;
    }
    if (ph === 'clear') {
      drawCard(g, w, h, ui, `Level ${this.level} Clear!`, [{ s: `Bonus +${this.bonus}`, size: 13, accent: true }], undefined, 200);
      return;
    }
    if (ph === 'dead' && this.lives > 0) {
      text(g, this.lives === 1 ? 'Last ball!' : `${this.lives} balls left`, w / 2, h * 0.6, {
        size: 14,
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

const create = (env: GameEnv) => new BrickGame(env);

export default function Brick(props: GameProps) {
  return <GameCanvas {...props} create={create} />;
}
