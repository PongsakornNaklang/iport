/** Tiny color helpers for the hardware rendering. */

function parse(hex: string): [number, number, number] | null {
  const m = hex.trim().replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color; amt is −1..1. */
export function shade(hex: string, amt: number): string {
  const c = parse(hex);
  if (!c) return hex;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;
}

/** Mix two #rrggbb colors (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return a;
  const f = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t);
  return `rgb(${f(0)}, ${f(1)}, ${f(2)})`;
}

export function luminance(hex: string): number {
  const c = parse(hex);
  if (!c) return 0.5;
  const [r, g, b] = c.map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
