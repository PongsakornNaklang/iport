import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useNano } from '../state';
import { clamp, tween, unscale, VelocityTracker } from './gesture';
import { t } from './i18n';

export interface PageSpec {
  title: string;
  node: ReactNode;
  /** label used by the next page's back button (defaults to title) */
  backLabel?: string;
  /** show the navigation bar (default true) */
  bar?: boolean;
  right?: ReactNode;
  /** status bar text colour on this page */
  theme?: 'light' | 'dark';
  hideStatus?: boolean;
  /** page background */
  bg?: string;
  /** a key that identifies the page kind ("nowplaying") */
  kind?: string;
  /** dark navigation bar */
  darkBar?: boolean;
}

export interface NavApi {
  push(p: PageSpec): void;
  pop(): void;
  popToRoot(): void;
  depth: number;
  topKind: string | undefined;
}

const NavCtx = createContext<NavApi>({ push() {}, pop() {}, popToRoot() {}, depth: 1, topKind: undefined });
export const useNav = () => useContext(NavCtx);

const PageCtx = createContext<{ top: boolean; active: boolean; settled: boolean }>({ top: true, active: true, settled: true });
/** Whether this page is the visible top page of the active app. */
export const usePage = () => useContext(PageCtx);

const TintCtx = createContext('#ff2d55');
export const useTint = () => useContext(TintCtx);

interface Entry {
  id: number;
  spec: PageSpec;
}

const ANIM_MS = 340;
let nextId = 1;

export function NavStack({
  root,
  tint,
  active,
  apiRef,
  resetSerial,
}: {
  root: PageSpec;
  tint: string;
  active: boolean;
  apiRef?: RefObject<NavApi | null>;
  /** when this changes the stack pops to root (Home pressed) */
  resetSerial?: number;
}) {
  const [stack, setStack] = useState<Entry[]>([{ id: 0, spec: root }]);
  const [leaving, setLeaving] = useState<Entry | null>(null);
  const [anim, setAnim] = useState<'push' | 'pop' | null>(null);
  const [peek, setPeek] = useState(false);
  const els = useRef(new Map<number, HTMLDivElement>());
  const wrap = useRef<HTMLDivElement>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const suppress = useRef(false);

  // bumps on every push/pop so the "animation finished" timer restarts
  const [animSerial, setAnimSerial] = useState(0);
  const finishLater = () => setAnimSerial((n) => n + 1);
  // (an effect rather than a stored timeout: StrictMode's simulated unmount
  // would otherwise cancel the timer and leave the stack "animating" forever)
  useEffect(() => {
    if (!animSerial) return;
    const tm = window.setTimeout(() => {
      setAnim(null);
      setLeaving(null);
    }, ANIM_MS + 20);
    return () => window.clearTimeout(tm);
  }, [animSerial]);

  const api: NavApi = {
    push(spec) {
      setStack((s) => [...s, { id: nextId++, spec }]);
      setLeaving(null);
      setAnim('push');
      finishLater();
    },
    pop() {
      const s = stackRef.current;
      if (s.length < 2) return;
      setLeaving(s[s.length - 1]);
      setStack(s.slice(0, -1));
      setAnim('pop');
      finishLater();
    },
    popToRoot() {
      const s = stackRef.current;
      if (s.length < 2) return;
      setLeaving(s[s.length - 1]);
      setStack(s.slice(0, 1));
      setAnim('pop');
      finishLater();
    },
    depth: stack.length,
    topKind: stack[stack.length - 1].spec.kind,
  };
  if (apiRef) (apiRef as { current: NavApi | null }).current = api;

  // Home pressed: next time the app opens it starts from the top? The nano
  // remembers where you were, so only reset when explicitly asked.
  const lastReset = useRef(resetSerial);
  useEffect(() => {
    if (resetSerial !== lastReset.current) {
      lastReset.current = resetSerial;
      setStack((s) => s.slice(0, 1));
      setLeaving(null);
      setAnim(null);
    }
  }, [resetSerial]);

  // publish the status bar style of the top page
  const top = stack[stack.length - 1];
  const topSpec = top.id === 0 ? root : top.spec;
  useLayoutEffect(() => {
    if (!active) return;
    useNano.setState({ statusTheme: topSpec.theme ?? 'dark', statusHidden: !!topSpec.hideStatus });
  }, [active, topSpec.theme, topSpec.hideStatus]);

  // ---------------------------------------------------------------- swipe back
  const drag = useRef<null | { id: number; x0: number; y0: number; k: number; w: number; started: boolean; vt: VelocityTracker; p: number }>(null);

  const setProgress = (p: number) => {
    const s = stackRef.current;
    const w = wrap.current?.offsetWidth ?? 240;
    const topEl = els.current.get(s[s.length - 1].id);
    const prevEl = els.current.get(s[s.length - 2]?.id ?? -1);
    if (topEl) topEl.style.transform = `translate3d(${(p * w).toFixed(1)}px,0,0)`;
    if (prevEl) {
      prevEl.style.transform = `translate3d(${(-0.3 * w * (1 - p)).toFixed(1)}px,0,0)`;
      prevEl.style.setProperty('--shade', String(0.12 * (1 - p)));
    }
  };
  const clearProgress = () => {
    for (const el of els.current.values()) {
      el.style.transform = '';
      el.style.removeProperty('--shade');
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    suppress.current = false;
    if (e.button !== 0 || stackRef.current.length < 2 || anim) return;
    if ((e.target as HTMLElement).closest('[data-noswipe]')) return;
    const vt = new VelocityTracker();
    vt.reset(e.clientX);
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, k: unscale(wrap.current!), w: wrap.current!.offsetWidth, started: false, vt, p: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.vt.add(e.clientX);
    const dx = (e.clientX - d.x0) * d.k;
    const dy = (e.clientY - d.y0) * d.k;
    if (!d.started) {
      if (dx > 10 && dx > Math.abs(dy) * 1.2) {
        d.started = true;
        suppress.current = true;
        try {
          wrap.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        setPeek(true);
      } else if (Math.abs(dy) > 10 || dx < -10) {
        drag.current = null;
        return;
      } else return;
    }
    d.p = clamp(dx / d.w, 0, 1);
    setProgress(d.p);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.started) return;
    const v = d.vt.velocity() * d.k;
    const commit = d.p > 0.4 || (v > 0.3 && d.p > 0.05);
    const target = commit ? 1 : 0;
    tween(d.p, target, Math.max(120, 260 * Math.abs(target - d.p)), setProgress, () => {
      if (commit) {
        const s = stackRef.current;
        setStack(s.slice(0, -1));
      }
      setPeek(false);
      requestAnimationFrame(clearProgress);
    });
  };

  // ---------------------------------------------------------------- render
  const entries = leaving ? [...stack, leaving] : stack;
  const topIdx = stack.length - 1;
  return (
    <NavCtx.Provider value={api}>
      <TintCtx.Provider value={tint}>
        <div
          ref={wrap}
          className="n7-nav"
          style={{ ['--tint' as string]: tint } as CSSProperties}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={(e) => {
            if (suppress.current) {
              e.stopPropagation();
              e.preventDefault();
              suppress.current = false;
            }
          }}
        >
          {entries.map((en, i) => {
            const isLeaving = en === leaving;
            const spec = en.id === 0 ? root : en.spec;
            const isTop = !isLeaving && i === topIdx;
            let cls = '';
            let visible = isTop || isLeaving;
            if (anim === 'push') {
              if (isTop) cls = 'n7-push-in';
              else if (i === topIdx - 1) {
                cls = 'n7-push-out';
                visible = true;
              }
            } else if (anim === 'pop') {
              if (isLeaving) cls = 'n7-pop-out';
              else if (isTop) cls = 'n7-pop-in';
            }
            if (peek && i === topIdx - 1) visible = true;
            const prevSpec = i > 0 ? (entries[i - 1].id === 0 ? root : entries[i - 1].spec) : null;
            return (
              <div
                key={en.id}
                ref={(el) => {
                  if (el) els.current.set(en.id, el);
                  else els.current.delete(en.id);
                }}
                className={`n7-page ${cls} ${spec.darkBar ? 'n7-page-dark' : ''}`}
                style={{ visibility: visible ? 'visible' : 'hidden', background: spec.bg, zIndex: i + 1 }}
                aria-hidden={!isTop}
              >
                {spec.bar !== false && (
                  <NavBar
                    title={spec.title}
                    back={prevSpec ? prevSpec.backLabel ?? prevSpec.title : undefined}
                    onBack={api.pop}
                    right={spec.right}
                    dark={spec.darkBar}
                  />
                )}
                <div className="n7-page-body">
                  <PageCtx.Provider value={{ top: isTop, active, settled: isTop && !anim && !peek }}>{spec.node}</PageCtx.Provider>
                </div>
                <div className="n7-page-shade" />
              </div>
            );
          })}
        </div>
      </TintCtx.Provider>
    </NavCtx.Provider>
  );
}

export function Chevron({ dir = 'left', size = 12, color = 'currentColor', weight = 2.2 }: { dir?: 'left' | 'right' | 'down' | 'up'; size?: number; color?: string; weight?: number }) {
  const rot = { left: 0, right: 180, down: -90, up: 90 }[dir];
  return (
    <svg width={size * 0.6} height={size} viewBox="0 0 12 20" style={{ transform: `rotate(${rot}deg)`, flex: 'none' }}>
      <path d="M10 2 2 10l8 8" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NavBar({ title, back, onBack, right, dark }: { title: string; back?: string; onBack?: () => void; right?: ReactNode; dark?: boolean }) {
  return (
    <div className={`n7-navbar ${dark ? 'n7-navbar-dark' : ''}`}>
      {back !== undefined && (
        <button className="n7-back" onClick={onBack} data-tap>
          <Chevron size={15} />
          <span>{back.length > 12 ? t('Back') : t(back)}</span>
        </button>
      )}
      <div className="n7-navtitle">{t(title)}</div>
      {right && <div className="n7-navright">{right}</div>}
    </div>
  );
}
