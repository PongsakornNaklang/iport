/**
 * The side of a device body as one continuous surface.
 *
 * The outline is a rounded rectangle whose inset changes with depth (that is
 * how curved or chamfered edges are described, see `EdgeSlice`). We cut the
 * depth into bands and walk the outline of each band: four straight walls and
 * a few flat facets per rounded corner. Every facet is a planar strip between
 * the outline at the band's front and back depths, so neighbouring facets
 * share their edges and nothing shows through. A stack of thin slices, which
 * is what this replaces, shows stripes when you look straight at the edge.
 *
 * Colors: each facet shows the background the edge profile gives for the
 * band's front depth, fading into the one for its back depth, so shading is
 * continuous from band to band. An inner element lays a background out the
 * way a full-size slice would have, and the facet shows a 1 px strip of it
 * just inside the rim, so gradients across the device (lighting, sheen) line
 * up exactly as before.
 *
 * Coordinates are CSS: x right, y down, z towards the viewer, origin at the
 * top-left of the device box, z = 0 at mid-depth.
 */

export interface ShellSlice {
  inset?: number;
  color: string;
}

/** A background laid out like a slice at some inset, mapped onto a facet. */
export interface FacetLayer {
  color: string;
  w: number;
  h: number;
  /** CSS 2D matrix from the slice box to the facet */
  matrix: string;
}

export interface Facet {
  key: string;
  /** CSS matrix3d placing the facet's local box (w × h at the origin) in the device */
  matrix: string;
  w: number;
  h: number;
  /** clip-path when the facet is a noticeably non-rectangular trapezoid */
  clip?: string;
  /** the band's front color */
  base: FacetLayer;
  /** the band's back color, faded in over the facet with `mask` */
  blend?: FacetLayer & { mask: string };
}

export interface Band {
  /** depth range, 0 = front, 1 = back (ta === tb for a step in the profile) */
  ta: number;
  tb: number;
  /** outline inset at ta and tb */
  ia: number;
  ib: number;
  /** background at ta and tb */
  ca: string;
  cb: string;
}

type V3 = [number, number, number];
type V2 = [number, number];

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const f = (n: number) => (Math.abs(n) < 5e-5 ? '0' : n.toFixed(4));

const EPS = 1e-6;
/** longest band, px of depth (colors are sampled at band edges) */
const BAND_PX = 5;
/** split a band when its middle is this far off a straight line, px */
const CURVE_TOL = 0.2;
/** how far a merged band may stray from the true profile, px */
const LINEAR_TOL = 0.15;
/**
 * px of overlap with neighbouring facets, so their anti-aliased edges don't
 * leave a hairline gap. Kept small: overlapping facets cross each other's
 * planes, and the browser's 3D sort cuts them there, which can leave single
 * sparkling pixels along the cut. The lining behind (see `liningSlices`)
 * makes whatever still shows through the body's own color.
 */
const OVER = 0.3;
/** px between the sides and the front/back faces, see buildShell */
const FACE_GAP = 0.08;

/**
 * Split the depth into bands. `breaks` are depths where the finish or the
 * profile changes abruptly (a seam, the edge of the cover glass): bands start
 * and end exactly there, and a jump in the inset becomes a step.
 */
export function makeBands(edge: (t: number) => ShellSlice, depth: number, breaks: number[] = []): Band[] {
  const at = (t: number) => edge(Math.min(1, Math.max(0, t)));
  const inset = (t: number) => at(t).inset ?? 0;
  const cuts = [0, ...breaks.filter((b) => b > EPS && b < 1 - EPS).sort((a, b) => a - b), 1];
  const out: Band[] = [];
  for (let s = 0; s < cuts.length - 1; s++) {
    const s0 = cuts[s];
    const s1 = cuts[s + 1];
    if (s1 - s0 < EPS) continue;
    const first = at(s0 + EPS);
    const last = at(s1 - EPS);
    let startInset = first.inset ?? 0;
    if (s > 0) {
      const before = inset(s0 - EPS);
      if (Math.abs(before - startInset) <= 0.05) startInset = before; // continuous: share the edge exactly
      else {
        // a step; it takes the finish of whichever side sticks out
        const c = before < startInset ? at(s0 - EPS).color : first.color;
        out.push({ ta: s0, tb: s0, ia: before, ib: startInset, ca: c, cb: c });
      }
    }
    const segStart = out.length;
    const push = (b: Band) => {
      const prev = out.length > segStart ? out[out.length - 1] : undefined;
      const sameColor = prev && prev.ca === prev.cb && prev.cb === b.ca && b.ca === b.cb;
      if (prev && sameColor && straight(inset, prev.ta, b.tb, prev.ia, b.ib, [prev.tb, (prev.ta + prev.tb) / 2, (b.ta + b.tb) / 2, (prev.ta + b.tb) / 2])) {
        prev.tb = b.tb;
        prev.ib = b.ib;
      } else out.push(b);
    };
    // Where the profile curves, split further so the facets follow it.
    const split = (ta: number, tb: number, ia: number, ib: number, ca: string, cb: string, level: number) => {
      const tm = (ta + tb) / 2;
      const mid = at(tm);
      const im = mid.inset ?? 0;
      if (level < 8 && (tb - ta) * depth > 0.15 && Math.abs(im - (ia + ib) / 2) > CURVE_TOL) {
        split(ta, tm, ia, im, ca, mid.color, level + 1);
        split(tm, tb, im, ib, mid.color, cb, level + 1);
        return;
      }
      push({ ta, tb, ia, ib, ca, cb });
    };
    const n = Math.max(1, Math.round(((s1 - s0) * depth) / BAND_PX));
    for (let k = 0; k < n; k++) {
      const ta = s0 + ((s1 - s0) * k) / n;
      const tb = s0 + ((s1 - s0) * (k + 1)) / n;
      const ia = k === 0 ? startInset : inset(ta);
      const ib = k === n - 1 ? (last.inset ?? 0) : inset(tb);
      const ca = k === 0 ? first.color : at(ta).color;
      const cb = k === n - 1 ? last.color : at(tb).color;
      split(ta, tb, ia, ib, ca, cb, 0);
    }
  }
  return out;
}

function straight(inset: (t: number) => number, ta: number, tb: number, ia: number, ib: number, probes: number[]): boolean {
  return probes.every((t) => Math.abs(inset(t) - (ia + ((ib - ia) * (t - ta)) / (tb - ta))) < LINEAR_TOL);
}

/**
 * A few solid layers just inside the shell. Anti-aliased edges between
 * facets let a little of whatever is behind them through; with these behind
 * every edge that is the body's own color rather than the page. They lie
 * entirely inside the (convex) shell, so nothing has to be depth-split.
 */
export function liningSlices(edge: (t: number) => ShellSlice, depth: number, R: number): { t: number; inset: number; color: string }[] {
  const n = Math.max(3, Math.min(8, Math.round(depth / 10)));
  const margin = 0.6 + R * (1 - Math.cos(Math.PI / 4 / cornerFacets(R))); // clear of the corner chords
  const out: { t: number; inset: number; color: string }[] = [];
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    // the deepest the outline goes around this depth (a step nearby must not cut through)
    const around = [t - 0.6 / depth, t, t + 0.6 / depth].map((u) => edge(Math.min(1, Math.max(0, u))).inset ?? 0);
    out.push({ t, inset: Math.max(...around) + margin, color: edge(t).color });
  }
  return out;
}

/** facets per rounded corner, so the chords stay within ~0.5 px of the arc */
export function cornerFacets(R: number): number {
  return Math.max(3, Math.min(8, Math.ceil(R / 9)));
}

/**
 * Build the facets for a rounded-rectangle body of size W × H × depth whose
 * outline has corner radius R (the outline at inset i has radius R - i).
 */
export function buildShell(W: number, H: number, depth: number, R: number, edge: (t: number) => ShellSlice, breaks?: number[]): Facet[] {
  const half = depth / 2;
  const bands = makeBands(edge, depth, breaks);
  const K = cornerFacets(R);
  const facets: Facet[] = [];
  const corners: { c: V2; a0: number }[] = [
    { c: [R, R], a0: Math.PI }, // top-left: 180°..270°
    { c: [W - R, R], a0: Math.PI * 1.5 }, // top-right
    { c: [W - R, H - R], a0: 0 }, // bottom-right
    { c: [R, H - R], a0: Math.PI * 0.5 }, // bottom-left
  ];
  const halfStep = Math.PI / 4 / K;

  // The sides stop a hair short of the front and back faces: where they would
  // touch a face's plane exactly, rounding lets their edge poke through it.
  const zAt = (t: number) => (t <= 0 ? half - FACE_GAP : t >= 1 ? -half + FACE_GAP : half - t * depth);

  bands.forEach((b, bi) => {
    const za = zAt(b.ta);
    const zb = zAt(b.tb);
    const ra = Math.max(0, R - b.ia);
    const rb = Math.max(0, R - b.ib);
    // Don't overlap past the front and back faces (it would show as a lip),
    // or across a step (it would cover part of a recessed seam).
    const step = b.ta === b.tb;
    const isStep = (x?: Band) => !x || x.ta === x.tb;
    const overTop = bi === 0 || step || isStep(bands[bi - 1]) ? 0 : OVER;
    const overBottom = bi === bands.length - 1 || step || isStep(bands[bi + 1]) ? 0 : OVER;

    /**
     * a0→a1 is the outline at the band's front depth, b0→b1 at its back
     * depth; `out2` is the outward direction of this piece of outline.
     * `rim(i)` is the matching point on the outline of a slice at inset i,
     * and `sag(i)` how far that outline curves away from a straight line
     * over the width of the facet.
     */
    const add = (key: string, a0: V2, a1: V2, b0: V2, b1: V2, out2: V2, rim: (i: number) => V2, sag: (i: number) => number) => {
      const P0: V3 = [a0[0], a0[1], za];
      const P1: V3 = [a1[0], a1[1], za];
      const P3: V3 = [b0[0], b0[1], zb];
      const P2: V3 = [b1[0], b1[1], zb];
      const la = len3(sub3(P1, P0));
      const lb = len3(sub3(P2, P3));
      if (la < 0.01 && lb < 0.01) return;
      const Ma = mul3(add3(P0, P1), 0.5);
      const Mb = mul3(add3(P3, P2), 0.5);
      let U = la >= lb ? sub3(P1, P0) : sub3(P2, P3);
      U = mul3(U, 1 / len3(U));
      const Vraw = sub3(Mb, Ma);
      const h = len3(Vraw);
      if (h < 0.01) return;
      const Vn = mul3(Vraw, 1 / h);
      let N = cross(U, Vn);
      // Face outwards (the back face is hidden). The outward normal of the
      // profile: out along the outline as it goes back, ±z across a step.
      const outward: V3 = [out2[0] * (za - zb), out2[1] * (za - zb), b.ia - b.ib];
      if (dot3(N, outward) < 0) {
        U = mul3(U, -1);
        N = mul3(N, -1);
      }
      const hh = h + overTop + overBottom;
      const slope = Math.abs(lb - la) / 2 / h; // how fast the sides lean, px per px
      const pad = OVER + slope * Math.max(overTop, overBottom);
      const w = Math.max(la, lb) + 2 * pad;
      const O = sub3(sub3(Ma, mul3(U, w / 2)), mul3(Vn, overTop));
      const matrix = `matrix3d(${f(U[0])},${f(U[1])},${f(U[2])},0,${f(Vn[0])},${f(Vn[1])},${f(Vn[2])},0,${f(N[0])},${f(N[1])},${f(N[2])},0,${f(O[0])},${f(O[1])},${f(O[2])},1)`;
      let clip: string | undefined;
      if (Math.abs(la - lb) > 1) {
        // half-width of the strip at local height y, grown by OVER
        const hw = (y: number) => (la + ((lb - la) * (y - overTop)) / h) / 2 + OVER;
        const c = w / 2;
        clip = `polygon(${f(c - hw(0))}px 0, ${f(c + hw(0))}px 0, ${f(c + hw(hh))}px ${f(hh)}px, ${f(c - hw(hh))}px ${f(hh)}px)`;
      }
      // A slice at inset i, point p = (i + sx, i + sy), lands at
      //   x' = U · (p - O)                  (along the strip)
      //   y' = hh · (m · (p - rim) - d0)    (a 1 px band just inside the rim)
      const m: V2 = [-out2[0], -out2[1]];
      const layer = (color: string, i: number): FacetLayer => {
        const r = rim(i);
        const d0 = sag(i) + 0.3;
        return {
          color,
          w: Math.max(1, W - 2 * i),
          h: Math.max(1, H - 2 * i),
          matrix: `matrix(${f(U[0])},${f(hh * m[0])},${f(U[1])},${f(hh * m[1])},${f(U[0] * (i - O[0]) + U[1] * (i - O[1]))},${f(hh * (m[0] * (i - r[0]) + m[1] * (i - r[1]) - d0))})`,
        };
      };
      // a step shows the finish of its outer edge
      const base = layer(b.ca, step ? Math.min(b.ia, b.ib) : b.ia);
      const blend =
        !step && b.cb !== b.ca
          ? { ...layer(b.cb, b.ib), mask: `linear-gradient(#0000 ${f(overTop)}px, #000 ${f(overTop + h)}px)` }
          : undefined;
      facets.push({ key: `${bi}-${key}`, matrix, w, h: hh, clip, base, blend });
    };

    // straight walls (each runs from R to W-R / H-R whatever the inset)
    const none = () => 0;
    add('top', [R, b.ia], [W - R, b.ia], [R, b.ib], [W - R, b.ib], [0, -1], (i) => [W / 2, i], none);
    add('right', [W - b.ia, R], [W - b.ia, H - R], [W - b.ib, R], [W - b.ib, H - R], [1, 0], (i) => [W - i, H / 2], none);
    add('bottom', [W - R, H - b.ia], [R, H - b.ia], [W - R, H - b.ib], [R, H - b.ib], [0, 1], (i) => [W / 2, H - i], none);
    add('left', [b.ia, H - R], [b.ia, R], [b.ib, H - R], [b.ib, R], [-1, 0], (i) => [i, H / 2], none);

    // rounded corners
    const sag = (i: number) => {
      const rho = Math.max(0, R - i);
      return rho * (1 - Math.cos(halfStep + (rho > 0 ? OVER / rho : 0)));
    };
    corners.forEach(({ c, a0 }, ci) => {
      for (let j = 0; j < K; j++) {
        const t0 = a0 + (j / K) * (Math.PI / 2);
        const t1 = a0 + ((j + 1) / K) * (Math.PI / 2);
        const tm = (t0 + t1) / 2;
        const p = (r: number, t: number): V2 => [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
        add(`c${ci}-${j}`, p(ra, t0), p(ra, t1), p(rb, t0), p(rb, t1), [Math.cos(tm), Math.sin(tm)], (i) => p(Math.max(0, R - i), tm), sag);
      }
    });
  });
  return facets;
}
