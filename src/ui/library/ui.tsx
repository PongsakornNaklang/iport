/** Reusable bits for the Library panel. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Artwork } from '@/core/library/Artwork';
import { NO_SERVER_MSG } from '@/core/sources/net';
import { IconCheck, IconClose, IconPlay, IconPlus, IconSearch } from '../icons';
import { IconMore, IconPause } from './icons';
import { usePreview } from './state';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  // the white thumb slides to the chosen option, like the panel tabs (SegTabs)
  const bar = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number; ready: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const place = () => {
      const b = el.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!b) return setThumb(null);
      setThumb((cur) => ({ x: b.offsetLeft, w: b.offsetWidth, ready: cur !== null }));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  return (
    <div ref={bar} className={`lib-seg ${className}`} role="tablist">
      {thumb && (
        <span className={`lib-seg-thumb ${thumb.ready ? 'ready' : ''}`} style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }} aria-hidden="true" />
      )}
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
  wrap = false,
}: {
  value: T;
  options: { value: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  return (
    <div className={`lib-chips ${wrap ? 'wrap' : ''}`}>
      {options.map((o) => (
        <button key={o.value} className={`lib-chip ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null && <span className="lib-chip-n">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Search box with icon + clear button; submits on Enter (or on every change with `live`). */
export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  busy,
  button = 'Search',
  autoFocus,
  live,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder: string;
  busy?: boolean;
  button?: string | null;
  autoFocus?: boolean;
  live?: boolean;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.(value.trim());
  };
  return (
    <form className="lib-search" onSubmit={submit} role="search" noValidate>
      <div className="lib-search-box">
        <IconSearch className="lib-search-icon" />
        <input
          className="input"
          type="search"
          enterKeyHint="search"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button type="button" className="lib-search-clear" aria-label="Clear" onClick={() => onChange('')}>
            <IconClose width={10} height={10} />
          </button>
        )}
      </div>
      {!live && button && (
        <button className="btn primary" disabled={busy || !value.trim()} type="submit">
          {busy ? <Spinner /> : button}
        </button>
      )}
    </form>
  );
}

/** Text input + action button on one line (paste-a-link fields). */
export function InlineForm({
  value,
  onChange,
  onSubmit,
  placeholder,
  busy,
  button,
  icon,
  type = 'url',
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder: string;
  busy?: boolean;
  button: string;
  icon?: ReactNode;
  type?: string;
}) {
  return (
    <form
      className="lib-search"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <div className="lib-search-box">
        {icon && <span className="lib-search-icon">{icon}</span>}
        <input
          className="input"
          type={type}
          inputMode={type === 'url' ? 'url' : undefined}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
          style={icon ? undefined : { paddingLeft: 12 }}
        />
      </div>
      <button className="btn primary" disabled={busy || !value.trim()} type="submit">
        {busy ? <Spinner /> : button}
      </button>
    </form>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="lib-spinner" style={{ width: size, height: size }} aria-label="Loading" />;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="lib-empty">
      {icon && <div className="lib-empty-icon">{icon}</div>}
      <div className="lib-empty-title">{title}</div>
      {children && <div className="lib-empty-text">{children}</div>}
    </div>
  );
}

/** Error / info line. The "needs server" message gets a softer style. */
export function Notice({ error, children }: { error?: string | null; children?: ReactNode }) {
  if (!error && !children) return null;
  if (error === NO_SERVER_MSG)
    return (
      <div className="lib-notice info">
        <b>Not available in this preview.</b> {NO_SERVER_MSG}
      </div>
    );
  return <div className={`lib-notice ${error ? 'error' : 'info'}`}>{error ?? children}</div>;
}

export function LoadingRows({ n = 4 }: { n?: number }) {
  return (
    <div className="list lib-skeleton" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <div className="list-item" key={i}>
          <div className="lib-sk-art" />
          <div className="li-text">
            <div className="lib-sk-line" style={{ width: `${60 + ((i * 17) % 30)}%` }} />
            <div className="lib-sk-line small" style={{ width: `${35 + ((i * 23) % 25)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Round icon button used in rows. */
export function RowBtn({
  title,
  onClick,
  children,
  className = '',
  disabled,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`lib-rbtn ${className}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/**
 * A search-result row: artwork, two lines of text, and play / add buttons.
 * `previewKey` + `onPreview` shows a play/pause toggle bound to the preview
 * player; `onPlay` (no preview) means "add and play on the iPod".
 */
export function ResultRow({
  art,
  title,
  sub,
  meta,
  badge,
  added,
  onAdd,
  previewKey,
  onPreview,
  onPlay,
  onClick,
  wideArt,
  chevron,
}: {
  art?: string;
  title: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  added?: boolean;
  onAdd?: () => void;
  previewKey?: string;
  onPreview?: () => void;
  onPlay?: () => void;
  onClick?: () => void;
  wideArt?: boolean;
  chevron?: boolean;
}) {
  const pkey = usePreview((s) => s.key);
  const pstatus = usePreview((s) => s.status);
  const previewing = !!previewKey && pkey === previewKey;
  return (
    <div className={`list-item lib-row ${onClick ? 'clickable' : ''} ${previewing ? 'previewing' : ''}`} onClick={onClick}>
      <Artwork src={art} size={40} radius={wideArt ? 6 : 6} className="li-art" />
      <div className="li-text">
        <div className="li-title">{title}</div>
        {sub && <div className="li-sub">{sub}</div>}
        {meta && <div className="li-meta">{meta}</div>}
      </div>
      {badge}
      {onPreview && (
        <RowBtn title={previewing ? 'Stop preview' : 'Preview'} onClick={onPreview} className={previewing ? 'on' : ''}>
          {previewing && pstatus === 'loading' ? <Spinner size={14} /> : previewing ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
        </RowBtn>
      )}
      {onPlay && (
        <RowBtn title="Play on iPod" onClick={onPlay}>
          <IconPlay width={14} height={14} />
        </RowBtn>
      )}
      {onAdd && (
        <RowBtn title={added ? 'In your library' : 'Add to library'} onClick={onAdd} className={added ? 'added' : 'add'} disabled={added}>
          {added ? <IconCheck width={15} height={15} /> : <IconPlus width={15} height={15} />}
        </RowBtn>
      )}
      {chevron && <span className="lib-chev">›</span>}
    </div>
  );
}

// ------------------------------------------------------------------ sheet (modal inside the panel)

export function Sheet({
  title,
  onClose,
  children,
  actions,
  wide,
  cancel = 'Cancel',
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  /** label of the top-left button; null hides it (when `actions` has its own Done) */
  cancel?: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`lib-sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <div className="lib-sheet-head">
        {cancel ? (
          <button className="btn small" onClick={onClose}>
            {cancel}
          </button>
        ) : (
          <span />
        )}
        <h3>{title}</h3>
        <div className="lib-sheet-actions">{actions}</div>
      </div>
      <div className="lib-sheet-body">{children}</div>
    </div>
  );
}

export function Confirm({
  title,
  message,
  confirm,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirm: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lib-confirm-wrap" onClick={onClose}>
      <div className="lib-confirm" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="lib-confirm-title">{title}</div>
        <div className="lib-confirm-msg">{message}</div>
        <div className="lib-confirm-btns">
          <button className="btn" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'danger-fill' : 'primary'}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ popover menu (portal, positioned next to its button)

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuButton({ items, title = 'More', className = '' }: { items: (MenuItem | null | false)[]; title?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btn}
        className={`lib-rbtn ${open ? 'on' : ''} ${className}`}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <IconMore width={16} height={16} />
      </button>
      {open && btn.current && <Menu anchor={btn.current} items={items.filter(Boolean) as MenuItem[]} onClose={() => setOpen(false)} />}
    </>
  );
}

export function Menu({ anchor, items, onClose }: { anchor: HTMLElement; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const close = useCallback(() => onClose(), [onClose]);

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const m = ref.current!.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + 4;
    if (top + m.height > vh - 8) top = Math.max(8, r.top - m.height - 4);
    const left = Math.min(Math.max(8, r.right - m.width), vw - m.width - 8);
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor, close]);

  return createPortal(
    <div
      ref={ref}
      className="lib-menu"
      role="menu"
      data-no-stage=""
      data-no-device-keys=""
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => (
        <button
          key={i}
          role="menuitem"
          className={`lib-menu-item ${it.danger ? 'danger' : ''}`}
          disabled={it.disabled}
          onClick={() => {
            close();
            it.onSelect();
          }}
        >
          <span className="lib-menu-icon">{it.icon}</span>
          {it.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** Incremental rendering for long lists: renders `step` more rows whenever the sentinel scrolls into view. */
export function useIncremental(total: number, step = 120, resetKey: unknown = null): [number, (el: HTMLElement | null) => void] {
  const [count, setCount] = useState(step);
  useEffect(() => setCount(step), [resetKey, step]);
  const obs = useRef<IntersectionObserver | null>(null);
  const setSentinel = useCallback(
    (el: HTMLElement | null) => {
      obs.current?.disconnect();
      if (!el) return;
      obs.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(total, c + step));
        },
        { rootMargin: '400px' },
      );
      obs.current.observe(el);
    },
    [total, step],
  );
  useEffect(() => () => obs.current?.disconnect(), []);
  return [Math.min(count, total), setSentinel];
}

/** Async action runner with busy + error state. */
export function useTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const run = useCallback(async <T,>(fn: () => Promise<T>, errorText: (e: unknown) => string): Promise<T | undefined> => {
    const my = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      return my === seq.current ? r : undefined;
    } catch (e) {
      if (my === seq.current) setError(errorText(e));
      return undefined;
    } finally {
      if (my === seq.current) setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}
