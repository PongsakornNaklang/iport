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

  it('puts the iPod in a sock pulled a third of the way out, with the toe below', () => {
    for (const m of fitted) {
      const g = coverGeometry(m.cover!, 'sock', m.jack!.pxPerMm, m.size);
      const s = g.sock!;
      const H = m.size.height;
      // opening a third of the way down, sleeve to just past the bottom
      expect(s.mouth).toBeGreaterThan(-H / 2 + H * 0.25);
      expect(s.mouth).toBeLessThan(0);
      expect(s.sleeve.cy + s.sleeve.h / 2).toBeGreaterThan(H / 2);
      // a narrower, flatter toe hanging below, tucked into the sleeve
      expect(s.toe.w).toBeLessThan(s.sleeve.w);
      expect(s.toe.d).toBeLessThan(s.sleeve.d);
      expect(s.toe.cy - s.toe.h / 2).toBeLessThan(s.sleeve.cy + s.sleeve.h / 2);
      // the sleeve holds the iPod: its rounded edge clears the body at the faces
      const u = (s.sleeve.d / 2 - m.size.depth / 2) / s.sleeve.d;
      expect(roundedInset(u, s.sleeve.d, s.sleeve.round)).toBeLessThan(g.t);
      // the stage makes room for all of it
      expect(g.bounds.height / 2).toBeGreaterThanOrEqual(s.toe.cy + s.toe.h / 2);
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
