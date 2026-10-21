import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from 'react';
import { clamp, rubber, unscale, VelocityTracker } from './gesture';

export interface ScrollApi {
  scrollTo(y: number, animate?: boolean): void;
  get(): number;
  max(): number;
}

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  /** snap the resting position to multiples of this (picker wheels) */
  snap?: number;
  onScroll?: (y: number) => void;
  /** called when a snapped scroll comes to rest */
  onSettle?: (y: number) => void;
  indicator?: boolean;
  /** extra scrollable space below the content */
  padBottom?: number;
  /** allow scrolling above 0 / below max by this much (picker wheels) */
  slack?: number;
}

const DECEL = 0.998; // per ms, like UIScrollView's normal rate

/**
 * Finger scrolling for the nano: drag with the pointer, fling with momentum,
 * rubber-band at the ends, mouse wheel. Taps that end a drag don't click.
 */
export const ScrollView = forwardRef<ScrollApi, Props>(function ScrollView(
  { children, className, style, contentStyle, snap, onScroll, onSettle, indicator = true, padBottom = 0, slack = 0 },
  ref,
) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const cb = useRef({ onScroll, onSettle, snap });
  cb.current = { onScroll, onSettle, snap };
  const s = useRef({
    y: 0,
    h: 0,
    ch: 0,
    raf: 0,
    vy: 0,
    moving: false,
    drag: null as null | { id: number; x0: number; y0: number; start: number; k: number; lock: 'x' | 'y' | null },
    suppress: false,
    vt: new VelocityTracker(),
    barTimer: 0,
  });

  const maxY = () => Math.max(0, s.current.ch + padBottom - s.current.h) + slack;
  const minY = () => -slack;

  const apply = () => {
    const st = s.current;
    if (inner.current) inner.current.style.transform = `translate3d(0, ${(-st.y).toFixed(2)}px, 0)`;
    cb.current.onScroll?.(st.y);
    const b = bar.current;
    if (b && indicator) {
      const max = maxY();
      if (max <= 1) {
        b.style.opacity = '0';
        return;
      }
      const vis = st.h / (st.ch + padBottom);
      let len = Math.max(18, st.h * vis - 6);
      let top = 3 + (st.y / max) * (st.h - 6 - len);
      if (st.y < 0) {
        len = Math.max(8, len + st.y);
        top = 3;
      } else if (st.y > max) {
        len = Math.max(8, len - (st.y - max));
        top = st.h - 3 - len;
      }
      b.style.height = `${len}px`;
      b.style.transform = `translateY(${top}px)`;
      b.style.opacity = '1';
      window.clearTimeout(st.barTimer);
      st.barTimer = window.setTimeout(() => {
        if (bar.current && !s.current.drag?.lock && !s.current.raf) bar.current.style.opacity = '0';
      }, 600);
    }
  };

  const stop = () => {
    const st = s.current;
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
    st.moving = false;
  };

  const animateTo = (target: number, ms = 380, then?: () => void) => {
    stop();
    const st = s.current;
    const from = st.y;
    const t0 = performance.now();
    st.moving = true;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      st.y = from + (target - from) * e;
      apply();
      if (k < 1) st.raf = requestAnimationFrame(step);
      else {
        st.raf = 0;
        st.moving = false;
        apply();
        then?.();
      }
    };
    st.raf = requestAnimationFrame(step);
  };

  const settle = () => {
    const st = s.current;
    const sn = cb.current.snap;
    if (sn) {
      const t = clamp(Math.round(st.y / sn) * sn, minY(), maxY());
      if (Math.abs(t - st.y) > 0.5) animateTo(t, 260, () => cb.current.onSettle?.(t));
      else {
        st.y = t;
        apply();
        cb.current.onSettle?.(t);
      }
      return;
    }
    const t = clamp(st.y, minY(), maxY());
    if (t !== st.y) animateTo(t, 420);
  };

  const fling = (v: number) => {
    const st = s.current;
    const sn = cb.current.snap;
    if (sn) {
      // predict where momentum would stop, then glide to the nearest detent
      const dist = v / (1 - DECEL);
      const target = clamp(Math.round((st.y + dist) / sn) * sn, minY(), maxY());
      const ms = clamp(Math.abs(target - st.y) * 2.2, 220, 900);
      animateTo(target, ms, () => cb.current.onSettle?.(target));
      return;
    }
    stop();
    st.vy = v;
    st.moving = true;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      const max = maxY();
      const out = st.y < minY() ? st.y - minY() : st.y > max ? st.y - max : 0;
      if (out !== 0) {
        // past an edge: decelerate hard then spring back
        st.vy *= Math.pow(0.86, dt / 16);
        st.y += st.vy * dt;
        if (Math.abs(st.vy) < 0.08 || Math.sign(st.vy) !== Math.sign(out)) {
          st.raf = 0;
          apply();
          animateTo(clamp(st.y, minY(), max), 420);
          return;
        }
      } else {
        st.y += st.vy * dt;
        st.vy *= Math.pow(DECEL, dt);
      }
      apply();
      if (Math.abs(st.vy) < 0.02 && out === 0) {
        st.raf = 0;
        st.moving = false;
        apply();
        return;
      }
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  };

  useImperativeHandle(ref, () => ({
    scrollTo(y: number, animate = false) {
      const t = clamp(y, minY(), maxY());
      if (animate) animateTo(t);
      else {
        stop();
        s.current.y = t;
        apply();
      }
    },
    get: () => s.current.y,
    max: () => maxY(),
  }));

  // measure
  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const st = s.current;
      st.h = o.offsetHeight;
      st.ch = i.offsetHeight;
      if (!st.drag?.lock && !st.moving) {
        const t = clamp(st.y, minY(), maxY());
        if (t !== st.y) {
          st.y = t;
          if (inner.current) inner.current.style.transform = `translate3d(0, ${-t}px, 0)`;
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => {
      ro.disconnect();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const st = s.current;
    const wasMoving = st.moving && (Math.abs(st.vy) > 0.06 || !!st.raf);
    if (st.moving) stop();
    st.suppress = wasMoving;
    st.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, start: st.y, k: unscale(outer.current!), lock: null };
    st.vt.reset(e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = s.current;
    const d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    st.vt.add(e.clientY);
    const dx = (e.clientX - d.x0) * d.k;
    const dy = (e.clientY - d.y0) * d.k;
    if (!d.lock) {
      if (Math.abs(dy) > 5 && Math.abs(dy) >= Math.abs(dx)) {
        d.lock = 'y';
        d.y0 = e.clientY;
        d.start = st.y;
        st.suppress = true;
        outer.current?.classList.add('n7-dragging');
        try {
          outer.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else if (Math.abs(dx) > 5) {
        d.lock = 'x';
        st.drag = null;
        return;
      } else return;
    }
    if (d.lock !== 'y') return;
    e.stopPropagation();
    const raw = d.start - (e.clientY - d.y0) * d.k;
    const max = maxY();
    const min = minY();
    if (raw < min) st.y = min + rubber(raw - min, st.h);
    else if (raw > max) st.y = max + rubber(raw - max, st.h);
    else st.y = raw;
    apply();
  };

  const end = (e: React.PointerEvent) => {
    const st = s.current;
    const d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    st.drag = null;
    outer.current?.classList.remove('n7-dragging');
    if (d.lock !== 'y') {
      if (!st.moving) settle();
      return;
    }
    const v = -st.vt.velocity() * d.k;
    if (Math.abs(v) > 0.12) fling(v);
    else settle();
  };

  const onWheel = (e: React.WheelEvent) => {
    const st = s.current;
    if (maxY() - minY() <= 0) return;
    stop();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    st.y = clamp(st.y + dy * 0.6, minY(), maxY());
    apply();
    if (cb.current.snap) {
      window.clearTimeout((st as unknown as { wt: number }).wt);
      (st as unknown as { wt: number }).wt = window.setTimeout(settle, 140);
    }
  };

  return (
    <div
      ref={outer}
      className={`n7-scroll ${className ?? ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onWheel={onWheel}
      onClickCapture={(e) => {
        if (s.current.suppress) {
          e.stopPropagation();
          e.preventDefault();
          s.current.suppress = false;
        }
      }}
    >
      <div ref={inner} className="n7-scroll-content" style={contentStyle}>
        {children}
      </div>
      {indicator && <div ref={bar} className="n7-scroll-bar" />}
    </div>
  );
});
