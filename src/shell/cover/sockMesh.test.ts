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

  /** a point of the facet's box, where the matrix puts it */
  const at = (m: number[], x: number, y: number) => {
    const W = m[3] * x + m[7] * y + m[15];
    return [0, 1, 2].map((i) => (m[i] * x + m[4 + i] * y + m[12 + i]) / W);
  };

  it('faces every facet outwards', () => {
    for (const fa of sockMesh(rows, girth(rows[2]))) {
      const m = parse(fa.matrix);
      const N = [m[8], m[9], m[10]];
      const c = at(m, fa.w / 2, fa.h / 2);
      expect(N[0] * c[0] + N[2] * c[2]).toBeGreaterThan(0);
    }
  });

  it('puts every facet exactly on its piece of the surface, corners on the cross-sections', () => {
    const a = ring(rows[1], 4);
    const b = ring(rows[2], 4);
    const f = sockMesh(rows, girth(rows[2])).filter((x) => x.row === 1);
    expect(f).toHaveLength(a.length - 1);
    const near = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    f.forEach((fa, j) => {
      const m = parse(fa.matrix);
      const corners = [at(m, 0, 0), at(m, fa.w, 0), at(m, fa.w, fa.h), at(m, 0, fa.h)];
      // each corner of the piece reaches just past one of its trapezoid's corners
      for (const want of [a[j].p, a[j + 1].p, b[j].p, b[j + 1].p]) {
        expect(Math.min(...corners.map((c) => near(c, want)))).toBeLessThan(0.6);
      }
    });
  });

  it('spreads the ribs where the knit is stretched', () => {
    const f = sockMesh(rows, girth(rows[2]));
    const sleeve = f.find((x) => x.row === 0)!;
    expect(sleeve.stretch).toBeCloseTo(girth(rows[0]) / girth(rows[2]));
    expect(sleeve.stretch).toBeGreaterThan(1);
  });
});
