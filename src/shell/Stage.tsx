import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { useAppearance, useCustomize } from '../core/customize/store';
import { getModel } from '../devices/registry';
import type { DeviceModel, DeviceProps } from '../devices/types';
import { liveOrientation, useStage } from './stageStore';
import { JackMarkers, useEarPods } from './earpods/EarPods';
import { BodySlotContext } from './bodySlot';
import { Cover, type CoverInfo } from './cover/Cover';
import { coverGeometry } from './cover/geometry';

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

  // A case or sock the iPod is wearing, and the size it all takes up.
  const coverKind = appearance.cover?.kind ?? 'none';
  const coverColor = appearance.cover?.color ?? '#000';
  const cover = useMemo<CoverInfo | null>(() => {
    const fit = model.cover;
    if (!fit || coverKind === 'none' || (coverKind !== 'sock' && !fit.cases)) return null;
    return { fit, choice: { kind: coverKind, color: coverColor }, pxPerMm: model.jack?.pxPerMm ?? 6.4, size: model.size, jackNy: model.jack?.ny };
  }, [model, coverKind, coverColor]);
  const outer = useMemo(() => {
    if (!cover || cover.choice.kind === 'none') return model.size;
    const g = coverGeometry(cover.fit, cover.choice.kind, cover.pxPerMm, cover.size, cover.jackNy);
    return {
      width: Math.max(model.size.width, g.w),
      height: Math.max(model.size.height, g.h + 2 * Math.abs(g.cy)),
      depth: Math.max(model.size.depth, g.d),
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

  const apply = (rx: number, ry: number) => {
    const el = rotRef.current;
    if (!el) return;
    el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    liveOrientation.rx = rx;
    liveOrientation.ry = ry;
    const ryRad = (ry * Math.PI) / 180;
    const rxRad = (rx * Math.PI) / 180;
    el.style.setProperty('--rx', rx.toFixed(1));
    el.style.setProperty('--ry', (((ry % 360) + 540) % 360 - 180).toFixed(1));
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
    if ((e.target as HTMLElement).closest('[data-control]')) return;
    useStage.getState().front();
  };
  const onWheel = (e: React.WheelEvent) => {
    if ((e.target as HTMLElement).closest('[data-control]')) return;
    const z = useStage.getState().zoom;
    useStage.getState().setZoom(z * (e.deltaY > 0 ? 0.94 : 1.06));
  };

  useEarPods({ wrap: wrapRef, back: backCanvas, front: frontCanvas, markers: jackRef, model, enabled: scene.earpods !== false });

  const Device = useMemo(() => deviceComponent(model), [model]);
  // inside the device's own 3D root, so they turn with it (see bodySlot)
  const bodyExtras = useMemo(
    () => (
      <>
        {cover && <Cover info={cover} />}
        <JackMarkers model={model} markerRef={jackRef} />
      </>
    ),
    [cover, model],
  );
  const scale = fit * zoom;
  const shiftX = (inset.left - inset.right - bars.right) / 2;
  const centerY = (TOP_BAR - (inset.bottom || bars.bottom)) / 2;

  return (
    <div
      ref={wrapRef}
      className={`stage backdrop-${scene.backdrop}`}
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
      <div className="stage-center" style={{ transform: `translate(${shiftX}px, ${centerY}px) scale(${scale})` }}>
        <div className="stage-rot" ref={rotRef}>
          <div className="device-enter" key={model.id} style={{ width: model.size.width, height: model.size.height }}>
            <Suspense fallback={<div className="device-loading" style={{ width: model.size.width, height: model.size.height }} />}>
              <BodySlotContext.Provider value={bodyExtras}>
                <Device model={model} appearance={appearance} />
              </BodySlotContext.Provider>
            </Suspense>
          </div>
        </div>
      </div>
      <canvas ref={frontCanvas} className="ep-canvas" aria-hidden="true" />
    </div>
  );
}
