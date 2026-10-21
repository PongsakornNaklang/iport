import { useEffect, useRef, useState } from 'react';
import { nano, useNano, useNanoData, type AppId } from '../state';
import { clamp, rubber, tween, unscale, VelocityTracker } from './gesture';
import { AppIcon } from './icons';
import { t } from './i18n';

export const APP_NAMES: Record<AppId, string> = {
  music: 'Music',
  videos: 'Videos',
  fitness: 'Fitness',
  podcasts: 'Podcasts',
  photos: 'Photos',
  radio: 'Radio',
  settings: 'Settings',
  clock: 'Clock',
  audiobooks: 'Audiobooks',
  itunesu: 'iTunes U',
  voicememos: 'Voice Memos',
};

const W = 240;
const ICON = 64;
const COLS = [63, 177];
const ROW0 = 22;
const PITCH = 94;
const PER_PAGE = 8;

export function slotCenter(index: number): { page: number; x: number; y: number } {
  const page = Math.floor(index / PER_PAGE);
  const i = index % PER_PAGE;
  return { page, x: COLS[i % 2], y: ROW0 + Math.floor(i / 2) * PITCH + ICON / 2 };
}

function slotAt(page: number, x: number, y: number): number {
  const col = x < W / 2 ? 0 : 1;
  const row = clamp(Math.floor((y - ROW0 + 14) / PITCH), 0, 3);
  return page * PER_PAGE + row * 2 + col;
}

export function Home({ hidden }: { hidden: boolean }) {
  const page = useNano((s) => s.homePage);
  const editing = useNano((s) => s.editing);
  const order = useNanoData((s) => s.order);
  const pages = Math.max(1, Math.ceil(order.length / PER_PAGE));
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | { id: AppId; x: number; y: number; target: number }>(null);
  const st = useRef({
    pager: null as null | { id: number; x0: number; y0: number; k: number; started: boolean; vt: VelocityTracker },
    offset: 0,
    press: 0 as number,
    pressPos: { x: 0, y: 0 },
    suppress: false,
    icon: null as null | { id: AppId; pid: number; k: number; rect: DOMRect },
    edgeTimer: 0,
    cancelTween: null as null | (() => void),
  });

  const setOffset = (x: number) => {
    st.current.offset = x;
    if (track.current) track.current.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  };

  // follow page changes (dots, Home button, edge flips)
  useEffect(() => {
    const s = st.current;
    s.cancelTween?.();
    s.cancelTween = tween(s.offset, -page * W, 320, setOffset);
  }, [page]);

  const preview = (() => {
    if (!drag) return order;
    const rest = order.filter((a) => a !== drag.id);
    const target = clamp(drag.target, 0, rest.length);
    return [...rest.slice(0, target), drag.id, ...rest.slice(target)];
  })();

  // ---------------------------------------------------------------- pager
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const s = st.current;
    s.suppress = false;
    const vt = new VelocityTracker();
    vt.reset(e.clientX);
    s.pager = { id: e.pointerId, x0: e.clientX, y0: e.clientY, k: unscale(root.current!), started: false, vt };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (s.icon && s.icon.pid === e.pointerId && editing) {
      // dragging an icon around while jiggling
      const lx = (e.clientX - s.icon.rect.left) * s.icon.k;
      const ly = (e.clientY - s.icon.rect.top) * s.icon.k;
      const pg = useNano.getState().homePage;
      const target = Math.min(order.length - 1, slotAt(pg, lx, ly - 18));
      setDrag({ id: s.icon.id, x: lx, y: ly, target });
      // hold near an edge to flip pages
      const nearEdge = lx < 14 ? -1 : lx > W - 14 ? 1 : 0;
      if (nearEdge && !s.edgeTimer) {
        s.edgeTimer = window.setTimeout(() => {
          s.edgeTimer = 0;
          const np = clamp(useNano.getState().homePage + nearEdge, 0, pages - 1);
          useNano.setState({ homePage: np });
        }, 650);
      } else if (!nearEdge && s.edgeTimer) {
        window.clearTimeout(s.edgeTimer);
        s.edgeTimer = 0;
      }
      return;
    }
    const p = s.pager;
    if (!p || p.id !== e.pointerId) return;
    p.vt.add(e.clientX);
    const dx = (e.clientX - p.x0) * p.k;
    const dy = (e.clientY - p.y0) * p.k;
    if (!p.started) {
      if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
        p.started = true;
        s.suppress = true;
        window.clearTimeout(s.press);
        s.cancelTween?.();
        try {
          root.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else {
        if (Math.abs(dy) > 8) window.clearTimeout(s.press);
        return;
      }
    }
    const base = -page * W;
    let x = base + dx;
    const min = -(pages - 1) * W;
    if (x > 0) x = rubber(x, W);
    else if (x < min) x = min + rubber(x - min, W);
    setOffset(x);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = st.current;
    window.clearTimeout(s.press);
    if (s.icon && s.icon.pid === e.pointerId) {
      window.clearTimeout(s.edgeTimer);
      s.edgeTimer = 0;
      if (drag) {
        useNanoData.getState().set('order', preview);
        setDrag(null);
        s.suppress = true;
      }
      s.icon = null;
    }
    const p = s.pager;
    s.pager = null;
    if (!p || !p.started) return;
    const v = p.vt.velocity() * p.k;
    const dx = (e.clientX - p.x0) * p.k;
    let np = page;
    if (dx < -W * 0.3 || v < -0.3) np = page + 1;
    else if (dx > W * 0.3 || v > 0.3) np = page - 1;
    np = clamp(np, 0, pages - 1);
    if (np === page) {
      s.cancelTween?.();
      s.cancelTween = tween(s.offset, -page * W, 280, setOffset);
    } else useNano.setState({ homePage: np });
  };

  const onIconDown = (id: AppId) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const s = st.current;
    window.clearTimeout(s.press);
    const startEditing = () => {
      s.icon = { id, pid: e.pointerId, k: unscale(root.current!), rect: root.current!.getBoundingClientRect() };
      try {
        root.current?.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    if (editing) {
      startEditing();
      return;
    }
    s.press = window.setTimeout(() => {
      s.suppress = true;
      useNano.setState({ editing: true });
      startEditing();
    }, 650);
  };

  const open = (id: AppId, index: number) => {
    if (st.current.suppress || editing) return;
    const c = slotCenter(index);
    nano.openApp(id, { x: c.x, y: c.y + 18 });
  };

  return (
    <div
      ref={root}
      className={`n7-home ${hidden ? 'n7-home-out' : ''} ${editing ? 'n7-editing' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (st.current.suppress) {
          e.stopPropagation();
          st.current.suppress = false;
        }
      }}
      style={{ transformOrigin: `${useNano.getState().origin.x}px ${useNano.getState().origin.y}px` }}
    >
      <div className="n7-home-track" ref={track} style={{ width: pages * W }}>
        {preview.map((id, index) => {
          const c = slotCenter(index);
          const dragging = drag?.id === id;
          return (
            <div
              key={id}
              className={`n7-icon ${dragging ? 'n7-icon-lift' : ''}`}
              style={{
                left: c.page * W + c.x - 45,
                top: c.y - ICON / 2 + 18,
                animationDelay: `${(index % 3) * -0.09}s`,
                visibility: dragging ? 'hidden' : undefined,
              }}
              onPointerDown={onIconDown(id)}
              onClick={() => open(id, index)}
            >
              <div className="n7-icon-img">
                <AppIcon id={id} size={ICON} />
              </div>
              <div className="n7-icon-label">{t(APP_NAMES[id])}</div>
            </div>
          );
        })}
      </div>
      {drag && (
        <div className="n7-icon n7-icon-float" style={{ left: drag.x - 45, top: drag.y - ICON / 2 - 6 }}>
          <div className="n7-icon-img">
            <AppIcon id={drag.id} size={ICON} />
          </div>
          <div className="n7-icon-label">{t(APP_NAMES[drag.id])}</div>
        </div>
      )}
      <div className="n7-dots">
        {Array.from({ length: pages }, (_, i) => (
          <span key={i} className={i === page ? 'on' : ''} onClick={() => useNano.setState({ homePage: i })} />
        ))}
      </div>
    </div>
  );
}
