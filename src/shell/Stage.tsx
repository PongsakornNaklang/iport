import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { useAppearance, useCustomize } from '../core/customize/store';
import { getModel } from '../devices/registry';
import type { DeviceModel, DeviceProps } from '../devices/types';
import { liveOrientation, useStage } from './stageStore';
import { JackMarkers, useEarPods } from './earpods/EarPods';
import { BodySlotContext } from './bodySlot';
import { Cover, type CoverInfo } from './cover/Cover';
import { coverGeometry } from './cover/geometry';
import { useModelSwitch } from './modelSwitch';
import { pickModel, useOverview } from './overview';
import { isTypingTarget } from './keyboard';
import { MODELS } from '../devices/registry';
import type { Appearance } from '../devices/types';

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
/** room for the view controls: along the bottom on phones, on the right edge otherwise (see app.css) */
const BOTTOM_BAR = 76;
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

/** narrower than this, the chooser is a carousel you swipe */
const CAROUSEL_W = 760;

/**
 * Where each iPod floats in the chooser, over the free part of the stage,
 * all at one scale so they keep their real sizes next to each other.
 *
 * Wide screens: a row, `focus` lifted. Narrow ones: a carousel, `focus`
 * big in the middle and its neighbours peeking in half from the edges;
 * `drag` is how far a finger has pulled it.
 */
function overviewLayout(
  area: { w: number; h: number },
  cx: number,
  cy: number,
  focus: number,
  drag: number,
): { k: number; cols: number; carousel: boolean; step: number; slots: Slot[] } {
  if (area.w < CAROUSEL_W) {
    const step = area.w * 0.5; // a neighbour's middle sits at the screen edge: half of it shows
    const cellH = area.h;
    const k = Math.min(...MODELS.map((m) => Math.min((area.w * 0.5) / m.size.width, ((cellH - LABEL) * 0.78) / m.size.height)));
    const at = focus - drag / step; // where the carousel is, in iPods
    const slots = MODELS.map((m, i) => {
      const d = Math.min(1, Math.abs(i - at));
      return {
        x: cx + (i - at) * step,
        y: cy - area.h / 2 + (cellH - LABEL) / 2,
        w: m.size.width * k,
        h: m.size.height * k,
        cellW: step,
        cellH,
        s: 1 - 0.22 * d,
      };
    });
    return { k, cols: 1, carousel: true, step, slots };
  }
  const cols = MODELS.length;
  const rows = Math.ceil(MODELS.length / cols);
  const cellW = area.w / cols;
  const cellH = area.h / rows;
  const k = Math.min(...MODELS.map((m) => Math.min((cellW * 0.7) / m.size.width, ((cellH - LABEL) * (rows > 1 ? 0.7 : 0.78)) / m.size.height)));
  const slots = MODELS.map((m, i) => ({
    x: cx - area.w / 2 + cellW * ((i % cols) + 0.5),
    y: cy - area.h / 2 + cellH * Math.floor(i / cols) + (cellH - LABEL) / 2,
    w: m.size.width * k,
    h: m.size.height * k,
    cellW,
    cellH,
    s: i === focus ? 1.08 : 1,
  }));
  return { k, cols, carousel: false, step: cellW, slots };
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

/** the light and view the device styles read, for an iPod facing front (the stage sets them live on its own) */
const FRONT_VARS = { '--rx': 0, '--ry': 0, '--lx': 0, '--ly': 0, '--elx': 0, '--ely': 0, '--vx': 0, '--vy': 0, '--vz': -1 } as React.CSSProperties;

/** One of the other iPods in the chooser: live, but it can't be used. */
function OverviewItem({ model, slot, index, out }: { model: DeviceModel; slot: Slot; index: number; out: boolean }) {
  const appearance = useAppearance(model.id);
  const cover = useCoverInfo(model, appearance);
  const Device = useMemo(() => deviceComponent(model), [model]);
  const extras = useMemo(() => ({ before: cover && <Cover info={cover} />, after: cover && <Cover info={cover} after /> }), [cover]);
  const k = slot.w / model.size.width;
  return (
    <div
      className={`stage-center ov-item ${out ? 'ov-out' : ''}`}
      style={{ transform: `translate(${slot.x}px, ${slot.y}px) scale(${k * slot.s})`, ['--ov-i' as string]: index }}
      inert
      aria-hidden="true"
    >
      <div className="stage-rot" style={FRONT_VARS}>
        <div className="device-enter ov-float" style={{ width: model.size.width, height: model.size.height }}>
          <Suspense fallback={<div className="device-loading" style={{ width: model.size.width, height: model.size.height }} />}>
            <BodySlotContext.Provider value={extras}>
              <Device model={model} appearance={appearance} />
            </BodySlotContext.Provider>
          </Suspense>
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

  const wrapRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLDivElement>(null);
  const edgeLight = useRef({ x: '', y: '' });
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
  });

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
      const f = Math.min((usableH * fh) / outer.height, (usableW * 0.86) / outer.width);
      setFit(clamp(f, 0.2, 3));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [model, inset, outer]);

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
      apply(s.rx - py, s.ry + px);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // what was last written, so a still iPod costs nothing a frame
  const applied = useRef({ el: null as HTMLElement | null, key: '' });
  const apply = (rx: number, ry: number) => {
    const el = rotRef.current;
    if (!el) return;
    const key = `${rx.toFixed(2)} ${ry.toFixed(2)} ${sizeRef.current.width} ${sizeRef.current.depth} ${shadowRef.current ? 1 : 0}`;
    if (applied.current.el === el && applied.current.key === key) return;
    applied.current = { el, key };
    el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    liveOrientation.rx = rx;
    liveOrientation.ry = ry;
    const ryRad = (ry * Math.PI) / 180;
    const rxRad = (rx * Math.PI) / 180;
    el.style.setProperty('--rx', rx.toFixed(1));
    el.style.setProperty('--ry', ((((ry % 360) + 540) % 360) - 180).toFixed(1));
    el.style.setProperty('--lx', Math.sin(ryRad).toFixed(3));
    el.style.setProperty('--ly', Math.sin(rxRad).toFixed(3));
    // A coarse copy for the device edges: their surface is hundreds of small
    // pieces, which only need repainting when the light has moved a step.
    const elx = (Math.round(Math.sin(ryRad) * 20) / 20).toFixed(2);
    const ely = (Math.round(Math.sin(rxRad) * 20) / 20).toFixed(2);
    if (elx !== edgeLight.current.x) el.style.setProperty('--elx', (edgeLight.current.x = elx));
    if (ely !== edgeLight.current.y) el.style.setProperty('--ely', (edgeLight.current.y = ely));
    // Where the camera looks, in device coordinates (x right, y down, z out of
    // the front): lets holes and recesses show their inner walls (parallax).
    el.style.setProperty('--vx', (Math.cos(rxRad) * Math.sin(ryRad)).toFixed(3));
    el.style.setProperty('--vy', (-Math.sin(rxRad)).toFixed(3));
    el.style.setProperty('--vz', (-Math.cos(rxRad) * Math.cos(ryRad)).toFixed(3));
    const sh = shadowRef.current;
    if (sh) {
      const m = sizeRef.current;
      const w = Math.abs(Math.cos(ryRad)) * m.width + Math.abs(Math.sin(ryRad)) * m.depth;
      sh.style.width = `${w * 1.05}px`;
      sh.style.opacity = String(0.55 + 0.25 * Math.abs(Math.cos(rxRad)));
    }
  };

  // Pointer handling for rotation.
  const onPointerDown = (e: React.PointerEvent) => {
    if (useOverview.getState().open) return;
    const t = e.target as HTMLElement;
    const force = e.shiftKey || e.altKey || e.button === 2;
    if (!force && t.closest('[data-control]')) return;
    if (t.closest('[data-no-stage]')) return;
    if (e.button !== 0 && e.button !== 2) return;
    const s = st.current;
    s.dragging = true;
    s.tween = null;
    s.vx = s.vy = 0;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = performance.now();
    s.lastInteract = performance.now();
    useStage.setState({ spinning: false });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current;
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) {
      s.px = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      s.py = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    }
    if (!s.dragging) return;
    const now = performance.now();
    const dx = e.clientX - s.lastX;
    const dy = e.clientY - s.lastY;
    const dt = Math.max(1, now - s.lastT);
    const k = 0.45;
    s.ry += dx * k;
    s.rx = clamp(s.rx - dy * k, -88, 88);
    s.vy = ((dx * k) / dt) * 16;
    s.vx = ((-dy * k) / dt) * 16;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = now;
    s.lastInteract = now;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = st.current;
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
  };
  const onWheel = (e: React.WheelEvent) => {
    if (useOverview.getState().open) return;
    if ((e.target as HTMLElement).closest('[data-control]')) return;
    const z = useStage.getState().zoom;
    useStage.getState().setZoom(z * (e.deltaY > 0 ? 0.94 : 1.06));
  };

  useEarPods({ wrap: wrapRef, back: backCanvas, front: frontCanvas, markers: jackRef, model, enabled: scene.earpods !== false });

  const Device = useMemo(() => deviceComponent(model), [model]);
  // inside the device's own 3D root, so they turn with it (see bodySlot)
  const bodyExtras = useMemo(
    () => ({
      before: (
        <>
          {cover && <Cover info={cover} />}
          <JackMarkers model={model} markerRef={jackRef} />
        </>
      ),
      after: cover && <Cover info={cover} after />,
    }),
    [cover, model],
  );
  const scale = fit * zoom;
  const shiftX = (inset.left - inset.right - bars.right) / 2;
  const centerY = (TOP_BAR - (inset.bottom || bars.bottom)) / 2;

  // The chooser: where everything floats, and the keys while it's up.
  const index = MODELS.findIndex((m) => m.id === model.id);
  const focus = hover < 0 ? index : hover;
  // a finger pulling the carousel (px), and where it started
  const [drag, setDrag] = useState(0);
  const swallow = useRef(false);
  const swipe = useRef<{ x: number; y: number; id: number; moved: boolean; bg: boolean } | null>(null);
  const layout = useMemo(
    () =>
      overviewLayout(
        { w: Math.max(200, box.w - inset.left - inset.right - bars.right), h: Math.max(200, box.h - TOP_BAR - (inset.bottom || bars.bottom)) },
        shiftX,
        centerY,
        focus,
        drag,
      ),
    [box, inset, bars, shiftX, centerY, focus, drag],
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
      const move = (d: number) => useOverview.setState({ hover: (cur + d + n) % n });
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowUp' && layout.cols > 1) move(-layout.cols);
      else if (e.key === 'ArrowDown' && layout.cols > 1) move(layout.cols);
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
  }, [overview, index, layout.cols]);
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
          style={{ transform: `translate(calc(-50% + ${shiftX}px), ${(outer.height / 2) * scale + centerY + 14}px) scale(${scale})` }}
        />
      )}
      {/* EarPods cable behind the iPod (and on top when the jack faces the camera) */}
      <canvas ref={backCanvas} className="ep-canvas" aria-hidden="true" />
      {showOverview &&
        MODELS.map((m, i) => (m.id === model.id ? null : <OverviewItem key={m.id} model={m} slot={layout.slots[i]} index={i} out={!overview} />))}
      <div className="stage-center" key={model.id} style={{ transform: centerTransform, ['--ov-i' as string]: index }}>
        <div className="stage-rot" ref={rotRef} inert={overview}>
          <div
            className={`device-enter ${leaving ? 'device-leave' : ''} ${quiet ? 'quiet' : ''}`}
            key={`${model.id}:${turn}`}
            style={{ width: model.size.width, height: model.size.height }}
          >
            <Suspense fallback={<div className="device-loading" style={{ width: model.size.width, height: model.size.height }} />}>
              <BodySlotContext.Provider value={bodyExtras}>
                <Device model={model} appearance={appearance} />
              </BodySlotContext.Provider>
            </Suspense>
          </div>
        </div>
      </div>
      <canvas ref={frontCanvas} className="ep-canvas" aria-hidden="true" />
      {overview && (
        <div
          className={`ov-hits ${layout.carousel ? 'carousel' : ''}`}
          data-no-stage=""
          onPointerDown={(e) => {
            const bg = e.target === e.currentTarget;
            if (!layout.carousel) {
              if (bg) pickModel();
              return;
            }
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
                onPointerEnter={(e) => e.pointerType === 'mouse' && !layout.carousel && useOverview.setState({ hover: i })}
                onClick={() => {
                  // in the carousel, a tap on a neighbour brings it to the middle first
                  if (layout.carousel && i !== focus) useOverview.setState({ hover: i });
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
