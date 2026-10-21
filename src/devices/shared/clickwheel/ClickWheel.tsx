import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playClick } from '../../../core/sound/click';
import type { WheelBus, WheelButton } from './bus';

/** Degrees of rotation per scroll step (≈ 24 steps per full turn, like the real wheel). */
export const STEP_DEG = 15;

export interface ClickWheelProps {
  bus: WheelBus;
  /** outer diameter, px */
  size: number;
  /** center button diameter, px */
  centerSize: number;
  wheelColor: string;
  labelColor: string;
  centerColor: string;
  /** subtle finish of the wheel surface */
  finish?: 'matte' | 'gloss';
  /** play the clicker sound on steps/presses (default true) */
  clicker?: boolean;
  /** label font for MENU (mini/nano used a different weight) */
  labelFont?: string;
  style?: CSSProperties;
  className?: string;
}

function zoneOf(angleDeg: number): Exclude<WheelButton, 'select'> {
  // angle: 0 = right, 90 = down (screen coords)
  const a = ((angleDeg % 360) + 360) % 360;
  if (a >= 45 && a < 135) return 'play';
  if (a >= 135 && a < 225) return 'prev';
  if (a >= 225 && a < 315) return 'menu';
  return 'next';
}

function shade(hex: string, amt: number): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const f = (h: string) => Math.max(0, Math.min(255, Math.round(parseInt(h, 16) + amt * 255)));
  return `rgb(${f(m[1])}, ${f(m[2])}, ${f(m[3])})`;
}

/** Relative luminance 0..1 of a #rrggbb color. */
export function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0.5;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The Click Wheel. Touch-sensitive ring + five mechanical buttons.
 *
 * - drag around the ring → scroll steps (clockwise = +1)
 * - tap/click a zone → button press (hold for 600 ms → hold/repeat)
 * - mouse wheel / trackpad over it → scroll steps
 */
export function ClickWheel({
  bus,
  size,
  centerSize,
  wheelColor,
  labelColor,
  centerColor,
  finish = 'matte',
  clicker = true,
  labelFont,
  style,
  className,
}: ClickWheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState<WheelButton | null>(null);
  const g = useRef({
    active: false,
    pointerId: -1,
    zone: null as WheelButton | null,
    lastAngle: 0,
    total: 0,
    acc: 0,
    scrolling: false,
    stepTimes: [] as number[],
    wheelAcc: 0,
  });

  const center = () => {
    const r = ref.current!.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, radius: r.width / 2 };
  };

  const velocity = () => {
    const now = performance.now();
    const ts = g.current.stepTimes.filter((t) => now - t < 500);
    g.current.stepTimes = ts;
    return ts.length * 2; // steps per second over the last half second
  };

  const emitSteps = (n: number) => {
    for (let i = 0; i < Math.abs(n); i++) g.current.stepTimes.push(performance.now());
    if (clicker) playClick();
    bus.scroll(n, velocity());
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.shiftKey || e.altKey) return;
    e.stopPropagation();
    const { cx, cy, radius } = center();
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy) / radius;
    if (dist > 1.02) return;
    ref.current!.setPointerCapture(e.pointerId);
    const s = g.current;
    s.active = true;
    s.pointerId = e.pointerId;
    s.total = 0;
    s.acc = 0;
    s.scrolling = false;
    s.lastAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const inner = centerSize / size;
    const zone: WheelButton = dist < inner ? 'select' : zoneOf(s.lastAngle);
    s.zone = zone;
    bus.emit({ type: 'touch', active: true });
    bus.down(zone);
    setPressed(zone);
    if (clicker) playClick(0.25);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    const { cx, cy, radius } = center();
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    if (Math.hypot(dx, dy) < radius * 0.15) return; // too close to the middle to read an angle
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    let d = a - s.lastAngle;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    s.lastAngle = a;
    s.total += d;
    if (!s.scrolling && Math.abs(s.total) > 9 && s.zone !== 'select') {
      // it was a swipe, not a press
      s.scrolling = true;
      bus.cancel(s.zone!);
      setPressed(null);
      s.acc = s.total;
    } else if (s.scrolling) {
      s.acc += d;
    }
    if (s.scrolling) {
      while (Math.abs(s.acc) >= STEP_DEG) {
        const dir = Math.sign(s.acc);
        s.acc -= dir * STEP_DEG;
        emitSteps(dir);
      }
    }
  };

  const end = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    s.active = false;
    if (!s.scrolling && s.zone) bus.up(s.zone);
    s.zone = null;
    setPressed(null);
    bus.emit({ type: 'touch', active: false });
  };

  // Non-passive wheel listener so the page doesn't scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const s = g.current;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      s.wheelAcc += (e.deltaY + e.deltaX) * unit;
      const STEP = 32;
      while (Math.abs(s.wheelAcc) >= STEP) {
        const dir = Math.sign(s.wheelAcc);
        s.wheelAcc -= dir * STEP;
        emitSteps(dir);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, clicker]);

  const dark = luminance(wheelColor) < 0.35;
  const ring =
    finish === 'gloss'
      ? `radial-gradient(circle at 50% 30%, ${shade(wheelColor, 0.06)} 0%, ${wheelColor} 55%, ${shade(wheelColor, -0.05)} 100%)`
      : `radial-gradient(circle at 50% 40%, ${shade(wheelColor, 0.02)} 0%, ${wheelColor} 60%, ${shade(wheelColor, -0.03)} 100%)`;
  const pressShade = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const pressAngle: Record<string, number> = { menu: 0, next: 90, play: 180, prev: 270 };
  const icon = Math.round(size * 0.075);

  return (
    <div
      ref={ref}
      data-control=""
      className={`clickwheel ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        background: ring,
        boxShadow: dark
          ? `inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.35)`
          : `inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.10)`,
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {pressed && pressed !== 'select' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(from ${pressAngle[pressed] - 45}deg, ${pressShade} 0deg 90deg, transparent 90deg 360deg)`,
            pointerEvents: 'none',
          }}
        />
      )}
      {/* labels */}
      <div
        style={{
          position: 'absolute',
          top: size * 0.085,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: labelColor,
          font: labelFont ?? `700 ${Math.round(size * 0.062)}px/1 "Helvetica Neue", Helvetica, Arial, sans-serif`,
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}
      >
        MENU
      </div>
      <WheelIcon kind="prev" color={labelColor} size={icon} style={{ left: size * 0.075, top: size / 2 - icon / 2 }} />
      <WheelIcon kind="next" color={labelColor} size={icon} style={{ right: size * 0.075, top: size / 2 - icon / 2 }} />
      <WheelIcon kind="play" color={labelColor} size={icon} style={{ bottom: size * 0.085, left: size / 2 - icon }} />
      {/* center button */}
      <div
        style={{
          position: 'absolute',
          width: centerSize,
          height: centerSize,
          left: (size - centerSize) / 2,
          top: (size - centerSize) / 2,
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 35%, ${shade(centerColor, 0.03)} 0%, ${centerColor} 60%, ${shade(centerColor, -0.04)} 100%)`,
          boxShadow:
            pressed === 'select'
              ? `inset 0 2px 4px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,${dark ? 0.5 : 0.14})`
              : `inset 0 1px 0 rgba(255,255,255,${dark ? 0.08 : 0.7}), inset 0 -1px 1px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,${dark ? 0.5 : 0.14}), 0 1px 1px rgba(255,255,255,${dark ? 0.04 : 0.6})`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function WheelIcon({ kind, color, size, style }: { kind: 'prev' | 'next' | 'play'; color: string; size: number; style: CSSProperties }) {
  const common: CSSProperties = { position: 'absolute', pointerEvents: 'none', ...style };
  if (kind === 'play') {
    return (
      <svg width={size * 2} height={size} viewBox="0 0 24 12" style={common}>
        <path d="M2 1.2v9.6l7.4-4.8z" fill={color} />
        <rect x="13.2" y="1.2" width="2.7" height="9.6" fill={color} />
        <rect x="18.1" y="1.2" width="2.7" height="9.6" fill={color} />
      </svg>
    );
  }
  const d =
    kind === 'next'
      ? 'M0.5 1.2v9.6l5-4.8zM5.8 1.2v9.6l5-4.8z M11 1.2h1.7v9.6H11z'
      : 'M11.5 1.2v9.6l-5-4.8zM6.2 1.2v9.6l-5-4.8z M-0.7 1.2h1.7v9.6h-1.7z';
  return (
    <svg width={size * 1.15} height={size} viewBox="-1 0 14 12" style={common}>
      <path d={d} fill={color} />
    </svg>
  );
}
