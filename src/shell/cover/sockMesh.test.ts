import { describe, expect, it } from 'vitest';
import { girth, ring, sockMesh, type SockRow } from './sockMesh';

const parse = (m: string) => m.slice('matrix3d('.length, -1).split(',').map(Number);

describe('sock mesh', () => {
  const rows: SockRow[] = [
    { y: 0, w: 100, d: 30, r: 12 },
    { y: 80, w: 100, d: 30, r: 12 },
    { y: 120, w: 80, d: 10, r: 5 },
  ];

  it('walks every cross-section the same way, so facing pieces stay parallel', () => {
    const a = ring(rows[0], 4);
    const b = ring(rows[2], 4);
    expect(a).toHaveLength(b.length);
    for (let j = 0; j < a.length - 1; j++) {
      const da = [a[j + 1].p[0] - a[j].p[0], a[j + 1].p[2] - a[j].p[2]];
      const db = [b[j + 1].p[0] - b[j].p[0], b[j + 1].p[2] - b[j].p[2]];
      expect(Math.abs(da[0] * db[1] - da[1] * db[0])).toBeLessThan(1e-6 * (1 + Math.hypot(...da) * Math.hypot(...db)));
    }
    // a closed loop, measured from the middle of the front
    expect(a[0].p[0]).toBeCloseTo(a[a.length - 1].p[0]);
    expect(a.find((p) => Math.abs(p.p[0]) < 1e-9 && p.p[2] > 0)?.u ?? 0).toBeCloseTo(0);
  });

  it('faces every facet outwards', () => {
    for (const fa of sockMesh(rows, girth(rows[2]))) {
      const m = parse(fa.matrix);
      const N = [m[8], m[9], m[10]];
      const O = [m[12], m[13], m[14]];
      const U = [m[0], m[1], m[2]];
      const V = [m[4], m[5], m[6]];
      const c = [0, 1, 2].map((i) => O[i] + U[i] * (fa.w / 2) + V[i] * (fa.h / 2));
      expect(N[0] * c[0] + N[2] * c[2]).toBeGreaterThan(0);
    }
  });

  it('spreads the ribs where the knit is stretched', () => {
    const f = sockMesh(rows, girth(rows[2]));
    const sleeve = f.find((x) => x.row === 0)!;
    const toe = f.find((x) => x.row === 1)!;
    expect(sleeve.stretch).toBeGreaterThan(toe.stretch);
    expect(sleeve.stretch).toBeGreaterThan(1);
  });
});
