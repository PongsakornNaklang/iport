/**
 * Parachute — the iPod take on Sabotage. Turn the wheel to swing the gun,
 * press (or hold) Center to fire. Shoot helicopters and their paratroopers
 * before they land; shoot a canopy and the trooper drops like a stone (and
 * flattens anyone below). If four troopers land on one side of the gun they
 * storm it. From wave 3, jets fly over and drop bombs at the gun.
 */
import type { WheelEvent } from '../../clickwheel/bus';
import { GameCanvas, type GameEnv, type GameImpl } from '../kit/GameCanvas';
import { approach, clamp, drawCard, drawPrompt, drawTitle, Particles, Popups, rand, rrect, text, vgrad, type Ctx } from '../kit/draw';
import { LCD, uiPalette, type UiPalette } from '../kit/palette';
import { boom, notes, sfx, tone } from '../kit/sfx';
import { loadData, saveData } from '../kit/storage';
import type { GameProps } from '../types';

const HUD = 14;
const MAX_AIM = 1.45;
const BARREL = 17;
const BULLET_SPEED = 340;
const FIRE_GAP = 0.13;
const AUTO_GAP = 0.18;
const CHUTE_SPEED = 26;
const LANDED_LIMIT = 4;

interface Craft {
  kind: 'heli' | 'jet';
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  drops: number[];
  bombAt: number | null;
  t: number;
  dead: boolean;
}
type TrooperState = 'fall' | 'chute' | 'free' | 'landed' | 'march' | 'dead';
interface Trooper {
  x: number;
  y: number;
  vy: number;
  state: TrooperState;
  openIn: number;
  t: number;
  chute: number; // canopy colour index
  open: number; // 0..1 canopy opening animation
}
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Bomb {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
type Phase = 'title' | 'play' | 'wave' | 'assault' | 'boom' | 'over';

interface Pal {
  sky: [string, string, string];
  stars: boolean;
  ground: string;
  groundTop: string;
  base: string;
  baseDark: string;
  dome: string;
  barrel: string;
  heli: string;
  heliDark: string;
  glass: string;
  rotor: string;
  beacon: string;
  jet: string;
  flame: string;
  trooper: string;
  chutes: [string, string][];
  lines: string;
  bullet: string;
  bomb: string;
  fire: string[];
  hud: string;
  hudDim: string;
  pipOn: string;
  pipOff: string;
}

function makePalette(color: boolean): Pal {
  if (!color) {
    return {
      sky: [LCD[0], LCD[0], LCD[0]],
      stars: false,
      ground: LCD[2],
      groundTop: LCD[3],
      base: LCD[3],
      baseDark: LCD[3],
      dome: LCD[2],
      barrel: LCD[3],
      heli: LCD[3],
      heliDark: LCD[3],
      glass: LCD[1],
      rotor: LCD[2],
      beacon: LCD[1],
      jet: LCD[3],
      flame: LCD[2],
      trooper: LCD[3],
      chutes: [
        [LCD[2], LCD[1]],
        [LCD[3], LCD[1]],
      ],
      lines: LCD[2],
      bullet: LCD[3],
      bomb: LCD[3],
      fire: [LCD[3], LCD[2], LCD[1]],
      hud: LCD[3],
      hudDim: LCD[2],
      pipOn: LCD[0],
      pipOff: LCD[1],
    };
  }
  return {
    sky: ['#06102a', '#15305c', '#3d5d8c'],
    stars: true,
    ground: '#2b3d22',
    groundTop: '#6b8f45',
    base: '#5b6a82',
    baseDark: '#3a465a',
    dome: '#8fa6c4',
    barrel: '#dfe7f2',
    heli: '#8e9c5c',
    heliDark: '#5d6a37',
    glass: '#9fdcff',
    rotor: 'rgba(230,236,240,0.85)',
    beacon: '#ff3b3b',
    jet: '#c3ccd9',
    flame: '#ffb347',
    trooper: '#f1e4c8',
    chutes: [
      ['#ff7a3d', '#ffffff'],
      ['#ffd23f', '#ff5468'],
      ['#4fdc7b', '#ffffff'],
    ],
    lines: 'rgba(255,255,255,0.55)',
    bullet: '#fff27a',
    bomb: '#ff5a50',
    fire: ['#fff3a0', '#ffb347', '#ff6a3d', '#7a7f8c'],
    hud: '#ffffff',
    hudDim: '#9fb3d6',
    pipOn: '#ff5a50',
    pipOff: 'rgba(255,255,255,0.18)',
  };
}

class ParachuteGame implements GameImpl {
  help = ['Wheel · aim the gun', 'Center · fire (hold for auto)', 'Each shot costs 1 point'];
  private ui: UiPalette;
  private p: Pal;
  private parts: Particles;
  private pops = new Popups();
  private phase: Phase = 'title';
  private t = 0;
  private phaseT = 0;
  private crafts: Craft[] = [];
  private troopers: Trooper[] = [];
  private bullets: Bullet[] = [];
  private bombs: Bomb[] = [];
  private stars: { x: number; y: number; s: number }[] = [];
  private queue: Craft['kind'][] = [];
  private spawnT = 0;
  private wave = 1;
  private aim = 0;
  private aimTarget = 0;
  private hold = 0;
  private holdWait = 0;
  private firing = false;
  private fireT = 0;
  private recoil = 0;
  private score = 0;
  private kills = 0;
  private shots = 0;
  private best: { high: number; wave: number };
  private newBest = false;
  private flash = 0;
  private shake = 0;
  private gx: number;
  private groundY: number;
  private baseTop: number;
  private aiT = 0;

  constructor(private env: GameEnv) {
    this.ui = uiPalette(env.color);
    this.p = makePalette(env.color);
    this.parts = new Particles(!env.color);
    this.best = loadData('parachute', { high: 0, wave: 1 });
    this.gx = env.w / 2;
    this.groundY = env.h - 12;
    this.baseTop = this.groundY - 20;
    for (let i = 0; i < 50; i++) this.stars.push({ x: rand(0, env.w), y: rand(HUD, env.h * 0.6), s: rand(0.3, 1) });
    this.startWave(2);
  }

  private get demo(): boolean {
    return this.phase === 'title';
  }
  private get pivot(): { x: number; y: number } {
    return { x: this.gx, y: this.baseTop - 3 };
  }
  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  // ---------------------------------------------------------------- waves

  private startWave(n: number): void {
    this.wave = n;
    const helis = Math.min(18, 5 + n * 2);
    const jets = n >= 3 ? Math.min(6, Math.floor((n - 1) / 2)) : 0;
    this.queue = [...Array<Craft['kind']>(helis).fill('heli'), ...Array<Craft['kind']>(jets).fill('jet')];
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    // open every wave with a few helicopters before any jet shows up
    for (let i = 0; i < Math.min(3, this.queue.length); i++) {
      if (this.queue[i] !== 'jet') continue;
      const k = this.queue.findIndex((q, j) => j >= 3 && q === 'heli');
      if (k >= 0) [this.queue[i], this.queue[k]] = [this.queue[k], this.queue[i]];
    }
    this.spawnT = 0.8;
  }

  private spawn(kind: Craft['kind']): void {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const w = this.env.w;
    const x = dir > 0 ? -20 : w + 20;
    if (kind === 'jet') {
      if (!this.demo) notes([[880, 60], [1175, 60], [880, 60], [1175, 60]], { type: 'square', volume: 0.03 });
      this.crafts.push({ kind, x, y: HUD + 10, dir, speed: 150 + this.wave * 4, drops: [], bombAt: this.gx - dir * 80, t: 0, dead: false });
      return;
    }
    const lanes = [HUD + 18, HUD + 38, HUD + 58];
    const n = this.wave >= 2 ? (Math.random() < 0.25 ? 2 : Math.random() < 0.85 ? 1 : 0) : Math.random() < 0.85 ? 1 : 0;
    const drops: number[] = [];
    for (let i = 0; i < n; i++) {
      let dx = 0;
      do dx = rand(14, w - 14);
      while (Math.abs(dx - this.gx) < 36);
      drops.push(dx);
    }
    this.crafts.push({
      kind,
      x,
      y: lanes[Math.floor(Math.random() * lanes.length)] + rand(-3, 3),
      dir,
      speed: Math.min(105, 40 + this.wave * 6) + rand(-8, 10),
      drops,
      bombAt: null,
      t: rand(0, 10),
      dead: false,
    });
  }

  private startGame(): void {
    this.crafts = [];
    this.troopers = [];
    this.bullets = [];
    this.bombs = [];
    this.parts.clear();
    this.score = 0;
    this.kills = 0;
    this.shots = 0;
    this.newBest = false;
    this.aim = this.aimTarget = 0;
    this.startWave(1);
    this.setPhase('play');
    sfx.start();
  }

  private toTitle(): void {
    this.crafts = [];
    this.troopers = [];
    this.bullets = [];
    this.bombs = [];
    this.startWave(2);
    this.setPhase('title');
  }

  // ---------------------------------------------------------------- input

  input(e: WheelEvent): void {
    const ph = this.phase;
    const live = ph === 'play' || ph === 'wave';
    if (e.type === 'scroll') {
      if (!live) return;
      const accel = 1 + Math.min(e.velocity, 40) / 20;
      this.aimTarget = clamp(this.aimTarget + e.steps * 0.045 * accel, -MAX_AIM, MAX_AIM);
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
    if (e.type === 'touch') return;
    if (e.button === 'select') {
      if (e.type === 'down' && live) {
        this.firing = true;
        if (this.fireT <= 0) this.fire();
      } else if (e.type === 'up') this.firing = false;
      else if (e.type === 'click') {
        if (ph === 'title') this.startGame();
        else if (ph === 'over' && this.phaseT > 0.8) this.startGame();
      }
      return;
    }
    if (e.type !== 'click') return;
    if (e.button === 'play') {
      if (this.pausable()) this.env.pause();
      else if (ph === 'title') this.startGame();
    } else if (e.button === 'menu') {
      if (ph === 'title') this.env.exit();
      else if (ph === 'over') this.toTitle();
    }
  }

  pausable(): boolean {
    return this.phase === 'play' || this.phase === 'wave' || this.phase === 'assault' || this.phase === 'boom';
  }

  onPause(): void {
    this.firing = false;
  }

  private fire(): void {
    if (this.bullets.length >= 10) return;
    const { x, y } = this.pivot;
    const sx = Math.sin(this.aim);
    const sy = -Math.cos(this.aim);
    this.bullets.push({ x: x + sx * BARREL, y: y + sy * BARREL, vx: sx * BULLET_SPEED, vy: sy * BULLET_SPEED });
    this.fireT = this.firing && !this.demo ? AUTO_GAP : FIRE_GAP;
    this.recoil = 1;
    this.parts.burst(x + sx * (BARREL + 2), y + sy * (BARREL + 2), 3, this.p.fire.slice(0, 2), { speed: 40, life: 0.15, gravity: 0, angle: this.aim - Math.PI / 2, spread: 0.8, size: 2 });
    if (!this.demo) {
      this.shots++;
      if (this.score > 0) this.score--;
      tone(1250, 28, { type: 'square', volume: 0.035, key: 'shot', gapMs: 60 });
    }
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    this.parts.update(dt);
    this.pops.update(dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.shake = Math.max(0, this.shake - dt);
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.fireT -= dt;
    const ph = this.phase;
    if (ph === 'over') return;

    if (this.demo) this.ai(dt);
    if (ph === 'play' || ph === 'wave' || ph === 'title') {
      if (this.hold && (this.holdWait -= dt) <= 0) this.aimTarget = clamp(this.aimTarget + this.hold * 2.2 * dt, -MAX_AIM, MAX_AIM);
      this.aim += (this.aimTarget - this.aim) * approach(35, dt);
      if (this.firing && this.fireT <= 0 && ph !== 'title') this.fire();
    }

    // spawning
    if (ph === 'play' || ph === 'title') {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.queue.length) {
        this.spawn(this.queue.shift()!);
        this.spawnT = Math.max(0.65, 2.1 - this.wave * 0.14) * rand(0.7, 1.3);
      }
      if (!this.queue.length && !this.crafts.length && !this.troopers.some((t) => t.state === 'fall' || t.state === 'chute' || t.state === 'free') && !this.bombs.length) {
        if (this.demo) this.startWave(2);
        else {
          const bonus = 25 * this.wave;
          this.score += bonus;
          this.pops.add(this.env.w / 2, this.env.h / 2 + 20, `Wave bonus +${bonus}`, this.ui.accent);
          this.setPhase('wave');
          sfx.levelUp();
        }
      }
    }
    if (ph === 'wave' && this.phaseT > 2.2) {
      this.startWave(this.wave + 1);
      this.setPhase('play');
    }

    this.stepCrafts(dt);
    this.stepBullets(dt);
    this.stepBombs(dt);
    this.stepTroopers(dt);

    if (ph === 'play' || ph === 'wave') {
      const { left, right } = this.landedCounts();
      if (left >= LANDED_LIMIT || right >= LANDED_LIMIT) this.startAssault(left >= LANDED_LIMIT ? -1 : 1);
    }
    if (ph === 'assault') {
      const marching = this.troopers.filter((t) => t.state === 'march');
      if (this.phaseT > 0.4 && Math.floor(this.phaseT * 4) !== Math.floor((this.phaseT - dt) * 4)) {
        tone(Math.floor(this.phaseT * 4) % 2 ? 880 : 660, 90, { type: 'square', volume: 0.05 });
      }
      if (marching.every((t) => Math.abs(t.x - this.gx) <= 20) || this.phaseT > 5) this.destroyGun();
    }
    if (ph === 'boom' && this.phaseT > 1.6) this.gameOver();
  }

  private landedCounts(): { left: number; right: number } {
    let left = 0;
    let right = 0;
    for (const t of this.troopers) {
      if (t.state !== 'landed') continue;
      if (t.x < this.gx) left++;
      else right++;
    }
    return { left, right };
  }

  private startAssault(side: -1 | 1): void {
    for (const t of this.troopers) {
      if (t.state === 'landed' && Math.sign(t.x - this.gx) === side) t.state = 'march';
    }
    this.firing = false;
    this.setPhase('assault');
  }

  private destroyGun(): void {
    const { x, y } = this.pivot;
    for (let i = 0; i < 4; i++) this.parts.burst(x + rand(-14, 14), y + rand(-4, 14), 22, this.p.fire, { speed: 170, life: 1.1, gravity: 120, size: 3 });
    for (const t of this.troopers) if (t.state === 'march' || Math.abs(t.x - this.gx) < 40) t.state = 'dead';
    this.flash = 1;
    this.shake = 0.8;
    boom(2.5);
    this.setPhase('boom');
  }

  private gameOver(): void {
    this.setPhase('over');
    this.firing = false;
    sfx.gameOver();
    if (this.score > this.best.high) {
      this.best = { high: this.score, wave: this.wave };
      this.newBest = true;
      saveData('parachute', this.best);
      sfx.highScore();
    }
  }

  /** Attract mode: aim at the most urgent target and fire when lined up. */
  private ai(dt: number): void {
    this.aiT -= dt;
    const { x: px, y: py } = this.pivot;
    let best: { x: number; y: number } | null = null;
    let bestY = -Infinity;
    for (const t of this.troopers) {
      if ((t.state === 'chute' || t.state === 'fall') && t.y > bestY && t.y < this.groundY - 30) {
        bestY = t.y;
        best = { x: t.x, y: t.y - 4 };
      }
    }
    if (!best) {
      for (const c of this.crafts) {
        if (c.x > 20 && c.x < this.env.w - 20) {
          const lead = (Math.hypot(c.x - px, c.y - py) / BULLET_SPEED) * c.speed * c.dir;
          best = { x: c.x + lead, y: c.y };
          break;
        }
      }
    }
    if (!best) return;
    this.aimTarget = clamp(Math.atan2(best.x - px, py - best.y), -MAX_AIM, MAX_AIM);
    if (Math.abs(this.aimTarget - this.aim) < 0.04 && this.aiT <= 0 && this.fireT <= 0) {
      this.fire();
      this.aiT = 0.35;
    }
  }

  private stepCrafts(dt: number): void {
    const w = this.env.w;
    for (const c of this.crafts) {
      c.t += dt;
      const ox = c.x;
      c.x += c.dir * c.speed * dt;
      for (let i = c.drops.length - 1; i >= 0; i--) {
        const d = c.drops[i];
        if ((ox - d) * (c.x - d) <= 0) {
          c.drops.splice(i, 1);
          this.troopers.push({ x: c.x, y: c.y + 6, vy: 10, state: 'fall', openIn: rand(0.25, 0.6), t: rand(0, 6), chute: Math.floor(Math.random() * this.p.chutes.length), open: 0 });
        }
      }
      if (c.bombAt !== null && (ox - c.bombAt) * (c.x - c.bombAt) <= 0) {
        c.bombAt = null;
        this.bombs.push({ x: c.x, y: c.y + 4, vx: c.dir * 35, vy: 0 });
        if (!this.demo) {
          // falling whistle
          for (let i = 0; i < 12; i++) tone(1500 - i * 70, 190, { type: 'sine', volume: 0.025, delayMs: i * 180 });
        }
      }
      if (c.x < -40 || c.x > w + 40) c.dead = true;
    }
    this.crafts = this.crafts.filter((c) => !c.dead);
  }

  private stepBombs(dt: number): void {
    for (const b of this.bombs) {
      b.vy += 70 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y >= this.baseTop - 6 && Math.abs(b.x - this.gx) < 22) {
        b.y = Infinity;
        if (this.demo) this.parts.burst(b.x, this.baseTop, 16, this.p.fire, { speed: 90, life: 0.6 });
        else if (this.phase === 'play' || this.phase === 'wave') this.destroyGun();
      } else if (b.y >= this.groundY) {
        this.parts.burst(b.x, this.groundY, 16, this.p.fire, { speed: 90, life: 0.6 });
        b.y = Infinity;
        boom(0.6);
      }
    }
    this.bombs = this.bombs.filter((b) => b.y < this.env.h);
  }

  private stepBullets(dt: number): void {
    const w = this.env.w;
    for (const b of this.bullets) {
      const steps = 3;
      for (let s = 0; s < steps && b.y > -10; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (this.bulletHits(b)) {
          b.y = -100;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.y > HUD - 4 && b.x > -5 && b.x < w + 5);
  }

  private award(x: number, y: number, pts: number): void {
    if (this.phase !== 'play' && this.phase !== 'wave' && this.phase !== 'assault') return;
    this.score += pts;
    this.kills++;
    this.pops.add(x, y, `+${pts}`, this.env.color ? '#ffe66b' : LCD[3]);
  }

  private bulletHits(b: Bullet): boolean {
    for (const c of this.crafts) {
      const hw = c.kind === 'jet' ? 13 : 12;
      if (Math.abs(b.x - c.x) < hw && Math.abs(b.y - c.y) < 6) {
        c.dead = true;
        this.parts.burst(c.x, c.y, 26, this.p.fire, { speed: 130, life: 0.9, gravity: 140, size: 3 });
        this.parts.burst(c.x, c.y, 8, this.env.color ? c.kind === 'jet' ? this.p.jet : this.p.heliDark : LCD[3], { speed: 80, life: 1.4, gravity: 260, size: 3.5 });
        this.award(c.x, c.y, c.kind === 'jet' ? 15 : 10);
        if (!this.demo) boom(1.2);
        return true;
      }
    }
    for (const bm of this.bombs) {
      if (Math.abs(b.x - bm.x) < 6.5 && Math.abs(b.y - bm.y) < 7.5) {
        this.parts.burst(bm.x, bm.y, 18, this.p.fire, { speed: 100, life: 0.6 });
        bm.y = Infinity;
        this.award(b.x, b.y, 10);
        if (!this.demo) boom(0.8);
        return true;
      }
    }
    for (const t of this.troopers) {
      if (t.state === 'dead' || t.state === 'landed' || t.state === 'march') continue;
      // body
      if (Math.abs(b.x - t.x) < 3.5 && b.y > t.y - 9 && b.y < t.y + 1) {
        t.state = 'dead';
        this.parts.burst(t.x, t.y - 4, 10, this.env.color ? [this.p.trooper, '#c9a27a'] : LCD[3], { speed: 60, life: 0.5, size: 2 });
        this.award(t.x, t.y - 12, 5);
        if (!this.demo) tone(300, 60, { type: 'square', volume: 0.06, key: 'hit' });
        return true;
      }
      // canopy
      if (t.state === 'chute' && t.open > 0.5) {
        const dx = (b.x - t.x) / 9;
        const dy = (b.y - (t.y - 16)) / 6;
        if (dx * dx + dy * dy < 1 && b.y < t.y - 10) {
          t.state = 'free';
          this.parts.burst(t.x, t.y - 17, 8, this.p.chutes[t.chute], { speed: 50, life: 0.6, gravity: 40, size: 2.5 });
          this.award(t.x, t.y - 22, 2);
          if (!this.demo) tone(900, 50, { type: 'triangle', volume: 0.06, key: 'rip' });
          return true;
        }
      }
    }
    return false;
  }

  private stepTroopers(dt: number): void {
    const gy = this.groundY;
    for (const t of this.troopers) {
      t.t += dt;
      if (t.state === 'fall') {
        t.vy = Math.min(150, t.vy + 220 * dt);
        t.openIn -= dt;
        if (t.openIn <= 0) {
          t.state = 'chute';
          if (!this.demo) tone(700, 40, { type: 'sine', volume: 0.03, key: 'chute' });
        }
      } else if (t.state === 'chute') {
        t.open = Math.min(1, t.open + dt * 5);
        t.vy += (CHUTE_SPEED - t.vy) * approach(4, dt);
        t.x += Math.sin(t.t * 1.8) * 6 * dt;
      } else if (t.state === 'free') {
        t.vy = Math.min(280, t.vy + 320 * dt);
      } else if (t.state === 'march') {
        const dir = Math.sign(this.gx - t.x);
        if (Math.abs(t.x - this.gx) > 20) t.x += dir * 34 * dt;
        continue;
      } else continue;
      t.y += t.vy * dt;
      if (t.y >= gy) {
        t.y = gy;
        if (t.state === 'free') {
          t.state = 'dead';
          this.parts.burst(t.x, gy - 2, 10, this.env.color ? [this.p.trooper, this.p.groundTop] : LCD[3], { speed: 60, life: 0.5, angle: -Math.PI / 2, spread: 2 });
          // flatten anyone standing underneath
          for (const o of this.troopers) {
            if (o.state === 'landed' && Math.abs(o.x - t.x) < 7) {
              o.state = 'dead';
              this.award(o.x, gy - 14, 5);
              this.parts.burst(o.x, gy - 4, 8, this.env.color ? this.p.trooper : LCD[3], { speed: 50, life: 0.5 });
            }
          }
          this.award(t.x, gy - 10, 5);
          if (!this.demo) tone(90, 110, { type: 'sawtooth', volume: 0.06 });
        } else {
          t.state = 'landed';
          // don't stand exactly on top of a comrade
          for (const o of this.troopers) if (o !== t && o.state === 'landed' && Math.abs(o.x - t.x) < 5) t.x += t.x < o.x ? -5 : 5;
          t.x = clamp(t.x, 6, this.env.w - 6);
          if (Math.abs(t.x - this.gx) < 24) t.x = this.gx + (t.x < this.gx ? -24 : 24);
          if (!this.demo) tone(120, 90, { type: 'triangle', volume: 0.08 });
          if (this.demo) {
            const { left, right } = this.landedCounts();
            if (left >= 3 || right >= 3) for (const o of this.troopers) if (o.state === 'landed') o.state = 'dead';
          }
        }
      }
    }
    this.troopers = this.troopers.filter((t) => t.state !== 'dead');
  }

  // ---------------------------------------------------------------- drawing

  draw(g: Ctx): void {
    const { w, h } = this.env;
    const p = this.p;
    g.fillStyle = vgrad(g, 0, this.groundY, [
      [0, p.sky[0]],
      [0.65, p.sky[1]],
      [1, p.sky[2]],
    ]);
    g.fillRect(0, 0, w, h);
    if (p.stars) {
      for (const s of this.stars) {
        g.globalAlpha = 0.3 + 0.5 * s.s * (0.7 + 0.3 * Math.sin(this.t * 2 + s.x));
        g.fillStyle = '#ffffff';
        g.fillRect(s.x, s.y, 1, 1);
      }
      g.globalAlpha = 1;
      // moon
      const mx = w - 46;
      const my = HUD + 30;
      const glow = g.createRadialGradient(mx, my, 6, mx, my, 30);
      glow.addColorStop(0, 'rgba(255,246,214,0.35)');
      glow.addColorStop(1, 'rgba(255,246,214,0)');
      g.fillStyle = glow;
      g.fillRect(mx - 30, my - 30, 60, 60);
      g.fillStyle = '#f6efd6';
      g.beginPath();
      g.arc(mx, my, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(170,160,130,0.3)';
      for (const [dx, dy, r] of [
        [-3, -2, 2.2],
        [3, 3, 1.6],
        [3, -3.5, 1.1],
      ]) {
        g.beginPath();
        g.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
        g.fill();
      }
    }

    g.save();
    if (this.shake > 0) g.translate(rand(-1, 1) * this.shake * 6, rand(-1, 1) * this.shake * 6);
    for (const c of this.crafts) (c.kind === 'jet' ? this.drawJet(g, c) : this.drawHeli(g, c));
    for (const t of this.troopers) this.drawTrooper(g, t);
    for (const b of this.bombs) this.drawBomb(g, b);
    g.fillStyle = p.bullet;
    for (const b of this.bullets) {
      g.fillRect(b.x - 1, b.y - 1, 2, 2);
      if (this.env.color) {
        g.globalAlpha = 0.35;
        g.fillRect(b.x - b.vx * 0.012 - 0.5, b.y - b.vy * 0.012 - 0.5, 1, 1);
        g.globalAlpha = 1;
      }
    }
    // ground
    g.fillStyle = p.ground;
    g.fillRect(0, this.groundY, w, h - this.groundY);
    g.fillStyle = p.groundTop;
    g.fillRect(0, this.groundY, w, 2);
    if (this.phase !== 'boom' && this.phase !== 'over') this.drawGun(g);
    else this.drawWreck(g);
    this.drawPips(g);
    this.parts.draw(g);
    this.pops.draw(g, !this.env.color);
    g.restore();

    if (this.flash > 0 && this.env.color) {
      g.fillStyle = `rgba(255,220,160,${this.flash * 0.5})`;
      g.fillRect(0, 0, w, h);
    }
    this.drawHud(g);
    this.drawOverlay(g);
  }

  private drawGun(g: Ctx): void {
    const p = this.p;
    const { x, y } = this.pivot;
    // barrel
    const r = this.recoil * 2.5;
    const sx = Math.sin(this.aim);
    const sy = -Math.cos(this.aim);
    g.strokeStyle = p.barrel;
    g.lineWidth = 4;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(x + sx * 4, y + sy * 4);
    g.lineTo(x + sx * (BARREL - r), y + sy * (BARREL - r));
    g.stroke();
    if (this.env.color) {
      g.strokeStyle = '#8193ab';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + sx * 4 + sy * 1.5, y + sy * 4 - sx * 1.5);
      g.lineTo(x + sx * (BARREL - r) + sy * 1.5, y + sy * (BARREL - r) - sx * 1.5);
      g.stroke();
    }
    // dome
    g.fillStyle = p.dome;
    g.beginPath();
    g.arc(x, y + 3, 9, Math.PI, 0);
    g.fill();
    // bunker
    const bx = this.gx - 20;
    g.fillStyle = p.base;
    g.beginPath();
    g.moveTo(bx, this.groundY);
    g.lineTo(bx + 5, this.baseTop);
    g.lineTo(bx + 35, this.baseTop);
    g.lineTo(bx + 40, this.groundY);
    g.closePath();
    g.fill();
    g.fillStyle = p.baseDark;
    g.fillRect(bx + 6, this.baseTop + 7, 28, 2);
    if (this.env.color) {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(bx + 5, this.baseTop, 30, 1);
    } else {
      g.fillStyle = LCD[1];
      g.fillRect(bx + 8, this.baseTop + 13, 3, 3);
      g.fillRect(bx + 29, this.baseTop + 13, 3, 3);
    }
  }

  private drawWreck(g: Ctx): void {
    const bx = this.gx - 20;
    g.fillStyle = this.p.baseDark;
    g.beginPath();
    g.moveTo(bx, this.groundY);
    g.lineTo(bx + 8, this.groundY - 9);
    g.lineTo(bx + 15, this.groundY - 5);
    g.lineTo(bx + 22, this.groundY - 12);
    g.lineTo(bx + 30, this.groundY - 6);
    g.lineTo(bx + 40, this.groundY);
    g.closePath();
    g.fill();
    if (this.env.color && Math.random() < 0.5) this.parts.burst(this.gx + rand(-10, 10), this.groundY - 8, 1, ['#555b66', '#3b3f48'], { speed: 12, life: 1.2, gravity: -25, size: 4, angle: -Math.PI / 2, spread: 0.6, round: true });
  }

  /** Four danger pips each side of the bunker: troopers landed on that side. */
  private drawPips(g: Ctx): void {
    const { left, right } = this.landedCounts();
    const y = this.groundY + 5;
    for (let i = 0; i < LANDED_LIMIT; i++) {
      g.fillStyle = i < left ? this.p.pipOn : this.p.pipOff;
      g.fillRect(this.gx - 30 - i * 7, y, 5, 4);
      g.fillStyle = i < right ? this.p.pipOn : this.p.pipOff;
      g.fillRect(this.gx + 25 + i * 7, y, 5, 4);
    }
  }

  private drawHeli(g: Ctx, c: Craft): void {
    const p = this.p;
    const { x, y, dir } = c;
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    // tail boom + tail rotor
    g.fillStyle = p.heliDark;
    g.fillRect(-15, -2, 11, 2.5);
    g.fillRect(-16, -5, 2, 5);
    const tr = Math.sin(c.t * 60) * 3;
    g.fillStyle = p.rotor;
    g.fillRect(-16.5, -3 - tr / 2, 1, Math.abs(tr) + 1);
    // body
    g.fillStyle = p.heli;
    g.beginPath();
    g.ellipse(1, 0, 8, 5, 0, 0, Math.PI * 2);
    g.fill();
    // cockpit glass
    g.fillStyle = p.glass;
    g.beginPath();
    g.ellipse(4.5, -1, 3.2, 2.6, 0, -Math.PI / 2, Math.PI / 2);
    g.fill();
    // skids
    g.fillStyle = p.heliDark;
    g.fillRect(-5, 6, 12, 1);
    g.fillRect(-3, 4.5, 1, 2);
    g.fillRect(4, 4.5, 1, 2);
    // main rotor (spinning blur)
    g.fillStyle = p.heliDark;
    g.fillRect(0, -7, 1.5, 2.5);
    const len = 11 * Math.abs(Math.cos(c.t * 28));
    g.fillStyle = p.rotor;
    g.fillRect(1 - len, -8, len * 2, 1.2);
    // beacon
    if (this.env.color && Math.floor(c.t * 3) % 2 === 0) {
      g.fillStyle = p.beacon;
      g.fillRect(-15, -6, 1.5, 1.5);
    }
    g.restore();
  }

  private drawJet(g: Ctx, c: Craft): void {
    const p = this.p;
    g.save();
    g.translate(c.x, c.y);
    g.scale(c.dir, 1);
    if (Math.floor(c.t * 30) % 2 === 0) {
      g.fillStyle = p.flame;
      g.beginPath();
      g.moveTo(-12, -1.5);
      g.lineTo(-18 - Math.random() * 3, 0);
      g.lineTo(-12, 1.5);
      g.fill();
    }
    g.fillStyle = p.jet;
    g.beginPath();
    g.moveTo(13, 0);
    g.lineTo(5, -2.5);
    g.lineTo(-12, -2.5);
    g.lineTo(-12, 2.5);
    g.lineTo(5, 2.5);
    g.closePath();
    g.fill();
    // wings + tail fin
    g.beginPath();
    g.moveTo(2, 0);
    g.lineTo(-5, -8);
    g.lineTo(-8, -8);
    g.lineTo(-5, 0);
    g.moveTo(2, 1);
    g.lineTo(-5, 7);
    g.lineTo(-8, 7);
    g.lineTo(-5, 1);
    g.moveTo(-8, -2);
    g.lineTo(-12, -7);
    g.lineTo(-13, -7);
    g.lineTo(-12, -2);
    g.fill();
    g.fillStyle = p.glass;
    g.fillRect(4, -2, 4, 1.5);
    g.restore();
  }

  private drawBomb(g: Ctx, b: Bomb): void {
    g.save();
    g.translate(b.x, b.y);
    g.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
    g.fillStyle = this.p.bomb;
    g.beginPath();
    g.ellipse(0, 0, 2.2, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-2.5, -6, 5, 1.5);
    g.restore();
  }

  private drawTrooper(g: Ctx, t: Trooper): void {
    const p = this.p;
    const x = Math.round(t.x * 2) / 2;
    const y = t.y;
    if (t.state === 'chute' || (t.state === 'fall' && t.open > 0)) {
      const o = t.open;
      const cw = 9 * (0.4 + 0.6 * o);
      const ch = 7 * o;
      const top = y - 13 - ch;
      const [c0, c1] = p.chutes[t.chute];
      // canopy with stripes
      g.save();
      g.beginPath();
      g.ellipse(x, y - 13, cw, ch + 0.01, 0, Math.PI, 0);
      g.closePath();
      g.fillStyle = c0;
      g.fill();
      g.clip();
      g.fillStyle = c1;
      g.fillRect(x - cw * 0.2, top - 1, cw * 0.4, ch + 2);
      g.restore();
      g.strokeStyle = p.lines;
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(x - cw, y - 13);
      g.lineTo(x - 1, y - 7);
      g.moveTo(x + cw, y - 13);
      g.lineTo(x + 1, y - 7);
      g.moveTo(x, y - 13);
      g.lineTo(x, y - 8);
      g.stroke();
    }
    // the trooper
    const walking = t.state === 'march';
    const leg = walking ? Math.sin(t.t * 14) * 1.5 : 0;
    g.fillStyle = p.trooper;
    g.fillRect(x - 1, y - 9, 2.5, 2.5); // head
    g.fillRect(x - 1.5, y - 6.5, 3.5, 4); // torso
    g.fillRect(x - 1.5 + leg, y - 2.5, 1.2, 2.5); // legs
    g.fillRect(x + 0.8 - leg, y - 2.5, 1.2, 2.5);
    if (t.state === 'free' || t.state === 'fall') {
      // arms flailing
      const f = Math.sin(t.t * 25) * 2;
      g.fillRect(x - 3.5, y - 7 - f, 2, 1);
      g.fillRect(x + 2, y - 7 + f, 2, 1);
    }
  }

  private drawHud(g: Ctx): void {
    const { w } = this.env;
    const p = this.p;
    g.fillStyle = this.env.color ? 'rgba(0,0,0,0.35)' : LCD[0];
    g.fillRect(0, 0, w, HUD);
    if (!this.env.color) {
      g.fillStyle = LCD[3];
      g.fillRect(0, HUD - 1, w, 1);
    }
    if (this.demo) {
      text(g, `HIGH SCORE ${this.best.high}`, w / 2, HUD / 2 + 0.5, { size: 10, color: p.hud, align: 'center', base: 'middle' });
      return;
    }
    text(g, 'SCORE', 5, HUD / 2 + 0.5, { size: 8, color: p.hudDim, base: 'middle' });
    text(g, String(this.score), 37, HUD / 2 + 0.5, { size: 11, weight: 800, color: p.hud, base: 'middle' });
    text(g, `WAVE ${this.wave}`, w / 2, HUD / 2 + 0.5, { size: 10, weight: 800, color: p.hud, align: 'center', base: 'middle' });
    text(g, `HI ${Math.max(this.best.high, this.score)}`, w - 5, HUD / 2 + 0.5, { size: 10, weight: 700, color: p.hudDim, align: 'right', base: 'middle' });
  }

  private drawOverlay(g: Ctx): void {
    const { w, h } = this.env;
    const ui = this.ui;
    const ph = this.phase;
    if (ph === 'title') {
      if (ui.scrim) {
        g.fillStyle = 'rgba(3,8,20,0.45)';
        g.fillRect(0, HUD, w, h - HUD);
      } else {
        g.fillStyle = LCD[0];
        rrect(g, w / 2 - 96, 84, 192, 86, 8);
        g.fill();
        g.strokeStyle = LCD[3];
        g.lineWidth = 2;
        g.stroke();
      }
      drawTitle(g, 'Parachute', w / 2, 112, ui, 34);
      text(g, 'Don’t let 4 land on one side', w / 2, 136, { size: 11, weight: 600, color: ui.textDim, align: 'center', base: 'middle', shadow: ui.shadow });
      drawPrompt(g, 'Press Center to start', w / 2, 156, this.t, ui, 12);
      return;
    }
    if (ph === 'play' && this.phaseT < 1.8) {
      text(g, `Wave ${this.wave}`, w / 2, h * 0.42, { size: 20, weight: 800, color: ui.text, align: 'center', base: 'middle', shadow: ui.shadow });
      if (this.wave === 1) text(g, 'Turn the wheel to aim · Center fires', w / 2, h * 0.42 + 20, { size: 10, weight: 600, color: ui.textDim, align: 'center', base: 'middle', shadow: ui.shadow });
      else if (this.wave === 3) text(g, 'Jets incoming — shoot their bombs!', w / 2, h * 0.42 + 20, { size: 10, weight: 600, color: ui.textDim, align: 'center', base: 'middle', shadow: ui.shadow });
      return;
    }
    if (ph === 'wave') {
      text(g, `Wave ${this.wave} cleared!`, w / 2, h * 0.42, { size: 18, weight: 800, color: ui.text, align: 'center', base: 'middle', shadow: ui.shadow });
      return;
    }
    if (ph === 'assault' && Math.floor(this.phaseT * 4) % 2 === 0) {
      text(g, 'They’re storming the gun!', w / 2, h * 0.42, { size: 14, weight: 800, color: this.env.color ? '#ff6a5a' : LCD[3], align: 'center', base: 'middle', shadow: ui.shadow });
      return;
    }
    if (ph === 'over') {
      const acc = this.shots ? Math.round((this.kills / this.shots) * 100) : 0;
      drawCard(
        g,
        w,
        h,
        ui,
        'Game Over',
        [
          { s: `Score ${this.score}`, size: 16, weight: 800 },
          this.newBest ? { s: 'New High Score!', size: 12, accent: true } : { s: `High Score ${this.best.high}`, size: 11, dim: true },
          { s: `Wave ${this.wave} · ${this.kills} hits · ${acc}% accuracy`, size: 11, dim: true },
        ],
        { s: 'Press Center to play again', t: this.t },
      );
    }
  }
}

const create = (env: GameEnv) => new ParachuteGame(env);

export default function Parachute(props: GameProps) {
  return <GameCanvas {...props} create={create} />;
}
