/**
 * Solitaire (Klondike), like iPod Solitaire. The wheel moves a hand around
 * the table (clockwise: stock → waste → foundations → tableau right to left),
 * Center picks cards up and puts them down. Picking up from a column takes
 * every face-up card; dropping moves just the part that fits, so any run can
 * be split. Double-click Center (or press Play) to send a card home.
 * Prev = undo, Next = jump between the top row and the tableau.
 */
import type { WheelEvent } from '../../clickwheel/bus';
import { GameCanvas, type GameEnv, type GameImpl, type PauseItem } from '../kit/GameCanvas';
import { approach, clamp, drawCard, drawPrompt, drawTitle, ease, rand, rrect, text, vgrad, type Ctx } from '../kit/draw';
import { LCD, uiPalette, type UiPalette } from '../kit/palette';
import { notes, sfx, tone } from '../kit/sfx';
import { loadData, saveData } from '../kit/storage';
import type { GameProps } from '../types';
import { cardPalette, drawCardAt, drawHand, drawSuit, isRed, type Card, type CardPal } from './cards';

const STOCK = 0;
const WASTE = 1;
const F0 = 2;
const T0 = 6;
/** Cursor order around the table, clockwise. */
const ORDER = [0, 1, 2, 3, 4, 5, 12, 11, 10, 9, 8, 7, 6];
const isFound = (p: number) => p >= F0 && p < T0;
const isTab = (p: number) => p >= T0;
const STATUS = 15;
const TWEEN = 0.17;
const FLIP = 0.18;

interface Stats {
  mode: 1 | 3;
  played1: number;
  won1: number;
  best1: number;
  played3: number;
  won3: number;
  best3: number;
}

type Phase = 'title' | 'deal' | 'play' | 'auto' | 'cascade' | 'won';

interface Flyer {
  c: Card;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface TablePal {
  felt: [string, string];
  bar: string;
  barText: string;
  barDim: string;
  slot: string;
  slotMark: string;
  pick: string;
  ok: string;
  handFill: string;
  handLine: string;
}

function tablePalette(color: boolean): TablePal {
  return color
    ? {
        felt: ['#2f9655', '#145233'],
        bar: 'rgba(0,0,0,0.28)',
        barText: '#ffffff',
        barDim: 'rgba(255,255,255,0.7)',
        slot: 'rgba(255,255,255,0.35)',
        slotMark: 'rgba(255,255,255,0.3)',
        pick: '#ffd23f',
        ok: '#7dff9a',
        handFill: '#ffffff',
        handLine: '#111111',
      }
    : {
        felt: [LCD[1], LCD[1]],
        bar: LCD[1],
        barText: LCD[3],
        barDim: LCD[2],
        slot: LCD[2],
        slotMark: LCD[2],
        pick: LCD[3],
        ok: LCD[3],
        handFill: LCD[0],
        handLine: LCD[3],
      };
}

class SolitaireGame implements GameImpl {
  help = ['Center · pick up / drop (double: send home)', 'Play · send home   Prev · undo', 'Next · jump between rows'];
  private ui: UiPalette;
  private tp: TablePal;
  private cp: CardPal;
  private phase: Phase = 'title';
  private t = 0;
  private phaseT = 0;
  private cards: Card[] = [];
  private piles: Card[][] = [];
  private cursor = 0;
  private held: { pile: number; index: number } | null = null;
  private hand = { x: 0, y: 0 };
  private moves = 0;
  private time = 0;
  private started = false;
  private undo: { piles: number[][]; moves: number }[] = [];
  private lastClick = { t: -1, pile: -1 };
  private stats: Stats;
  private menuSel = 0;
  private draw3 = false;
  private autoT = 0;
  private bad = 0;
  private flyers: Flyer[] = [];
  private queue: Card[] = [];
  private trail: HTMLCanvasElement | null = null;
  private newBest = false;
  private readonly cw = 40;
  private readonly ch = 54;
  private readonly gap: number;
  private readonly margin: number;
  private readonly topY = STATUS + 4;
  private readonly tabY: number;

  constructor(private env: GameEnv) {
    this.ui = uiPalette(env.color);
    this.tp = tablePalette(env.color);
    this.cp = cardPalette(env.color);
    this.stats = loadData<Stats>('solitaire', { mode: 1, played1: 0, won1: 0, best1: 0, played3: 0, won3: 0, best3: 0 });
    this.menuSel = this.stats.mode === 3 ? 1 : 0;
    this.gap = Math.max(2, Math.floor((env.w - 7 * this.cw - 8) / 6));
    this.margin = Math.round((env.w - 7 * this.cw - 6 * this.gap) / 2);
    this.tabY = this.topY + this.ch + 6;
    for (let s = 0; s < 4; s++) {
      for (let r = 1; r <= 13; r++) {
        this.cards.push({ id: s * 13 + r - 1, suit: s, rank: r, up: false, ax: 0, ay: 0, sx: 0, sy: 0, tx: NaN, ty: NaN, t0: -1, wait: 0, flipT0: -1 });
      }
    }
    this.piles = Array.from({ length: 13 }, () => []);
    // decorative layout behind the title screen
    this.deal(false);
    for (const c of this.cards) this.snap(c);
  }

  // ---------------------------------------------------------------- geometry

  private colX(i: number): number {
    return this.margin + i * (this.cw + this.gap);
  }

  private pileXY(p: number): { x: number; y: number } {
    if (p === STOCK) return { x: this.colX(0), y: this.topY };
    if (p === WASTE) return { x: this.colX(1), y: this.topY };
    if (isFound(p)) return { x: this.colX(3 + p - F0), y: this.topY };
    return { x: this.colX(p - T0), y: this.tabY };
  }

  private fanSteps(pile: Card[]): { down: number; up: number } {
    let nDown = 0;
    let nUp = 0;
    for (const c of pile) c.up ? nUp++ : nDown++;
    const avail = this.env.h - 3 - this.tabY - this.ch;
    let down = 4;
    let up = 13;
    if (nDown * down + Math.max(0, nUp - 1) * up > avail && nUp > 1) up = Math.max(6, (avail - nDown * down) / (nUp - 1));
    if (nDown * down + Math.max(0, nUp - 1) * up > avail) down = 2;
    return { down, up };
  }

  /** Where each card of pile `p` sits. */
  private cardPositions(p: number): { x: number; y: number }[] {
    const pile = this.piles[p];
    const { x, y } = this.pileXY(p);
    if (isTab(p)) {
      const f = this.fanSteps(pile);
      let yy = y;
      return pile.map((c) => {
        const pos = { x, y: yy };
        yy += c.up ? f.up : f.down;
        return pos;
      });
    }
    if (p === WASTE && this.draw3) {
      const n = pile.length;
      const shown = Math.min(3, n);
      return pile.map((_, i) => {
        const k = n - 1 - i; // 0 = top
        return { x: x + (k < 3 ? (shown - 1 - k) * 11 : 0), y };
      });
    }
    if (p === STOCK) return pile.map((_, i) => ({ x: x - Math.min(2, Math.floor(i / 8)) * 0.5, y: y - Math.min(2, Math.floor(i / 8)) * 0.5 }));
    return pile.map(() => ({ x, y }));
  }

  /** Point the hand's fingertip at for the current cursor pile. */
  private handTarget(): { x: number; y: number } {
    const p = ORDER[this.cursor];
    const pile = this.piles[p];
    const pos = this.cardPositions(p);
    const base = this.pileXY(p);
    const fx = this.cw * 0.6;
    if (this.held) {
      if (isTab(p)) {
        if (!pile.length) return { x: base.x + fx, y: base.y + 10 };
        const last = pos[pos.length - 1];
        const lastCard = pile[pile.length - 1];
        const off = p === this.held.pile ? 0 : lastCard.up ? this.fanSteps(pile).up : 4;
        const yy = p === this.held.pile ? pos[this.held.index].y : last.y + off;
        return { x: base.x + fx, y: yy + 10 };
      }
      const top = pos[pos.length - 1] ?? base;
      return { x: top.x + fx, y: top.y + 18 };
    }
    if (isTab(p) && pile.length) {
      const i = this.firstUp(p);
      const at = pos[i >= 0 ? i : pile.length - 1];
      return { x: at.x + fx, y: at.y + (i >= 0 && i < pile.length - 1 ? 7 : 20) };
    }
    const top = pos[pos.length - 1] ?? base;
    return { x: top.x + fx, y: top.y + 22 };
  }

  private firstUp(p: number): number {
    const pile = this.piles[p];
    for (let i = 0; i < pile.length; i++) if (pile[i].up) return i;
    return -1;
  }

  // ---------------------------------------------------------------- dealing

  private deal(animate: boolean): void {
    const deck = [...this.cards];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.piles = Array.from({ length: 13 }, () => []);
    const stockPos = this.pileXY(STOCK);
    for (const c of deck) {
      c.up = false;
      c.flipT0 = -1;
      c.wait = 0;
      if (animate) {
        c.ax = c.tx = stockPos.x;
        c.ay = c.ty = stockPos.y;
        c.t0 = -1;
      }
    }
    let k = 0;
    let n = 0;
    for (let row = 0; row < 7; row++) {
      for (let col = row; col < 7; col++) {
        const c = deck[k++];
        const up = col === row;
        this.piles[T0 + col].push(c);
        if (animate) {
          c.wait = n * 0.035;
          if (up) {
            c.up = true;
            c.flipT0 = this.t + c.wait + TWEEN * 0.6;
          }
        } else c.up = up;
        n++;
      }
    }
    this.piles[STOCK] = deck.slice(k);
  }

  private newGame(mode: 1 | 3): void {
    this.draw3 = mode === 3;
    this.stats.mode = mode;
    saveData('solitaire', this.stats);
    this.deal(true);
    this.held = null;
    this.moves = 0;
    this.time = 0;
    this.started = false;
    this.undo = [];
    this.cursor = 0;
    this.newBest = false;
    this.trail = null;
    this.flyers = [];
    const h = this.handTarget();
    this.hand = { ...h };
    this.setPhase('deal');
    notes(
      Array.from({ length: 8 }, (_, i) => [700 + (i % 2) * 120, 18] as [number, number]),
      { type: 'triangle', volume: 0.03, step: 110 },
    );
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  // ---------------------------------------------------------------- rules

  private canFound(c: Card, f: number): boolean {
    const pile = this.piles[f];
    const top = pile[pile.length - 1];
    return top ? top.suit === c.suit && c.rank === top.rank + 1 : c.rank === 1;
  }

  private canTab(c: Card, t: number): boolean {
    const pile = this.piles[t];
    const top = pile[pile.length - 1];
    return top ? top.up && isRed(top.suit) !== isRed(c.suit) && c.rank === top.rank - 1 : c.rank === 13;
  }

  /** Index into the held run of the first card that can go on pile `p`, or -1. */
  private dropIndex(p: number): number {
    if (!this.held) return -1;
    const run = this.piles[this.held.pile].slice(this.held.index);
    if (isFound(p)) return this.canFound(run[run.length - 1], p) ? run.length - 1 : -1;
    if (isTab(p)) {
      for (let i = 0; i < run.length; i++) if (this.canTab(run[i], p)) return i;
    }
    return -1;
  }

  private snapshot(): void {
    this.undo.push({ piles: this.piles.map((p) => p.map((c) => c.id * 2 + (c.up ? 1 : 0))), moves: this.moves });
    if (this.undo.length > 300) this.undo.shift();
  }

  private doUndo(): void {
    const s = this.undo.pop();
    if (!s) {
      sfx.error();
      return;
    }
    this.held = null;
    this.piles = s.piles.map((p) =>
      p.map((v) => {
        const c = this.cards[v >> 1];
        const up = (v & 1) === 1;
        if (up !== c.up) c.flipT0 = this.t;
        c.up = up;
        return c;
      }),
    );
    this.moves = s.moves;
    tone(520, 40, { type: 'triangle', volume: 0.05 });
    tone(390, 60, { type: 'triangle', volume: 0.05, delayMs: 40 });
  }

  private moved(): void {
    this.moves++;
    if (!this.started) {
      this.started = true;
      if (this.draw3) this.stats.played3++;
      else this.stats.played1++;
      saveData('solitaire', this.stats);
    }
  }

  private flipTop(p: number): void {
    const pile = this.piles[p];
    const top = pile[pile.length - 1];
    if (top && !top.up) {
      top.up = true;
      top.flipT0 = this.t + 0.05;
      tone(1400, 20, { type: 'triangle', volume: 0.03, delayMs: 50 });
    }
  }

  private moveCards(from: number, index: number, to: number): void {
    const run = this.piles[from].splice(index);
    this.piles[to].push(...run);
    if (isTab(from)) this.flipTop(from);
    if (isFound(to)) {
      const c = run[run.length - 1];
      tone(660 + c.rank * 45, 70, { type: 'triangle', volume: 0.07 });
    } else tone(520, 40, { type: 'triangle', volume: 0.06 });
  }

  private drawStock(): void {
    const stock = this.piles[STOCK];
    const waste = this.piles[WASTE];
    if (!stock.length) {
      if (!waste.length) {
        sfx.error();
        return;
      }
      this.snapshot();
      this.piles[STOCK] = waste.reverse().map((c) => {
        c.up = false;
        return c;
      });
      this.piles[WASTE] = [];
      this.moved();
      notes([[900, 25], [700, 25], [500, 40]], { type: 'triangle', volume: 0.04 });
      return;
    }
    this.snapshot();
    const n = Math.min(this.draw3 ? 3 : 1, stock.length);
    for (let i = 0; i < n; i++) {
      const c = stock.pop()!;
      c.up = true;
      c.flipT0 = this.t + i * 0.05;
      c.wait = i * 0.05;
      waste.push(c);
      tone(760 + i * 60, 22, { type: 'triangle', volume: 0.04, delayMs: i * 50 });
    }
    this.moved();
  }

  /** Send the top card of pile `p` (or the held card) to a foundation. */
  private sendHome(p: number): boolean {
    const pile = this.piles[p];
    const c = pile[pile.length - 1];
    if (!c || !c.up || isFound(p)) return false;
    for (let f = F0; f < T0; f++) {
      if (this.canFound(c, f)) {
        this.snapshot();
        this.held = null;
        this.moveCards(p, pile.length - 1, f);
        this.moved();
        this.checkWin();
        return true;
      }
    }
    return false;
  }

  private checkWin(): void {
    const homed = this.piles.slice(F0, T0).reduce((a, p) => a + p.length, 0);
    if (homed === 52) {
      this.win();
      return;
    }
    if (this.phase === 'play' && !this.piles[STOCK].length && !this.piles[WASTE].length && this.piles.slice(T0).every((p) => p.every((c) => c.up))) {
      this.held = null;
      this.setPhase('auto');
    }
  }

  private win(): void {
    this.held = null;
    const t = Math.floor(this.time);
    if (this.draw3) {
      this.stats.won3++;
      if (!this.stats.best3 || t < this.stats.best3) {
        this.stats.best3 = t;
        this.newBest = true;
      }
    } else {
      this.stats.won1++;
      if (!this.stats.best1 || t < this.stats.best1) {
        this.stats.best1 = t;
        this.newBest = true;
      }
    }
    saveData('solitaire', this.stats);
    notes([[523, 90], [659, 90], [784, 90], [1047, 90], [784, 90], [1047, 90], [1319, 300]], { type: 'square', volume: 0.05 });
    // the classic bouncing-cards finale
    this.queue = [];
    for (let r = 13; r >= 1; r--) for (let f = F0; f < T0; f++) {
      const c = this.piles[f].find((x) => x.rank === r);
      if (c) this.queue.push(c);
    }
    const tr = document.createElement('canvas');
    tr.width = this.env.w * 2;
    tr.height = this.env.h * 2;
    tr.getContext('2d')?.scale(2, 2);
    this.trail = tr;
    this.flyers = [];
    this.autoT = 0.5;
    this.setPhase('cascade');
  }

  // ---------------------------------------------------------------- input

  input(e: WheelEvent): void {
    const ph = this.phase;
    if (ph === 'title') {
      if (e.type === 'scroll') {
        const n = clamp(this.menuSel + Math.sign(e.steps), 0, 1);
        if (n !== this.menuSel) this.menuSel = n;
      } else if (e.type === 'click') {
        if (e.button === 'select' || e.button === 'play') this.newGame(this.menuSel === 1 ? 3 : 1);
        else if (e.button === 'menu') this.env.exit();
      }
      return;
    }
    if (ph === 'cascade' || ph === 'won') {
      if (e.type !== 'click') return;
      if (e.button === 'select' && (ph === 'won' || this.phaseT > 0.5)) {
        if (ph === 'cascade') this.setPhase('won');
        else this.newGame(this.draw3 ? 3 : 1);
      } else if (e.button === 'menu') this.setPhase('title');
      return;
    }
    if (ph !== 'play') return;
    if (e.type === 'scroll') {
      this.cursor = (((this.cursor + e.steps) % ORDER.length) + ORDER.length) % ORDER.length;
      return;
    }
    if (e.type !== 'click') return;
    if (e.button === 'select') this.select();
    else if (e.button === 'play') this.playButton();
    else if (e.button === 'prev') this.doUndo();
    else if (e.button === 'next') this.jumpRow();
  }

  pausable(): boolean {
    return this.phase === 'play' || this.phase === 'deal' || this.phase === 'auto';
  }

  pauseItems(): PauseItem[] {
    return [{ label: 'New Game', action: () => this.newGame(this.draw3 ? 3 : 1) }];
  }

  private select(): void {
    const p = ORDER[this.cursor];
    const pile = this.piles[p];
    const now = this.t;
    const dbl = now - this.lastClick.t < 0.42 && this.lastClick.pile === p;
    this.lastClick = { t: now, pile: p };

    if (this.held) {
      if (p === this.held.pile) {
        // double-click on a card you just picked up sends it home
        if (dbl && this.sendHome(p)) return;
        this.held = null;
        tone(440, 30, { type: 'triangle', volume: 0.04 });
        return;
      }
      const i = this.dropIndex(p);
      if (i < 0) {
        this.bad = 0.3;
        sfx.error();
        return;
      }
      this.snapshot();
      const { pile: from, index } = this.held;
      this.held = null;
      this.moveCards(from, index + i, p);
      this.moved();
      this.checkWin();
      return;
    }

    if (p === STOCK) {
      this.drawStock();
      return;
    }
    if (!pile.length) {
      sfx.error();
      return;
    }
    if (isTab(p)) {
      const top = pile[pile.length - 1];
      if (!top.up) {
        this.snapshot();
        this.flipTop(p);
        this.moved();
        return;
      }
      this.held = { pile: p, index: this.firstUp(p) };
    } else {
      this.held = { pile: p, index: pile.length - 1 };
    }
    tone(880, 30, { type: 'triangle', volume: 0.05 });
  }

  private playButton(): void {
    if (this.held) {
      const run = this.piles[this.held.pile].length - this.held.index;
      if (run === 1 && this.sendHome(this.held.pile)) return;
      sfx.error();
      return;
    }
    if (!this.sendHome(ORDER[this.cursor])) sfx.error();
  }

  private jumpRow(): void {
    const p = ORDER[this.cursor];
    let target: number;
    if (isTab(p)) {
      const col = p - T0;
      target = col === 0 ? STOCK : col <= 2 ? WASTE : F0 + col - 3;
    } else {
      const col = p === STOCK ? 0 : p === WASTE ? 1 : 3 + p - F0;
      target = T0 + col;
    }
    this.cursor = ORDER.indexOf(target);
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    this.bad = Math.max(0, this.bad - dt);
    if (this.phase === 'play' || this.phase === 'auto') {
      if (this.started) this.time += dt;
    }
    if (this.phase === 'deal' && this.phaseT > 28 * 0.035 + TWEEN + FLIP + 0.1) this.setPhase('play');
    if (this.phase === 'auto') {
      this.autoT -= dt;
      if (this.autoT <= 0) {
        this.autoT = 0.09;
        // lowest card that can go home
        let best = -1;
        let bestRank = 99;
        for (let p = T0; p < 13; p++) {
          const pile = this.piles[p];
          const c = pile[pile.length - 1];
          if (c && c.rank < bestRank && [2, 3, 4, 5].some((f) => this.canFound(c, f))) {
            best = p;
            bestRank = c.rank;
          }
        }
        if (best >= 0) {
          const c = this.piles[best][this.piles[best].length - 1];
          const f = [2, 3, 4, 5].find((ff) => this.canFound(c, ff))!;
          this.moveCards(best, this.piles[best].length - 1, f);
          this.moves++;
        }
        if (this.piles.slice(F0, T0).reduce((a, p) => a + p.length, 0) === 52) this.win();
      }
    }
    if (this.phase === 'cascade') this.stepCascade(dt);

    // hand follows the cursor
    if (this.phase === 'play' || this.phase === 'deal') {
      const ht = this.handTarget();
      const k = approach(24, dt);
      this.hand.x += (ht.x - this.hand.x) * k;
      this.hand.y += (ht.y - this.hand.y) * k;
    }
    this.layout();
  }

  /** Give every card its target position; moved cards tween there. */
  private layout(): void {
    for (let p = 0; p < 13; p++) {
      const pos = this.cardPositions(p);
      this.piles[p].forEach((c, i) => {
        if (this.held && p === this.held.pile && i >= this.held.index) {
          const off = this.heldOffset(i - this.held.index);
          c.tx = c.ax = this.hand.x - this.cw * 0.6 - 3 + off.x;
          c.ty = c.ay = this.hand.y - 10 - 4 + off.y;
          c.t0 = -1;
          return;
        }
        this.tweenTo(c, pos[i].x, pos[i].y);
      });
    }
  }

  private heldOffset(k: number): { x: number; y: number } {
    return { x: 0, y: k * 12 };
  }

  private tweenTo(c: Card, x: number, y: number): void {
    if (Number.isNaN(c.tx)) {
      c.ax = c.tx = x;
      c.ay = c.ty = y;
      return;
    }
    if (c.tx !== x || c.ty !== y) {
      c.sx = c.ax;
      c.sy = c.ay;
      c.tx = x;
      c.ty = y;
      c.t0 = this.t;
    }
    if (c.t0 < 0) return;
    const k = clamp((this.t - c.t0 - c.wait) / TWEEN, 0, 1);
    const e = ease(k);
    c.ax = c.sx + (c.tx - c.sx) * e;
    c.ay = c.sy + (c.ty - c.sy) * e;
    if (k >= 1) {
      c.t0 = -1;
      c.wait = 0;
    }
  }

  private snap(c: Card): void {
    c.ax = c.tx;
    c.ay = c.ty;
    c.t0 = -1;
  }

  private stepCascade(dt: number): void {
    const { w, h } = this.env;
    const tg = this.trail?.getContext('2d');
    this.autoT -= dt;
    if (this.autoT <= 0 && this.queue.length) {
      this.autoT = 0.2;
      const c = this.queue.shift()!;
      // pull it off its foundation and throw it
      for (let f = F0; f < T0; f++) {
        const i = this.piles[f].indexOf(c);
        if (i >= 0) this.piles[f].splice(i, 1);
      }
      const dir = Math.random() < 0.65 ? -1 : 1;
      this.flyers.push({ c, x: c.ax, y: c.ay, vx: dir * rand(95, 230), vy: rand(-200, -20) });
      tone(400 + c.rank * 40, 30, { type: 'triangle', volume: 0.03 });
    }
    const flat = { ...this.cp, shadow: 'rgba(0,0,0,0)' };
    for (const f of this.flyers) {
      f.vy += 900 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y > h - this.ch) {
        f.y = h - this.ch;
        f.vy = -Math.abs(f.vy) * 0.75;
      }
      if (tg) drawCardAt(tg, f.c, f.x, f.y, this.cw, this.ch, this.env.color ? flat : this.cp, true);
    }
    this.flyers = this.flyers.filter((f) => f.x > -this.cw - 2 && f.x < w + 2);
    if (!this.queue.length && !this.flyers.length) this.setPhase('won');
  }

  // ---------------------------------------------------------------- drawing

  draw(g: Ctx): void {
    const { w, h } = this.env;
    if (this.env.color) {
      const bg = g.createRadialGradient(w / 2, h * 0.4, 20, w / 2, h * 0.5, w * 0.75);
      bg.addColorStop(0, this.tp.felt[0]);
      bg.addColorStop(1, this.tp.felt[1]);
      g.fillStyle = bg;
    } else g.fillStyle = this.tp.felt[0];
    g.fillRect(0, 0, w, h);

    if (this.phase === 'title') {
      this.drawTitleScreen(g);
      return;
    }
    this.drawStatus(g);
    this.drawSlots(g);

    const animating: Card[] = [];
    const heldCards: Card[] = [];
    for (let p = 0; p < 13; p++) {
      const pile = this.piles[p];
      // stock/waste/foundations only need their top few cards
      const from = isTab(p) ? 0 : Math.max(0, pile.length - 4);
      for (let i = from; i < pile.length; i++) {
        const c = pile[i];
        if (this.held && p === this.held.pile && i >= this.held.index) heldCards.push(c);
        else if (c.t0 >= 0) animating.push(c);
        else this.drawCard(g, c, c.ax, c.ay);
      }
    }
    this.drawHighlights(g);
    animating.sort((a, b) => a.t0 + a.wait - (b.t0 + b.wait));
    for (const c of animating) this.drawCard(g, c, c.ax, c.ay);
    for (const c of heldCards) this.drawCard(g, c, c.ax, c.ay, true);

    if (this.trail) g.drawImage(this.trail, 0, 0, w, h);

    if (this.phase === 'play' || this.phase === 'deal') {
      const shakeX = this.bad > 0 ? Math.sin(this.bad * 60) * 2.5 : 0;
      drawHand(g, this.hand.x + shakeX, this.hand.y, this.tp.handFill, this.tp.handLine, !!this.held);
    }
    if (this.phase === 'won') this.drawWin(g);
    if (this.phase === 'cascade' && this.phaseT > 1) {
      g.fillStyle = this.env.color ? 'rgba(0,0,0,0.6)' : LCD[3];
      rrect(g, w / 2 - 70, h - 20, 140, 16, 8);
      g.fill();
      text(g, 'Press Center to continue', w / 2, h - 12, { size: 10, weight: 700, color: this.env.color ? '#fff' : LCD[0], align: 'center', base: 'middle' });
    }
  }

  private drawCard(g: Ctx, c: Card, x: number, y: number, lift = false): void {
    let sx = 1;
    let face = c.up;
    if (c.flipT0 >= 0) {
      const k = (this.t - c.flipT0) / FLIP;
      if (k < 0) face = !c.up;
      else if (k < 1) {
        sx = Math.abs(Math.cos(k * Math.PI));
        face = k < 0.5 ? !c.up : c.up;
      } else c.flipT0 = -1;
    }
    drawCardAt(g, c, x, y, this.cw, this.ch, this.cp, face, sx, lift);
  }

  private drawSlots(g: Ctx): void {
    const tp = this.tp;
    g.lineWidth = 1;
    for (let p = 0; p < 13; p++) {
      if (p === WASTE) continue;
      const { x, y } = this.pileXY(p);
      g.strokeStyle = tp.slot;
      g.setLineDash(this.env.color ? [] : [3, 2]);
      rrect(g, x + 0.5, y + 0.5, this.cw - 1, this.ch - 1, 3);
      g.stroke();
      g.setLineDash([]);
      if (this.piles[p].length) continue;
      const cx = x + this.cw / 2;
      const cy = y + this.ch / 2;
      if (p === STOCK) {
        // recycle arrow
        g.strokeStyle = tp.slotMark;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, 8, -Math.PI * 0.35, Math.PI * 1.35);
        g.stroke();
        g.fillStyle = tp.slotMark;
        g.beginPath();
        const a = -Math.PI * 0.35;
        const ex = cx + Math.cos(a) * 8;
        const ey = cy + Math.sin(a) * 8;
        g.moveTo(ex + 4, ey - 1);
        g.lineTo(ex - 2, ey - 4);
        g.lineTo(ex - 1, ey + 3);
        g.fill();
        g.lineWidth = 1;
      } else if (isFound(p)) {
        drawSuit(g, p - F0, cx, cy, 16, tp.slotMark);
      } else {
        text(g, 'K', cx, cy + 1, { size: 15, weight: 800, color: tp.slotMark, align: 'center', base: 'middle' });
      }
    }
  }

  private drawHighlights(g: Ctx): void {
    if (this.phase !== 'play') return;
    const p = ORDER[this.cursor];
    const pos = this.cardPositions(p);
    const base = this.pileXY(p);
    g.lineWidth = 2;
    if (this.held) {
      if (p === this.held.pile || this.dropIndex(p) < 0) return;
      const pile = this.piles[p];
      const at = pile.length ? pos[pos.length - 1] : base;
      g.strokeStyle = this.tp.ok;
      rrect(g, at.x - 1, at.y - 1, this.cw + 2, this.ch + 2, 4);
      g.stroke();
      return;
    }
    if (isTab(p)) {
      const i = this.firstUp(p);
      if (i < 0) return;
      const top = pos[i];
      const bottom = pos[pos.length - 1];
      g.strokeStyle = this.tp.pick;
      rrect(g, top.x - 1, top.y - 1, this.cw + 2, bottom.y - top.y + this.ch + 2, 4);
      g.stroke();
    }
  }

  private drawStatus(g: Ctx): void {
    const { w } = this.env;
    const tp = this.tp;
    g.fillStyle = tp.bar;
    g.fillRect(0, 0, w, STATUS);
    if (!this.env.color) {
      g.fillStyle = LCD[3];
      g.fillRect(0, STATUS - 1, w, 1);
    }
    const y = STATUS / 2 + 0.5;
    text(g, 'Moves', 5, y, { size: 9, weight: 600, color: tp.barDim, base: 'middle' });
    text(g, String(this.moves), 35, y, { size: 10, weight: 800, color: tp.barText, base: 'middle' });
    text(g, this.draw3 ? 'Draw Three' : 'Draw One', w / 2, y, { size: 9, weight: 700, color: tp.barDim, align: 'center', base: 'middle' });
    text(g, fmtTime(this.time), w - 5, y, { size: 10, weight: 800, color: tp.barText, align: 'right', base: 'middle' });
  }

  private drawTitleScreen(g: Ctx): void {
    const { w, h } = this.env;
    const ui = this.ui;
    // a fan of aces
    const aces = [0, 1, 2, 3].map((s) => this.cards[s * 13]);
    aces.forEach((c, i) => {
      g.save();
      g.translate(w / 2 + (i - 1.5) * 13, 106);
      g.rotate((i - 1.5) * 0.2);
      drawCardAt(g, c, -this.cw / 2, -this.ch - 26, this.cw, this.ch, this.cp, true);
      g.restore();
    });
    drawTitle(g, 'Solitaire', w / 2, 112, ui, 30);
    const items = ['Draw One', 'Draw Three'];
    const lw = 150;
    const x = (w - lw) / 2;
    items.forEach((s, i) => {
      const y = 134 + i * 24;
      const on = i === this.menuSel;
      if (on) {
        g.fillStyle = vgrad(g, y, y + 21, [
          [0, ui.sel[0]],
          [1, ui.sel[1]],
        ]);
        rrect(g, x, y, lw, 21, 5);
        g.fill();
      } else if (this.env.color) {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        rrect(g, x, y, lw, 21, 5);
        g.fill();
      }
      text(g, s, w / 2, y + 11, { size: 13, weight: 700, color: on ? ui.selText : this.env.color ? '#fff' : LCD[3], align: 'center', base: 'middle' });
    });
    const st = this.stats;
    const three = this.menuSel === 1;
    const won = three ? st.won3 : st.won1;
    const played = three ? st.played3 : st.played1;
    const best = three ? st.best3 : st.best1;
    text(g, `Won ${won} of ${played}${best ? ` · Best ${fmtTime(best)}` : ''}`, w / 2, 192, {
      size: 10,
      weight: 600,
      color: this.env.color ? 'rgba(255,255,255,0.8)' : LCD[3],
      align: 'center',
      base: 'middle',
    });
    drawPrompt(g, 'Press Center to deal', w / 2, h - 18, this.t, ui, 11);
  }

  private drawWin(g: Ctx): void {
    const { w, h } = this.env;
    drawCard(
      g,
      w,
      h,
      this.ui,
      'You Win!',
      [
        { s: `Time ${fmtTime(this.time)} · ${this.moves} moves`, size: 13, weight: 700 },
        this.newBest ? { s: 'New best time!', size: 12, accent: true } : { s: `Best ${fmtTime(this.draw3 ? this.stats.best3 : this.stats.best1)}`, size: 11, dim: true },
      ],
      { s: 'Press Center to deal again', t: this.t },
    );
  }
}

function fmtTime(s: number): string {
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

const create = (env: GameEnv) => new SolitaireGame(env);

export default function Solitaire(props: GameProps) {
  return <GameCanvas {...props} create={create} />;
}
