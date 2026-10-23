import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { useAppearance, useCustomize } from '../core/customize/store';
import { getModel } from '../devices/registry';
import type { DeviceModel, DeviceProps } from '../devices/types';
import { liveOrientation, ROLL_ANGLE, useStage } from './stageStore';
import { installRollInput, rawPoint } from './rollInput';
import { LightVars } from './lightVars';
import { PHONE } from './phone';
import { JackMarkers, useEarPods } from './earpods/EarPods';
import { BodySlotContext } from './bodySlot';
import { Cover, type CoverInfo } from './cover/Cover';
import { coverGeometry } from './cover/geometry';
import { onSock, useSockPull } from './cover/sockPull';
import { useModelSwitch } from './modelSwitch';
import { pickModel, useOverview } from './overview';
import { isTypingTarget } from './keyboard';
import { MODELS } from '../devices/registry';
import type { Appearance } from '../devices/types';
import { ModelArt } from '../ui/ModelArt';

const lazyCache = new Map<string, LazyExoticComponent<ComponentType<DeviceProps>>>();
function deviceComponent(model: DeviceModel) {
  let c = lazyCache.get(model.id);
  if (!c) {
    c = lazy(model.load);
    lazyCache.set(model.id, c);
  }
  return c;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Space taken by the floating top bar and the view controls (px). */
const TOP_BAR = 64;
/** how long the iPod takes to lie on its side, or stand back up (ms) */
const ROLL_MS = 650;
/** room at the bottom: on phones the view controls are one button in the corner, so just a margin (see app.css) */
const BOTTOM_BAR = 28;
const SIDE_BAR = 68;
const WIDE = 720;
/** with a mouse the side controls hide off the edge until wanted (ViewControls.tsx), so they need no room */
const hoverable = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches;
/** room under each iPod in the chooser for its name */
const LABEL = 54;

interface Slot {
  /** centre, from the stage's centre (px) */
  x: number;
  y: number;
  /** the iPod's size on screen */
  w: number;
  h: number;
  /** its cell */
  cellW: number;
  cellH: number;
  /** extra scale: lifted under the pointer, or smaller beside the middle of the carousel */
  s: number;
}

/** at most this far from the middle (in iPods), an iPod in the chooser is live 3D; further out, a picture */
const LIVE_RANGE = 1;

/**
 * Where each iPod floats in the chooser: a carousel over the free part of
 * the stage, all at one scale so they keep their real sizes next to each
 * other. `focus` is big in the middle and the others get smaller with
 * distance; `drag` is how far a finger or the mouse has pulled it.
 *
 * Phones: a neighbour's middle sits at the screen edge, so half of it
 * shows. Wider screens: about five fit across.
 */
function overviewLayout(
  area: { w: number; h: number },
  cx: number,
  cy: number,
  focus: number,
  drag: number,
): { k: number; step: number; at: number; slots: Slot[] } {
  const phone = area.w < 760;
  const step = phone ? area.w * 0.5 : Math.min(area.w * 0.2, 320);
  const cellH = area.h;
  const fitW = phone ? area.w * 0.5 : step * 1.05;
  const k = Math.min(...MODELS.map((m) => Math.min(fitW / m.size.width, ((cellH - LABEL) * 0.78) / m.size.height)));
  const at = focus - drag / step; // where the carousel is, in iPods
  const slots = MODELS.map((m, i) => {
    const d = Math.min(2.5, Math.abs(i - at));
    return {
      x: cx + (i - at) * step,
      y: cy - area.h / 2 + (cellH - LABEL) / 2,
      w: m.size.width * k,
      h: m.size.height * k,
      cellW: step,
      cellH,
      s: phone ? 1 - 0.22 * Math.min(1, d) : 1 - 0.17 * d,
    };
  });
  return { k, step, at, slots };
}

/** A case or sock the iPod is wearing. */
function useCoverInfo(model: DeviceModel, appearance: Appearance): CoverInfo | null {
  const coverKind = appearance.cover?.kind ?? 'none';
  const coverColor = appearance.cover?.color ?? '#000';
  return useMemo<CoverInfo | null>(() => {
    const fit = model.cover;
    if (!fit || coverKind === 'none' || (coverKind !== 'sock' && !fit.cases)) return null;
    return { fit, choice: { kind: coverKind, color: coverColor }, pxPerMm: model.jack?.pxPerMm ?? 6.4, size: model.size };
  }, [model, coverKind, coverColor]);
}

/**
 * How far the camera may look down on the iPod (the view's share along the
 * iPod's length) before the sock goes back into the iPod's own 3D space.
 */
const SOCK_STEEP = 0.85;

/** The sock in the iPod's own 3D space: correct from anywhere, slow; shown only from high above (Stage SOCK LAYER). */
function SlowSock({ info, after = false }: { info: CoverInfo; after?: boolean }) {
  return <div className="cv-slow">{after ? <Cover info={info} after rim="none" /> : <Cover info={info} />}</div>;
}

/** the light and view the device styles read, for an iPod facing front (the stage sets them live on its own) */
const FRONT_VARS = { '--rx': 0, '--ry': 0, '--lx': 0, '--ly': 0, '--elx': 0, '--ely': 0, '--vx': 0, '--vy': 0, '--vz': -1 } as React.CSSProperties;

/**
 * How far from the middle (in iPods) an iPod in the chooser comes alive, and
 * how far it must go to become a picture again. On a phone only the one in
 * the middle, and only once the carousel has come to rest (see `settled`).
 */
const LIVE_ENTER = PHONE ? 0.5 : LIVE_RANGE + 0.5;
const LIVE_LEAVE = PHONE ? 0.6 : LIVE_RANGE + 1;
/** the cross-fade between an iPod's picture and its live self (ms, as in app.css) */
const ART_FADE = 360;

/**
 * A new iPod spins in only once it has been built and drawn: started at
 * once, the spin would run while the page is still busy putting the iPod
 * together, and its first half would be lost (on a phone, most of it).
 */
function EnterWhenDrawn({ onDrawn }: { onDrawn?: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const drawn = useRef(onDrawn);
  drawn.current = onDrawn;
  useEffect(() => {
    const host = ref.current?.closest('.device-enter');
    let r2 = 0;
    const r1 = requestAnimationFrame(
      () =>
        (r2 = requestAnimationFrame(() => {
          host?.classList.remove('wait');
          drawn.current?.();
        })),
    );
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);
  return <span ref={ref} hidden />;
}

/** Tells its parent once the lazily loaded device inside the same Suspense has drawn. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    // a frame for the device to paint its first look
    const r = requestAnimationFrame(() => requestAnimationFrame(onReady));
    return () => cancelAnimationFrame(r);
  }, [onReady]);
  return null;
}

/**
 * One of the other iPods in the chooser. Far from the middle it is only its
 * picture (a phone can't draw seven live iPods); near the middle the live
 * iPod is put underneath, and once it has drawn the picture fades away, so
 * it seems to come alive rather than be swapped. Moving away, the picture
 * fades back over it before it goes. It is one floating element throughout,
 * so its drift and entrance carry on unbroken. It can't be used.
 */
function OverviewSlot({ model, slot, index, out, dist, settled }: { model: DeviceModel; slot: Slot; index: number; out: boolean; dist: number; settled: boolean }) {
  const appearance = useAppearance(model.id);
  const cover = useCoverInfo(model, appearance);
  const Device = useMemo(() => deviceComponent(model), [model]);
  const extras = useMemo(() => ({ before: cover && <Cover info={cover} />, after: cover && <Cover info={cover} after /> }), [cover]);
  // pic: picture only · loading: live underneath, still hidden · live: shown · leaving: picture fading back
  const [phase, setPhase] = useState<'pic' | 'loading' | 'live' | 'leaving'>(() => (dist <= LIVE_ENTER && settled ? 'loading' : 'pic'));
  const near = dist <= LIVE_ENTER && settled;
  const far = dist > LIVE_LEAVE;
  useEffect(() => {
    if (near && (phase === 'pic' || phase === 'leaving')) setPhase(phase === 'pic' ? 'loading' : 'live');
    else if (far && (phase === 'live' || phase === 'loading')) setPhase('leaving');
  }, [near, far, phase]);
  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = window.setTimeout(() => setPhase('pic'), ART_FADE + 40);
    return () => window.clearTimeout(t);
  }, [phase]);
  const onReady = useCallback(() => setPhase((p) => (p === 'loading' ? 'live' : p)), []);
  const k = slot.w / model.size.width;
  const hasLive = phase !== 'pic';
  return (
    <div
      className={`stage-center ov-item ${out ? 'ov-out' : ''}`}
      style={{ transform: `translate(${slot.x}px, ${slot.y}px) scale(${k * slot.s})`, ['--ov-i' as string]: index }}
      inert
      aria-hidden="true"
    >
      <div className="stage-rot" style={FRONT_VARS}>
        <div className="device-enter ov-float" style={{ width: model.size.width, height: model.size.height }}>
          {hasLive && (
            <Suspense fallback={null}>
              <BodySlotContext.Provider value={extras}>
                <Device model={model} appearance={appearance} />
              </BodySlotContext.Provider>
              <Ready onReady={onReady} />
            </Suspense>
          )}
          {/* on the front face (alone, or over the live iPod until it has drawn), so it never moves when the live one comes or goes */}
          <div
            className={`ov-art ${phase === 'live' ? 'gone' : ''}`}
            style={{ width: model.size.width, height: model.size.height, transform: `translateZ(${model.size.depth / 2 + 1}px)` }}
          >
            <ModelArt model={model} appearance={appearance} height={model.size.height} />
          </div>
        </div>
      </div>
    </div>
  );
}

const barsFor = (width: number) => (width > WIDE ? { bottom: 28, right: hoverable() ? 0 : SIDE_BAR } : { bottom: BOTTOM_BAR, right: 0 });

/**
 * The 3D stage: fits the device to the viewport and lets the user spin it.
 *
 * Dragging anywhere that is not a device control rotates the device.
 * Shift/Alt + drag, or a right-button drag, rotates even over controls.
 */
export function Stage() {
  const modelId = useCustomize((s) => s.modelId);
  const scene = useCustomize((s) => s.scene);
  const model = getModel(modelId);
  const leaving = useModelSwitch((s) => s.leaving);
  const turn = useModelSwitch((s) => s.turn);
  const appearance = useAppearance(modelId);
  const zoom = useStage((s) => s.zoom);
  const target = useStage((s) => s.target);
  const spinning = useStage((s) => s.spinning);
  const inset = useStage((s) => s.inset);
  const roll = useStage((s) => s.roll);

  const wrapRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLDivElement>(null);
  // an iPod Sock's own 3D space, laid over the iPod's (see SOCK LAYER below)
  const sockRotRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLDivElement>(null);
  const sockEnterRef = useRef<HTMLDivElement>(null);
  const edgeLight = useRef({ x: '', y: '', shown: false });
  // the light values go onto the elements that read them, not the whole iPod (see lightVars)
  const lit = useMemo(() => new LightVars(), []);
  useEffect(() => () => lit.detach(), [lit]);
  const shadowRef = useRef<HTMLDivElement>(null);
  const backCanvas = useRef<HTMLCanvasElement>(null);
  const frontCanvas = useRef<HTMLCanvasElement>(null);
  const jackRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.8);
  const [bars, setBars] = useState(() => barsFor(typeof window === 'undefined' ? 1200 : window.innerWidth));

  const overview = useOverview((s) => s.open);
  const closing = useOverview((s) => s.closing);
  const hover = useOverview((s) => s.hover);
  const [box, setBox] = useState({ w: 1200, h: 800 });

  // A case or sock the iPod is wearing, and the size it all takes up.
  const cover = useCoverInfo(model, appearance);
  const outer = useMemo(() => {
    if (!cover || cover.choice.kind === 'none') return model.size;
    const b = coverGeometry(cover.fit, cover.choice.kind, cover.pxPerMm, cover.size).bounds;
    return {
      width: Math.max(model.size.width, b.width),
      height: Math.max(model.size.height, b.height),
      depth: Math.max(model.size.depth, b.depth),
    };
  }, [cover, model]);

  // Orientation lives in a ref and is applied directly to the DOM each frame.
  const st = useRef({
    rx: 0,
    ry: 0,
    vx: 0,
    vy: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    lastInteract: 0,
    tween: null as null | { fromX: number; fromY: number; toX: number; toY: number; t0: number; dur: number },
    px: 0,
    py: 0,
    /** a press on the sock that may yet become a pull (see onPointerMove) */
    maybePull: null as null | { id: number; x: number; y: number },
    /** the turn in the screen plane (deg), easing to the store's `roll` */
    roll: 0,
    rollTween: null as null | { from: number; to: number; t0: number },
  });

  // The other iPods' code, fetched while nothing else is happening, so changing
  // iPods doesn't wait for it (on a phone, downloading and starting it was
  // much of the pause).
  useEffect(() => {
    let cancelled = false;
    const idle = (f: () => void) => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: 4000 });
      else window.setTimeout(f, 1500);
    };
    const next = (i: number) => {
      if (cancelled || i >= MODELS.length) return;
      idle(() => {
        void MODELS[i]
          .load()
          .catch(() => {})
          .then(() => next(i + 1));
      });
    };
    const t = window.setTimeout(() => next(0), 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  // Lying on its side (the view controls, or a device turning for video).
  useEffect(() => {
    installRollInput();
    const s = st.current;
    const to = roll ? ROLL_ANGLE : 0;
    // (a turn still under way is replaced, even by one back to where it started)
    s.rollTween = s.roll === to ? null : { from: s.roll, to, t0: performance.now() };
  }, [roll]);

  // Fit to the available area (minus any side panel).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const fh = model.fitHeight ?? 0.86;
      // leave room for the floating top bar and the view controls
      const b = barsFor(r.width);
      setBars((cur) => (cur.bottom === b.bottom && cur.right === b.right ? cur : b));
      setBox((cur) => (cur.w === r.width && cur.h === r.height ? cur : { w: r.width, h: r.height }));
      const usableH = Math.max(160, r.height - TOP_BAR - (inset.bottom || b.bottom));
      const usableW = Math.max(200, r.width - inset.left - inset.right - b.right);
      // lying on its side, the iPod is as wide as it is otherwise tall
      const ow = roll ? outer.height : outer.width;
      const oh = roll ? outer.width : outer.height;
      const f = Math.min((usableH * fh) / oh, (usableW * 0.86) / ow);
      setFit(clamp(f, 0.2, 3));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [model, inset, outer, roll]);

  // Toolbar-requested views.
  useEffect(() => {
    if (!target) return;
    const s = st.current;
    // go the short way round
    let toY = target.ry;
    const cur = s.ry;
    toY = toY + Math.round((cur - toY) / 360) * 360;
    s.tween = { fromX: s.rx, fromY: s.ry, toX: target.rx, toY, t0: performance.now(), dur: 700 };
    s.vx = s.vy = 0;
  }, [target]);

  // Animation loop.
  const spinRef = useRef(spinning);
  spinRef.current = spinning;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const sizeRef = useRef(outer);
  sizeRef.current = outer;
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = st.current;
      const sc = sceneRef.current;
      if (s.tween) {
        const k = clamp((now - s.tween.t0) / s.tween.dur, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        s.rx = s.tween.fromX + (s.tween.toX - s.tween.fromX) * e;
        s.ry = s.tween.fromY + (s.tween.toY - s.tween.fromY) * e;
        if (k >= 1) s.tween = null;
      }
      if (s.rollTween) {
        const k = clamp((now - s.rollTween.t0) / ROLL_MS, 0, 1);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        s.roll = s.rollTween.from + (s.rollTween.to - s.rollTween.from) * e;
        if (k >= 1) s.rollTween = null;
      } else if (!s.dragging) {
        // inertia
        if (Math.abs(s.vx) > 0.01 || Math.abs(s.vy) > 0.01) {
          s.ry += s.vy;
          s.rx = clamp(s.rx + s.vx, -88, 88);
          s.vx *= 0.94;
          s.vy *= 0.94;
        } else if (spinRef.current || (sc.autoRotate && now - s.lastInteract > 4000)) {
          s.ry += 0.35;
        }
      }
      let px = 0;
      let py = 0;
      if (sc.parallax && !s.dragging && !s.tween) {
        px = s.px * 5;
        py = s.py * 4;
      }
      apply(s.rx - py, s.ry + px, s.roll);
      // a moment after it stops turning, the paused effects come back
      const mv = moving.current;
      if (mv.on && now - mv.t > 220) {
        mv.on = false;
        wrapRef.current?.classList.remove('moving');
        flushEdgeLight();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const moving = useRef({ on: false, t: 0 });
  const flushEdgeLight = () => {
    const e = edgeLight.current;
    e.shown = true;
    lit.set('--elx', e.x);
    lit.set('--ely', e.y);
  };
  // what was last written, so a still iPod costs nothing a frame
  const applied = useRef({ el: null as HTMLElement | null, sock: null as HTMLElement | null, key: '' });
  const steepRef = useRef(false);
  const tagRef = useRef(false);
  const apply = (rx: number, ry: number, roll: number) => {
    const el = rotRef.current;
    if (!el) return;
    const m = sizeRef.current;
    const key = `${rx.toFixed(2)} ${ry.toFixed(2)} ${roll.toFixed(2)} ${m.width} ${m.height} ${m.depth} ${shadowRef.current ? 1 : 0}`;
    lit.attach(el);
    const sockEl = sockRotRef.current;
    if (applied.current.el === el && applied.current.sock === sockEl && applied.current.key === key) return;
    applied.current = { el, sock: sockEl, key };
    lit.tick();
    // while it turns, effects that would be redrawn every frame wait (app.css .stage.moving)
    moving.current.t = performance.now();
    if (!moving.current.on) {
      moving.current.on = true;
      wrapRef.current?.classList.add('moving');
    }
    // the roll turns the iPod in its own plane first, then the view turns it in 3D
    el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)${roll ? ` rotateZ(${roll.toFixed(2)}deg)` : ''}`;
    if (sockEl) sockEl.style.transform = el.style.transform;
    liveOrientation.rx = rx;
    liveOrientation.ry = ry;
    liveOrientation.roll = roll;
    const ryRad = (ry * Math.PI) / 180;
    const rxRad = (rx * Math.PI) / 180;
    // Light and view directions are read in the iPod's own frame: on its
    // side, the stage's left-right is the iPod's up-down.
    const rr = (roll * Math.PI) / 180;
    const rc = Math.cos(rr);
    const rs = Math.sin(rr);
    const own = (x: number, y: number) => [x * rc + y * rs, -x * rs + y * rc];
    const [lx, nly] = own(Math.sin(ryRad), -Math.sin(rxRad));
    lit.set('--rx', rx.toFixed(1));
    lit.set('--ry', ((((ry % 360) + 540) % 360) - 180).toFixed(1));
    lit.set('--lx', lx.toFixed(3));
    lit.set('--ly', (-nly).toFixed(3));
    // A coarse copy for the device edges: their surface is hundreds of small
    // pieces, which only need repainting when the light has moved a step.
    const elx = (Math.round(lx * 20) / 20).toFixed(2);
    const ely = (Math.round(-nly * 20) / 20).toFixed(2);
    // Those hundreds of pieces repaint together whenever it steps, so while
    // the iPod turns it waits, and catches up when it stops (see the loop).
    edgeLight.current.x = elx;
    edgeLight.current.y = ely;
    if (!edgeLight.current.shown) flushEdgeLight();
    // Where the camera looks, in device coordinates (x right, y down, z out of
    // the front): lets holes and recesses show their inner walls (parallax).
    const [vx, vy] = own(Math.cos(rxRad) * Math.sin(ryRad), -Math.sin(rxRad));
    // Seen from high above the iPod, the top of it hides parts of the sock,
    // which its own space (drawn over the iPod) can't know: there, the sock
    // in the iPod's space is shown instead (SOCK LAYER below).
    const steep = vy > SOCK_STEEP;
    if (steep !== steepRef.current) {
      steepRef.current = steep;
      wrapRef.current?.classList.toggle('sock-steep', steep);
    }
    // Its tag sticks out on the iPod's left: seen from that side it is in
    // front of the sock (drawn with it); from the other, the iPod may hide it.
    const tagNear = vx > 0;
    if (tagNear !== tagRef.current) {
      tagRef.current = tagNear;
      wrapRef.current?.classList.toggle('sock-tag-near', tagNear);
    }
    lit.set('--vx', vx.toFixed(3));
    lit.set('--vy', vy.toFixed(3));
    lit.set('--vz', (-Math.cos(rxRad) * Math.cos(ryRad)).toFixed(3));
    const sh = shadowRef.current;
    if (sh) {
      const across = Math.abs(rc) * m.width + Math.abs(rs) * m.height;
      const w = Math.abs(Math.cos(ryRad)) * across + Math.abs(Math.sin(ryRad)) * m.depth;
      sh.style.width = `${w * 1.05}px`;
      sh.style.opacity = String(0.55 + 0.25 * Math.abs(Math.cos(rxRad)));
    }
  };

  // Two fingers on the stage zoom (phones have no wheel): where they are, and the pinch under way.
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; z0: number } | null>(null);
  const spread = () => {
    const [a, b] = [...fingers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  // a double tap on the background faces the iPod front at 100% (iOS doesn't send dblclick here)
  const tap = useRef<{ x: number; y: number; t: number; last: { x: number; y: number; t: number } | null }>({ x: 0, y: 0, t: 0, last: null });
  const endFinger = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId);
    if (fingers.current.size < 2) pinch.current = null;
  };

  // Pointer handling for rotation.
  const onPointerDown = (e: React.PointerEvent) => {
    if (useOverview.getState().open) return;
    if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('[data-no-stage]')) {
      // the first finger of a new touch: forget any finger whose lift went unseen
      if (e.isPrimary) {
        fingers.current.clear();
        pinch.current = null;
      }
      fingers.current.set(e.pointerId, { x: rawPoint(e).x, y: rawPoint(e).y });
      if (!(e.target as HTMLElement).closest('[data-control]')) Object.assign(tap.current, { x: rawPoint(e).x, y: rawPoint(e).y, t: performance.now() });
      else tap.current.t = 0;
      if (fingers.current.size === 2) {
        // a second finger: stop turning, start zooming
        const s = st.current;
        s.dragging = false;
        s.vx = s.vy = 0;
        pinch.current = { d0: Math.max(1, spread()), z0: useStage.getState().zoom };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
    const t = e.target as HTMLElement;
    const force = e.shiftKey || e.altKey || e.button === 2;
    if (!force && t.closest('[data-control]')) return;
    if (t.closest('[data-no-stage]')) return;
    if (e.button !== 0 && e.button !== 2) return;
    const s = st.current;
    // on the sock: a drag up or down moves it along the iPod, a sideways one turns the iPod
    s.maybePull = !force && sockMouthRef.current != null && !useStage.getState().roll && onSock(sockRotRef.current, rawPoint(e).x, rawPoint(e).y) ? { id: e.pointerId, x: rawPoint(e).x, y: rawPoint(e).y } : null;
    s.dragging = true;
    s.tween = null;
    s.vx = s.vy = 0;
    s.lastX = rawPoint(e).x;
    s.lastY = rawPoint(e).y;
    s.lastT = performance.now();
    s.lastInteract = performance.now();
    useStage.setState({ spinning: false });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, { x: rawPoint(e).x, y: rawPoint(e).y });
    if (pinch.current) {
      if (fingers.current.size >= 2) useStage.getState().setZoom((pinch.current.z0 * spread()) / pinch.current.d0);
      return;
    }
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) {
      s.px = clamp(((rawPoint(e).x - r.left) / r.width) * 2 - 1, -1, 1);
      s.py = clamp(((rawPoint(e).y - r.top) / r.height) * 2 - 1, -1, 1);
    }
    if (!s.dragging) return;
    const mp = s.maybePull;
    if (mp && mp.id === e.pointerId) {
      const mx = rawPoint(e).x - mp.x;
      const my = rawPoint(e).y - mp.y;
      if (Math.hypot(mx, my) < 8) return; // not sure yet
      s.maybePull = null;
      if (Math.abs(my) > 1.5 * Math.abs(mx)) {
        s.dragging = false;
        s.vx = s.vy = 0;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* not captured */
        }
        pullSock(e.pointerId, mp.y);
        return;
      }
    }
    const now = performance.now();
    const dx = rawPoint(e).x - s.lastX;
    const dy = rawPoint(e).y - s.lastY;
    const dt = Math.max(1, now - s.lastT);
    const k = 0.45;
    s.ry += dx * k;
    s.rx = clamp(s.rx - dy * k, -88, 88);
    s.vy = ((dx * k) / dt) * 16;
    s.vx = ((-dy * k) / dt) * 16;
    s.lastX = rawPoint(e).x;
    s.lastY = rawPoint(e).y;
    s.lastT = now;
    s.lastInteract = now;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasPinch = !!pinch.current || fingers.current.size > 1;
    endFinger(e);
    const tp = tap.current;
    const now = performance.now();
    if (e.pointerType === 'touch' && !wasPinch && tp.t && now - tp.t < 250 && Math.hypot(rawPoint(e).x - tp.x, rawPoint(e).y - tp.y) < 10) {
      const l = tp.last;
      if (l && now - l.t < 350 && Math.hypot(rawPoint(e).x - l.x, rawPoint(e).y - l.y) < 40) {
        tp.last = null;
        useStage.getState().front();
        useStage.getState().setZoom(1);
      } else tp.last = { x: rawPoint(e).x, y: rawPoint(e).y, t: now };
    }
    const s = st.current;
    // lifting from a pinch doesn't fling the iPod round
    if (wasPinch) {
      s.dragging = false;
      s.vx = s.vy = 0;
      return;
    }
    if (!s.dragging) return;
    s.dragging = false;
    s.lastInteract = performance.now();
    if (performance.now() - s.lastT > 80) s.vx = s.vy = 0;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    if (useOverview.getState().open) return;
    if ((e.target as HTMLElement).closest('[data-control]')) return;
    useStage.getState().front();
    useStage.getState().setZoom(1);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (useOverview.getState().open) return;
    if ((e.target as HTMLElement).closest('[data-control]')) return;
    const z = useStage.getState().zoom;
    useStage.getState().setZoom(z * (e.deltaY > 0 ? 0.94 : 1.06));
  };

  // A sock covers everything below its opening: a jack down there can't be reached,
  // and the controls in there work only as they would through fabric (see bodySlot).
  const sock = useMemo(() => {
    if (!cover || cover.choice.kind !== 'sock') return null;
    return coverGeometry(cover.fit, 'sock', cover.pxPerMm, cover.size).sock ?? null;
  }, [cover]);
  const sockMouth = sock?.mouth ?? null;
  const jackCovered = sockMouth != null && !!model.jack && model.jack.y > sockMouth;
  const sockMouthRef = useRef(sockMouth);
  sockMouthRef.current = sockMouth;
  const scaleRef = useRef(1);
  const sockSpan = useMemo(
    () => ({
      height: model.size.height,
      sleeve: sock ? sock.rows[sock.sleeve].y - sock.mouth : 1,
      below: sock ? sock.rows[sock.rows.length - 1].y - sock.rows[sock.sleeve].y : 1,
    }),
    [model, sock],
  );
  const pullSock = useSockPull([rotRef, sockRotRef], scaleRef, sockSpan);
  useEarPods({ wrap: wrapRef, back: backCanvas, front: frontCanvas, markers: jackRef, model, enabled: scene.earpods !== false && !jackCovered });

  const Device = useMemo(() => deviceComponent(model), [model]);
  // inside the device's own 3D root, so they turn with it (see bodySlot)
  const bodyExtras = useMemo(
    () => ({
      before: (
        <>
          {cover && (sock ? <SlowSock info={cover} /> : <Cover info={cover} />)}
          <JackMarkers model={model} markerRef={jackRef} />
        </>
      ),
      // a sock is drawn over the iPod (SOCK LAYER below), all but the rim and tag; seen from high above, here instead
      after:
        cover &&
        (sock ? (
          <>
            <SlowSock info={cover} after />
            <Cover info={cover} after rim="only" />
          </>
        ) : (
          <Cover info={cover} after />
        )),
      sockMouth,
      // on its side the sock can't be pulled along the iPod
      pullSock: roll ? undefined : pullSock,
    }),
    [cover, model, sock, sockMouth, pullSock, roll],
  );
  const enterKey = `${model.id}:${turn}`;
  // the sock waits for the iPod it goes on to be drawn
  const [drawn, setDrawn] = useState('');
  const onDrawn = useCallback(() => setDrawn(enterKey), [enterKey]);
  const sockShown = !!sock && drawn === enterKey;
  // The sock's copy of the iPod's entrance (and its float in the chooser):
  // the same classes, so the same animations, caught up to where the
  // iPod's are when the sock goes on later.
  useLayoutEffect(() => {
    const main = enterRef.current;
    const copy = sockEnterRef.current;
    if (!sockShown || !main || !copy) return;
    const sync = () => {
      if (copy.className !== main.className) copy.className = main.className;
    };
    sync();
    const theirs = main.getAnimations();
    for (const a of copy.getAnimations()) {
      const name = (a as CSSAnimation).animationName;
      const m = theirs.find((x) => (x as CSSAnimation).animationName === name);
      try {
        if (m) a.currentTime = m.currentTime;
        else a.finish();
      } catch {
        /* an endless one the iPod isn't running: leave it */
      }
    }
    const mo = new MutationObserver(sync);
    mo.observe(main, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, [sockShown, enterKey]);
  const scale = fit * zoom;
  scaleRef.current = scale;
  const shiftX = (inset.left - inset.right - bars.right) / 2;
  const centerY = (TOP_BAR - (inset.bottom || bars.bottom)) / 2;

  // The chooser: where everything floats, and the keys while it's up.
  const index = MODELS.findIndex((m) => m.id === model.id);
  const focus = hover < 0 ? index : hover;
  // a finger pulling the carousel (px), and where it started
  const [drag, setDrag] = useState(0);
  // On a phone the chooser's iPods stay pictures while it moves; the one that
  // comes to rest in the middle comes alive (one live iPod is all a phone can turn smoothly).
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    if (!PHONE) return;
    setSettled(false);
    if (drag) return;
    // long enough that stepping through several iPods doesn't build the ones passed on the way
    const t = window.setTimeout(() => setSettled(true), 800);
    return () => window.clearTimeout(t);
  }, [focus, drag]);
  const swallow = useRef(false);
  const wheelAcc = useRef({ sum: 0, t: 0, last: 0 });
  const swipe = useRef<{ x: number; y: number; id: number; moved: boolean; bg: boolean } | null>(null);
  const areaW = Math.max(200, box.w - inset.left - inset.right - bars.right);
  const layout = useMemo(
    () => overviewLayout({ w: areaW, h: Math.max(200, box.h - TOP_BAR - (inset.bottom || bars.bottom)) }, shiftX, centerY, focus, drag),
    [box, inset, bars, shiftX, centerY, focus, drag, areaW],
  );
  const showOverview = overview || !!closing;
  const mySlot = layout.slots[index];
  // an iPod that has been in the chooser doesn't play its entrance again when it leaves
  const quietFor = useRef('');
  if (showOverview) quietFor.current = `${model.id}:${turn}`;
  const quiet = quietFor.current === `${model.id}:${turn}`;
  useEffect(() => {
    if (!overview) return;
    const taken = new Set<string>();
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const { hover: h } = useOverview.getState();
      const n = MODELS.length;
      const cur = h < 0 ? index : h;
      const move = (d: number) => useOverview.setState({ hover: Math.max(0, Math.min(n - 1, cur + d)) });
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'Home') move(-n);
      else if (e.key === 'End') move(n);
      else if (e.key === 'Enter' || e.key === ' ') pickModel(MODELS[cur].id);
      else if (e.key === 'Escape') pickModel();
      // every other key too: none of the iPods takes keys while you choose
      taken.add(e.key);
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const up = (e: KeyboardEvent) => {
      if (taken.delete(e.key)) e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [overview, index]);
  const centerTransform =
    overview && mySlot
      ? `translate(${mySlot.x}px, ${mySlot.y}px) scale(${(mySlot.w / model.size.width) * mySlot.s})`
      : `translate(${shiftX}px, ${centerY}px) scale(${scale})`;

  return (
    <div
      ref={wrapRef}
      className={`stage backdrop-${scene.backdrop} ${overview ? 'overview' : ''} ${drag ? 'swiping' : ''}`}
      style={{ ['--bg1' as string]: scene.color1, ['--bg2' as string]: scene.color2 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="stage-floor" />
      {scene.shadow && (
        <div
          className="stage-shadow"
          ref={shadowRef}
          style={{ transform: `translate(calc(-50% + ${shiftX}px), ${((roll ? outer.width : outer.height) / 2) * scale + centerY + 14}px) scale(${scale})` }}
        />
      )}
      {/* EarPods cable behind the iPod (and on top when the jack faces the camera) */}
      <canvas ref={backCanvas} className="ep-canvas" aria-hidden="true" />
      {showOverview &&
        MODELS.map((m, i) => {
          if (m.id === model.id) return null;
          // live 3D only near the middle: the rest are pictures (see OverviewSlot)
          return <OverviewSlot key={m.id} model={m} slot={layout.slots[i]} index={i} out={!overview} dist={Math.abs(i - layout.at)} settled={settled} />;
        })}
      <div className="stage-center" key={model.id} style={{ transform: centerTransform, ['--ov-i' as string]: index }}>
        <div className="stage-rot" ref={rotRef} inert={overview}>
          <div
            className={`device-enter ${leaving ? 'device-leave' : ''} ${quiet ? 'quiet' : 'wait'}`}
            key={enterKey}
            ref={enterRef}
            style={{ width: model.size.width, height: model.size.height }}
          >
            <Suspense fallback={<div className="device-loading" style={{ width: model.size.width, height: model.size.height }} />}>
              <BodySlotContext.Provider value={bodyExtras}>
                <Device model={model} appearance={appearance} />
              </BodySlotContext.Provider>
              <EnterWhenDrawn onDrawn={onDrawn} />
            </Suspense>
          </div>
        </div>
      </div>
      {/*
       * SOCK LAYER. The browser depth-sorts everything in one 3D space by
       * cutting pieces along each other's planes, every frame it moves: in the
       * iPod's own space the body's hundreds of planes would slice the sock's
       * pieces again and again (a sock made it drop to half the frame rate).
       * So the sock has a space of its own, turned with the iPod and drawn
       * over it. Only the sides of the fabric facing the camera are drawn
       * (cover.css), and the iPod is inside or above it, never in front of it.
       */}
      {sockShown && cover && (
        <div className="stage-center stage-sock" key={`sock:${model.id}`} style={{ transform: centerTransform, ['--ov-i' as string]: index }} aria-hidden="true">
          <div className="stage-rot" ref={sockRotRef} inert>
            <div className="device-enter" key={enterKey} ref={sockEnterRef} style={{ width: model.size.width, height: model.size.height }}>
              <div className="stage-sock-host" style={{ width: model.size.width, height: model.size.height }}>
                <Cover info={cover} />
                <Cover info={cover} after rim="none" />
              </div>
            </div>
          </div>
        </div>
      )}
      <canvas ref={frontCanvas} className="ep-canvas" aria-hidden="true" />
      {overview && (
        <div
          className="ov-hits carousel"
          data-no-stage=""
          onWheel={(e) => {
            // a wheel or a trackpad swipe steps through them
            const w = wheelAcc.current;
            const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            w.sum = performance.now() - w.t > 250 ? d : w.sum + d;
            w.t = performance.now();
            if (Math.abs(w.sum) < 40 || performance.now() - w.last < 180) return;
            w.last = performance.now();
            useOverview.setState({ hover: Math.max(0, Math.min(MODELS.length - 1, focus + (w.sum > 0 ? 1 : -1))) });
            w.sum = 0;
          }}
          onPointerDown={(e) => {
            const bg = e.target === e.currentTarget;
            // the carousel follows a finger; a tap still picks
            swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, bg };
          }}
          onPointerMove={(e) => {
            const sw = swipe.current;
            if (!sw || sw.id !== e.pointerId) return;
            const dx = e.clientX - sw.x;
            if (!sw.moved && Math.abs(dx) > 8) {
              sw.moved = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }
            if (!sw.moved) return;
            // past the first or last iPod it gives, like a rubber band
            const end = (dx > 0 && focus === 0) || (dx < 0 && focus === MODELS.length - 1);
            setDrag(end ? dx * 0.3 : dx);
          }}
          onPointerUp={(e) => {
            const sw = swipe.current;
            if (!sw || sw.id !== e.pointerId) return;
            swipe.current = null;
            if (sw.moved) {
              swallow.current = true;
              setTimeout(() => (swallow.current = false), 0);
            }
            if (!sw.moved) {
              if (sw.bg) pickModel();
              return;
            }
            const dx = e.clientX - sw.x;
            let steps = Math.round(-dx / layout.step);
            if (steps === 0 && Math.abs(dx) > 40) steps = dx < 0 ? 1 : -1;
            useOverview.setState({ hover: Math.max(0, Math.min(MODELS.length - 1, focus + steps)) });
            setDrag(0);
          }}
          onPointerCancel={() => {
            swipe.current = null;
            setDrag(0);
          }}
          onClickCapture={(e) => {
            // the click that ends a swipe isn't a tap
            if (swallow.current || swipe.current?.moved) e.stopPropagation();
          }}
        >
          <div className="ov-title" style={{ top: TOP_BAR + 6, left: `calc(50% + ${shiftX}px)` }}>
            Choose an iPod
          </div>
          {/* where you are among them; and arrows for a mouse */}
          <div className="ov-dots" style={{ top: TOP_BAR + 28, left: `calc(50% + ${shiftX}px)` }}>
            {MODELS.map((m, i) => (
              <button key={m.id} className={i === focus ? 'on' : ''} aria-label={`${m.name} (${m.year})`} onClick={() => useOverview.setState({ hover: i })} />
            ))}
          </div>
          {focus > 0 && (
            <button
              className="ov-arrow prev"
              style={{ left: `calc(50% + ${shiftX - areaW / 2 + 44}px)` }}
              aria-label="Previous iPod"
              onClick={() => useOverview.setState({ hover: focus - 1 })}
            >
              ‹
            </button>
          )}
          {focus < MODELS.length - 1 && (
            <button
              className="ov-arrow next"
              style={{ left: `calc(50% + ${shiftX + areaW / 2 - 44}px)` }}
              aria-label="Next iPod"
              onClick={() => useOverview.setState({ hover: focus + 1 })}
            >
              ›
            </button>
          )}
          {MODELS.map((m, i) => {
            const s = layout.slots[i];
            const top = s.y - (s.cellH - LABEL) / 2;
            return (
              <button
                key={m.id}
                className={`ov-hit ${focus === i ? 'on' : ''} ${m.id === model.id ? 'current' : ''}`}
                style={{
                  left: `calc(50% + ${s.x - s.cellW / 2}px)`,
                  top: `calc(50% + ${top}px)`,
                  width: s.cellW,
                  height: s.cellH,
                  ['--ov-i' as string]: i,
                  ['--ov-floor' as string]: `${s.y + s.h / 2 - top + 10}px`,
                  ['--ov-w' as string]: `${s.w}px`,
                }}
                onClick={() => {
                  // a tap on a neighbour brings it to the middle first
                  if (i !== focus) useOverview.setState({ hover: i });
                  else pickModel(m.id);
                }}
              >
                <i className="ov-shadow" />
                <span className="ov-label">
                  <b>{m.name}</b>
                  <small>
                    {m.generation.split(' · ')[0]} · {m.year}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
