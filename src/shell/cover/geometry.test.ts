import { describe, expect, it } from 'vitest';
import { MODELS } from '../../devices/registry';
import { buildShell } from '../edgeShell';
import { coverGeometry, holeMask, holesOnFacet, roundedInset } from './geometry';

const fitted = MODELS.filter((m) => m.cover && m.jack);

describe('cover geometry', () => {
  it('leaves room for the iPod inside every cover', () => {
    for (const m of fitted) {
      for (const kind of ['silicone', 'leather', 'sock'] as const) {
        if (kind !== 'sock' && !m.cover!.cases) continue;
        const g = coverGeometry(m.cover!, kind, m.jack!.pxPerMm, m.size, m.jack!.ny);
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
      const g = coverGeometry(m.cover!, 'silicone', m.jack!.pxPerMm, m.size, m.jack!.ny);
      const facets = buildShell(g.w, g.h, g.d, g.radius, (u) => ({ inset: roundedInset(u, g.d, g.round), color: '#000' }));
      for (const hole of g.holes) {
        const hit = facets.filter((fa) => holesOnFacet(fa, [hole]).length > 0);
        expect(hit.length).toBeGreaterThan(0);
        // only facets facing the same way as the wall
        for (const fa of hit) expect(fa.frame.N[0] * hole.n[0] + fa.frame.N[1] * hole.n[1] + fa.frame.N[2] * hole.n[2]).toBeGreaterThan(0.3);
      }
    }
  });

  it('opens a sock at its headphone end', () => {
    const touch = fitted.find((m) => m.id === 'touch7')!;
    const g = coverGeometry(touch.cover!, 'sock', touch.jack!.pxPerMm, touch.size, 1);
    expect(g.mouth).toBe('bottom');
    expect(g.holes).toHaveLength(1);
    expect(g.holes[0].n).toEqual([0, 1, 0]);
    // the slack is at the closed end
    expect(g.cy).toBeLessThan(0);
  });

  it('draws holes as cut-outs in an otherwise full mask', () => {
    const url = holeMask(100, 20, [{ x: 10, y: 4, w: 30, h: 12 }], (r) => Math.min(r.w, r.h) / 2);
    const svg = decodeURIComponent(url.slice('url("data:image/svg+xml,'.length, -2));
    expect(svg).toContain("fill-rule='evenodd'");
    expect(svg).toContain('M0 0H100V20H0Z');
    expect(svg).toContain('A6 6');
  });
});
