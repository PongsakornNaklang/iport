/** Vector playing cards, suits and the pointing-hand cursor for Solitaire. */
import { rrect, text, type Ctx } from '../kit/draw';
import { LCD } from '../kit/palette';

export interface Card {
  id: number;
  suit: number; // 0 ♠ 1 ♥ 2 ♣ 3 ♦
  rank: number; // 1..13
  up: boolean;
  // animation state (screen space)
  ax: number;
  ay: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t0: number;
  wait: number;
  flipT0: number;
}

export const isRed = (suit: number) => suit === 1 || suit === 3;
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface CardPal {
  face: string;
  edge: string;
  red: string;
  black: string;
  back: [string, string];
  backLine: string;
  backEdge: string;
  shadow: string | null;
}

export function cardPalette(color: boolean): CardPal {
  return color
    ? {
        face: '#ffffff',
        edge: 'rgba(0,0,0,0.35)',
        red: '#d91e2a',
        black: '#141414',
        back: ['#3a7be0', '#1d4fa6'],
        backLine: 'rgba(255,255,255,0.22)',
        backEdge: '#ffffff',
        shadow: 'rgba(0,0,0,0.35)',
      }
    : {
        face: LCD[0],
        edge: LCD[3],
        red: LCD[2],
        black: LCD[3],
        back: [LCD[2], LCD[2]],
        backLine: LCD[1],
        backEdge: LCD[0],
        shadow: null,
      };
}

/** A suit symbol of height `s` centred on (x, y). */
export function suitPath(g: Ctx, suit: number, x: number, y: number, s: number): void {
  const t = y - s / 2;
  const b = y + s / 2;
  const hw = s / 2;
  g.beginPath();
  if (suit === 1) {
    // heart
    g.moveTo(x, b);
    g.bezierCurveTo(x - hw * 0.3, b - s * 0.22, x - hw * 1.05, y + s * 0.02, x - hw * 1.0, y - s * 0.2);
    g.bezierCurveTo(x - hw * 0.95, t - s * 0.02, x - hw * 0.1, t - s * 0.04, x, t + s * 0.2);
    g.bezierCurveTo(x + hw * 0.1, t - s * 0.04, x + hw * 0.95, t - s * 0.02, x + hw * 1.0, y - s * 0.2);
    g.bezierCurveTo(x + hw * 1.05, y + s * 0.02, x + hw * 0.3, b - s * 0.22, x, b);
  } else if (suit === 3) {
    // diamond
    g.moveTo(x, t);
    g.quadraticCurveTo(x + hw * 0.35, y - s * 0.2, x + hw * 0.8, y);
    g.quadraticCurveTo(x + hw * 0.35, y + s * 0.2, x, b);
    g.quadraticCurveTo(x - hw * 0.35, y + s * 0.2, x - hw * 0.8, y);
    g.quadraticCurveTo(x - hw * 0.35, y - s * 0.2, x, t);
  } else if (suit === 0) {
    // spade
    g.moveTo(x, t);
    g.bezierCurveTo(x + hw * 0.15, t + s * 0.15, x + hw * 1.0, y - s * 0.1, x + hw * 0.95, y + s * 0.13);
    g.bezierCurveTo(x + hw * 0.9, y + s * 0.34, x + hw * 0.3, y + s * 0.36, x + s * 0.04, y + s * 0.18);
    g.lineTo(x + s * 0.2, b);
    g.lineTo(x - s * 0.2, b);
    g.lineTo(x - s * 0.04, y + s * 0.18);
    g.bezierCurveTo(x - hw * 0.3, y + s * 0.36, x - hw * 0.9, y + s * 0.34, x - hw * 0.95, y + s * 0.13);
    g.bezierCurveTo(x - hw * 1.0, y - s * 0.1, x - hw * 0.15, t + s * 0.15, x, t);
  } else {
    // club
    const r = s * 0.23;
    g.moveTo(x + r, t + r);
    g.arc(x, t + r, r, 0, Math.PI * 2);
    g.moveTo(x - s * 0.24 + r, y + s * 0.07);
    g.arc(x - s * 0.24, y + s * 0.07, r, 0, Math.PI * 2);
    g.moveTo(x + s * 0.24 + r, y + s * 0.07);
    g.arc(x + s * 0.24, y + s * 0.07, r, 0, Math.PI * 2);
    g.moveTo(x - s * 0.06, y);
    g.lineTo(x + s * 0.06, y);
    g.lineTo(x + s * 0.19, b);
    g.lineTo(x - s * 0.19, b);
    g.closePath();
    g.moveTo(x - s * 0.12, y - s * 0.02);
    g.lineTo(x + s * 0.12, y - s * 0.02);
    g.lineTo(x, y + s * 0.2);
    g.closePath();
  }
  g.closePath();
}

export function drawSuit(g: Ctx, suit: number, x: number, y: number, s: number, color: string): void {
  suitPath(g, suit, x, y, s);
  g.fillStyle = color;
  g.fill('nonzero');
}

/**
 * Draw a card with its top-left at (x, y). `sx` squashes it horizontally
 * around its centre (flip animation); `lift` adds a drop shadow.
 */
export function drawCardAt(g: Ctx, c: Card, x: number, y: number, w: number, h: number, pal: CardPal, faceUp: boolean, sx = 1, lift = false): void {
  g.save();
  if (sx !== 1) {
    g.translate(x + w / 2, 0);
    g.scale(Math.max(0.02, sx), 1);
    g.translate(-(x + w / 2), 0);
  }
  if (pal.shadow) {
    g.shadowColor = pal.shadow;
    g.shadowBlur = lift ? 8 : 1.5;
    g.shadowOffsetY = lift ? 4 : 0.5;
    g.shadowOffsetX = lift ? 2 : 0;
  } else if (lift) {
    g.fillStyle = LCD[3];
    rrect(g, x + 2, y + 2, w, h, 3);
    g.fill();
  }
  rrect(g, x, y, w, h, 3);
  if (faceUp) {
    g.fillStyle = pal.face;
    g.fill();
    g.restore();
    g.save();
    if (sx !== 1) {
      g.translate(x + w / 2, 0);
      g.scale(Math.max(0.02, sx), 1);
      g.translate(-(x + w / 2), 0);
    }
    g.strokeStyle = pal.edge;
    g.lineWidth = 0.75;
    rrect(g, x + 0.375, y + 0.375, w - 0.75, h - 0.75, 3);
    g.stroke();
    drawFace(g, c, x, y, w, h, pal);
  } else {
    g.fillStyle = pal.back[0];
    g.fill();
    g.restore();
    g.save();
    if (sx !== 1) {
      g.translate(x + w / 2, 0);
      g.scale(Math.max(0.02, sx), 1);
      g.translate(-(x + w / 2), 0);
    }
    drawBack(g, x, y, w, h, pal);
  }
  g.restore();
}

function drawFace(g: Ctx, c: Card, x: number, y: number, w: number, h: number, pal: CardPal): void {
  const col = isRed(c.suit) ? pal.red : pal.black;
  const r = RANKS[c.rank];
  text(g, r, x + 3, y + 10.5, { size: r === '10' ? 10 : 11, weight: 800, color: col });
  drawSuit(g, c.suit, x + w - 7, y + 6.5, 8, col);
  const cx = x + w / 2;
  const cy = y + h / 2 + 5;
  if (c.rank >= 11) {
    // court card: framed letter with a suit pip
    g.strokeStyle = col;
    g.lineWidth = 0.75;
    rrect(g, x + 6.5, y + 15.5, w - 13, h - 20, 2);
    g.stroke();
    text(g, r, cx, cy + 1, { size: 18, weight: 800, color: col, align: 'center', base: 'middle' });
    drawSuit(g, c.suit, cx, y + h - 9, 6, col);
  } else if (c.rank === 1) {
    drawSuit(g, c.suit, cx, cy, 22, col);
  } else {
    drawSuit(g, c.suit, cx, cy, 17, col);
  }
}

function drawBack(g: Ctx, x: number, y: number, w: number, h: number, pal: CardPal): void {
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, pal.back[0]);
  gr.addColorStop(1, pal.back[1]);
  rrect(g, x, y, w, h, 3);
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = pal.backEdge;
  g.lineWidth = 1.5;
  rrect(g, x + 2.25, y + 2.25, w - 4.5, h - 4.5, 2);
  g.stroke();
  // lattice
  g.save();
  rrect(g, x + 3, y + 3, w - 6, h - 6, 1.5);
  g.clip();
  g.strokeStyle = pal.backLine;
  g.lineWidth = 1;
  g.beginPath();
  for (let d = -h; d < w + h; d += 6) {
    g.moveTo(x + d, y);
    g.lineTo(x + d + h, y + h);
    g.moveTo(x + d + h, y);
    g.lineTo(x + d, y + h);
  }
  g.stroke();
  g.restore();
  if (pal.shadow === null) {
    g.strokeStyle = LCD[3];
    g.lineWidth = 0.75;
    rrect(g, x + 0.375, y + 0.375, w - 0.75, h - 0.75, 3);
    g.stroke();
  }
}

/** Pointing-hand cursor with the fingertip at (x, y). */
export function drawHand(g: Ctx, x: number, y: number, fill: string, line: string, grab = false): void {
  g.save();
  g.translate(x, y);
  g.rotate(-0.35);
  g.lineWidth = 1;
  g.lineJoin = 'round';
  g.strokeStyle = line;
  g.fillStyle = fill;
  const fingerLen = grab ? 5 : 8;
  // palm + curled fingers
  g.beginPath();
  g.moveTo(-1.8, fingerLen);
  g.lineTo(-1.8, 1.5);
  g.arc(0, 1.5, 1.8, Math.PI, 0);
  g.lineTo(1.8, fingerLen);
  // knuckles of the three curled fingers
  g.arc(3.4, fingerLen + 0.4, 1.6, Math.PI, 0);
  g.arc(6.6, fingerLen + 1.1, 1.6, Math.PI, 0);
  g.arc(9.4, fingerLen + 2.2, 1.5, Math.PI, 0.2);
  g.lineTo(10.6, fingerLen + 8);
  g.quadraticCurveTo(9.5, fingerLen + 12.5, 5, fingerLen + 12.5);
  g.lineTo(2, fingerLen + 12.5);
  g.quadraticCurveTo(-2, fingerLen + 11.5, -4.2, fingerLen + 6.5);
  // thumb
  g.lineTo(-5.6, fingerLen + 3);
  g.quadraticCurveTo(-5.2, fingerLen + 1.2, -3.2, fingerLen + 2.6);
  g.lineTo(-1.8, fingerLen + 4.5);
  g.closePath();
  g.fill();
  g.stroke();
  // cuff
  g.beginPath();
  g.moveTo(0.5, fingerLen + 12.5);
  g.lineTo(0.5, fingerLen + 15.5);
  g.lineTo(8.5, fingerLen + 15.5);
  g.lineTo(8.5, fingerLen + 12.5);
  g.fill();
  g.stroke();
  g.restore();
}
