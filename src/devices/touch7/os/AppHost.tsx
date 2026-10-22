import { memo, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { APPS, appName } from '../apps/registry';
import { claim, localPoint, suppressNextClick } from './gesture';
import { iconRect } from './HomeScreen';
import { AppIcon } from './icons';
import { os, useOS } from './store';
import { AppCtx } from './ui';
import { Wallpaper } from './wallpapers';

const K = 0.62;
const CW = 320 * K;
const CH = 568 * K;
const CY = 298;
const EASE = 'cubic-bezier(0.2, 0.9, 0.25, 1)';

function cardX(d: number): number {
  return 160 + (d <= 0 ? d * 104 : d * 206);
}

export function AppHost({ wall, dark }: { wall: string; dark: boolean }) {
  const app = useOS((s) => s.app);
  const recents = useOS((s) => s.recents);
  const overlay = useOS((s) => s.overlay);
  const locked = useOS((s) => s.locked);
  const screenOn = useOS((s) => s.screenOn);
  const pos = useOS((s) => s.switcherPos);
  const switcher = overlay === 'switcher';
  const order = useMemo(() => [...recents].reverse(), [recents]);
  const [cardDrag, setCardDrag] = useState<{ id: string; dy: number; fly?: boolean } | null>(null);
  const [scrolling, setScrolling] = useState(false);

  return (
    <div className={`t7-apphost ${switcher ? 'switcher' : ''}`}>
      <div className={`t7-switcher-bg ${switcher ? 'on' : ''}`}>{switcher && <Wallpaper id={wall} dark={dark} />}</div>
      {order.map((id, i) => (
        <AppFrame
          key={id}
          id={id}
          z={i + 1}
          d={i - pos}
          switcher={switcher}
          fg={app === id}
          active={app === id && !switcher && !locked && screenOn}
          dy={cardDrag?.id === id ? cardDrag.dy : 0}
          instant={scrolling || (cardDrag?.id === id && !cardDrag.fly)}
        />
      ))}
      {switcher && <SwitcherInput order={order} pos={pos} setCardDrag={setCardDrag} setScrolling={setScrolling} cardDrag={cardDrag} />}
    </div>
  );
}

const AppFrame = memo(function AppFrame({
  id,
  z,
  d,
  switcher,
  fg,
  active,
  dy,
  instant,
}: {
  id: string;
  z: number;
  d: number;
  switcher: boolean;
  fg: boolean;
  active: boolean;
  dy: number;
  instant: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);
  const [zoomIcon, setZoomIcon] = useState<'in' | 'out' | null>(null);
  const launchSerial = useOS((s) => s.launchSerial);
  const prevFg = useRef(fg);
  const prevSwitcher = useRef(switcher);

  // launch: zoom out of the icon
  useLayoutEffect(() => {
    if (!fg || switcher) return;
    const node = el.current;
    if (!node) return;
    const st = useOS.getState();
    if (!st.launchFromIcon) {
      if (!prevSwitcher.current) {
        node.animate([{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300, easing: EASE });
      }
      return;
    }
    const r = iconRect(id);
    if (!r) {
      node.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: EASE });
      return;
    }
    const s = r.size / 320;
    const tx = r.x + r.size / 2 - 160;
    const ty = r.y + r.size / 2 - 284;
    setZoomIcon('in');
    const a = node.animate(
      [
        { transform: `translate(${tx}px, ${ty}px) scale(${s})`, clipPath: `inset(124px 0px round ${13.4 / s}px)` },
        { transform: 'translate(0px, 0px) scale(1)', clipPath: 'inset(0px 0px round 0px)' },
      ],
      { duration: 500, easing: EASE },
    );
    a.onfinish = () => setZoomIcon(null);
    a.oncancel = () => setZoomIcon(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchSerial]);

  // close: shrink back into the icon
  useLayoutEffect(() => {
    const was = prevFg.current;
    const wasSw = prevSwitcher.current;
    prevFg.current = fg;
    prevSwitcher.current = switcher;
    if (!(was && !fg && !switcher && !wasSw)) return;
    const st = useOS.getState();
    if (st.locked || !st.screenOn) return;
    const node = el.current;
    if (!node) return;
    setClosing(true);
    const r = iconRect(id);
    let a: Animation;
    if (r) {
      const s = r.size / 320;
      const tx = r.x + r.size / 2 - 160;
      const ty = r.y + r.size / 2 - 284;
      setZoomIcon('out');
      a = node.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', clipPath: 'inset(0px 0px round 40px)' },
          { transform: `translate(${tx}px, ${ty}px) scale(${s})`, clipPath: `inset(124px 0px round ${13.4 / s}px)` },
        ],
        { duration: 440, easing: EASE },
      );
    } else {
      a = node.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.5)' }], { duration: 360, easing: EASE });
    }
    a.onfinish = () => {
      setClosing(false);
      setZoomIcon(null);
    };
  }, [fg, switcher, id]);

  const visible = fg || switcher || closing;
  let transform = 'none';
  let radius = 0;
  if (switcher) {
    const x = cardX(d) - 160;
    const y = CY - 284 + dy;
    transform = `translate3d(${x}px, ${y}px, 0) scale(${K})`;
    radius = 12 / K;
  }
  const def = APPS[id];
  const bg = def?.bg ?? 'system';
  return (
    <div
      ref={(n) => {
        el.current = n;
        if (n && n !== host) setHost(n);
      }}
      className={`t7-frame ${visible ? '' : 'is-hidden'} ${switcher ? 'as-card' : ''} ${instant ? 'instant' : ''} ${closing ? 'closing' : ''}`}
      // clip-path as well: a blurred bar (backdrop-filter) escapes a rounded overflow clip
      style={{ zIndex: fg && !switcher ? 50 : z, transform, borderRadius: radius, clipPath: `inset(0 round ${radius}px)` }}
    >
      <AppContent id={id} active={active} host={host} bg={bg} />
      {zoomIcon && (
        <div className={`t7-frame-icon ${zoomIcon}`}>
          <AppIcon id={id} size={320} />
        </div>
      )}
    </div>
  );
});

const AppContent = memo(function AppContent({ id, active, host, bg }: { id: string; active: boolean; host: HTMLElement | null; bg: string }) {
  const def = APPS[id];
  const ctx = useMemo(() => ({ id, active, host }), [id, active, host]);
  if (!def) return null;
  const Comp = def.Comp;
  const cls = bg === 'system' || bg === 'grouped' || bg === 'black' ? `bg-${bg}` : '';
  return (
    <AppCtx.Provider value={ctx}>
      <div className={`t7-app ${cls}`} style={cls ? undefined : { background: bg }}>
        <Suspense fallback={<div className="t7-launch" />}>
          <Comp />
        </Suspense>
      </div>
    </AppCtx.Provider>
  );
});

// ------------------------------------------------------------------ switcher input

function SwitcherInput({
  order,
  pos,
  setCardDrag,
  setScrolling,
  cardDrag,
}: {
  order: string[];
  pos: number;
  setCardDrag: (v: { id: string; dy: number; fly?: boolean } | null) => void;
  setScrolling: (v: boolean) => void;
  cardDrag: { id: string; dy: number; fly?: boolean } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const g = useRef<{
    id: number;
    x0: number;
    y0: number;
    k: number;
    mode: '' | 'h' | 'v';
    card: string | null;
    pos0: number;
    samples: { t: number; v: number }[];
  } | null>(null);
  const anim = useRef(0);
  const n = order.length;

  const hit = (x: number, y: number): string | null => {
    for (let i = n - 1; i >= 0; i--) {
      const cx = cardX(i - pos);
      if (Math.abs(x - cx) <= CW / 2 && Math.abs(y - CY) <= CH / 2) return order[i];
    }
    return null;
  };

  const settle = (from: number, v: number) => {
    cancelAnimationFrame(anim.current);
    const target = Math.max(0, Math.min(n - 1, Math.round(from - v * 220)));
    const t0 = performance.now();
    setScrolling(true);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 380);
      const e = 1 - Math.pow(1 - k, 3);
      useOS.setState({ switcherPos: from + (target - from) * e });
      if (k < 1) anim.current = requestAnimationFrame(step);
      else setScrolling(false);
    };
    anim.current = requestAnimationFrame(step);
  };

  return (
    <div
      ref={ref}
      className="t7-switcher-input"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        cancelAnimationFrame(anim.current);
        const el = ref.current!;
        const p = localPoint(el, e.clientX, e.clientY);
        g.current = {
          id: e.pointerId,
          x0: e.clientX,
          y0: e.clientY,
          k: el.offsetWidth / (el.getBoundingClientRect().width || 1),
          mode: '',
          card: hit(p.x, p.y),
          pos0: useOS.getState().switcherPos,
          samples: [],
        };
      }}
      onPointerMove={(e) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId) return;
        const dx = (e.clientX - s.x0) * s.k;
        const dy = (e.clientY - s.y0) * s.k;
        if (!s.mode) {
          if (Math.hypot(dx, dy) < 8) return;
          if (!claim(e.pointerId, ref.current!)) return;
          ref.current!.setPointerCapture(e.pointerId);
          s.mode = Math.abs(dx) > Math.abs(dy) || !s.card ? 'h' : 'v';
          if (s.mode === 'h') setScrolling(true);
        }
        const now = performance.now();
        if (s.mode === 'h') {
          const np = Math.max(-0.4, Math.min(n - 0.6, s.pos0 - dx / 170));
          useOS.setState({ switcherPos: np });
          s.samples.push({ t: now, v: np });
        } else if (s.card) {
          const ddy = dy < 0 ? dy : dy * 0.25;
          setCardDrag({ id: s.card, dy: ddy });
          s.samples.push({ t: now, v: ddy });
        }
        while (s.samples.length > 2 && now - s.samples[0].t > 100) s.samples.shift();
      }}
      onPointerUp={(e) => {
        const s = g.current;
        g.current = null;
        if (!s || s.id !== e.pointerId) return;
        let v = 0;
        if (s.samples.length >= 2) {
          const a = s.samples[0];
          const b = s.samples[s.samples.length - 1];
          v = (b.v - a.v) / Math.max(1, b.t - a.t);
        }
        if (!s.mode) {
          // tap
          if (s.card) os.openApp(s.card);
          else os.goHome();
          return;
        }
        suppressNextClick();
        if (s.mode === 'h') {
          settle(useOS.getState().switcherPos, -v * 0.6);
          return;
        }
        const dy = s.samples.length ? s.samples[s.samples.length - 1].v : 0;
        if (s.card && (dy < -110 || v < -0.6)) {
          const id = s.card;
          setCardDrag({ id, dy: -700, fly: true });
          window.setTimeout(() => {
            setCardDrag(null);
            const st = useOS.getState();
            const rest = st.recents.filter((x) => x !== id);
            os.closeRecent(id);
            if (!rest.length) os.goHome();
            else useOS.setState({ switcherPos: Math.min(rest.length - 1, Math.max(0, st.switcherPos - (order.indexOf(id) <= st.switcherPos ? 1 : 0))) });
          }, 260);
        } else setCardDrag(null);
      }}
      onPointerCancel={() => {
        g.current = null;
        setCardDrag(null);
        setScrolling(false);
      }}
    >
      {order.map((id, i) => {
        const cx = cardX(i - pos);
        const dy = cardDrag?.id === id ? cardDrag.dy : 0;
        if (cx < -150 || cx > 480) return null;
        return (
          <div
            key={id}
            className={`t7-card-label ${cardDrag?.id === id && cardDrag.fly ? 'fly' : ''}`}
            style={{ transform: `translate3d(${cx - CW / 2}px, ${CY - CH / 2 - 30 + dy}px, 0)`, zIndex: i + 1, opacity: dy < -40 ? 0 : 1 }}
          >
            <AppIcon id={id} size={24} />
            <span>{appName(id)}</span>
          </div>
        );
      })}
      {n === 0 && <div className="t7-switcher-empty">No Recent Apps</div>}
    </div>
  );
}
