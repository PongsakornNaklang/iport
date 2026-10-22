/**
 * The shape of a case or an iPod Sock around a body, in device px.
 *
 * A cover is a hollow rounded box around the device box (`DeviceModel.size`):
 * `w × h × d`, centred at (cx, cy, cz) relative to its centre (+z towards
 * the front). Its
 * side walls are `t` thick and its edges are rounded with radius `round`.
 *
 *  - Cases leave the front open (all but a lip of `lip` px) and have holes
 *    for the buttons and ports.
 *  - Socks cover everything except their mouth, at the headphone end, and
 *    are a little longer than the iPod (the toe is slack).
 */
import type { CoverFit, CoverKind } from '../../devices/types';
import type { Facet, V3 } from '../edgeShell';

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
  /** sock: which end the mouth is at */
  mouth: 'top' | 'bottom';
  holes: CoverHole[];
}

const MM = {
  caseWall: 1.3,
  caseFront: 0.8,
  caseBack: 1.1,
  caseLip: 1.1,
  sockWall: 1.4,
  sockSlack: 3,
};

export function coverGeometry(fit: CoverFit, kind: Exclude<CoverKind, 'none'>, pxPerMm: number, size: { width: number; height: number; depth: number }, jackNy: 1 | -1 = -1): CoverGeometry {
  const box = { w: size.width, h: size.height, d: size.depth };
  const mouth = jackNy === 1 ? 'bottom' : 'top';
  if (kind === 'sock') {
    const t = MM.sockWall * pxPerMm;
    const slack = MM.sockSlack * pxPerMm;
    const w = box.w + 2 * t;
    const h = box.h + 2 * t + slack;
    const d = box.d + 2 * t;
    const cy = mouth === 'top' ? slack / 2 : -slack / 2;
    const g: CoverGeometry = {
      w,
      h,
      d,
      cx: 0,
      cy,
      cz: 0,
      t,
      radius: fit.radius + t + 0.5 * pxPerMm,
      // soft and plump: the edge rounds over most of the depth
      round: Math.min(t * 3.2, d * 0.48, (fit.radius + t) * 0.6),
      lip: 0,
      mouth,
      holes: [],
    };
    // the mouth: most of the end, so the iPod's end (and its jack) shows
    g.holes.push(
      toShell(g, {
        side: mouth,
        at: 0,
        len: Math.max(box.w * 0.4, box.w - 1.2 * fit.radius),
        thick: box.d * 0.62,
        z: 0,
      }),
    );
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
    mouth,
    holes: [],
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
