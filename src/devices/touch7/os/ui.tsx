/**
 * A small UIKit: navigation stacks with large titles, inset-grouped lists,
 * switches, sliders, segmented controls, search fields, tab bars and sheets.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Glyph } from './glyphs';
import { claim, isClaimed, localPoint, suppressNextClick, unitScale } from './gesture';
import { Scroller } from './Scroller';
import { playTap } from '../../../core/sound/click';
import { usePrefs } from './store';

// ------------------------------------------------------------------ app context

export interface AppContextValue {
  id: string;
  active: boolean;
  host: HTMLElement | null;
}
export const AppCtx = createContext<AppContextValue>({ id: '', active: false, host: null });
export const useApp = () => useContext(AppCtx);

// ------------------------------------------------------------------ navigation

interface NavEntry {
  key: number;
  node: ReactNode;
  title: string;
}
export interface NavApi {
  push(node: ReactNode, title: string): void;
  pop(): void;
  popToRoot(): void;
  depth: number;
}
const NavCtx = createContext<NavApi | null>(null);
const EntryCtx = createContext<{ index: number; backTitle: string | null; top: boolean }>({ index: 0, backTitle: null, top: true });
export const useNav = () => useContext(NavCtx);
export const useEntry = () => useContext(EntryCtx);

let navKey = 1;
const DUR = 380;
const EASE = 'cubic-bezier(0.2, 0.85, 0.25, 1)';

export function NavStack({
  root,
  rootTitle,
  resetSerial = 0,
  className,
  onApi,
}: {
  root: ReactNode;
  rootTitle: string;
  resetSerial?: number;
  className?: string;
  onApi?: (api: NavApi) => void;
}) {
  const [stack, setStack] = useState<NavEntry[]>([{ key: 0, node: root, title: rootTitle }]);
  const [anim, setAnim] = useState<null | 'push' | 'pop'>(null);
  const [leaving, setLeaving] = useState<NavEntry | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  // the root node may change (props) — keep it fresh
  useEffect(() => {
    setStack((s) => [{ ...s[0], node: root, title: rootTitle }, ...s.slice(1)]);
  }, [root, rootTitle]);

  const push = useCallback((node: ReactNode, title: string) => {
    setStack((s) => [...s, { key: navKey++, node, title }]);
    setAnim('push');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnim(null), DUR);
  }, []);
  const pop = useCallback(() => {
    const s = stackRef.current;
    if (s.length <= 1) return;
    setLeaving(s[s.length - 1]);
    setStack(s.slice(0, -1));
    setAnim('pop');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAnim(null);
      setLeaving(null);
    }, DUR);
  }, []);
  const popToRoot = useCallback(() => {
    const s = stackRef.current;
    if (s.length <= 1) return;
    setLeaving(s[s.length - 1]);
    setStack(s.slice(0, 1));
    setAnim('pop');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAnim(null);
      setLeaving(null);
    }, DUR);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    popToRoot();
  }, [resetSerial, popToRoot]);

  const api = useMemo(() => ({ push, pop, popToRoot, depth: stack.length }), [push, pop, popToRoot, stack.length]);
  useEffect(() => onApi?.(api), [api, onApi]);

  // interactive edge swipe back
  const swipe = useRef<{ id: number; x0: number; k: number; w: number; dx: number; t: number; v: number; on: boolean } | null>(null);
  const topEl = () => wrap.current?.querySelector<HTMLElement>(':scope > .t7-nav-entry.is-top') ?? null;
  const underEl = () => wrap.current?.querySelector<HTMLElement>(':scope > .t7-nav-entry.is-under') ?? null;
  const onDownCap = (e: React.PointerEvent) => {
    if (stack.length < 2 || anim || e.button !== 0) return;
    const el = wrap.current!;
    const p = localPoint(el, e.clientX, e.clientY);
    if (p.x > 22) return;
    const { kx } = unitScale(el);
    swipe.current = { id: e.pointerId, x0: e.clientX, k: kx, w: el.offsetWidth, dx: 0, t: performance.now(), v: 0, on: false };
  };
  const onMoveCap = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = (e.clientX - s.x0) * s.k;
    if (!s.on) {
      if (dx < 8) return;
      if (isClaimed(e.pointerId, wrap.current!) || !claim(e.pointerId, wrap.current!)) {
        swipe.current = null;
        return;
      }
      s.on = true;
      wrap.current!.setPointerCapture(e.pointerId);
      const u = underEl();
      if (u) u.style.visibility = 'visible';
    }
    const now = performance.now();
    s.v = (dx - s.dx) / Math.max(1, now - s.t);
    s.t = now;
    s.dx = Math.max(0, dx);
    const top = topEl();
    const under = underEl();
    if (top) {
      top.style.transition = 'none';
      top.style.transform = `translate3d(${s.dx}px,0,0)`;
    }
    if (under) {
      under.style.transition = 'none';
      under.style.transform = `translate3d(${-0.3 * s.w + 0.3 * s.dx}px,0,0)`;
      under.style.setProperty('--dim', String(0.1 * (1 - s.dx / s.w)));
    }
  };
  const onUpCap = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || e.pointerId !== s.id) return;
    swipe.current = null;
    if (!s.on) return;
    suppressNextClick();
    const top = topEl();
    const under = underEl();
    const done = s.dx > s.w * 0.35 || s.v > 0.4;
    const ms = 260;
    if (top) {
      top.style.transition = `transform ${ms}ms ${EASE}`;
      top.style.transform = done ? `translate3d(${s.w}px,0,0)` : '';
    }
    if (under) {
      under.style.transition = `transform ${ms}ms ${EASE}`;
      under.style.transform = done ? 'translate3d(0,0,0)' : '';
      under.style.removeProperty('--dim');
    }
    window.setTimeout(() => {
      if (top) {
        top.style.transition = '';
        top.style.transform = '';
      }
      if (under) {
        under.style.transition = '';
        under.style.transform = '';
        under.style.visibility = '';
      }
      if (done) {
        setStack((st) => st.slice(0, -1));
      }
    }, ms);
  };

  const n = stack.length;
  return (
    <NavCtx.Provider value={api}>
      <div
        ref={wrap}
        className={`t7-nav ${className ?? ''}`}
        onPointerDownCapture={onDownCap}
        onPointerMoveCapture={onMoveCap}
        onPointerUpCapture={onUpCap}
        onPointerCancelCapture={onUpCap}
      >
        {stack.map((entry, i) => {
          const isTop = i === n - 1;
          const isUnder = i === n - 2;
          let cls = '';
          if (isTop && anim === 'push' && n > 1) cls = 'nav-in';
          if (isUnder && anim === 'push') cls = 'nav-cover';
          if (isTop && anim === 'pop') cls = 'nav-uncover';
          const hidden = !isTop && !(isUnder && anim);
          return (
            <div
              key={entry.key}
              className={`t7-nav-entry ${isTop ? 'is-top' : ''} ${isUnder ? 'is-under' : ''} ${cls} ${hidden ? 'is-hidden' : ''}`}
            >
              <EntryCtx.Provider value={{ index: i, backTitle: i > 0 ? stack[i - 1].title : null, top: isTop }}>{entry.node}</EntryCtx.Provider>
            </div>
          );
        })}
        {leaving && (
          <div key={leaving.key} className="t7-nav-entry is-leaving nav-out">
            <EntryCtx.Provider value={{ index: n, backTitle: stack[n - 1]?.title ?? null, top: false }}>{leaving.node}</EntryCtx.Provider>
          </div>
        )}
      </div>
    </NavCtx.Provider>
  );
}

export function BackButton({ label, onPress }: { label?: string | null; onPress?: () => void }) {
  const nav = useNav();
  const entry = useEntry();
  const t = label ?? entry.backTitle ?? 'Back';
  return (
    <button className="t7-back" onClick={() => (onPress ? onPress() : nav?.pop())}>
      <Glyph name="chevron.left" size={21} />
      <span>{t.length > 14 ? 'Back' : t}</span>
    </button>
  );
}

/** A navigation page: nav bar (with large title), scrolling content. */
export function Page({
  title,
  large = true,
  left,
  right,
  children,
  bg = 'plain',
  search,
  className,
  scrollClassName,
  noBack,
  noScroll,
  titleView,
  bottom,
  onScroll,
  barAlways,
}: {
  title: string;
  large?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  bg?: 'plain' | 'grouped' | 'black';
  search?: ReactNode;
  className?: string;
  scrollClassName?: string;
  noBack?: boolean;
  noScroll?: boolean;
  titleView?: ReactNode;
  /** fixed toolbar at the bottom */
  bottom?: ReactNode;
  onScroll?: (pos: number) => void;
  barAlways?: boolean;
}) {
  const entry = useEntry();
  const [state, setState] = useState(0);
  const stRef = useRef(0);
  const handle = (pos: number) => {
    const s = pos > (large ? 38 : 1) ? 2 : pos > 1 ? 1 : 0;
    if (s !== stRef.current) {
      stRef.current = s;
      setState(s);
    }
    onScroll?.(pos);
  };
  const showBack = entry.backTitle != null && !noBack && !left;
  const barOn = barAlways || state === 2 || (!large && state >= 1);
  const titleOn = !large || state === 2;
  return (
    <div className={`t7-page bg-${bg} ${className ?? ''} ${bottom ? 'has-toolbar' : ''}`}>
      <div className={`t7-navbar ${barOn ? 'bar-on' : ''}`}>
        <div className="t7-nav-left">{showBack ? <BackButton /> : left}</div>
        <div className={`t7-nav-title ${titleOn ? 'on' : ''}`}>{titleView ?? title}</div>
        <div className="t7-nav-right">{right}</div>
      </div>
      {noScroll ? (
        <div className={`t7-page-fixed ${scrollClassName ?? ''}`}>
          {large && <h1 className="t7-large-title">{title}</h1>}
          {children}
        </div>
      ) : (
        <Scroller className={`t7-page-scroll ${scrollClassName ?? ''}`} onScroll={handle}>
          {large && <h1 className="t7-large-title">{title}</h1>}
          {search}
          {children}
          <div className="t7-page-pad" />
        </Scroller>
      )}
      {bottom && <div className="t7-toolbar">{bottom}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ lists

export function Section({
  header,
  footer,
  children,
  plain,
  className,
  style,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  plain?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`t7-section ${plain ? 'plain' : 'inset'} ${className ?? ''}`} style={style}>
      {header != null && <div className="t7-section-h">{header}</div>}
      <div className="t7-section-body">{children}</div>
      {footer != null && <div className="t7-section-f">{footer}</div>}
    </section>
  );
}

export function IconTile({ glyph, bg, size = 29, color = '#fff', children }: { glyph?: string; bg: string; size?: number; color?: string; children?: ReactNode }) {
  return (
    <span className="t7-icontile" style={{ background: bg, width: size, height: size, color, borderRadius: size * 0.23 }}>
      {children ?? (glyph ? <Glyph name={glyph} size={size * 0.66} /> : null)}
    </span>
  );
}

export function Cell({
  icon,
  title,
  subtitle,
  detail,
  chevron,
  onPress,
  accessory,
  destructive,
  tint,
  check,
  className,
  style,
  center,
  onLongPress,
  disabled,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  accessory?: ReactNode;
  destructive?: boolean;
  tint?: boolean;
  check?: boolean;
  className?: string;
  style?: CSSProperties;
  center?: boolean;
  onLongPress?: (y: number) => void;
  disabled?: boolean;
}) {
  const lp = useLongPressCell(onLongPress);
  return (
    <div
      className={`t7-cell ${onPress && !disabled ? 'tappable' : ''} ${icon ? 'has-icon' : ''} ${destructive ? 'destructive' : ''} ${tint ? 'tinted' : ''} ${center ? 'center' : ''} ${disabled ? 'disabled' : ''} ${className ?? ''}`}
      style={style}
      onClick={disabled ? undefined : onPress}
      {...lp}
    >
      {icon && <div className="t7-cell-icon">{icon}</div>}
      <div className="t7-cell-main">
        <div className="t7-cell-text">
          <div className="t7-cell-title">{title}</div>
          {subtitle != null && <div className="t7-cell-sub">{subtitle}</div>}
        </div>
        {detail != null && <div className="t7-cell-detail">{detail}</div>}
        {accessory}
        {check && <Glyph name="checkmark" size={17} className="t7-cell-check" />}
        {chevron && <Glyph name="chevron.right" size={14} className="t7-cell-chev" />}
      </div>
    </div>
  );
}

function useLongPressCell(onLong?: (y: number) => void) {
  const st = useRef<{ t: number; x: number; y: number } | null>(null);
  if (!onLong) return {};
  const cancel = () => {
    if (st.current) window.clearTimeout(st.current.t);
    st.current = null;
  };
  return {
    onPointerDown(e: React.PointerEvent) {
      if (e.button !== 0) return;
      cancel();
      const el = e.currentTarget as HTMLElement;
      const id = e.pointerId;
      const t = window.setTimeout(() => {
        st.current = null;
        if (isClaimed(id)) return;
        suppressNextClick(700);
        el.classList.add('t7-lifted');
        window.setTimeout(() => el.classList.remove('t7-lifted'), 350);
        onLong(screenY(el));
      }, 500);
      st.current = { t, x: e.clientX, y: e.clientY };
    },
    onPointerMove(e: React.PointerEvent) {
      const s = st.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(e: React.MouseEvent) {
      e.preventDefault();
      cancel();
      onLong(screenY(e.currentTarget as HTMLElement));
    },
  };
}

/** y of an element's bottom edge in screen points */
export function screenY(el: HTMLElement): number {
  const scr = el.closest('.t7-screen') as HTMLElement | null;
  if (!scr) return 300;
  const r = el.getBoundingClientRect();
  const p = localPoint(scr, r.left, r.bottom);
  return p.y;
}

// ------------------------------------------------------------------ controls

export function Switch({ on, onChange, tint, disabled }: { on: boolean; onChange: (v: boolean) => void; tint?: string; disabled?: boolean }) {
  return (
    <button
      className={`t7-switch ${on ? 'on' : ''} ${disabled ? 'disabled' : ''}`}
      style={tint && on ? { background: tint } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!on);
      }}
      role="switch"
      aria-checked={on}
    >
      <span className="t7-switch-knob" />
    </button>
  );
}

/** Horizontal slider 0..1 (iOS style unless `className` overrides the look). */
export function Slider({
  value,
  onChange,
  onEnd,
  className,
  minGlyph,
  maxGlyph,
  thumb = true,
  fill,
  style,
}: {
  value: number;
  onChange: (v: number) => void;
  onEnd?: (v: number) => void;
  className?: string;
  minGlyph?: string;
  maxGlyph?: string;
  thumb?: boolean;
  fill?: string;
  style?: CSSProperties;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const last = useRef(value);
  const from = (e: React.PointerEvent) => {
    const el = track.current!;
    const p = localPoint(el, e.clientX, e.clientY);
    return Math.max(0, Math.min(1, p.x / el.offsetWidth));
  };
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`t7-slider ${className ?? ''} ${drag ? 'dragging' : ''}`} style={style}>
      {minGlyph && <Glyph name={minGlyph} size={14} className="t7-slider-g" />}
      <div
        ref={track}
        className="t7-slider-track"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          claim(e.pointerId, e.currentTarget);
          e.currentTarget.setPointerCapture(e.pointerId);
          e.stopPropagation();
          setDrag(true);
          last.current = from(e);
          onChange(last.current);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          last.current = from(e);
          onChange(last.current);
        }}
        onPointerUp={() => {
          if (!drag) return;
          setDrag(false);
          onEnd?.(last.current);
        }}
        onPointerCancel={() => setDrag(false)}
      >
        <div className="t7-slider-rail">
          <div className="t7-slider-fill" style={{ width: `${v * 100}%`, background: fill }} />
        </div>
        {thumb && <div className="t7-slider-thumb" style={{ left: `${v * 100}%` }} />}
      </div>
      {maxGlyph && <Glyph name={maxGlyph} size={18} className="t7-slider-g" />}
    </div>
  );
}

export function Segmented({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: string; label: ReactNode }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const i = Math.max(0, items.findIndex((x) => x.id === value));
  return (
    <div className={`t7-seg ${className ?? ''}`}>
      <div className="t7-seg-pill" style={{ width: `calc(${100 / items.length}% - 4px)`, transform: `translateX(calc(${i * 100}% + ${i * 4}px))` }} />
      {items.map((it) => (
        <button key={it.id} className={it.id === value ? 'on' : ''} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  className,
  onFocusChange,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onFocusChange?: (f: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState(false);
  const clicks = usePrefs((s) => s.keyboardClicks);
  return (
    <div className={`t7-search ${focus ? 'focused' : ''} ${className ?? ''}`}>
      <div className="t7-search-box" onClick={() => ref.current?.focus({ preventScroll: true })}>
        <Glyph name="magnifyingglass" size={15} />
        <input
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={() => clicks && playTap()}
          onFocus={() => {
            setFocus(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocus(false);
            onFocusChange?.(false);
          }}
          spellCheck={false}
        />
        {value && (
          <button className="t7-search-clear" onClick={() => onChange('')}>
            <Glyph name="xmark.circle.fill" size={16} />
          </button>
        )}
      </div>
      {(focus || value) && (
        <button
          className="t7-search-cancel"
          onClick={() => {
            onChange('');
            ref.current?.blur();
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  multiline,
  onEnter,
  style,
  autoFocus,
  type,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  onEnter?: () => void;
  style?: CSSProperties;
  autoFocus?: boolean;
  type?: string;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const clicks = usePrefs((s) => s.keyboardClicks);
  useEffect(() => {
    if (autoFocus) {
      const t = window.setTimeout(() => ref.current?.focus({ preventScroll: true }), 380);
      return () => window.clearTimeout(t);
    }
  }, [autoFocus]);
  const common = {
    ref,
    value,
    placeholder,
    className: `t7-input ${className ?? ''}`,
    style,
    spellCheck: false,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (clicks) playTap();
      if (e.key === 'Enter' && !multiline) onEnter?.();
    },
  };
  return multiline ? <textarea {...common} /> : <input {...common} type={type ?? 'text'} />;
}

// ------------------------------------------------------------------ tab bar

export interface TabDef {
  id: string;
  label: string;
  glyph: string;
  render: (resetSerial: number) => ReactNode;
}

export function Tabs({
  tabs,
  value,
  onChange,
  accessory,
  className,
  dark,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  /** e.g. the Music mini player, shown above the tab bar */
  accessory?: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  const [visited, setVisited] = useState<string[]>([value]);
  const [resets, setResets] = useState<Record<string, number>>({});
  useEffect(() => {
    setVisited((v) => (v.includes(value) ? v : [...v, value]));
  }, [value]);
  const bottom = 49 + (accessory ? 64 : 0);
  return (
    <div className={`t7-tabs ${className ?? ''} ${dark ? 'dark' : ''}`} style={{ ['--t7-bottom' as string]: `${bottom}px` }}>
      {tabs.map((t) =>
        visited.includes(t.id) ? (
          <div key={t.id} className={`t7-tab-pane ${t.id === value ? 'on' : ''}`}>
            {t.render(resets[t.id] ?? 0)}
          </div>
        ) : null,
      )}
      {accessory && <div className="t7-tab-accessory">{accessory}</div>}
      <div className="t7-tabbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={t.id === value ? 'on' : ''}
            onClick={() => {
              if (t.id === value) setResets((r) => ({ ...r, [t.id]: (r[t.id] ?? 0) + 1 }));
              else onChange(t.id);
            }}
          >
            <Glyph name={t.glyph} size={25} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ sheets

/**
 * Modal page sheet (slides up over the app, drag down to dismiss).
 * Rendered into the app's host so it covers tab bars.
 */
export function Sheet({
  open,
  onClose,
  children,
  className,
  full,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  full?: boolean;
}) {
  const app = useApp();
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 420);
    return () => window.clearTimeout(t);
  }, [open]);

  const drag = useRef<{ id: number; y0: number; k: number; dy: number; t: number; v: number; on: boolean } | null>(null);
  if (!mounted || !app.host) return null;
  return createPortal(
    <div className={`t7-sheet-wrap ${shown ? 'shown' : ''} ${full ? 'full' : ''}`}>
      <div className="t7-sheet-dim" onClick={onClose} />
      <div
        ref={card}
        className={`t7-sheet ${className ?? ''}`}
        onPointerDownCapture={(e) => {
          const el = card.current!;
          const p = localPoint(el, e.clientX, e.clientY);
          if (p.y > 64) return; // drag from the header area
          drag.current = { id: e.pointerId, y0: e.clientY, k: unitScale(el).ky, dy: 0, t: performance.now(), v: 0, on: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dy = (e.clientY - d.y0) * d.k;
          if (!d.on) {
            if (dy < 8 || !claim(e.pointerId, card.current!)) return;
            d.on = true;
            card.current!.setPointerCapture(e.pointerId);
          }
          const now = performance.now();
          d.v = (dy - d.dy) / Math.max(1, now - d.t);
          d.t = now;
          d.dy = Math.max(0, dy);
          card.current!.style.transition = 'none';
          card.current!.style.transform = `translateY(${d.dy}px)`;
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (!d?.on) return;
          suppressNextClick();
          const el = card.current!;
          el.style.transition = '';
          el.style.transform = '';
          if (d.dy > 140 || d.v > 0.6) onClose();
        }}
      >
        {children}
      </div>
    </div>,
    app.host,
  );
}

export function SheetHeader({
  title,
  left,
  right,
}: {
  title: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="t7-sheet-head">
      <div className="t7-sheet-l">{left}</div>
      <div className="t7-sheet-title">{title}</div>
      <div className="t7-sheet-r">{right}</div>
    </div>
  );
}

export function Empty({ glyph, title, text, children }: { glyph?: string; title: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className="t7-empty">
      {glyph && <Glyph name={glyph} size={54} />}
      <div className="t7-empty-t">{title}</div>
      {text && <div className="t7-empty-x">{text}</div>}
      {children}
    </div>
  );
}

export function TextButton({ children, onPress, bold, disabled, className }: { children: ReactNode; onPress?: () => void; bold?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button className={`t7-tbtn ${bold ? 'bold' : ''} ${className ?? ''}`} disabled={disabled} onClick={onPress}>
      {children}
    </button>
  );
}

export function GlyphButton({ glyph, onPress, size = 22, className, label }: { glyph: string; onPress?: () => void; size?: number; className?: string; label?: string }) {
  return (
    <button className={`t7-gbtn ${className ?? ''}`} onClick={onPress} aria-label={label}>
      <Glyph name={glyph} size={size} />
    </button>
  );
}

/** Wheel picker column (alarm/timer time pickers). */
export function Wheel({
  items,
  value,
  onChange,
  width = 60,
  align = 'center',
  loop,
}: {
  items: string[];
  value: number;
  onChange: (i: number) => void;
  width?: number;
  align?: 'left' | 'right' | 'center';
  loop?: boolean;
}) {
  const ROW = 32;
  const reps = loop ? 40 : 1;
  const n = items.length;
  const el = useRef<HTMLDivElement>(null);
  const mid = loop ? Math.floor(reps / 2) * n : 0;
  const [off, setOff] = useState((mid + value) * ROW);
  const offRef = useRef(off);
  offRef.current = off;
  const anim = useRef(0);
  // external value changes
  useEffect(() => {
    const cur = Math.round(offRef.current / ROW);
    const curIdx = ((cur % n) + n) % n;
    if (curIdx !== value) setOff((mid + value) * ROW);
  }, [value, n, mid]);
  const st = useRef<{ id: number; y0: number; o0: number; k: number; last: { t: number; o: number }[] } | null>(null);
  const settle = (o: number, v: number) => {
    cancelAnimationFrame(anim.current);
    const max = (n * reps - 1) * ROW;
    const target = Math.max(0, Math.min(max, Math.round((o + v * 180) / ROW) * ROW));
    const from = o;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 320);
      const e = 1 - Math.pow(1 - k, 3);
      setOff(from + (target - from) * e);
      if (k < 1) anim.current = requestAnimationFrame(step);
      else {
        const idx = (((target / ROW) % n) + n) % n;
        onChange(idx);
      }
    };
    anim.current = requestAnimationFrame(step);
  };
  return (
    <div
      ref={el}
      className={`t7-wheel align-${align}`}
      style={{ width }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        cancelAnimationFrame(anim.current);
        claim(e.pointerId, e.currentTarget);
        e.currentTarget.setPointerCapture(e.pointerId);
        st.current = { id: e.pointerId, y0: e.clientY, o0: offRef.current, k: unitScale(e.currentTarget).ky, last: [] };
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s) return;
        const o = s.o0 - (e.clientY - s.y0) * s.k;
        setOff(o);
        const now = performance.now();
        s.last.push({ t: now, o });
        while (s.last.length > 2 && now - s.last[0].t > 100) s.last.shift();
      }}
      onPointerUp={(e) => {
        const s = st.current;
        st.current = null;
        if (!s) return;
        const moved = Math.abs(e.clientY - s.y0) * s.k;
        if (moved < 4) {
          // tap a row
          const p = localPoint(el.current!, e.clientX, e.clientY);
          const d = Math.round((p.y - el.current!.offsetHeight / 2) / ROW);
          settle(offRef.current + d * ROW, 0);
          return;
        }
        suppressNextClick();
        let v = 0;
        if (s.last.length >= 2) {
          const a = s.last[0];
          const b = s.last[s.last.length - 1];
          v = (b.o - a.o) / Math.max(1, b.t - a.t);
        }
        settle(offRef.current, v);
      }}
      onWheel={(e) => {
        cancelAnimationFrame(anim.current);
        settle(offRef.current + Math.sign(e.deltaY) * ROW, 0);
      }}
    >
      <div className="t7-wheel-in" style={{ transform: `translateY(${-off}px)` }}>
        {Array.from({ length: n * reps }, (_, i) => {
          const d = (i * ROW - off) / ROW;
          if (Math.abs(d) > 4) return <div key={i} className="t7-wheel-row" />;
          const ang = Math.max(-80, Math.min(80, d * 20));
          return (
            <div
              key={i}
              className="t7-wheel-row"
              style={{ transform: `rotateX(${-ang}deg) translateZ(0)`, opacity: Math.max(0.2, 1 - Math.abs(d) * 0.22) }}
            >
              {items[i % n]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
