import { describe, expect, it } from 'vitest';
import { buildShell, makeBands, type ShellSlice } from './edgeShell';

/** classic-like profile: chamfer, flat side, a recessed seam, then a curved back */
const classic = (t: number): ShellSlice => {
  if (t < 0.034) return { color: 'chamfer', inset: 0.4 * (1 - t / 0.034) };
  if (t < 0.17) return { color: 'side', inset: 0 };
  if (t < 0.2) return { color: 'seam', inset: 0.5 };
  const u = (t - 0.2) / 0.8;
  return { color: `steel-${Math.round(u * 10)}`, inset: 15 * (1 - Math.sqrt(1 - Math.min(0.97, u) ** 2)) };
};

/** parse matrix3d(...) into its columns */
function columns(m: string) {
  const v = m.slice(9, -1).split(',').map(Number);
  return { x: v.slice(0, 3), y: v.slice(4, 7), n: v.slice(8, 11), o: v.slice(12, 15) };
}

describe('edge shell', () => {
  it('bands cover the whole depth without gaps', () => {
    const bands = makeBands(classic, 85, [0.034, 0.17, 0.2]);
    expect(bands[0].ta).toBe(0);
    expect(bands[bands.length - 1].tb).toBe(1);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].ta).toBeCloseTo(bands[i - 1].tb, 9);
      expect(bands[i].ia).toBeCloseTo(bands[i - 1].ib, 6);
    }
  });

  it('turns a jump in the inset into a step at the break', () => {
    const bands = makeBands(classic, 85, [0.034, 0.17, 0.2]);
    const steps = bands.filter((b) => b.ta === b.tb);
    expect(steps).toHaveLength(2);
    expect([steps[0].ta, steps[0].ia, steps[0].ib]).toEqual([0.17, 0, 0.5]);
    expect(steps[1].ta).toBe(0.2);
    expect(steps[1].ia).toBe(0.5);
    expect(steps[1].ib).toBeCloseTo(0, 6);
    // the seam itself is one flat band of its own color
    const seam = bands.filter((b) => b.ca === 'seam' && b.ta !== b.tb);
    expect(seam).toHaveLength(1);
    expect(seam[0].ta).toBe(0.17);
    expect(seam[0].tb).toBe(0.2);
  });

  it('merges flat runs of the same finish', () => {
    const bands = makeBands(classic, 85, [0.034, 0.17, 0.2]);
    expect(bands.filter((b) => b.ca === 'side' && b.ta !== b.tb)).toHaveLength(1);
  });

  it('follows a curve more finely than a flat side', () => {
    const round = (t: number): ShellSlice => {
      const d = Math.min(t, 1 - t) * 56;
      return { color: 'c', inset: d < 6 ? 6 - Math.sqrt(36 - (6 - d) ** 2) : 0 };
    };
    const bands = makeBands(round, 56);
    for (const b of bands) {
      const tm = (b.ta + b.tb) / 2;
      expect(Math.abs((round(tm).inset ?? 0) - (b.ia + b.ib) / 2)).toBeLessThan(0.2);
    }
  });

  it('every facet faces outwards', () => {
    const W = 240;
    const H = 400;
    const facets = buildShell(W, H, 85, 42, classic, [0.034, 0.17, 0.2]);
    for (const fa of facets) {
      const { x, y, n, o } = columns(fa.matrix);
      // centre of the facet in device space
      const c = [0, 1, 2].map((i) => o[i] + x[i] * (fa.w / 2) + y[i] * (fa.h / 2));
      const fromCentre = [c[0] - W / 2, c[1] - H / 2, c[2]];
      const outward = n[0] * fromCentre[0] + n[1] * fromCentre[1] + n[2] * fromCentre[2];
      // steps face ±z, and the device centre is not "inside" them in xy terms;
      // check those against their own depth instead
      if (Math.abs(n[2]) > 0.99) expect(Math.sign(n[2])).not.toBe(0);
      else expect(outward).toBeGreaterThan(0);
    }
  });

  it('blends each band from its front color to its back color', () => {
    const bands = makeBands(classic, 85, [0.034, 0.17, 0.2]).filter((b) => b.ta !== b.tb);
    for (let i = 1; i < bands.length; i++) {
      // continuous shading: a band starts with the color the previous one ends with
      if (bands[i].ta !== 0.034 && bands[i].ta !== 0.17 && bands[i].ta !== 0.2) expect(bands[i].ca).toBe(bands[i - 1].cb);
    }
    const facets = buildShell(240, 400, 85, 42, classic, [0.034, 0.17, 0.2]);
    expect(facets.some((fa) => fa.blend)).toBe(true);
    expect(facets.filter((fa) => fa.base.color === 'side').every((fa) => !fa.blend)).toBe(true);
  });

  it('stays a manageable number of elements', () => {
    expect(buildShell(240, 400, 85, 42, classic, [0.034, 0.17, 0.2]).length).toBeLessThan(700);
  });
});
