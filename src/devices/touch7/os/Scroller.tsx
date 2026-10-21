import { useEffect, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { claim, isClaimed, rubber, suppressNextClick } from './gesture';

/**
 * A scroll view that behaves like UIScrollView under a mouse or a finger:
 * drag to scroll, momentum with iOS deceleration, rubber-band overscroll and
 * bounce. Mouse wheel scrolling stays native. Optional snapping for carousels.
 */
export function Scroller({
  axis = 'y',
  className,
  style,
  innerClassName,
  innerStyle,
  children,
  onScroll,
  snap,
  bounce = true,
  ref,
}: {
  axis?: 'x' | 'y';
  className?: string;
  style?: CSSProperties;
  innerClassName?: string;
  innerStyle?: CSSProperties;
  children?: ReactNode;
  onScroll?: (pos: number, el: HTMLDivElement) => void;
  /** item pitch in px for snapping carousels */
  snap?: number;
  bounce?: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const inRef = useRef<HTMLDivElement>(null);
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    const el = elRef.current;
    const inner = inRef.current;
    if (!el || !inner) return;
    const horiz = axis === 'x';
    const max = () => Math.max(0, horiz ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight);
    const dim = () => (horiz ? el.clientWidth : el.clientHeight) || 1;
    const pos = () => (horiz ? el.scrollLeft : el.scrollTop);
    let over = 0; // visible overshoot in px (positive = past the end)
    const show = (p: number, visOver: number) => {
      if (horiz) el.scrollLeft = p;
      else el.scrollTop = p;
      over = visOver;
      inner.style.transform = visOver ? (horiz ? `translate3d(${-visOver}px,0,0)` : `translate3d(0,${-visOver}px,0)`) : '';
    };
    /** raw position (may be outside bounds) → rubber-banded display */
    const setRaw = (raw: number) => {
      const m = max();
      const c = Math.max(0, Math.min(m, raw));
      show(c, bounce ? rubber(raw - c, dim()) : 0);
    };

    let raf = 0;
    let vNow = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      vNow = 0;
    };

    /** physics after release. p: logical position incl. visible overshoot */
    const run = (p0: number, v0: number) => {
      stop();
      let p = p0;
      let v = v0; // px per ms
      let last = performance.now();
      const sn = snapRef.current;
      let snapTarget: number | null = null;
      if (sn) {
        const m = max();
        // project where inertia would land, then snap
        const proj = p + v * 260;
        snapTarget = Math.max(0, Math.min(m, Math.round(proj / sn) * sn));
        if (m - snapTarget < sn * 0.5 && proj > m - sn * 0.5) snapTarget = m;
      }
      const step = (now: number) => {
        let dt = Math.min(34, now - last);
        last = now;
        const m = max();
        while (dt > 0) {
          const h = Math.min(4, dt);
          dt -= h;
          if (snapTarget != null) {
            // spring towards the snap point
            const w = 0.016;
            const x = p - snapTarget;
            v += (-w * w * x - 2 * w * v) * h;
            p += v * h;
          } else if (p < 0 || p > m) {
            const b = p < 0 ? 0 : m;
            const x = p - b;
            const w = 0.017;
            v += (-w * w * x - 2 * w * v) * h;
            p += v * h;
            if (Math.abs(p - b) < 0.4 && Math.abs(v) < 0.02) {
              p = b;
              v = 0;
            }
          } else {
            v *= Math.pow(0.998, h);
            p += v * h;
            if (!bounce) p = Math.max(0, Math.min(m, p));
          }
        }
        vNow = v;
        const c = Math.max(0, Math.min(m, p));
        show(c, p - c);
        const done =
          snapTarget != null
            ? Math.abs(p - snapTarget) < 0.5 && Math.abs(v) < 0.02
            : Math.abs(v) < 0.015 && p >= 0 && p <= m;
        if (done) {
          if (snapTarget != null) show(snapTarget, 0);
          else show(Math.max(0, Math.min(m, p)), 0);
          raf = 0;
          vNow = 0;
          return;
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    let st: null | {
      id: number;
      x0: number;
      y0: number;
      s0: number;
      decided: '' | 'mine' | 'no';
      k: number;
      samples: { t: number; p: number }[];
      raw: number;
      wasMoving: boolean;
    } = null;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const moving = raf !== 0 && Math.abs(vNow) > 0.08;
      const start = pos() + over;
      stop();
      if (over) {
        // grabbed while bouncing: keep the visual position
      }
      const r = el.getBoundingClientRect();
      const k = horiz ? (el.offsetWidth || 1) / (r.width || 1) : (el.offsetHeight || 1) / (r.height || 1);
      st = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s0: start, decided: '', k, samples: [], raw: start, wasMoving: moving };
      if (moving) {
        // a tap on a moving list just stops it
        st.decided = '';
        suppressNextClick(500);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x0;
      const dy = e.clientY - st.y0;
      if (!st.decided) {
        if (Math.hypot(dx, dy) < 6) return;
        const along = horiz ? Math.abs(dx) > Math.abs(dy) : Math.abs(dy) >= Math.abs(dx);
        const can = max() > 0 || (!horiz && bounce);
        if (along && can && !isClaimed(e.pointerId, el) && claim(e.pointerId, el)) {
          st.decided = 'mine';
          // restart from here so there is no jump
          st.x0 = e.clientX;
          st.y0 = e.clientY;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        } else {
          st.decided = 'no';
          return;
        }
      }
      if (st.decided !== 'mine') return;
      if (isClaimed(e.pointerId, el)) {
        // someone else (edge gesture) took over
        st = null;
        run(pos() + over, 0);
        return;
      }
      e.preventDefault();
      const d = (horiz ? e.clientX - st.x0 : e.clientY - st.y0) * st.k;
      const raw = st.s0 - d;
      st.raw = raw;
      setRaw(raw);
      const now = performance.now();
      st.samples.push({ t: now, p: raw });
      while (st.samples.length > 2 && now - st.samples[0].t > 90) st.samples.shift();
      onScrollRef.current?.(pos(), el);
    };
    const onUp = (e: PointerEvent) => {
      if (!st || e.pointerId !== st.id) return;
      const s = st;
      st = null;
      if (s.decided !== 'mine') {
        if (over) run(pos() + over, 0);
        return;
      }
      suppressNextClick(300);
      let v = 0;
      const now = performance.now();
      const smp = s.samples.filter((x) => now - x.t < 110);
      if (smp.length >= 2) {
        const a = smp[0];
        const b = smp[smp.length - 1];
        if (b.t > a.t) v = (b.p - a.p) / (b.t - a.t);
      }
      if (Math.abs(v) > 5) v = Math.sign(v) * 5;
      const m = max();
      const c = Math.max(0, Math.min(m, s.raw));
      const visible = c + (bounce ? rubber(s.raw - c, dim()) : 0);
      run(visible, v);
    };
    const onWheel = () => {
      if (raf) stop();
      if (over) show(pos(), 0);
    };
    const onNativeScroll = () => onScrollRef.current?.(pos(), el);

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('scroll', onNativeScroll, { passive: true });
    return () => {
      stop();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', onNativeScroll);
    };
  }, [axis, bounce]);

  return (
    <div
      ref={(n) => {
        elRef.current = n;
        if (typeof ref === 'function') ref(n);
        else if (ref) (ref as { current: HTMLDivElement | null }).current = n;
      }}
      className={`t7-scroll ${axis === 'x' ? 't7-scroll-x' : 't7-scroll-y'} ${className ?? ''}`}
      style={style}
    >
      <div ref={inRef} className={`t7-scroll-in ${innerClassName ?? ''}`} style={innerStyle}>
        {children}
      </div>
    </div>
  );
}

/** Smoothly scroll a Scroller's element to a position. */
export function scrollToTop(el: HTMLElement | null) {
  if (!el) return;
  el.scrollTo({ top: 0, behavior: 'smooth' });
}
