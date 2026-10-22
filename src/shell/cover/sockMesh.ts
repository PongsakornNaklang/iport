/**
 * An iPod Sock as one knitted surface.
 *
 * The sock is a loft: a stack of cross-sections down its length (y), each a
 * rounded rectangle in x/z (width, depth, corner radius). From the opening
 * to just past the iPod's bottom it is a straight sleeve around the iPod;
 * below, the empty fabric narrows and flattens, and at the toe it closes in
 * a flat seam.
 *
 * Every cross-section is walked the same way: the same straight sides and
 * the same corner angles. So between two neighbouring cross-sections each
 * piece of outline has a parallel twin, and the strip between them is a
 * flat trapezoid: one CSS 3D facet. It is drawn as a rectangle of the
 * trapezoid's mean width: the rows are close enough together that its
 * corners are off by a pixel or so, and a clip-path on a 3D layer is very
 * slow to draw (each becomes a mask layer). The knit is laid out by distance around
 * the sock from the middle of the front (u) and down it (v), so the ribs
 * run on unbroken from facet to facet, over the edges and down the toe.
 *
 * Coordinates: device px, origin at the iPod's centre, x right, y down,
 * z towards the viewer.
 */

export interface SockRow {
  y: number;
  /** outer width (x) and depth (z) */
  w: number;
  d: number;
  /** corner radius of the cross-section */
  r: number;
}

export interface SockFacet {
  key: string;
  matrix: string;
  w: number;
  h: number;
  /** background offset that lines the knit up with the neighbours */
  bx: number;
  by: number;
  /** the knit runs the other way along this facet's x */
  flip: boolean;
  /** world y of the facet's top edge (for the cuff) */
  top: number;
  /** -1 (in shadow) … 1 (facing the light) */
  light: number;
  /** row index (rows beside the iPod come first) */
  row: number;
  /**
   * How stretched the knit is here: this row's girth over the relaxed
   * girth. A sock has the same number of ribs all the way round, so where
   * it is stretched over the iPod they are wider apart.
   */
  stretch: number;
}

/** distance all the way round a cross-section */
export function girth(row: SockRow, k = 4): number {
  const g = ring(row, k);
  return g[g.length - 1].u - g[0].u;
}

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const f = (n: number) => (Math.abs(n) < 5e-5 ? '0' : n.toFixed(4));

/** light from the top left, in front */
const LIGHT: V3 = (() => {
  const l: V3 = [-0.35, -0.55, 0.76];
  return mul(l, 1 / len(l));
})();
/** px each facet reaches over its neighbours, so their edges leave no hairline */
const OVER = 0.3;

/**
 * Points around a cross-section, starting at the front face's left end and
 * going right, then back round: front, front-right corner, right side,
 * back-right corner, back, back-left corner, left side, front-left corner.
 * Each point also carries its distance around from the middle of the front.
 */
export function ring(row: SockRow, k: number): { p: V3; u: number }[] {
  const hw = row.w / 2;
  const hd = row.d / 2;
  const r = Math.max(0, Math.min(row.r, hw, hd));
  const pts: [number, number][] = [];
  // corner centres, in order: front-right, back-right, back-left, front-left
  const cs: [number, number, number][] = [
    [hw - r, hd - r, Math.PI / 2],
    [hw - r, -(hd - r), 0],
    [-(hw - r), -(hd - r), -Math.PI / 2],
    [-(hw - r), hd - r, Math.PI],
  ];
  pts.push([-(hw - r), hd]);
  for (const [cx, cz, a0] of cs) {
    for (let i = 0; i <= k; i++) {
      const a = a0 - (i / k) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  }
  // distance round from the start, then from the middle of the front
  const out: { p: V3; u: number }[] = [];
  let u = -(hw - r);
  pts.forEach(([x, z], i) => {
    if (i > 0) u += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    out.push({ p: [x, row.y, z], u });
  });
  return out;
}

/**
 * Facets for the rows (row i joins rows[i] and rows[i + 1]). `relaxed` is
 * the girth of the knit unstretched; `rowBase` numbers the rows (for keys).
 */
export function sockMesh(rows: SockRow[], relaxed: number, k = 4, rowBase = 0): SockFacet[] {
  const out: SockFacet[] = [];
  const rings = rows.map((r) => ring(r, k));
  const girths = rings.map((g) => g[g.length - 1].u - g[0].u);
  for (let i = 0; i < rows.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    const stretch = Math.max(0.5, (girths[i] + girths[i + 1]) / 2 / relaxed);
    for (let j = 0; j < A.length - 1; j++) {
      const fa = quad(A[j].p, A[j + 1].p, B[j].p, B[j + 1].p, A[j].u, rows[i].y);
      if (fa) out.push({ ...fa, key: `${rowBase + i}-${j}`, row: rowBase + i, stretch });
    }
  }
  return out;
}

/** The flat trapezoid P0 P1 (top) – Q0 Q1 (bottom), P0P1 ∥ Q0Q1. */
function quad(P0: V3, P1: V3, Q0: V3, Q1: V3, u0: number, top: number): Omit<SockFacet, 'key' | 'row' | 'stretch'> | null {
  const lp = len(sub(P1, P0));
  const lq = len(sub(Q1, Q0));
  if (lp < 0.01 && lq < 0.01) return null;
  let U = lp >= lq ? sub(P1, P0) : sub(Q1, Q0);
  U = mul(U, 1 / len(U));
  const Mp = mul(add(P0, P1), 0.5);
  const Mq = mul(add(Q0, Q1), 0.5);
  const D = sub(Mq, Mp);
  const off = dot(D, U);
  const Vraw = sub(D, mul(U, off));
  const h = len(Vraw);
  if (h < 0.01) return null;
  const V = mul(Vraw, 1 / h);
  let N = cross(U, V);
  // outwards: away from the sock's axis
  const mid = mul(add(Mp, Mq), 0.5);
  const flip = dot(N, [mid[0], 0, mid[2]]) < 0;
  let xs = { p0: -lp / 2, p1: lp / 2, q0: off - lq / 2, q1: off + lq / 2 };
  if (flip) {
    U = mul(U, -1);
    N = mul(N, -1);
    xs = { p0: lp / 2, p1: -lp / 2, q0: -off + lq / 2, q1: -off - lq / 2 };
  }
  // a rectangle of the mean width, centred between the two edges' middles
  const mean = (lp + lq) / 2;
  const centre = ((xs.p0 + xs.p1) / 2 + (xs.q0 + xs.q1) / 2) / 2;
  const minX = centre - mean / 2 - OVER;
  const w = mean + 2 * OVER;
  const H = h + 2 * OVER;
  const O = sub(add(Mp, mul(U, minX)), mul(V, OVER));
  const matrix = `matrix3d(${f(U[0])},${f(U[1])},${f(U[2])},0,${f(V[0])},${f(V[1])},${f(V[2])},0,${f(N[0])},${f(N[1])},${f(N[2])},0,${f(O[0])},${f(O[1])},${f(O[2])},1)`;
  // knit coordinate along x: u, increasing from P0 towards P1 (flipped: the other way)
  const x0 = xs.p0 - minX;
  const bx = flip ? x0 + u0 : x0 - u0;
  return { matrix, w, h: H, bx, by: OVER - top, flip, top, light: dot(N, LIGHT) };
}
