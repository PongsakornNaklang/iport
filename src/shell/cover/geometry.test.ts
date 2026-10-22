import { describe, expect, it } from 'vitest';
import { MODELS } from '../../devices/registry';
import { buildShell } from '../edgeShell';
import { coverGeometry, holeMask, holesOnFacet, roundedInset } from './geometry';

const fitted = MODELS.filter((m) => m.cover && m.jack);

describe('cover geometry', () => {
  it('leaves room for the iPod inside every case', () => {
    for (const m of fitted.filter((x) => x.cover!.cases)) {
      for (const kind of ['silicone', 'leather', 'clear'] as const) {
        const g = coverGeometry(m.cover!, kind, m.jack!.pxPerMm, m.size);
        expect(g.w).toBeGreaterThan(m.size.width);
        expect(g.h).toBeGreaterThan(m.size.height);
        expect(g.d).toBeGreaterThan(m.size.depth);
        // where the body's front and back faces are, the rounded edge is still outside the body
        const front = (g.d / 2 + g.cz - m.size.depth / 2) / g.d;
        const back = (g.d / 2 + g.cz + m.size.depth / 2) / g.d;
        for (const u of [front, back]) expect(roundedInset(u, g.d, g.round)).toBeLessThan(g.t);
      }
    }
  });

  it('cuts every case hole into the facets of the wall it is on', () => {
    for (const m of fitted.filter((x) => x.cover!.cases)) {
      const g = coverGeometry(m.cover!, 'silicone', m.jack!.pxPerMm, m.size);
      const facets = buildShell(g.w, g.h, g.d, g.radius, (u) => ({ inset: roundedInset(u, g.d, g.round), color: '#000' }));
      for (const hole of g.holes) {
        const hit = facets.filter((fa) => holesOnFacet(fa, [hole]).length > 0);
        expect(hit.length).toBeGreaterThan(0);
        // only facets facing the same way as the wall
        for (const fa of hit) expect(fa.frame.N[0] * hole.n[0] + fa.frame.N[1] * hole.n[1] + fa.frame.N[2] * hole.n[2]).toBeGreaterThan(0.3);
      }
    }
  });

  it('puts the iPod in a one-piece sock, pulled a third of the way out', () => {
    for (const m of fitted) {
      const g = coverGeometry(m.cover!, 'sock', m.jack!.pxPerMm, m.size);
      const s = g.sock!;
      const H = m.size.height;
      const rows = s.rows;
      // the opening a third of the way down; the sleeve runs past the iPod's bottom
      expect(s.mouth).toBeGreaterThan(-H / 2 + H * 0.25);
      expect(s.mouth).toBeLessThan(0);
      expect(rows[0].y).toBe(s.mouth);
      expect(rows[s.sleeve].y).toBeGreaterThan(H / 2);
      // the sleeve holds the iPod
      expect(rows[0].w).toBeGreaterThan(m.size.width);
      expect(rows[0].d).toBeGreaterThan(m.size.depth);
      // one piece: rows go down, never wider than the sleeve, and close in a flat seam
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].y).toBeGreaterThan(rows[i - 1].y);
        expect(rows[i].w).toBeLessThanOrEqual(rows[0].w + 1e-9);
        expect(rows[i].d).toBeLessThanOrEqual(rows[i - 1].d + 1e-9);
      }
      expect(rows[rows.length - 1].d).toBeLessThan(rows[0].d * 0.05);
      // the cuff is the top part; the stage makes room for the whole sock
      expect(s.cuffEnd).toBeGreaterThan(s.mouth);
      expect(s.cuffEnd).toBeLessThan(rows[s.sleeve].y);
      expect(g.bounds.height / 2).toBeGreaterThanOrEqual(rows[rows.length - 1].y);
      // the toe bends below the narrowing
      for (const h of s.hinges) expect(rows[h].y).toBeGreaterThan(rows[s.sleeve].y);
    }
  });

  it('draws holes as cut-outs in an otherwise full mask', () => {
    const url = holeMask(100, 20, [{ x: 10, y: 4, w: 30, h: 12 }], (r) => Math.min(r.w, r.h) / 2);
    const svg = decodeURIComponent(url.slice('url("data:image/svg+xml,'.length, -2));
    expect(svg).toContain("fill-rule='evenodd'");
    expect(svg).toContain('M0 0H100V20H0Z');
    expect(svg).toContain('A6 6');
  });
});
