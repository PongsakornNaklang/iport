/**
 * A Verlet-integrated rope: point masses joined by distance constraints, plus
 * a weak bending constraint so the cable has a little stiffness (EarPods
 * cable is soft, but not a string). Units are screen px and seconds.
 */
export interface RopePoint {
  x: number;
  y: number;
  /** previous position (Verlet velocity = x - px) */
  px: number;
  py: number;
  /** pinned points are moved by code, not by physics */
  pinned: boolean;
}

export interface RopeOptions {
  gravity: number;
  /** velocity kept per step (0..1) */
  damping: number;
  iterations: number;
  /** 0..1, how strongly folds are straightened */
  bend: number;
  /** degrees a joint may turn before the bending stiffness kicks in (default 90) */
  maxBend?: number;
  /** the last this-many joints (the end held by a plug) are 3× stiffer: a strain relief */
  stiffTail?: number;
  /**
   * 0..1, a gentle pull towards straight at every joint (a cable that resists
   * any bend, not only sharp ones): higher is stiffer and springier.
   */
  straighten?: number;
  /** y of a floor the rope rests on (points from index `floorFrom` on) */
  floor?: number;
  floorFrom?: number;
}

export const DEFAULT_ROPE: RopeOptions = { gravity: 2400, damping: 0.986, iterations: 28, bend: 0.12 };

export class Rope {
  pts: RopePoint[];
  /** rest length of each segment */
  rest: number;

  constructor(count: number, x: number, y: number, rest: number, dirX = 0, dirY = 1) {
    this.rest = rest;
    this.pts = Array.from({ length: count }, (_, i) => {
      const px = x + dirX * rest * i;
      const py = y + dirY * rest * i;
      return { x: px, y: py, px, py, pinned: false };
    });
  }

  get count(): number {
    return this.pts.length;
  }

  get length(): number {
    return this.rest * (this.pts.length - 1);
  }

  /** Move a point by code. Keeps the motion as velocity so it carries on when released. */
  moveTo(i: number, x: number, y: number): void {
    const p = this.pts[i];
    p.px = p.x;
    p.py = p.y;
    p.x = x;
    p.y = y;
  }

  /** Pin a point in place (no velocity). */
  pinAt(i: number, x: number, y: number): void {
    const p = this.pts[i];
    p.pinned = true;
    p.x = p.px = x;
    p.y = p.py = y;
  }

  /** Teleport without adding velocity. */
  place(i: number, x: number, y: number): void {
    const p = this.pts[i];
    p.x = p.px = x;
    p.y = p.py = y;
  }

  step(dt: number, o: RopeOptions = DEFAULT_ROPE): void {
    const g = o.gravity * dt * dt;
    for (const p of this.pts) {
      if (p.pinned) continue;
      const vx = (p.x - p.px) * o.damping;
      const vy = (p.y - p.py) * o.damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + g;
    }
    const n = this.pts.length;
    const r = this.rest;
    // Points i and i+2 are 2r·cos(turn/2) apart when the joint between them
    // turns by `turn`: closer than that means it is bent more than allowed.
    const span = (deg: number) => 2 * r * Math.cos((Math.min(170, deg) * Math.PI) / 360);
    const maxBend = o.maxBend ?? 90;
    const fold = span(maxBend);
    const tailFold = span(maxBend / 3);
    const tailFrom = n - 2 - (o.stiffTail ?? 0);
    const tailBend = Math.min(1, o.bend * 3);
    for (let it = 0; it < o.iterations; it++) {
      for (let i = 0; i < n - 1; i++) this.solve(this.pts[i], this.pts[i + 1], r, 1);
      if (o.bend > 0) {
        // only resist folding (push apart when bent), never pull straight
        for (let i = 0; i < n - 2; i++) {
          const a = this.pts[i];
          const b = this.pts[i + 2];
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          const tail = i >= tailFrom;
          const f = tail ? tailFold : fold;
          if (d < f) this.solve(a, b, f, tail ? tailBend : o.bend);
          else if (o.straighten && d < 2 * r) this.solve(a, b, 2 * r, o.straighten);
        }
      }
      if (o.floor != null) this.collideFloor(o.floor, o.floorFrom ?? 0);
    }
  }

  /**
   * Ease the free points towards a target shape by `k` (0..1) without adding
   * velocity: a gentle shape memory.
   */
  blendTo(target: (i: number) => { x: number; y: number }, k: number): void {
    for (let i = 0; i < this.pts.length; i++) {
      const p = this.pts[i];
      if (p.pinned) continue;
      const t = target(i);
      const dx = (t.x - p.x) * k;
      const dy = (t.y - p.y) * k;
      p.x += dx;
      p.px += dx;
      p.y += dy;
      p.py += dy;
    }
  }

  /**
   * Remove small loops: where the cable crosses itself within `span`
   * segments, lay the points in between straight across. A stiff cable held
   * at both ends can't unwind a loop on its own (it would have to kink).
   * Returns whether anything changed.
   */
  untangle(span = 14): boolean {
    const pts = this.pts;
    const n = pts.length;
    let changed = false;
    for (let i = 0; i < n - 3; i++) {
      for (let j = i + 2; j <= Math.min(n - 2, i + span); j++) {
        if (!segmentsCross(pts[i], pts[i + 1], pts[j], pts[j + 1])) continue;
        const a = pts[i];
        const b = pts[j + 1];
        for (let k = i + 1; k <= j; k++) {
          const p = pts[k];
          if (p.pinned) continue;
          const t = (k - i) / (j + 1 - i);
          p.x = p.px = a.x + (b.x - a.x) * t;
          p.y = p.py = a.y + (b.y - a.y) * t;
        }
        changed = true;
        break;
      }
    }
    return changed;
  }

  /** Keep points above the floor, with friction while touching it. */
  private collideFloor(floor: number, from: number): void {
    for (let i = from; i < this.pts.length; i++) {
      const p = this.pts[i];
      if (p.pinned || p.y <= floor) continue;
      p.y = floor;
      // friction: bleed off sideways motion
      p.px += (p.x - p.px) * 0.25;
      if (p.py < floor) p.py = floor;
    }
  }

  private solve(a: RopePoint, b: RopePoint, rest: number, stiffness: number): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const diff = ((d - rest) / d) * stiffness;
    if (a.pinned && b.pinned) return;
    if (a.pinned) {
      b.x -= dx * diff;
      b.y -= dy * diff;
    } else if (b.pinned) {
      a.x += dx * diff;
      a.y += dy * diff;
    } else {
      a.x += dx * diff * 0.5;
      a.y += dy * diff * 0.5;
      b.x -= dx * diff * 0.5;
      b.y -= dy * diff * 0.5;
    }
  }

  /** Distance from (x, y) to the polyline, and the nearest point index. */
  nearest(x: number, y: number): { dist: number; index: number } {
    let best = Infinity;
    let index = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i];
      const b = this.pts[i + 1];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const l2 = vx * vx + vy * vy || 1e-6;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / l2));
      const d = Math.hypot(a.x + vx * t - x, a.y + vy * t - y);
      if (d < best) {
        best = d;
        index = t < 0.5 ? i : i + 1;
      }
    }
    return { dist: best, index };
  }

  /** How much a segment is stretched beyond its rest length (1 = relaxed). */
  stretch(i: number): number {
    const a = this.pts[i];
    const b = this.pts[i + 1];
    return Math.hypot(b.x - a.x, b.y - a.y) / this.rest;
  }
}

function segmentsCross(a: RopePoint, b: RopePoint, c: RopePoint, d: RopePoint): boolean {
  const o = (p: RopePoint, q: RopePoint, r: RopePoint) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
