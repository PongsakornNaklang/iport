import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appName } from '../apps/registry';
import { claim, localPoint, suppressNextClick } from './gesture';
import { AppIcon } from './icons';
import { os, prefs, usePrefs, useOS, type HomeLayout } from './store';
import { Wallpaper } from './wallpapers';
import { player } from '../../../core/player/player';
import { Glyph } from './glyphs';

export const GRID_X0 = 16;
export const GRID_DX = 76;
export const GRID_Y0 = 28;
export const GRID_DY = 88;
export const DOCK_TOP = 478;
export const DOCK_ICON_Y = 493;
export const PER_PAGE = 20;

export function dockX(i: number, n: number): number {
  const total = n * 60 + (n - 1) * 16;
  return (320 - total) / 2 + i * 76;
}
export function gridPos(idx: number): { x: number; y: number } {
  return { x: GRID_X0 + (idx % 4) * GRID_DX, y: GRID_Y0 + Math.floor(idx / 4) * GRID_DY };
}

/** Where an app's icon is on the current Home Screen page (for zoom animations). */
export function iconRect(id: string): { x: number; y: number; size: number } | null {
  const { layout } = prefs();
  const di = layout.dock.indexOf(id);
  if (di >= 0) return { x: dockX(di, layout.dock.length), y: DOCK_ICON_Y, size: 60 };
  const page = useOS.getState().homePage;
  const idx = layout.pages[page]?.indexOf(id) ?? -1;
  if (idx >= 0) return { ...gridPos(idx), size: 60 };
  return null;
}

const QUICK: Record<string, { label: string; glyph: string; run: () => void }[]> = {
  music: [
    { label: 'Search', glyph: 'magnifyingglass', run: () => os.openAppWith('music', 'search') },
    { label: 'Play', glyph: 'play.fill', run: () => player.play() },
  ],
  camera: [{ label: 'Take Photo', glyph: 'camera.fill', run: () => os.openApp('camera') }],
  clock: [
    { label: 'Create Alarm', glyph: 'alarm.fill', run: () => os.openAppWith('clock', 'alarm') },
    { label: 'Start Timer', glyph: 'timer', run: () => os.openAppWith('clock', 'timer') },
    { label: 'Start Stopwatch', glyph: 'stopwatch', run: () => os.openAppWith('clock', 'stopwatch') },
  ],
  notes: [{ label: 'New Note', glyph: 'square.and.pencil', run: () => os.openAppWith('notes', 'new') }],
  voicememos: [{ label: 'New Recording', glyph: 'mic.fill', run: () => os.openAppWith('voicememos', 'record') }],
  settings: [
    { label: 'Wi-Fi', glyph: 'wifi', run: () => os.openAppWith('settings', 'wifi') },
    { label: 'Wallpaper', glyph: 'photo', run: () => os.openAppWith('settings', 'wallpaper') },
  ],
};

export function HomeScreen({ wall, dark }: { wall: string; dark: boolean }) {
  const layout = usePrefs((s) => s.layout);
  const page = useOS((s) => s.homePage);
  const jiggle = useOS((s) => s.jiggle);
  const app = useOS((s) => s.app);
  const locked = useOS((s) => s.locked);
  const overlay = useOS((s) => s.overlay);
  const contentRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!app);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [work, setWork] = useState<HomeLayout | null>(null);
  const lay = work ?? layout;
  const nPages = lay.pages.length;

  // app launch / close animation of the icons
  const prevApp = useRef(app);
  useLayoutEffect(() => {
    const el = contentRef.current;
    const was = prevApp.current;
    prevApp.current = app;
    if (!el || was === app) return;
    if (app && !was) {
      setVisible(true);
      const a = el.animate(
        [
          { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)' },
          { transform: 'scale(1.12)', opacity: 0, filter: 'blur(3px)' },
        ],
        { duration: 420, easing: 'cubic-bezier(0.25, 0.85, 0.3, 1)', fill: 'forwards' },
      );
      a.onfinish = () => {
        if (useOS.getState().app) setVisible(false);
        a.cancel();
      };
    } else if (!app) {
      setVisible(true);
      el.animate(
        [
          { transform: 'scale(1.12)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 440, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      );
    } else {
      setVisible(false);
    }
  }, [app]);

  // icons fly in after unlocking to the Home Screen
  const prevLocked = useRef(locked);
  useEffect(() => {
    const was = prevLocked.current;
    prevLocked.current = locked;
    if (was && !locked && !useOS.getState().app && contentRef.current) {
      contentRef.current.animate(
        [
          { transform: 'scale(1.18)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 520, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      );
    }
  }, [locked]);

  // ---------------------------------------------------------------- paging
  const pg = useRef<{ id: number; x0: number; y0: number; k: number; on: boolean; dx: number; t: number; v: number } | null>(null);
  const setOffset = (dx: number, animate: boolean) => {
    const el = pagesRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 380ms cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none';
    el.style.transform = `translate3d(${-page * 320 + dx}px,0,0)`;
  };
  useEffect(() => setOffset(0, true), [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPagesDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || drag) return;
    const el = e.currentTarget as HTMLElement;
    pg.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, k: el.offsetWidth / (el.getBoundingClientRect().width || 1), on: false, dx: 0, t: performance.now(), v: 0 };
  };
  const onPagesMove = (e: React.PointerEvent) => {
    const g = pg.current;
    if (!g || g.id !== e.pointerId || drag) return;
    const dx = (e.clientX - g.x0) * g.k;
    const dy = (e.clientY - g.y0) * g.k;
    if (!g.on) {
      if (Math.hypot(dx, dy) < 8) return;
      if (Math.abs(dx) < Math.abs(dy)) {
        pg.current = null;
        return;
      }
      if (!claim(e.pointerId, e.currentTarget)) {
        pg.current = null;
        return;
      }
      g.on = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    let d = dx;
    if ((page === 0 && d > 0) || (page === nPages - 1 && d < 0)) d = d * 0.35;
    const now = performance.now();
    g.v = (d - g.dx) / Math.max(1, now - g.t);
    g.t = now;
    g.dx = d;
    setOffset(d, false);
  };
  const onPagesUp = (e: React.PointerEvent) => {
    const g = pg.current;
    pg.current = null;
    if (!g || g.id !== e.pointerId || !g.on) return;
    suppressNextClick();
    let next = page;
    if (g.dx < -80 || g.v < -0.35) next = Math.min(nPages - 1, page + 1);
    else if (g.dx > 80 || g.v > 0.35) next = Math.max(0, page - 1);
    if (next !== page) useOS.setState({ homePage: next });
    else setOffset(0, true);
  };

  // long-press on empty space → jiggle
  const emptyTimer = useRef<number | undefined>(undefined);
  const onBgDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.t7-hicon')) return;
    window.clearTimeout(emptyTimer.current);
    const x = e.clientX;
    const y = e.clientY;
    emptyTimer.current = window.setTimeout(() => {
      const g = pg.current;
      if (g?.on) return;
      suppressNextClick(600);
      useOS.setState({ jiggle: true });
    }, 650);
    const cancel = (ev: PointerEvent) => {
      if (ev.type === 'pointermove' && Math.hypot(ev.clientX - x, ev.clientY - y) < 8) return;
      window.clearTimeout(emptyTimer.current);
      window.removeEventListener('pointermove', cancel, true);
      window.removeEventListener('pointerup', cancel, true);
    };
    window.addEventListener('pointermove', cancel, true);
    window.addEventListener('pointerup', cancel, true);
  };

  // ---------------------------------------------------------------- drag to rearrange
  const dragInfo = useRef<{ id: string; pointer: number; hoverT: number; edge: number } | null>(null);
  const startDrag = (id: string, e: React.PointerEvent) => {
    const scr = contentRef.current!;
    const p = localPoint(scr, e.clientX, e.clientY);
    dragInfo.current = { id, pointer: e.pointerId, hoverT: 0, edge: 0 };
    setWork(structuredClone(prefs().layout));
    setDrag({ id, x: p.x, y: p.y });
  };
  useEffect(() => {
    if (!drag) return;
    const scr = contentRef.current!;
    const move = (ev: PointerEvent) => {
      const d = dragInfo.current;
      if (!d || ev.pointerId !== d.pointer) return;
      const p = localPoint(scr, ev.clientX, ev.clientY);
      setDrag({ id: d.id, x: p.x, y: p.y });
      // page flip at the edges
      const edge = p.x < 14 ? -1 : p.x > 306 ? 1 : 0;
      if (edge !== d.edge) {
        d.edge = edge;
        d.hoverT = performance.now();
      } else if (edge && performance.now() - d.hoverT > 650) {
        d.hoverT = performance.now();
        const cur = useOS.getState().homePage;
        setWork((w) => {
          const L = w ?? prefs().layout;
          let pages = L.pages;
          let target = cur + edge;
          if (target >= pages.length && pages[pages.length - 1].length > 1) pages = [...pages, []];
          target = Math.max(0, Math.min(pages.length - 1, target));
          useOS.setState({ homePage: target });
          return { ...L, pages };
        });
        return;
      }
      setWork((w) => (w ? reorder(w, d.id, p.x, p.y, useOS.getState().homePage) : w));
    };
    const up = (ev: PointerEvent) => {
      const d = dragInfo.current;
      if (!d || ev.pointerId !== d.pointer) return;
      dragInfo.current = null;
      setDrag(null);
      setWork((w) => {
        if (w) {
          const pages = w.pages.filter((p2, i) => p2.length || i === 0);
          usePrefs.getState().set('layout', { pages, dock: w.dock });
          if (useOS.getState().homePage >= pages.length) useOS.setState({ homePage: pages.length - 1 });
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, [drag?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hidden = !visible && !!app;
  return (
    <div className={`t7-home ${hidden ? 'is-hidden' : ''} ${jiggle ? 'jiggle' : ''}`} onPointerDown={onBgDown}>
      <Wallpaper id={wall} dark={dark} dim={dark ? 0.12 : 0} />
      <div ref={contentRef} className="t7-home-content">
        <div
          className="t7-pages"
          ref={pagesRef}
          onPointerDown={onPagesDown}
          onPointerMove={onPagesMove}
          onPointerUp={onPagesUp}
          onPointerCancel={onPagesUp}
        >
          {lay.pages.map((p, pi) => (
            <div key={pi} className="t7-page-grid" style={{ left: pi * 320 }}>
              {p.map((id, i) => {
                const pos = gridPos(i);
                return <HomeIcon key={id} id={id} x={pos.x} y={pos.y} jiggle={jiggle} dragging={drag?.id === id} onDragStart={startDrag} seed={i + pi * 7} />;
              })}
            </div>
          ))}
        </div>
        <div className="t7-dots">
          {lay.pages.map((_, i) => (
            <span key={i} className={i === page ? 'on' : ''} onClick={() => useOS.setState({ homePage: i })} />
          ))}
        </div>
        <div className="t7-dock">
          {lay.dock.map((id, i) => (
            <HomeIcon key={id} id={id} x={dockX(i, lay.dock.length)} y={DOCK_ICON_Y - DOCK_TOP} jiggle={jiggle} dragging={drag?.id === id} onDragStart={startDrag} seed={i + 3} noLabel />
          ))}
        </div>
        {jiggle && (
          <>
            <button className="t7-jiggle-done" onClick={() => useOS.setState({ jiggle: false })}>
              Done
            </button>
            <button className="t7-jiggle-plus" onClick={() => os.toast('Widgets', 'plus')}>
              <Glyph name="plus" size={16} />
            </button>
          </>
        )}
      </div>
      {drag && (
        <div className="t7-drag-icon" style={{ left: drag.x - 34, top: drag.y - 34 }}>
          <AppIcon id={drag.id} size={68} />
        </div>
      )}
      {overlay === 'switcher' && <div className="t7-home-block" />}
    </div>
  );
}

/** Move `id` to the slot under (x, y). */
function reorder(L: HomeLayout, id: string, x: number, y: number, page: number): HomeLayout {
  const pages = L.pages.map((p) => p.filter((a) => a !== id));
  let dock = L.dock.filter((a) => a !== id);
  const fromDock = L.dock.includes(id);
  if (y > DOCK_TOP - 6) {
    if (dock.length >= 4 && !fromDock) return L; // dock full
    // insertion index by x
    const n = dock.length + 1;
    let idx = 0;
    for (let i = 0; i < n; i++) if (x > dockX(i, n) + 30) idx = i + 1;
    idx = Math.min(dock.length, Math.max(0, idx - (idx > 0 && x < dockX(idx - 1, n) + 60 ? 0 : 0)));
    dock = [...dock.slice(0, idx), id, ...dock.slice(idx)];
    const res = { pages, dock };
    return same(res, L) ? L : res;
  }
  const col = Math.max(0, Math.min(3, Math.floor((x - GRID_X0 + 8) / GRID_DX)));
  const row = Math.max(0, Math.min(4, Math.floor((y - GRID_Y0 + 10) / GRID_DY)));
  const target = pages[page] ?? (pages[page] = []);
  const idx = Math.min(target.length, row * 4 + col);
  target.splice(idx, 0, id);
  // overflow cascades to the next page
  for (let i = page; i < pages.length; i++) {
    while (pages[i].length > PER_PAGE) {
      const extra = pages[i].pop()!;
      if (!pages[i + 1]) pages.push([]);
      pages[i + 1].unshift(extra);
    }
  }
  const res = { pages, dock };
  return same(res, L) ? L : res;
}
function same(a: HomeLayout, b: HomeLayout) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const HomeIcon = memo(function HomeIcon({
  id,
  x,
  y,
  jiggle,
  dragging,
  onDragStart,
  seed,
  noLabel,
}: {
  id: string;
  x: number;
  y: number;
  jiggle: boolean;
  dragging: boolean;
  onDragStart: (id: string, e: React.PointerEvent) => void;
  seed: number;
  noLabel?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const st = useRef<{ x: number; y: number; t: number; id: number; e: React.PointerEvent | null } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`t7-hicon ${pressed ? 'pressed' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ left: x, top: y, ['--jd' as string]: `${(seed % 5) * -0.07}s`, ['--jr' as string]: seed % 2 ? '1' : '-1' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        setPressed(true);
        const evt = e;
        const t = window.setTimeout(() => {
          const s = st.current;
          if (!s) return;
          setPressed(false);
          if (useOS.getState().jiggle) return;
          suppressNextClick(700);
          // quick actions + edit
          const items = [
            ...(QUICK[id] ?? []).map((q) => ({ label: q.label, glyph: q.glyph, onPress: q.run })),
            { label: 'Edit Home Screen', glyph: 'square.grid.2x2.fill', onPress: () => useOS.setState({ jiggle: true }) },
          ];
          const scr = ref.current?.closest('.t7-screen') as HTMLElement | null;
          const r = ref.current!.getBoundingClientRect();
          const p = scr ? localPoint(scr, r.left, r.bottom) : { x: 0, y: 300 };
          os.showMenu(items, p.y + 8, appName(id));
          s.e = null;
        }, 520);
        st.current = { x: e.clientX, y: e.clientY, t, id: e.pointerId, e: evt };
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s) return;
        const d = Math.hypot(e.clientX - s.x, e.clientY - s.y);
        if (d > 8) {
          window.clearTimeout(s.t);
          setPressed(false);
          st.current = null;
          if (useOS.getState().jiggle && claim(e.pointerId, e.currentTarget)) {
            suppressNextClick(400);
            onDragStart(id, e);
          }
        }
      }}
      onPointerUp={() => {
        if (st.current) window.clearTimeout(st.current.t);
        st.current = null;
        setPressed(false);
      }}
      onPointerCancel={() => {
        if (st.current) window.clearTimeout(st.current.t);
        st.current = null;
        setPressed(false);
      }}
      onClick={() => {
        if (useOS.getState().jiggle) return;
        os.openApp(id, true);
      }}
    >
      <div className="t7-hicon-art">
        <AppIcon id={id} />
        {jiggle && <span className="t7-hicon-minus">−</span>}
      </div>
      {!noLabel && <div className="t7-hicon-label">{appName(id)}</div>}
    </div>
  );
});
