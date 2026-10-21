import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { indexLetter } from '../../../core/util/format';
import { clamp, useInput, useOS, useScreen } from './core';
import { Check, Chevron, SpeakerGlyph } from './glyphs';

export interface Row {
  key: string;
  label: string;
  /** second line (artwork rows) */
  sub?: string;
  /** artwork ref (artwork rows) */
  art?: string;
  /** right-aligned value ("Off", "3:24") */
  detail?: string;
  chevron?: boolean;
  /** blue "unplayed" dot (podcasts) */
  dot?: boolean;
  /** speaker: this is the song that is playing */
  speaker?: boolean;
  check?: boolean;
  /** text used for the fast-scroll letter (defaults to label) */
  sort?: string;
  /** custom left adornment */
  icon?: ReactNode;
  dim?: boolean;
  onSelect?: () => void;
  onHold?: () => void;
}

export interface ListViewProps {
  rows: Row[];
  /** alphabetical list: show the big letter while scrolling fast */
  indexed?: boolean;
  variant?: 'plain' | 'art';
  /** list area height (defaults to the screen minus the status bar) */
  height?: number;
  initial?: number;
  onHighlight?: (index: number) => void;
  empty?: string;
  /** keep handling input even when the row has no action (default true) */
  className?: string;
  style?: CSSProperties;
  /** Let the parent intercept events first. */
  disabled?: boolean;
}

/**
 * The iPod list: blue selection bar, chevrons, a scroll bar on long lists,
 * marquee for long titles, scroll acceleration and the big index letter.
 */
export function ListView({ rows, indexed, variant = 'plain', height, initial = 0, onHighlight, empty, className, style, disabled }: ListViewProps) {
  const os = useOS();
  const { active } = useScreen();
  const areaH = height ?? os.height - os.hdr;
  const rowH = variant === 'art' ? Math.round(os.row * 1.6) : os.row;
  const visible = Math.max(1, Math.floor(areaH / rowH));
  const [state, setState] = useState(() => {
    const sel = clamp(initial, 0, Math.max(0, rows.length - 1));
    return { sel, top: clamp(sel - visible + 1, 0, Math.max(0, rows.length - visible)) };
  });
  const [letter, setLetter] = useState<string | null>(null);
  const letterTimer = useRef<number | undefined>(undefined);

  // keep the selection valid when the list changes
  const sel = clamp(state.sel, 0, Math.max(0, rows.length - 1));
  let top = clamp(state.top, 0, Math.max(0, rows.length - visible));
  if (sel < top) top = sel;
  if (sel >= top + visible) top = sel - visible + 1;

  const hlRef = useRef(onHighlight);
  hlRef.current = onHighlight;
  useEffect(() => {
    hlRef.current?.(sel);
  }, [sel]);

  useEffect(() => () => window.clearTimeout(letterTimer.current), []);

  useInput((e) => {
    if (e.type === 'scroll') {
      if (!rows.length) return true;
      let steps = e.steps;
      const v = e.velocity;
      if (rows.length > 40) steps *= v > 44 ? 8 : v > 30 ? 4 : v > 18 ? 2 : 1;
      const ns = clamp(sel + steps, 0, rows.length - 1);
      let nt = top;
      if (ns < nt) nt = ns;
      if (ns >= nt + visible) nt = ns - visible + 1;
      setState({ sel: ns, top: nt });
      if (indexed && v > 16 && rows.length > visible * 2) {
        const r = rows[ns];
        setLetter(indexLetter(r.sort ?? r.label));
        window.clearTimeout(letterTimer.current);
        letterTimer.current = window.setTimeout(() => setLetter(null), 650);
      }
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      rows[sel]?.onSelect?.();
      return true;
    }
    if (e.type === 'hold' && e.button === 'select') {
      rows[sel]?.onHold?.();
      return true;
    }
    if ((e.type === 'down' || e.type === 'up' || e.type === 'repeat') && e.button === 'select') return true;
    return false;
  }, !disabled);

  const scroll = rows.length > visible;
  const trackH = areaH;
  const thumbH = scroll ? Math.max(14, Math.round((visible / rows.length) * trackH)) : 0;
  const thumbTop = scroll ? Math.round((top / (rows.length - visible)) * (trackH - thumbH)) : 0;

  const out: ReactNode[] = [];
  for (let i = top; i < Math.min(rows.length, top + visible + 1); i++) {
    const r = rows[i];
    const selected = i === sel;
    out.push(
      <div
        key={r.key}
        className={`cl-row ${selected ? 'cl-sel' : ''} ${variant === 'art' ? 'cl-row-artv' : ''} ${r.dim ? 'cl-dim' : ''}`}
        style={{ top: (i - top) * rowH, height: rowH }}
      >
        {r.dot !== undefined && <span className={`cl-dot ${r.dot ? '' : 'cl-dot-off'}`} />}
        {r.icon}
        {variant === 'art' && <Artwork src={r.art} size={rowH - 4} className="cl-row-art" />}
        <div className="cl-row-main">
          <Marquee text={r.label} run={selected && active} className="cl-row-label" />
          {r.sub !== undefined && <Marquee text={r.sub} run={false} className="cl-row-sub" />}
        </div>
        {r.detail !== undefined && <span className="cl-row-detail">{r.detail}</span>}
        {r.speaker && <SpeakerGlyph />}
        {r.check && <Check />}
        {r.chevron && <Chevron />}
      </div>,
    );
  }

  return (
    <div className={`cl-list ${scroll ? 'cl-list-scroll' : ''} ${className ?? ''}`} style={{ height: areaH, ...style }}>
      <div className="cl-list-rows">{out}</div>
      {scroll && (
        <div className="cl-scrollbar">
          <div className="cl-scrollthumb" style={{ top: thumbTop, height: thumbH }} />
        </div>
      )}
      {!rows.length && empty && <div className="cl-empty">{empty}</div>}
      {letter && <div className="cl-letter">{letter}</div>}
    </div>
  );
}

/** Text that scrolls when it does not fit and `run` is on (the selected row). */
export function Marquee({ text, run, className, style }: { text: string; run: boolean; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!run || !el) {
      setDist(0);
      return;
    }
    const d = el.scrollWidth - el.clientWidth;
    setDist(d > 2 ? d : 0);
  }, [text, run]);
  return (
    <div ref={ref} className={`cl-mq ${dist ? 'cl-mq-on' : ''} ${className ?? ''}`} style={style}>
      <span
        style={
          dist
            ? ({ ['--mq' as string]: `-${dist + 6}px`, animationDuration: `${(3 + dist / 22).toFixed(1)}s` } as CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
