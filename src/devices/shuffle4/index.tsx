import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Box3D, Device3D, type CornerRadii, type EdgeSlice } from '../../shell/Device3D';
import { isTypingTarget } from '../../shell/keyboard';
import { usePlaylists } from '../../core/library/selectors';
import { useSettings } from '../../core/settings/store';
import { useBattery } from '../../core/util/hooks';
import type { DeviceProps } from '../types';
import { ShuffleBrain, useS4, type SwitchPos, type Zone } from './brain';
import './shuffle4.css';

/*
 * iPod shuffle (4th generation, 2010 / 2015 colours).
 * 29.0 × 31.6 mm, 8.7 mm deep including the clip — 10 px per mm.
 *
 * The assembly is centred in z: the aluminium body (5.6 mm) sits in front,
 * the spring clip (0.9 mm plate, 2.2 mm gap) behind it.
 */
const BODY_D = 56;
const GAP = 22;
const CLIP_T = 9;
const RADIUS = 26;
const TOTAL_D = BODY_D + GAP + CLIP_T; // 87
/** body centre, relative to the assembly centre */
const BODY_CZ = TOTAL_D / 2 - BODY_D / 2;
/** clip plate centre, relative to the body centre */
const CLIP_CZ = -(BODY_D / 2 + GAP + CLIP_T / 2);
const CLIP_W = 262;
const CLIP_H = 282;
/** the clip's corners: tighter at the hinge (top), wider and slightly oval at the bottom */
const CLIP_RADIUS: CornerRadii = { x: [18, 18, 30, 30], y: [18, 18, 26, 26] };
/** the clip pivots 1.6 mm below the top edge */
const HINGE_DROP = 16;

// top edge layout (x from the centre, as seen from the front)
const JACK_X = -92;
const LED_X = -55;
const VO_X = 8;
const SWITCH_X = 86;
const SWITCH_LEN = 70;
/** knob offsets for OFF / in order / shuffle */
const KNOB_OFF = [22, 0, -22];

const KEYMAP: Record<string, Zone> = {
  ' ': 'center',
  Spacebar: 'center',
  ArrowLeft: 'prev',
  ArrowRight: 'next',
  ArrowUp: 'up',
  ArrowDown: 'down',
  v: 'vo',
  V: 'vo',
};

export default function IpodShuffle({ model, appearance }: DeviceProps) {
  const { width: W, height: H } = model.size;
  const colors = appearance.colors;
  const body = colors.body ?? '#d5d7d9';
  const pad = colors.pad ?? '#f3f3f4';
  const symbols = colors.symbols ?? '#8a8b8f';

  // Live data the firmware reads.
  const battery = useBattery();
  const batteryRef = useRef(battery);
  batteryRef.current = battery;
  const playlists = usePlaylists();
  const playlistsRef = useRef(playlists);
  playlistsRef.current = playlists;

  const rootRef = useRef<HTMLDivElement>(null);
  const brainRef = useRef<ShuffleBrain | null>(null);
  useEffect(() => {
    const b = new ShuffleBrain({
      modelId: model.id,
      battery: () => batteryRef.current,
      playlists: () => playlistsRef.current,
    });
    brainRef.current = b;
    return () => {
      b.dispose();
      brainRef.current = null;
    };
  }, [model.id]);

  const power = useSettings((s) => s.device[model.id]?.power) !== false;
  const shuffle = useSettings((s) => s.shuffle);
  const switchPos: SwitchPos = !power ? 0 : shuffle === 'off' ? 1 : 2;
  const led = useS4((s) => s.led);
  const pressed = useS4((s) => s.pressed);

  // Keyboard: Space = center, ←/→ = previous/next, ↑/↓ = volume, V = VoiceOver, S = switch.
  useEffect(() => {
    const ok = (e: KeyboardEvent) => !(isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey);
    const down = (e: KeyboardEvent) => {
      if (!ok(e)) return;
      const b = brainRef.current;
      if (!b) return;
      if (e.key === 's' || e.key === 'S') {
        if (!e.repeat) b.cycleSwitch();
        return;
      }
      const z = KEYMAP[e.key];
      if (!z) return;
      e.preventDefault();
      if (!e.repeat) b.down(z);
    };
    const up = (e: KeyboardEvent) => {
      const z = KEYMAP[e.key];
      if (!z) return;
      if (ok(e)) e.preventDefault();
      brainRef.current?.up(z);
    };
    const blur = () => brainRef.current?.releaseAll();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const zone = (z: Zone): ZoneProps => ({
    'data-control': '',
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || e.shiftKey || e.altKey) return;
      e.preventDefault();
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      brainRef.current?.down(z);
    },
    onPointerUp: () => brainRef.current?.up(z),
    onPointerCancel: () => brainRef.current?.up(z),
    onLostPointerCapture: () => brainRef.current?.up(z),
  });

  // The spring clip opens when you click it (and snaps shut again).
  const [clipOpen, setClipOpen] = useState(false);
  const clipDown = useRef<{ x: number; y: number; t: number } | null>(null);
  useEffect(() => {
    const up = (e: PointerEvent) => {
      const d = clipDown.current;
      clipDown.current = null;
      if (!d) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5 && performance.now() - d.t < 450) setClipOpen(true);
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);
  useEffect(() => {
    if (!clipOpen) return;
    const t = window.setTimeout(() => setClipOpen(false), 2200);
    return () => window.clearTimeout(t);
  }, [clipOpen]);

  const padPress = (['center', 'next', 'prev', 'up', 'down'] as Zone[]).find((z) => pressed[z]);

  const vars = {
    '--s4-body': body,
    '--s4-pad': pad,
    '--s4-sym': symbols,
  } as CSSProperties;

  return (
    <div ref={rootRef} className={`s4 ${power ? 's4-on' : 's4-off'}`} style={{ width: W, height: H, ...vars }}>
      <div className="s4-asm" style={{ transform: `translateZ(${BODY_CZ}px)` }}>
        {/*
         * The flat parts on the top edge are painted BEFORE the body. Chrome
         * depth-sorts a 3D scene with a BSP tree built in paint order: as the
         * first planes, they split nothing (the body's sides lie entirely
         * below them). Painted after the body, each of them would be cut
         * along the planes of the sides, leaving hairline seams across the
         * VoiceOver button and the switch.
         */}
        <TopEdge H={H} switchPos={switchPos} led={led} voDown={!!pressed.vo} zone={zone} brain={brainRef} />
        <Device3D
          width={W}
          height={H}
          depth={BODY_D}
          radius={RADIUS}
          breaks={BODY_BREAKS}
          frontInset={BODY_FACE_INSET}
          backInset={BODY_FACE_INSET}
          edge={bodyEdge}
          front={<Front press={padPress} zone={zone} />}
          back={<UnderClip />}
        >
          <SwitchKnob H={H} switchPos={switchPos} />
          <LedGlow H={H} color={led} />
          <Clip
            H={H}
            open={clipOpen}
            engraving={appearance.engraving}
            onDown={(e) => {
              if (e.button === 0) clipDown.current = { x: e.clientX, y: e.clientY, t: performance.now() };
            }}
          />
        </Device3D>
      </div>
      <CaptionBubble device={rootRef} />
    </div>
  );
}

// ---------------------------------------------------------------- body

/**
 * The front and back are flat where the rounded edge meets them. (Wider
 * faces would overhang the rounding, their rims sticking out at the corners.)
 * Content on the faces that is placed in px from their edge is offset by
 * this in shuffle4.css.
 */
const BODY_FACE_INSET = 6;
/** where bodyEdge's darker rim line starts and ends, from the front and from the back */
const BODY_BREAKS = [5.5, 8.6].flatMap((d) => [d / BODY_D, 1 - d / BODY_D]);

/** Slightly rounded front/back edges (r ≈ 0.6 mm) with a polished catch-light. */
function bodyEdge(t: number): EdgeSlice {
  const r = BODY_FACE_INSET;
  const d = Math.min(t, 1 - t) * BODY_D;
  const inset = d < r ? r - Math.sqrt(r * r - (r - d) * (r - d)) : 0;
  const shine = d < r ? Math.round((1 - d / r) * 30) : 0;
  const nearFront = t < 0.5;
  // Where the rounded edge turns into the flat wall the surface faces away
  // from the camera: a slightly darker line. Seen face-on this is the outer
  // rim of the silhouette, which keeps light finishes defined on white.
  const rim = d >= r - 0.5 && d < r + 2.6;
  const top = rim ? `color-mix(in srgb, var(--s4-body) 84%, #000)` : `color-mix(in srgb, var(--s4-body) ${82 - shine}%, #fff)`;
  return {
    inset,
    color: [
      // the side turned towards the light is brighter
      `linear-gradient(90deg, rgba(0,0,0,calc(0.2 - var(--elx, 0) * 0.2)), rgba(0,0,0,0) 14%, rgba(0,0,0,0) 86%, rgba(0,0,0,calc(0.2 + var(--elx, 0) * 0.2)))`,
      `linear-gradient(180deg, ${top} 0%, color-mix(in srgb, var(--s4-body) ${nearFront ? 94 : 90}%, #000) 46%, color-mix(in srgb, var(--s4-body) ${rim ? 70 : 76 + shine / 2}%, #000) 100%)`,
    ].join(', '),
  };
}

/** Pointer handlers that turn an element into one of the shuffle's buttons. */
interface ZoneProps {
  'data-control': string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onLostPointerCapture: () => void;
}

function Front({ press, zone }: { press: Zone | undefined; zone: (z: Zone) => ZoneProps }) {
  return (
    <div className="s4-face s4-anod s4-front">
      <div className="s4-grain" />
      <div className="s4-sheen" />
      <div className="s4-well">
        <div className={`s4-pad${press ? ` is-${press}` : ''}`}>
          <PadSymbols press={press} />
          <div className="s4-pad-shade" />
          <div className="s4-hit s4-hit-up" {...zone('up')} title="Volume Up" />
          <div className="s4-hit s4-hit-down" {...zone('down')} title="Volume Down" />
          <div className="s4-hit s4-hit-prev" {...zone('prev')} title="Previous / Rewind" />
          <div className="s4-hit s4-hit-next" {...zone('next')} title="Next / Fast-forward" />
          <div className="s4-hit s4-hit-center" {...zone('center')} title="Play/Pause" />
        </div>
      </div>
    </div>
  );
}

/** The five symbols, drawn on a 196 px pad. */
function PadSymbols({ press }: { press: Zone | undefined }) {
  const cls = (z: Zone) => `s4-sym${press === z ? ' is-pressed' : ''}`;
  return (
    <svg className="s4-syms" viewBox="0 0 196 196" width="196" height="196" aria-hidden>
      <g className={cls('up')}>
        <rect x="89" y="28.6" width="18" height="2.8" rx="0.5" />
        <rect x="96.6" y="21" width="2.8" height="18" rx="0.5" />
      </g>
      <g className={cls('down')}>
        <rect x="89" y="164.6" width="18" height="2.8" rx="0.5" />
      </g>
      <g className={cls('prev')}>
        <rect x="19" y="92" width="2.6" height="12" rx="0.4" />
        <path d="M21.6 98 L31.6 92 V104 Z M31.6 98 L41.6 92 V104 Z" />
      </g>
      <g className={cls('next')}>
        <rect x="174.4" y="92" width="2.6" height="12" rx="0.4" />
        <path d="M174.4 98 L164.4 92 V104 Z M164.4 98 L154.4 92 V104 Z" />
      </g>
      <g className={cls('center')}>
        <path d="M86.5 91.6 L97 98 L86.5 104.4 Z" />
        <rect x="99.8" y="91.6" width="2.9" height="12.8" rx="0.3" />
        <rect x="105.3" y="91.6" width="2.9" height="12.8" rx="0.3" />
      </g>
    </svg>
  );
}

const APPLE_PATH =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';

/** The back of the body, hidden under the clip: Apple logo and the small print. */
function UnderClip() {
  return (
    <div className="s4-face s4-anod s4-back">
      <div className="s4-grain" />
      <div className="s4-clipshadow" />
      <div className="s4-print">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path d={APPLE_PATH} />
        </svg>
        <div className="s4-print-name">iPod shuffle</div>
        <div>Designed by Apple in California · Assembled in China</div>
        <div>Model No.: A1373 · EMC No.: 2393 · 2GB</div>
        <div className="s4-print-marks">
          <span>CE</span>
          <span>FC</span>
          <span className="s4-bin">⌧</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- top edge

/** A flat element lying on the top surface; local +y points to the front. */
function OnTop({
  H,
  x,
  z = 0,
  w,
  d,
  lift = 2.4,
  className,
  style,
  children,
  ...rest
}: {
  H: number;
  x: number;
  z?: number;
  w: number;
  d: number;
  lift?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Partial<ZoneProps> & { title?: string; onClick?: () => void }) {
  return (
    <div className="s4-ontop" style={{ transform: `translate3d(${x}px, ${-H / 2 - lift}px, ${z}px) rotateX(90deg)` }}>
      <div className={className} style={{ width: w, height: d, marginLeft: -w / 2, marginTop: -d / 2, ...style }} {...rest}>
        {children}
      </div>
    </div>
  );
}

function TopEdge({
  H,
  switchPos,
  led,
  voDown,
  zone,
  brain,
}: {
  H: number;
  switchPos: SwitchPos;
  led: string;
  voDown: boolean;
  zone: (z: Zone) => ZoneProps;
  brain: React.RefObject<ShuffleBrain | null>;
}) {
  return (
    <>
      {/* headphone port */}
      <OnTop H={H} x={JACK_X} w={44} d={44} className="s4-jack">
        <i className="s4-jack-bore">
          <b />
        </i>
      </OnTop>
      {/* status light */}
      <OnTop H={H} x={LED_X} w={30} d={30} lift={2.2} className={`s4-spill s4-spill-${led}`} />
      <OnTop H={H} x={LED_X} w={8} d={8} lift={2.6} className={`s4-led s4-led-${led}`} />
      {/* VoiceOver button: a nearly flush pill in a pill-shaped opening */}
      <OnTop H={H} x={VO_X} w={62} d={25} className={`s4-vo${voDown ? ' is-down' : ''}`}>
        <div className="s4-vo-cap" />
      </OnTop>
      <OnTop H={H} x={VO_X} w={84} d={46} lift={7} className="s4-hitpad" title="VoiceOver" {...zone('vo')} />
      {/* three-way switch: OFF · play in order · shuffle */}
      <OnTop H={H} x={SWITCH_X} w={SWITCH_LEN} d={18} className={`s4-slot s4-slot-${switchPos}`}>
        <div className="s4-green" />
      </OnTop>
      {[0, 1, 2].map((p) => (
        <OnTop
          key={p}
          H={H}
          x={SWITCH_X + KNOB_OFF[p]}
          w={23}
          d={46}
          lift={8}
          className="s4-hitpad"
          title={['Off', 'Play in order', 'Shuffle'][p]}
          data-control=""
          onPointerDown={(e: React.PointerEvent) => {
            if (e.button !== 0 || e.shiftKey || e.altKey) return;
            e.preventDefault();
            const b = brain.current;
            if (!b) return;
            if (p === switchPos) b.cycleSwitch();
            else b.setSwitch(p as SwitchPos);
          }}
        />
      ))}
    </>
  );
}

/** The knurled slider of the three-way switch, standing just proud of the top edge. */
function SwitchKnob({ H, switchPos }: { H: number; switchPos: SwitchPos }) {
  return (
    <Box3D
      x={SWITCH_X + KNOB_OFF[switchPos]}
      y={-H / 2 + 0.8}
      w={24}
      h={10}
      d={13}
      radius={2.5}
      color="color-mix(in srgb, var(--s4-body) 80%, #000)"
      faces={{ top: 'var(--s4-knob-top)' }}
      className="s4-knob s4-nohit"
    />
  );
}

/** Light bloom around the status light, always facing the viewer. */
function LedGlow({ H, color }: { H: number; color: string }) {
  return (
    <div className="s4-billboard" style={{ ['--bx' as string]: `${LED_X}px`, ['--by' as string]: `${-H / 2 - 15}px`, ['--bz' as string]: '0px' }}>
      <div className={`s4-glow s4-glow-${color}`} />
    </div>
  );
}

// ---------------------------------------------------------------- clip

function clipEdge(t: number): EdgeSlice {
  // diamond-cut, polished edges on the outside of the clip
  const outer = t > 0.5;
  return {
    inset: outer ? (t - 0.5) * 2.4 : 0,
    color: outer
      ? `linear-gradient(180deg, color-mix(in srgb, var(--s4-body) 45%, #fff), color-mix(in srgb, var(--s4-body) 60%, #fff) 50%, color-mix(in srgb, var(--s4-body) 70%, #444))`
      : `color-mix(in srgb, var(--s4-body) 78%, #000)`,
  };
}

function Clip({
  H,
  open,
  engraving,
  onDown,
}: {
  H: number;
  open: boolean;
  engraving: [string, string];
  onDown: (e: React.PointerEvent) => void;
}) {
  const hingeY = -H / 2 + HINGE_DROP;
  const lines = engraving.filter((l) => l && l.trim());
  return (
    <>
      {/* the bent-over top of the clip that anchors it in the body */}
      <Box3D
        x={0}
        y={-H / 2 + 14}
        z={-(BODY_D / 2 + GAP / 2)}
        w={CLIP_W - 40}
        h={28}
        d={GAP + 2}
        radius={3}
        color="color-mix(in srgb, var(--s4-body) 55%, #000)"
        faces={{
          // the rounded bend where the clip turns into the body
          top: 'linear-gradient(0deg, color-mix(in srgb, var(--s4-body) 55%, #000), color-mix(in srgb, var(--s4-body) 62%, #fff) 45%, color-mix(in srgb, var(--s4-body) 80%, #fff) 60%, color-mix(in srgb, var(--s4-body) 60%, #000))',
        }}
        className="s4-nohit"
      />
      <div className={`s4-clipgroup${open ? ' is-open' : ''}`} style={{ transform: `translate3d(0px, ${hingeY}px, ${CLIP_CZ}px) rotateX(${open ? -17 : 0}deg)` }}>
        <div className="s4-clipplate" style={{ left: -CLIP_W / 2, top: -HINGE_DROP, width: CLIP_W, height: CLIP_H }}>
          <Device3D
            width={CLIP_W}
            height={CLIP_H}
            depth={CLIP_T}
            radius={CLIP_RADIUS}
            edge={clipEdge}
            breaks={[0.5]}
            backInset={1.2}
            front={<div className="s4-face s4-clip-in" />}
            back={
              <div className="s4-face s4-anod s4-clip-out" onPointerDown={onDown}>
                <div className="s4-grain" />
                <div className="s4-sheen" />
                {lines.length > 0 && (
                  <div className="s4-engraving">
                    {lines.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                )}
              </div>
            }
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- VoiceOver caption

/** Faces whose projected bounds approximate the iPod on screen. */
const OUTLINE_FACES = '.s4-front, .s4-back, .s4-clip-out';
/** Keep clear of the floating top bar. */
const CAPTION_MIN_TOP = 76;

/**
 * What VoiceOver is saying, as a Liquid Glass capsule floating above the
 * iPod. It lives in screen space (portalled into the stage, outside the 3D
 * scene) so it never intersects or gets depth-sorted with the device, its
 * backdrop blur works, and it stays readable from any angle. Each frame
 * while it is visible it follows the device's projected top edge.
 */
function CaptionBubble({ device }: { device: React.RefObject<HTMLDivElement | null> }) {
  const caption = useS4((s) => s.caption);
  const menu = useS4((s) => s.menu);
  const [shown, setShown] = useState(caption);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const on = !!caption;

  useEffect(() => {
    if (caption) setShown(caption);
  }, [caption]);

  useLayoutEffect(() => {
    setHost(device.current?.closest<HTMLElement>('.stage') ?? document.body);
  }, [device]);

  useLayoutEffect(() => {
    if (!host || !shown) return;
    // follow the iPod while visible, and through the fade-out
    const until = on ? Infinity : performance.now() + 450;
    let raf = 0;
    const place = () => {
      const box = boxRef.current;
      const root = device.current;
      if (box && root) {
        let top = Infinity;
        let left = Infinity;
        let right = -Infinity;
        root.querySelectorAll(OUTLINE_FACES).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width && !r.height) return;
          top = Math.min(top, r.top);
          left = Math.min(left, r.left);
          right = Math.max(right, r.right);
        });
        if (top !== Infinity) {
          const hr = host.getBoundingClientRect();
          const w = box.offsetWidth;
          const h = box.offsetHeight;
          const cx = Math.max(w / 2 + 12, Math.min(hr.width - w / 2 - 12, (left + right) / 2 - hr.left));
          const y = Math.max(CAPTION_MIN_TOP + h, top - hr.top - 14);
          box.style.transform = `translate3d(${(cx - w / 2).toFixed(1)}px, ${(y - h).toFixed(1)}px, 0)`;
        }
      }
      if (performance.now() < until) raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [host, shown, on, device]);

  if (!host) return null;
  return createPortal(
    <div ref={boxRef} className={`s4-cap${on ? ' is-on' : ''}`} role="status" aria-live="polite">
      {shown && (
        <>
          <div className="s4-cap-pill">
            <span className="s4-cap-icon" aria-hidden>
              <svg viewBox="0 0 20 20" width="16" height="16">
                <path className="s4-cap-spk" d="M2.8 7.4h2.9l4-3.4v12l-4-3.4H2.8a.8.8 0 0 1-.8-.8V8.2c0-.4.4-.8.8-.8z" />
                <path className="s4-cap-w1" d="M12.6 7.2a4 4 0 0 1 0 5.6" />
                <path className="s4-cap-w2" d="M15 4.9a7.3 7.3 0 0 1 0 10.2" />
              </svg>
            </span>
            <span className="s4-cap-text">
              <span className="s4-cap-main">{shown.text}</span>
              {shown.hint && <span className="s4-cap-hint">{shown.hint}</span>}
            </span>
          </div>
          {menu && <div className="s4-cap-keys">Next / Previous to browse · Play or VoiceOver to choose</div>}
        </>
      )}
    </div>,
    host,
  );
}
