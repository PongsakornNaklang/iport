/**
 * EarPods: when music starts, a white EarPods cable rises from the bottom of
 * the window and plugs into the iPod's headphone jack. The cable is a
 * physics rope — it sags, swings when the iPod turns, and you can grab it.
 * Pull the plug out and the music pauses, just like a real iPod.
 *
 * The jack's screen position comes from tiny marker elements placed inside
 * the 3D device (see <JackMarkers>), so the plug follows every rotation.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { player, usePlayer } from '../../core/player/player';
import { playTone } from '../../core/sound/click';
import type { DeviceModel } from '../../devices/types';
import { liveOrientation } from '../stageStore';
import { Rope } from './rope';

// EarPods dimensions in millimetres
const MM = {
  housing: 17,
  relief: 8,
  width: 5.4,
  reliefEnd: 2.3,
  cable: 1.9,
  tip: 13.5,
  tipWidth: 3.5,
};
const POINTS = 34;
const MARK = 20; // marker offset, device px
const MAX_PX_PER_MM = 7.5;

type Phase = 'hidden' | 'entering' | 'plugged' | 'free' | 'retracting';

interface Vec {
  x: number;
  y: number;
}

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const len = (a: Vec) => Math.hypot(a.x, a.y);
const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function bezier(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Invisible points inside the 3D device that tell us where the jack is on screen. */
export function JackMarkers({ model, markerRef }: { model: DeviceModel; markerRef: RefObject<HTMLDivElement | null> }) {
  const j = model.jack;
  if (!j) return null;
  const cx = model.size.width / 2 + j.x;
  const cy = model.size.height / 2 + j.y;
  const pts: [number, number, number][] = [
    [cx, cy, j.z],
    [cx, cy + j.ny * MARK, j.z], // outward normal
    [cx + MARK, cy, j.z], // device x
    [cx, cy, j.z + MARK], // device z
  ];
  return (
    <div ref={markerRef} className="ep-markers" aria-hidden="true">
      {pts.map(([x, y, z], i) => (
        <i key={i} style={{ transform: `translate3d(${x}px, ${y}px, ${z}px)` }} />
      ))}
    </div>
  );
}

interface Jack {
  /** jack opening, stage px */
  p: Vec;
  /** outward axis, stage px per mm (foreshortened by the 3D view) */
  aMm: Vec;
  /** stage px per mm across the plug (not foreshortened) */
  mm: number;
  /** how much the opening points at the camera: 1 = straight at us, -1 = straight away */
  dz: number;
}

export function useEarPods({
  wrap,
  back,
  front,
  markers,
  model,
  enabled,
}: {
  wrap: RefObject<HTMLDivElement | null>;
  back: RefObject<HTMLCanvasElement | null>;
  front: RefObject<HTMLCanvasElement | null>;
  markers: RefObject<HTMLDivElement | null>;
  model: DeviceModel;
  enabled: boolean;
}): void {
  const modelRef = useRef(model);
  modelRef.current = model;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const sim = useRef({
    phase: 'hidden' as Phase,
    rope: null as Rope | null,
    anchor: { x: 0, y: 0 },
    t0: 0,
    from: { x: 0, y: 0 },
    fromAxis: { x: 0, y: -1 },
    insertOnly: false,
    drag: null as null | { id: number; index: number; plug: boolean; off: Vec; start: Vec; wasPlugged: boolean },
    yank: 0,
    idleSince: 0,
    lastJack: null as Jack | null,
    drawFront: false,
    retractFrom: { x: 0, y: 0 },
  });

  // ------------------------------------------------------------ triggers
  useEffect(() => {
    const start = () => {
      const s = sim.current;
      if (!enabledRef.current || !modelRef.current.jack) return;
      if (s.phase === 'plugged' || s.phase === 'entering') return;
      beginEnter(false);
    };
    if (usePlayer.getState().status === 'playing') start();
    return usePlayer.subscribe((st, prev) => {
      const on = st.status === 'playing' || st.status === 'loading';
      const was = prev.status === 'playing' || prev.status === 'loading';
      if (on && !was) start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // switching models while plugged: move the plug to the new jack
  useEffect(() => {
    const s = sim.current;
    if (s.phase === 'plugged' || s.phase === 'entering') {
      if (!model.jack) beginRetract();
      else window.setTimeout(() => beginEnter(false), 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id]);

  useEffect(() => {
    if (!enabled && sim.current.phase !== 'hidden') beginRetract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  function stageSize() {
    const r = wrap.current?.getBoundingClientRect();
    return { w: r?.width ?? window.innerWidth, h: r?.height ?? window.innerHeight };
  }

  function plugEnd(): Vec | null {
    const r = sim.current.rope;
    return r ? { x: r.pts[r.count - 1].x, y: r.pts[r.count - 1].y } : null;
  }

  function beginEnter(insertOnly: boolean) {
    const s = sim.current;
    const { w, h } = stageSize();
    const j = s.lastJack;
    if (!s.rope || s.phase === 'hidden') {
      const ax = Math.max(40, Math.min(w - 40, (j?.p.x ?? w / 2) + (modelRef.current.jack?.ny === -1 ? -60 : 70)));
      s.anchor = { x: ax, y: h + 40 };
      const r = new Rope(POINTS, ax, h + 40, 18, 0, 1);
      // start coiled just below the window so the plug appears right away
      for (let i = 1; i < r.count; i++) r.place(i, ax + Math.sin(i * 0.9) * 10, h + 40 + i * 2);
      r.pts[0].pinned = true;
      s.rope = r;
    }
    const wasHidden = s.phase === 'hidden';
    const end = plugEnd()!;
    s.from = end;
    // plug orientation (tip → cable); rising from below, the cable trails downwards
    s.fromAxis = wasHidden ? { x: 0, y: 1 } : plugAxis();
    s.t0 = performance.now();
    s.insertOnly = insertOnly;
    s.phase = 'entering';
  }

  function beginRetract() {
    const s = sim.current;
    if (!s.rope || s.phase === 'hidden') return;
    s.retractFrom = plugEnd()!;
    s.t0 = performance.now();
    s.phase = 'retracting';
    for (const p of s.rope.pts) p.pinned = false;
    s.rope.pts[0].pinned = true;
  }

  function unplug() {
    const s = sim.current;
    s.phase = 'free';
    s.idleSince = performance.now();
    const st = usePlayer.getState().status;
    if (st === 'playing' || st === 'loading') player.pause();
    playTone(700, 35, { type: 'triangle', volume: 0.08 });
  }

  // ------------------------------------------------------------ pointer: grab the cable
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const local = (e: PointerEvent): Vec => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      const s = sim.current;
      if (!s.rope || s.phase === 'hidden' || s.phase === 'retracting' || e.button !== 0 || e.shiftKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('[data-control], .panel, .view-controls, [data-no-stage]')) return;
      // the cable is behind the iPod unless the jack faces us
      if (!s.drawFront && t.closest('.d3-root')) return;
      const p = local(e);
      const r = s.rope;
      const j = s.lastJack;
      const mm = j?.mm ?? 3;
      // plug body hit test
      const end = plugEnd()!;
      const front = sub(end, mul(plugAxis(), (MM.housing + MM.relief + (s.phase === 'plugged' ? 0 : MM.tip)) * mm));
      const onPlug = distToSeg(p, front, end) < Math.max(14, MM.width * mm * 0.75);
      const near = r.nearest(p.x, p.y);
      if (!onPlug && near.dist > Math.max(14, MM.cable * mm * 3)) return;
      e.stopPropagation();
      e.preventDefault();
      const index = onPlug ? r.count - 1 : Math.max(1, near.index);
      const pt = r.pts[index];
      s.drag = { id: e.pointerId, index, plug: onPlug || index >= r.count - 2, off: sub({ x: pt.x, y: pt.y }, p), start: p, wasPlugged: s.phase === 'plugged' };
      if (s.phase === 'entering') s.phase = 'free';
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      const s = sim.current;
      const d = s.drag;
      if (!d || d.id !== e.pointerId || !s.rope) return;
      const p = local(e);
      const mm = s.lastJack?.mm ?? 3;
      if (s.phase === 'plugged' && d.plug) {
        // pulling the plug out of the jack
        if (len(sub(p, d.start)) > Math.max(16, 4 * mm)) unplug();
        return;
      }
      const target = add(p, d.off);
      const r = s.rope;
      r.pts[d.index].pinned = true;
      r.moveTo(d.index, target.x, target.y);
    };
    const up = (e: PointerEvent) => {
      const s = sim.current;
      const d = s.drag;
      if (!d || d.id !== e.pointerId) return;
      s.drag = null;
      el.style.cursor = '';
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* not captured */
      }
      if (!s.rope) return;
      if (s.phase !== 'plugged') s.rope.pts[d.index].pinned = false;
      s.rope.pts[0].pinned = true;
      // dropped next to the jack → plug it back in
      const j = s.lastJack;
      if (s.phase === 'free' && d.plug && j) {
        const end = plugEnd()!;
        const seat = add(j.p, mul(j.aMm, MM.housing + MM.relief + 0.3));
        if (len(sub(end, seat)) < Math.max(36, 9 * j.mm)) beginEnter(true);
      }
      s.idleSince = performance.now();
    };
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Unit vector along the plug from its tip towards the cable. */
  function plugAxis(): Vec {
    const s = sim.current;
    const r = s.rope!;
    const end = r.pts[r.count - 1];
    const prev = r.pts[r.count - 2];
    return norm(sub({ x: prev.x, y: prev.y }, { x: end.x, y: end.y }));
  }

  // ------------------------------------------------------------ main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const readJack = (): Jack | null => {
      const m = markers.current;
      const host = wrap.current;
      const jack = modelRef.current.jack;
      if (!m || !host || !jack || m.children.length < 4) return null;
      const hr = host.getBoundingClientRect();
      const c = (i: number): Vec => {
        const r = (m.children[i] as HTMLElement).getBoundingClientRect();
        return { x: r.left - hr.left, y: r.top - hr.top };
      };
      const p = c(0);
      const n = sub(c(1), p);
      const ax = sub(c(2), p);
      const az = sub(c(3), p);
      // three orthogonal device axes: their projected lengths give the true scale
      // (for a rotation, the squared lengths of the projected axes sum to 2 k²)
      const k = Math.max(0.05, Math.sqrt((len(n) ** 2 + len(ax) ** 2 + len(az) ** 2) / 2) / MARK);
      // how foreshortened the jack axis is → how much it points at / away from us
      const f = Math.min(1, len(n) / (MARK * k));
      const toward = jack.ny * Math.sin((liveOrientation.rx * Math.PI) / 180);
      const dz = Math.sign(toward || 0) * Math.sqrt(Math.max(0, 1 - f * f));
      // small iPods are shown enlarged; cap the plug so it doesn't fill the window
      const cap = Math.min(1, MAX_PX_PER_MM / (jack.pxPerMm * k));
      const mm = jack.pxPerMm * k * cap;
      const aMm = mul(n, (jack.pxPerMm / MARK) * cap);
      return { p, aMm, mm, dz };
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = sim.current;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const j = readJack();
      if (j) s.lastJack = j;
      const cb = back.current;
      const cf = front.current;
      const host = wrap.current;
      if (!cb || !cf || !host) return;
      const W = host.clientWidth;
      const H = host.clientHeight;
      sizeCanvas(cb, W, H);
      sizeCanvas(cf, W, H);
      const gb = cb.getContext('2d')!;
      const gf = cf.getContext('2d')!;
      const dpr = cb.width / Math.max(1, W);
      gb.setTransform(dpr, 0, 0, dpr, 0, 0);
      gf.setTransform(dpr, 0, 0, dpr, 0, 0);
      gb.clearRect(0, 0, W, H);
      gf.clearRect(0, 0, W, H);

      if (s.phase === 'hidden' || !s.rope) return;
      const r = s.rope;
      const jk = s.lastJack;
      const mm = jk?.mm ?? 3;
      const n = r.count;

      // anchor drifts to stay below the jack as the stage resizes / pans
      const targetAx = Math.max(40, Math.min(W - 40, (jk?.p.x ?? W / 2) + (modelRef.current.jack?.ny === -1 ? -60 : 70)));
      s.anchor.x += (targetAx - s.anchor.x) * 0.02;
      s.anchor.y = H + 40;
      r.pinAt(0, s.anchor.x, s.anchor.y);

      // keep a little slack so it can sway, but not so much that it loops
      const end = plugEnd()!;
      let want = len(sub(end, s.anchor)) * 1.05 + 24 + 6 * mm;
      if (s.drag) {
        const dp = r.pts[s.drag.index];
        want = Math.max(want, (len(sub(dp, s.anchor)) + len(sub(dp, end))) * 1.05);
      }
      r.rest += (want / (n - 1) - r.rest) * 0.06;

      let axis: Vec = plugAxis();
      let axisMm: Vec = mul(axis, mm);
      let dz = 0; // how much the plug points at the camera
      let showTip = true;
      const seat = jk ? add(jk.p, mul(jk.aMm, MM.housing + MM.relief + 0.3)) : end;

      if (s.phase === 'entering' && jk) {
        const approach = add(seat, mul(norm(jk.aMm), (MM.tip + 7) * mm));
        const T1 = s.insertOnly || reduce ? 0 : 950;
        const T2 = reduce ? 1 : 260;
        const t = now - s.t0;
        let pos: Vec;
        if (t < T1) {
          const k = easeOut(t / T1);
          const c1 = add(s.from, mul(s.fromAxis, -Math.min(260, H * 0.35)));
          const c2 = add(approach, mul(norm(jk.aMm), 140 * Math.max(0.6, mm / 4)));
          pos = bezier(s.from, c1, c2, approach, k);
          const e = easeInOut(Math.min(1, k * 1.15));
          axisMm = lerpV(mul(s.fromAxis, mm), jk.aMm, e);
          dz = jk.dz * e;
        } else {
          const k = easeInOut(Math.min(1, (t - T1) / T2));
          const startPos = s.insertOnly ? s.from : approach;
          pos = lerpV(startPos, seat, k);
          axisMm = jk.aMm;
          dz = jk.dz;
          if (k >= 1) {
            s.phase = 'plugged';
            s.yank = 0;
            // the satisfying click
            playTone(2600, 18, { type: 'square', volume: 0.05 });
            playTone(160, 70, { type: 'sine', volume: 0.12, delayMs: 8 });
          }
        }
        r.pts[n - 1].pinned = true;
        r.moveTo(n - 1, pos.x, pos.y);
        axis = norm(axisMm);
        pinExit(r, pos, axis);
      } else if (s.phase === 'plugged' && jk) {
        r.pts[n - 1].pinned = true;
        r.moveTo(n - 1, seat.x, seat.y);
        axisMm = jk.aMm;
        dz = jk.dz;
        axis = norm(jk.aMm);
        if (len(jk.aMm) > mm * 0.35) pinExit(r, seat, axis);
        else r.pts[n - 2].pinned = false;
        showTip = false;
        // a hard yank on the cable pulls the plug out
        if (r.stretch(n - 3) > 2.4 || r.stretch(n - 4) > 2.4) s.yank++;
        else s.yank = Math.max(0, s.yank - 1);
        if (s.yank > 5 && s.drag) unplug();
      } else if (s.phase === 'retracting') {
        const k = Math.min(1, (now - s.t0) / 800);
        const pos = lerpV(s.retractFrom, { x: s.anchor.x, y: H + 260 }, k * k);
        r.pts[n - 1].pinned = true;
        r.moveTo(n - 1, pos.x, pos.y);
        if (k >= 1) {
          s.phase = 'hidden';
          s.rope = null;
          return;
        }
      } else if (s.phase === 'free') {
        const held = s.drag?.index;
        if (held !== n - 1) r.pts[n - 1].pinned = false;
        if (held !== n - 2) r.pts[n - 2].pinned = false;
        if (!s.drag && now - s.idleSince > 9000) beginRetract();
      }

      // physics (2 substeps for stability)
      const steps = 2;
      // the bottom of the window is a desk the cable can lie on (not near the anchor, which is below it)
      // (only once unplugged: while plugged in, spare cable hangs out of view)
      const floor = s.phase === 'free' ? H - Math.max(6, MM.cable * mm) : undefined;
      for (let i = 0; i < steps; i++)
        r.step(dt / steps, { gravity: 2400, damping: 0.985, iterations: 24, bend: 0.12, floor, floorFrom: 4 });

      if (s.phase === 'free' || s.phase === 'retracting') {
        axis = plugAxis();
        axisMm = mul(axis, mm);
      }

      // The cable lives behind the iPod. It comes in front when the jack's
      // opening faces the camera, or while you hold it.
      s.drawFront = dz > 0.12 || !!s.drag;
      const g = s.drawFront ? gf : gb;
      const tail = { x: r.pts[n - 1].x, y: r.pts[n - 1].y };
      // the nearer of plug and cable is drawn last
      if (dz > 0.15) {
        drawPlug(g, tail, axisMm, mm, dz, showTip);
        drawCable(g, r, MM.cable * mm);
      } else {
        drawCable(g, r, MM.cable * mm);
        drawPlug(g, tail, axisMm, mm, dz, showTip);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// pin the second-to-last point so the cable leaves the strain relief straight
function pinExit(r: Rope, tail: Vec, axis: Vec) {
  const n = r.count;
  const p = add(tail, mul(axis, r.rest));
  r.pts[n - 2].pinned = true;
  r.moveTo(n - 2, p.x, p.y);
}

function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const v = sub(b, a);
  const l2 = v.x * v.x + v.y * v.y || 1e-6;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * v.x + (p.y - a.y) * v.y) / l2));
  return len(sub(add(a, mul(v, t)), p));
}

function sizeCanvas(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(w * dpr);
  const H = Math.round(h * dpr);
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
}

function tracePath(g: CanvasRenderingContext2D, r: Rope) {
  const p = r.pts;
  g.beginPath();
  g.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    g.quadraticCurveTo(p[i].x, p[i].y, mx, my);
  }
  const l = p[p.length - 1];
  g.lineTo(l.x, l.y);
}

function drawCable(g: CanvasRenderingContext2D, r: Rope, w: number) {
  const width = Math.max(1.6, w);
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // soft contact shadow so the white cable reads on a white backdrop
  g.shadowColor = 'rgba(0,0,0,0.16)';
  g.shadowBlur = Math.max(3, width * 1.4);
  g.shadowOffsetY = Math.max(2, width * 0.7);
  tracePath(g, r);
  g.strokeStyle = '#cfd0d5';
  g.lineWidth = width + 1;
  g.stroke();
  g.restore();
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  tracePath(g, r);
  g.strokeStyle = '#f7f7f8';
  g.lineWidth = width * 0.82;
  g.stroke();
  // specular line
  g.translate(-width * 0.12, -width * 0.12);
  tracePath(g, r);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = Math.max(0.6, width * 0.26);
  g.stroke();
  g.restore();
}

/**
 * The EarPods 3.5 mm plug, drawn as a set of 3D cylinders.
 *
 * `tail` is where the cable leaves the strain relief. `axisMm` points from
 * the tip towards the cable and is one millimetre long on screen (shorter
 * when the plug points at or away from the camera). `mm` is px per mm across
 * the plug. `dz` is how much the plug's outward end points at the camera
 * (1 straight at us, -1 straight away): it sets how round the cylinder ends
 * look and which end you can see.
 */
interface Section {
  d0: number;
  d1: number;
  w0: number;
  w1: number;
  kind: 'plastic' | 'metal' | 'ring';
}

const PLUG: Section[] = [
  { d0: -MM.tip, d1: -12.6, w0: 1.4, w1: 3.2, kind: 'metal' },
  { d0: -12.6, d1: -10.4, w0: 3.2, w1: 3.5, kind: 'metal' },
  { d0: -10.4, d1: -9.6, w0: 3.5, w1: 3.5, kind: 'ring' },
  { d0: -9.6, d1: -6.8, w0: 3.5, w1: 3.5, kind: 'metal' },
  { d0: -6.8, d1: -6, w0: 3.5, w1: 3.5, kind: 'ring' },
  { d0: -6, d1: 0, w0: 3.5, w1: 3.5, kind: 'metal' },
  { d0: 0, d1: 0.7, w0: 4.8, w1: MM.width, kind: 'plastic' },
  { d0: 0.7, d1: MM.housing, w0: MM.width, w1: MM.width, kind: 'plastic' },
  { d0: MM.housing, d1: MM.housing + MM.relief, w0: MM.width * 0.97, w1: MM.reliefEnd, kind: 'plastic' },
];

const SIDE_STOPS: Record<Section['kind'], [number, string][]> = {
  plastic: [
    [0, '#c3c4c9'],
    [0.2, '#efeff1'],
    [0.42, '#ffffff'],
    [0.76, '#e8e8eb'],
    [1, '#b6b7bc'],
  ],
  metal: [
    [0, '#74777d'],
    [0.28, '#f2f3f5'],
    [0.5, '#c2c4c8'],
    [0.8, '#8a8d93'],
    [1, '#585b61'],
  ],
  ring: [
    [0, '#0d0d0e'],
    [0.4, '#3a3a3d'],
    [1, '#111112'],
  ],
};
const CAP_FILL: Record<Section['kind'], [string, string]> = {
  plastic: ['#ffffff', '#dedee2'],
  metal: ['#e9eaec', '#9a9da2'],
  ring: ['#2a2a2c', '#111'],
};

function drawPlug(g: CanvasRenderingContext2D, tail: Vec, axisMm: Vec, mm: number, dz: number, showTip: boolean) {
  const along = len(axisMm);
  const u = along > 1e-3 ? norm(axisMm) : { x: 0, y: 1 };
  const v = { x: -u.y, y: u.x };
  const rot = Math.atan2(v.y, v.x);
  const round = Math.min(1, Math.abs(dz)); // minor/major ratio of the cylinder ends
  const total = MM.housing + MM.relief;
  const at = (d: number): Vec => add(tail, mul(u, (d - total) * along));

  const parts = PLUG.filter((p) => showTip || p.d0 >= 0);
  // far to near: when the outward end points at us, larger d is nearer
  const order = dz >= 0 ? parts : [...parts].reverse();

  const ellipse = (c: Vec, r: number) => {
    g.beginPath();
    g.ellipse(c.x, c.y, Math.max(0.01, r), Math.max(0.01, r * round), rot, 0, Math.PI * 2);
    g.fill();
  };

  const body = (p: Section) => {
    const c0 = at(p.d0);
    const c1 = at(p.d1);
    const r0 = (p.w0 / 2) * mm;
    const r1 = (p.w1 / 2) * mm;
    const rMax = Math.max(r0, r1);
    const grad = g.createLinearGradient(c0.x - v.x * rMax, c0.y - v.y * rMax, c0.x + v.x * rMax, c0.y + v.y * rMax);
    for (const [o, c] of SIDE_STOPS[p.kind]) grad.addColorStop(o, c);
    g.fillStyle = grad;
    // the side of the cylinder: a band between the two end ellipses
    g.beginPath();
    g.moveTo(c0.x + v.x * r0, c0.y + v.y * r0);
    g.lineTo(c1.x + v.x * r1, c1.y + v.y * r1);
    g.lineTo(c1.x - v.x * r1, c1.y - v.y * r1);
    g.lineTo(c0.x - v.x * r0, c0.y - v.y * r0);
    g.closePath();
    g.fill();
    if (round > 0.02) {
      ellipse(c0, r0);
      ellipse(c1, r1);
    }
  };

  const nearCap = (p: Section, i: number) => {
    if (round < 0.08) return;
    const nearD = dz >= 0 ? p.d1 : p.d0;
    const nearW = dz >= 0 ? p.w1 : p.w0;
    // hidden when the next nearer part is at least as wide at the joint
    const next = order[i + 1];
    if (next) {
      const nextW = dz >= 0 ? next.w0 : next.w1;
      if (nextW >= nearW * 0.98) return;
    }
    const c = at(nearD);
    const r = (nearW / 2) * mm;
    const [hi, lo] = CAP_FILL[p.kind];
    const grad = g.createRadialGradient(c.x - v.x * r * 0.3, c.y - v.y * r * 0.3, 0, c.x, c.y, r);
    grad.addColorStop(0, hi);
    grad.addColorStop(1, lo);
    g.fillStyle = grad;
    ellipse(c, r);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = Math.max(0.5, mm * 0.1);
    g.beginPath();
    g.ellipse(c.x, c.y, r, r * round, rot, 0, Math.PI * 2);
    g.stroke();
  };

  // soft shadow from the whole plug
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.18)';
  g.shadowBlur = Math.max(3, mm * 1.6);
  g.shadowOffsetY = Math.max(2, mm * 0.8);
  g.fillStyle = '#e9e9ec';
  for (const p of parts) if (p.kind === 'plastic') body(p);
  g.restore();

  order.forEach((p, i) => {
    body(p);
    nearCap(p, i);
  });

  // fine seam between housing and strain relief (only when seen from the side)
  if (round < 0.6) {
    const s1 = add(at(MM.housing), mul(v, (-MM.width / 2) * mm));
    const s2 = add(at(MM.housing), mul(v, (MM.width / 2) * mm));
    g.save();
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = Math.max(0.5, mm * 0.12);
    g.beginPath();
    g.moveTo(s1.x, s1.y);
    g.lineTo(s2.x, s2.y);
    g.stroke();
    g.restore();
  }
}
