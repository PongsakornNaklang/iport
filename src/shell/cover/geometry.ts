/**
 * The shape of a case or an iPod Sock around a body, in device px.
 *
 * Socks are one knitted piece, like Apple's (see sockMesh.ts): a sleeve
 * around the iPod, open at the top with the iPod pulled a third of the way
 * out and a lighter ribbed cuff at the opening; below the iPod the empty
 * fabric narrows and flattens down to a flat seam at the toe. A small woven
 * Apple tag sticks out of the left seam.
 *
 * A cover is a hollow rounded box around the device box (`DeviceModel.size`):
 * `w × h × d`, centred at (cx, cy, cz) relative to its centre (+z towards
 * the front). Its
 * side walls are `t` thick and its edges are rounded with radius `round`.
 *
 *  - Cases leave the front open (all but a lip of `lip` px) and have holes
 *    for the buttons and ports.
 *  - Socks are described by `sock` (the top-level box is their sleeve).
 */
import type { CoverFit, CoverKind } from '../../devices/types';
import type { Facet, V3 } from '../edgeShell';
import type { SockRow } from './sockMesh';

export interface CoverHole {
  /** centre on the cover's outer box, shell coordinates (origin top-left, z = 0 mid-depth) */
  p: V3;
  /** outward normal of the wall it's in, and the direction along the wall */
  n: V3;
  along: V3;
  len: number;
  thick: number;
}

export interface CoverGeometry {
  w: number;
  h: number;
  d: number;
  cx: number;
  cy: number;
  cz: number;
  /** side wall thickness */
  t: number;
  /** outline corner radius */
  radius: number;
  /** radius of the rounded edge between the sides and the faces */
  round: number;
  /** case: width of the lip over the front, from the outer edge of the body */
  lip: number;
  holes: CoverHole[];
  /** how much room it all takes, centred on the body (for fitting the stage) */
  bounds: { width: number; height: number; depth: number };
  sock?: SockGeometry;
}

export interface SockGeometry {
  /** cross-sections from the opening down to the toe (see sockMesh.ts) */
  rows: SockRow[];
  /** rows[0..sleeve] run beside the iPod; the rest hang below it */
  sleeve: number;
  /**
   * Where the empty toe bends (row indices, top first): it hangs from the
   * first, and bends again at each of the others.
   */
  hinges: number[];
  /** y of the opening, relative to the body centre */
  mouth: number;
  /** y where the lighter cuff ends */
  cuffEnd: number;
  /** the Apple tag: its rectangle in the body's x/y, at mid-depth */
  tag: { x: number; y: number; w: number; h: number };
}

const MM = {
  caseWall: 1.3,
  caseFront: 0.8,
  caseBack: 1.1,
  caseLip: 1.1,
  sockWall: 1.4,
  tagW: 11,
  tagH: 10,
};

/** how much of the iPod is pulled out of its sock */
const SOCK_EXPOSED = 0.36;

const smooth = (k: number) => k * k * (3 - 2 * k);

export function coverGeometry(fit: CoverFit, kind: Exclude<CoverKind, 'none'>, pxPerMm: number, size: { width: number; height: number; depth: number }): CoverGeometry {
  const box = { w: size.width, h: size.height, d: size.depth };
  if (kind === 'sock') {
    const t = MM.sockWall * pxPerMm;
    const H = box.h;
    const mouth = -H / 2 + H * SOCK_EXPOSED;
    const sw = box.w + 2 * t;
    const sd = box.d + 2 * t;
    // soft and plump: the sides round over most of the depth
    const round = Math.min(t * 3.2, sd * 0.48);
    const row = (y: number, w: number, d: number): SockRow => ({ y, w, d, r: Math.min(round, d / 2, w / 2) });
    // beside the iPod: one straight run (the cuff colour changes within it)
    const rows: SockRow[] = [row(mouth, sw, sd), row(H / 2 + t, sw, sd)];
    let y = H / 2 + t;
    // the empty fabric narrows and flattens…
    const narrow = 0.17 * H;
    const tw = sw * 0.8;
    const td = sd * 0.3;
    const steps = 10; // fine enough that each piece is nearly a rectangle (sockMesh.ts)
    for (let i = 1; i <= steps; i++) {
      const k = smooth(i / steps);
      rows.push(row(y + narrow * (i / steps), sw + (tw - sw) * k, sd + (td - sd) * k));
    }
    y += narrow;
    // …hangs straight…
    const hang = 0.1 * H;
    rows.push(row(y + hang * 0.5, tw, td * 0.9), row(y + hang, tw, td * 0.8));
    y += hang;
    // …and closes in a flat seam
    const end = 0.045 * H;
    for (let i = 1; i <= 6; i++) {
      const k = i / 6;
      rows.push(row(y + end * k, tw, Math.max(1, td * 0.8 * Math.sqrt(Math.max(0, 1 - k * k)))));
    }
    const toeEnd = y + end;
    const tagW = MM.tagW * pxPerMm;
    const g: CoverGeometry = {
      w: sw,
      h: H / 2 + t - mouth,
      d: sd,
      cx: 0,
      cy: (mouth + H / 2 + t) / 2,
      cz: 0,
      t,
      radius: fit.radius + t,
      round,
      lip: 0,
      holes: [],
      bounds: { width: sw + 2 * tagW, height: 2 * Math.max(H / 2, toeEnd), depth: sd },
      sock: {
        rows,
        sleeve: 1,
        // the narrowing ends at rows[11]; the toe bends there and at the next two rows
        hinges: [11, 12, 13],
        mouth,
        cuffEnd: mouth + 0.24 * (toeEnd - mouth),
        tag: { x: -sw / 2 - tagW, y: mouth + 1.5 * pxPerMm, w: tagW + 2, h: MM.tagH * pxPerMm },
      },
    };
    return g;
  }
  const t = MM.caseWall * pxPerMm;
  const front = MM.caseFront * pxPerMm;
  const back = MM.caseBack * pxPerMm;
  const d = box.d + front + back;
  const g: CoverGeometry = {
    w: box.w + 2 * t,
    h: box.h + 2 * t,
    d,
    cx: 0,
    cy: 0,
    cz: (front - back) / 2,
    t,
    radius: fit.radius + t,
    round: Math.min(t, d * 0.3),
    lip: MM.caseLip * pxPerMm,
    holes: [],
    bounds: { width: box.w + 2 * t, height: box.h + 2 * t, depth: d + 2 * Math.abs((front - back) / 2) },
  };
  g.holes = fit.holes.map((hole) => toShell(g, hole));
  return g;
}

/** A hole given on the body's edges, placed on the cover's outer box. */
function toShell(g: CoverGeometry, hole: CoverFit['holes'][number]): CoverHole {
  const z = (hole.z ?? 0) - g.cz;
  const x = (at: number) => at - g.cx + g.w / 2;
  const y = (at: number) => at - g.cy + g.h / 2;
  const base = { len: hole.len, thick: hole.thick };
  switch (hole.side) {
    case 'top':
      return { ...base, p: [x(hole.at), 0, z], n: [0, -1, 0], along: [1, 0, 0] };
    case 'bottom':
      return { ...base, p: [x(hole.at), g.h, z], n: [0, 1, 0], along: [1, 0, 0] };
    case 'left':
      return { ...base, p: [0, y(hole.at), z], n: [-1, 0, 0], along: [0, 1, 0] };
    default:
      return { ...base, p: [g.w, y(hole.at), z], n: [1, 0, 0], along: [0, 1, 0] };
  }
}

/** How far the outline is pulled in at depth u (0 front … 1 back): round edges. */
export function roundedInset(u: number, d: number, round: number): number {
  const z = u * d;
  const k = z < round ? round - z : z > d - round ? z - (d - round) : 0;
  return round - Math.sqrt(Math.max(0, round * round - k * k));
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const addk = (a: V3, b: V3, k: number): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/**
 * The holes that fall on a facet, as rounded rectangles in its local box:
 * each hole is projected along its wall's normal onto the facet's plane.
 */
export function holesOnFacet(fa: Facet, holes: CoverHole[]): { x: number; y: number; w: number; h: number }[] {
  const { O, U, V, N } = fa.frame;
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (const hole of holes) {
    const nn = dot(hole.n, N);
    if (nn < 0.3) continue; // a facet facing another way
    const local = (q: V3) => {
      const s = -dot(sub(q, O), N) / nn;
      const r = sub(addk(q, hole.n, s), O);
      return [dot(r, U), dot(r, V)];
    };
    const pts = [
      local(addk(hole.p, hole.along, -hole.len / 2)),
      local(addk(hole.p, hole.along, hole.len / 2)),
      local(addk(hole.p, [0, 0, 1], -hole.thick / 2)),
      local(addk(hole.p, [0, 0, 1], hole.thick / 2)),
    ];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    if (x1 < 0 || y1 < 0 || x0 > fa.w || y0 > fa.h) continue;
    out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return out;
}

/** A mask image that shows a w × h box except the given rounded rectangles. */
export function holeMask(w: number, h: number, rects: { x: number; y: number; w: number; h: number }[], radius: (r: { w: number; h: number }) => number): string {
  const n = (v: number) => +v.toFixed(2);
  let d = `M0 0H${n(w)}V${n(h)}H0Z`;
  for (const r of rects) {
    const rr = Math.min(radius(r), r.w / 2, r.h / 2);
    const x0 = r.x;
    const y0 = r.y;
    const x1 = r.x + r.w;
    const y1 = r.y + r.h;
    d +=
      `M${n(x0 + rr)} ${n(y0)}H${n(x1 - rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x1)} ${n(y0 + rr)}` +
      `V${n(y1 - rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x1 - rr)} ${n(y1)}H${n(x0 + rr)}` +
      `A${n(rr)} ${n(rr)} 0 0 1 ${n(x0)} ${n(y1 - rr)}V${n(y0 + rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x0 + rr)} ${n(y0)}Z`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${n(w)}' height='${n(h)}' viewBox='0 0 ${n(w)} ${n(h)}' preserveAspectRatio='none'><path fill-rule='evenodd' d='${d}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
