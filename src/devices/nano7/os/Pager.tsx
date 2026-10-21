import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { clamp, rubber, tween, unscale, VelocityTracker } from './gesture';

/**
 * Horizontal paging with a finger: drag, fling, rubber-band at the ends.
 * Used by the Clock (clock / stopwatch / timer) and the photo viewer.
 * Only pages within `window` of the current one are rendered.
 */
export function Pager({
  index,
  count,
  onChange,
  render,
  width = 240,
  gap = 0,
  window: win = 1,
  onTap,
  className,
}: {
  index: number;
  count: number;
  onChange: (i: number) => void;
  render: (i: number) => ReactNode;
  width?: number;
  /** black gap between pages (photo viewer) */
  gap?: number;
  window?: number;
  onTap?: () => void;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pitch = width + gap;
  const st = useRef({
    x: -index * pitch,
    drag: null as null | { id: number; x0: number; y0: number; k: number; started: boolean; vt: VelocityTracker; base: number },
    cancel: null as null | (() => void),
    moved: false,
  });

  const setX = (x: number) => {
    st.current.x = x;
    if (track.current) track.current.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  };

  useLayoutEffect(() => {
    setX(st.current.x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // follow index changes (dots, slideshow, programmatic)
  useEffect(() => {
    const s = st.current;
    if (s.drag?.started) return;
    s.cancel?.();
    const target = -index * pitch;
    if (Math.abs(s.x - target) < 0.5) setX(target);
    else s.cancel = tween(s.x, target, 300, setX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, pitch]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const vt = new VelocityTracker();
    vt.reset(e.clientX);
    st.current.moved = false;
    st.current.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, k: unscale(root.current!), started: false, vt, base: st.current.x };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current;
    const d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    d.vt.add(e.clientX);
    const dx = (e.clientX - d.x0) * d.k;
    const dy = (e.clientY - d.y0) * d.k;
    if (!d.started) {
      if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
        d.started = true;
        s.moved = true;
        s.cancel?.();
        d.base = s.x;
        d.x0 = e.clientX;
        try {
          root.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else {
        if (Math.abs(dy) > 8) s.drag = null;
        return;
      }
    }
    e.stopPropagation();
    let x = d.base + (e.clientX - d.x0) * d.k;
    const min = -(count - 1) * pitch;
    if (x > 0) x = rubber(x, width);
    else if (x < min) x = min + rubber(x - min, width);
    setX(x);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = st.current;
    const d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    s.drag = null;
    if (!d.started) {
      if (e.type === 'pointerup') onTap?.();
      return;
    }
    const v = d.vt.velocity() * d.k;
    const moved = s.x - -index * pitch;
    let ni = index;
    if (moved < -width * 0.35 || v < -0.3) ni = index + 1;
    else if (moved > width * 0.35 || v > 0.3) ni = index - 1;
    ni = clamp(ni, 0, count - 1);
    s.cancel?.();
    s.cancel = tween(s.x, -ni * pitch, 280, setX);
    if (ni !== index) onChange(ni);
  };

  const pages: ReactNode[] = [];
  for (let i = Math.max(0, index - win); i <= Math.min(count - 1, index + win); i++) {
    pages.push(
      <div key={i} className="n7-pager-page" style={{ left: i * pitch, width }}>
        {render(i)}
      </div>,
    );
  }
  return (
    <div
      ref={root}
      className={`n7-pager ${className ?? ''}`}
      data-noswipe
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (st.current.moved) {
          e.stopPropagation();
          st.current.moved = false;
        }
      }}
    >
      <div ref={track} className="n7-pager-track">
        {pages}
      </div>
    </div>
  );
}

export function Dots({ count, index, onPick, dark }: { count: number; index: number; onPick?: (i: number) => void; dark?: boolean }) {
  return (
    <div className={`n7-pdots ${dark ? 'dark' : ''}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i === index ? 'on' : ''} onClick={() => onPick?.(i)} />
      ))}
    </div>
  );
}
