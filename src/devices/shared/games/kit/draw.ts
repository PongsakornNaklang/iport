/** Canvas helpers shared by the games: text, rounded rects, overlays, particles. */
import { font, type UiPalette } from './palette';

export type Ctx = CanvasRenderingContext2D;

export interface TextOpts {
  size?: number;
  weight?: number | string;
  color: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  /** drop shadow colour (1px down) */
  shadow?: string | null;
  /** squeeze the text to this width if it is longer */
  max?: number;
}

export function text(g: Ctx, s: string, x: number, y: number, o: TextOpts): void {
  g.font = font(o.size ?? 12, o.weight ?? 700);
  g.textAlign = o.align ?? 'left';
  g.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow) {
    g.fillStyle = o.shadow;
    g.fillText(s, x, y + 1, o.max);
  }
  g.fillStyle = o.color;
  g.fillText(s, x, y, o.max);
}

/** Truncate with an ellipsis so `s` fits in `maxW` at the current font. */
export function ellipsize(g: Ctx, s: string, maxW: number): string {
  if (g.measureText(s).width <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (g.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo).trimEnd() + '…';
}

export function rrect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function vgrad(g: Ctx, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

/** On/off at `hz` blinks per second (for "Press Center" prompts). */
export function blink(t: number, hz = 1.4): boolean {
  return (t * hz) % 1 < 0.62;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
/** Frame-rate independent exponential approach factor. */
export const approach = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Big game title with a soft glow (colour) or a solid outline (LCD). */
export function drawTitle(g: Ctx, s: string, x: number, y: number, ui: UiPalette, size = 34, colorFill?: string): void {
  g.font = font(size, 800);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (ui.shadow) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 2;
    g.fillStyle = colorFill ?? ui.text;
    g.fillText(s, x, y);
    g.restore();
  } else {
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.strokeStyle = '#d1dbe0';
    g.strokeText(s, x, y);
    g.fillStyle = ui.text;
    g.fillText(s, x, y);
  }
}

/** Blinking prompt, e.g. "Press Center to start". */
export function drawPrompt(g: Ctx, s: string, x: number, y: number, t: number, ui: UiPalette, size = 12): void {
  if (!blink(t)) return;
  text(g, s, x, y, { size, color: ui.text, align: 'center', base: 'middle', shadow: ui.shadow });
}

/**
 * A centred card with a heading and lines of text (game over, level clear…).
 * Returns the card rect so callers can draw extra content inside.
 */
export function drawCard(
  g: Ctx,
  w: number,
  h: number,
  ui: UiPalette,
  heading: string,
  lines: { s: string; size?: number; weight?: number; dim?: boolean; accent?: boolean }[],
  prompt?: { s: string; t: number },
  cardW = 210,
): { x: number; y: number; w: number; h: number } {
  const lh = lines.reduce((a, l) => a + (l.size ?? 12) + 5, 0);
  const ch = 40 + lh + (prompt ? 22 : 4);
  const cx = Math.round((w - cardW) / 2);
  const cy = Math.round((h - ch) / 2);
  if (ui.scrim) {
    g.fillStyle = ui.scrim;
    g.fillRect(0, 0, w, h);
  }
  g.save();
  if (ui.shadow) {
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 3;
    g.fillStyle = 'rgba(18,22,34,0.94)';
  } else {
    g.fillStyle = ui.panel;
  }
  rrect(g, cx, cy, cardW, ch, 10);
  g.fill();
  g.restore();
  g.lineWidth = ui.shadow ? 1 : 2;
  g.strokeStyle = ui.shadow ? 'rgba(255,255,255,0.16)' : ui.panelEdge;
  rrect(g, cx + 0.5, cy + 0.5, cardW - 1, ch - 1, 10);
  g.stroke();
  const fg = ui.shadow ? '#fff' : ui.panelText;
  const dim = ui.shadow ? 'rgba(255,255,255,0.65)' : ui.panelDim;
  text(g, heading, w / 2, cy + 22, { size: 20, weight: 800, color: fg, align: 'center', base: 'middle' });
  let y = cy + 40;
  for (const l of lines) {
    const size = l.size ?? 12;
    y += size + 5;
    text(g, l.s, w / 2, y - 3, {
      size,
      weight: l.weight ?? 600,
      color: l.accent ? ui.accent : l.dim ? dim : fg,
      align: 'center',
      max: cardW - 16,
    });
  }
  if (prompt && blink(prompt.t)) {
    text(g, prompt.s, w / 2, cy + ch - 13, { size: 11, weight: 600, color: dim, align: 'center', base: 'middle' });
  }
  return { x: cx, y: cy, w: cardW, h: ch };
}

/** The shared pause screen: "Paused" + a short menu (Resume / … / Quit). */
export function drawPauseMenu(g: Ctx, w: number, h: number, ui: UiPalette, items: string[], sel: number, help: string[] = []): void {
  const pw = 200;
  const rowH = 24;
  const ph = 38 + items.length * rowH + (help.length ? help.length * 13 + 10 : 0) + 8;
  const x = Math.round((w - pw) / 2);
  const y = Math.round((h - ph) / 2);
  if (ui.scrim) {
    g.fillStyle = ui.scrim;
    g.fillRect(0, 0, w, h);
  }
  g.save();
  if (ui.shadow) {
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 4;
  } else {
    // hard drop shadow in the LCD's mid shade
    g.fillStyle = '#56697a';
    rrect(g, x + 3, y + 3, pw, ph, 8);
    g.fill();
  }
  g.fillStyle = ui.panel;
  rrect(g, x, y, pw, ph, 8);
  g.fill();
  g.restore();
  g.lineWidth = ui.shadow ? 1 : 2;
  g.strokeStyle = ui.panelEdge;
  rrect(g, x + 0.5, y + 0.5, pw - 1, ph - 1, 8);
  g.stroke();

  text(g, 'Paused', w / 2, y + 20, { size: 16, weight: 800, color: ui.panelText, align: 'center', base: 'middle' });
  g.fillStyle = ui.shadow ? 'rgba(0,0,0,0.12)' : ui.panelDim;
  g.fillRect(x + 10, y + 34, pw - 20, 1);
  items.forEach((it, i) => {
    const ry = y + 38 + i * rowH;
    const on = i === sel;
    if (on) {
      g.fillStyle = vgrad(g, ry, ry + rowH - 2, [
        [0, ui.sel[0]],
        [1, ui.sel[1]],
      ]);
      rrect(g, x + 8, ry, pw - 16, rowH - 2, 5);
      g.fill();
    }
    text(g, it, x + 18, ry + rowH / 2, { size: 13, weight: 700, color: on ? ui.selText : ui.panelText, base: 'middle' });
    if (on) {
      // iPod-style chevron
      g.strokeStyle = ui.selText;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + pw - 24, ry + 7);
      g.lineTo(x + pw - 19, ry + rowH / 2 - 1);
      g.lineTo(x + pw - 24, ry + rowH - 9);
      g.stroke();
    }
  });
  help.forEach((s, i) => {
    text(g, s, w / 2, y + 38 + items.length * rowH + 12 + i * 13, {
      size: 10,
      weight: 500,
      color: ui.panelDim,
      align: 'center',
      base: 'middle',
      max: pw - 14,
    });
  });
}

// ------------------------------------------------------------------ particles

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  round: boolean;
}

export interface BurstOpts {
  speed?: number;
  life?: number;
  size?: number;
  gravity?: number;
  drag?: number;
  /** direction (radians) and spread (radians); default: all around */
  angle?: number;
  spread?: number;
  round?: boolean;
  vx?: number;
  vy?: number;
}

/** Simple particle system. In LCD mode particles shrink instead of fading (no in-between shades). */
export class Particles {
  list: Particle[] = [];
  constructor(private lcd: boolean) {}

  burst(x: number, y: number, n: number, colors: string | readonly string[], o: BurstOpts = {}): void {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2) : Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 80) * (0.35 + Math.random() * 0.65);
      const life = (o.life ?? 0.6) * (0.6 + Math.random() * 0.4);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * sp + (o.vx ?? 0),
        vy: Math.sin(a) * sp + (o.vy ?? 0),
        life,
        max: life,
        size: (o.size ?? 2.5) * (0.7 + Math.random() * 0.6),
        color: typeof colors === 'string' ? colors : colors[Math.floor(Math.random() * colors.length)],
        gravity: o.gravity ?? 160,
        drag: o.drag ?? 1.5,
        round: o.round ?? false,
      });
    }
    if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
  }

  update(dt: number): void {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) {
        l[i] = l[l.length - 1];
        l.pop();
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(g: Ctx): void {
    for (const p of this.list) {
      const k = p.life / p.max;
      const s = this.lcd ? p.size * (0.3 + 0.7 * k) : p.size;
      if (!this.lcd) g.globalAlpha = Math.min(1, k * 1.6);
      g.fillStyle = p.color;
      if (p.round) {
        g.beginPath();
        g.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    g.globalAlpha = 1;
  }

  clear(): void {
    this.list.length = 0;
  }
}

/** Floating "+50" score popups. */
export class Popups {
  list: { x: number; y: number; s: string; life: number; color: string }[] = [];
  add(x: number, y: number, s: string, color: string): void {
    this.list.push({ x, y, s, life: 0.9, color });
  }
  update(dt: number): void {
    for (const p of this.list) {
      p.life -= dt;
      p.y -= 22 * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  draw(g: Ctx, lcd: boolean): void {
    for (const p of this.list) {
      if (!lcd) g.globalAlpha = Math.min(1, p.life * 2.5);
      text(g, p.s, p.x, p.y, { size: 10, weight: 800, color: p.color, align: 'center', base: 'middle', shadow: lcd ? null : 'rgba(0,0,0,0.6)' });
    }
    g.globalAlpha = 1;
  }
}
