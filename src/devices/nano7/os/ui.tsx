import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { clamp, useDrag } from './gesture';
import { Chevron, useTint } from './Nav';
import { ScrollView } from './ScrollView';
import { t } from './i18n';

/** A scrolling page body. */
export function Page({ children, grouped, style, padBottom }: { children: ReactNode; grouped?: boolean; style?: CSSProperties; padBottom?: number }) {
  return (
    <ScrollView className={grouped ? 'n7-grouped' : 'n7-plain'} style={style} padBottom={padBottom ?? (grouped ? 18 : 0)}>
      {children}
    </ScrollView>
  );
}

export function Section({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="n7-section">
      {header && <div className="n7-section-header">{typeof header === 'string' ? t(header) : header}</div>}
      <div className="n7-section-body">{children}</div>
      {footer && <div className="n7-section-footer">{footer}</div>}
    </div>
  );
}

export function Row({
  title,
  subtitle,
  detail,
  icon,
  art,
  artSize = 34,
  chevron,
  checked,
  onClick,
  right,
  destructive,
  center,
  tinted,
  badge,
  disabled,
  left,
  tall,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  art?: string | null;
  artSize?: number;
  chevron?: boolean;
  checked?: boolean;
  onClick?: () => void;
  right?: ReactNode;
  destructive?: boolean;
  center?: boolean;
  tinted?: boolean;
  badge?: boolean;
  disabled?: boolean;
  left?: ReactNode;
  tall?: boolean;
  className?: string;
}) {
  const tint = useTint();
  const titleText = typeof title === 'string' ? t(title) : title;
  return (
    <div
      className={`n7-row ${onClick && !disabled ? 'n7-tap' : ''} ${subtitle ? 'n7-row-2' : ''} ${tall ? 'n7-row-tall' : ''} ${disabled ? 'n7-disabled' : ''} ${className ?? ''}`}
      onClick={disabled ? undefined : onClick}
      style={art !== undefined ? ({ ['--sep' as string]: `${artSize + 18}px` } as CSSProperties) : icon ? ({ ['--sep' as string]: '40px' } as CSSProperties) : undefined}
    >
      {badge !== undefined && <span className="n7-badge" style={{ opacity: badge ? 1 : 0 }} />}
      {left}
      {icon && <div className="n7-row-icon" style={{ color: tint }}>{icon}</div>}
      {art !== undefined && <Artwork src={art ?? undefined} size={artSize} radius={2} />}
      <div className="n7-row-text" style={center ? { textAlign: 'center' } : undefined}>
        <div className="n7-row-title" style={destructive ? { color: '#ff3b30' } : tinted ? { color: tint } : undefined}>
          {titleText}
        </div>
        {subtitle && <div className="n7-row-sub">{subtitle}</div>}
      </div>
      {detail !== undefined && <div className="n7-row-detail">{detail}</div>}
      {right}
      {checked && (
        <svg width="13" height="11" viewBox="0 0 13 11" style={{ flex: 'none', marginLeft: 6 }}>
          <path d="M1.5 6 5 9.5 11.5 1.5" fill="none" stroke={tint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {chevron && (
        <span className="n7-row-chev">
          <Chevron dir="right" size={11} color="#c7c7cc" weight={2.4} />
        </span>
      )}
    </div>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className={`n7-switch ${on ? 'on' : ''}`}
      data-noswipe
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
    >
      <div className="n7-switch-knob" />
    </div>
  );
}

/** iOS 7 slider: thin track, white knob. value 0..1 */
export function Slider({
  value,
  onChange,
  onEnd,
  min,
  max,
  className,
  color,
  knob = 18,
  style,
}: {
  value: number;
  onChange: (v: number) => void;
  onEnd?: (v: number) => void;
  min?: ReactNode;
  max?: ReactNode;
  className?: string;
  color?: string;
  knob?: number;
  style?: CSSProperties;
}) {
  const tint = useTint();
  const track = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const toValue = (lx: number) => {
    const w = track.current?.offsetWidth ?? 100;
    return clamp((lx - knob / 2) / Math.max(1, w - knob), 0, 1);
  };
  const handlers = useDrag({
    axis: 'x',
    immediate: true,
    onStart: (d) => {
      last.current = toValue(d.lx);
      onChange(last.current);
    },
    onMove: (d) => {
      last.current = toValue(d.lx);
      onChange(last.current);
    },
    onEnd: () => onEnd?.(last.current),
  });
  const v = clamp(value, 0, 1);
  return (
    <div className={`n7-slider ${className ?? ''}`} data-noswipe style={style}>
      {min && <span className="n7-slider-cap">{min}</span>}
      <div className="n7-slider-track" ref={track} {...handlers} style={{ ['--k' as string]: `${knob}px` } as CSSProperties}>
        <div className="n7-slider-rail" />
        <div className="n7-slider-fill" style={{ width: `calc(${knob / 2}px + (100% - ${knob}px) * ${v})`, background: color ?? tint }} />
        <div className="n7-slider-knob" style={{ left: `calc((100% - ${knob}px) * ${v})`, width: knob, height: knob }} />
      </div>
      {max && <span className="n7-slider-cap">{max}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const tint = useTint();
  return (
    <div className="n7-seg" style={{ borderColor: tint }}>
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? 'on' : ''}
          style={o.value === value ? { background: tint, color: '#fff' } : { color: tint, borderColor: tint }}
          onClick={() => onChange(o.value)}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, text }: { icon?: ReactNode; title: string; text?: string }) {
  return (
    <div className="n7-empty">
      {icon && <div className="n7-empty-icon">{icon}</div>}
      <div className="n7-empty-title">{t(title)}</div>
      {text && <div className="n7-empty-text">{text}</div>}
    </div>
  );
}

export function PillButton({ children, onClick, color, textColor, style, disabled }: { children: ReactNode; onClick?: () => void; color?: string; textColor?: string; style?: CSSProperties; disabled?: boolean }) {
  return (
    <button className="n7-pill" disabled={disabled} onClick={onClick} style={{ background: color, color: textColor, ...style }}>
      {children}
    </button>
  );
}

/** Row with artwork for a track (title + artist — album). */
export function trackSubtitle(artist?: string, album?: string): string {
  return [artist, album].filter(Boolean).join(' — ');
}
