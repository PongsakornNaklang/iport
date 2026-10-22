/**
 * A Click Wheel iPod with a stainless steel back: the iPod classic and the
 * 5th generation iPod (Video) share it. What differs between them is in
 * `ClickWheelSpec`: the front (anodized aluminium or glossy plastic), how
 * much of the edge the front covers, where the headphone jack is, what
 * the back says and what the software can do.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Box3D, Device3D, type EdgeSlice } from '../../shell/Device3D';
import { BodyExtras } from '../../shell/bodySlot';
import { Decals } from '../../shell/decals/Decals';
import { isTypingTarget } from '../../shell/keyboard';
import { useSettings } from '../../core/settings/store';
import { ClickWheel } from '../shared/clickwheel/ClickWheel';
import { WheelBus } from '../shared/clickwheel/bus';
import { useWheelKeyboard } from '../shared/clickwheel/useWheelKeyboard';
import type { DeviceProps } from '../types';
import { ClickWheelOS } from './os/ClickWheelOS';
import type { DeviceInfo, OSCaps, ThemeName } from './os/core';
import { ClassicBack } from './Back';
import { luminance, shade } from './color';
import './hardware.css';

export interface ClickWheelSpec {
  /** About screen and back print, by finish */
  info(finishId: string | undefined): DeviceInfo;
  /** the front: anodized aluminium (classic) or glossy polycarbonate (5th generation) */
  finish: 'aluminium' | 'gloss';
  /** share of the thickness the front covers on the edge */
  frontT: number;
  /** the headphone jack: which edge, and x from the centre (px) */
  jack: { side: 'top' | 'bottom'; x: number };
  /** Hold switch x from the centre (px), on the top edge */
  holdX: number;
  /** model number on the back ("A1238", and anything after it on that line) */
  modelNo: string;
  caps?: Partial<OSCaps>;
}

const RADIUS = 42;
const WINDOW = { w: 336, h: 256, top: 38 };
const LCD = { w: 320, h: 240 };
const WHEEL = { size: 236, center: 92, cy: 471 };
const SEAM_T = 0.03;
/** how far the steel back curves in at the back face */
const CURVE = 15;

function steelInset(u: number): number {
  const x = Math.min(0.97, u);
  return CURVE * (1 - Math.sqrt(1 - x * x));
}

/** Mirror steel seen at the angle of slice `u` (0 = side, 1 = facing back). */
function steelColor(u: number, material: string, back: string): string {
  // brightness of what the curved mirror reflects: sky → horizon (dark) → floor
  const stops: [number, number][] = [
    [0, 0.88],
    [0.14, 0.98],
    [0.3, 0.84],
    [0.46, 0.56],
    [0.58, 0.64],
    [0.74, 0.9],
    [0.88, 0.98],
    [1, 0.86],
  ];
  let l = stops[stops.length - 1][1];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const [a, la] = stops[i - 1];
      const [b, lb] = stops[i];
      l = la + ((lb - la) * (u - a)) / (b - a);
      break;
    }
  }
  if (material === 'matte') l = 0.72 + (l - 0.62) * 0.3;
  if (material === 'painted') {
    const base = shade(back, (l - 0.65) * 0.35);
    return `linear-gradient(90deg, ${shade(back, -0.12)}, ${base} 30%, ${base} 70%, ${shade(back, -0.14)})`;
  }
  const v = Math.round(64 + l * 188);
  const c = `rgb(${v - 4}, ${v - 2}, ${Math.min(255, v + 2)})`;
  // the left/right flanks of each slice face sideways: a touch darker, never black
  const dk = `rgb(${Math.round(v * 0.84)}, ${Math.round(v * 0.85)}, ${Math.round(v * 0.88)})`;
  return `linear-gradient(90deg, ${dk} 0%, ${c} 14%, ${c} 86%, ${dk} 100%)`;
}

export function ClickWheelIpod({ model, appearance, spec }: DeviceProps & { spec: ClickWheelSpec }) {
  const FRONT_T = spec.frontT;
  const gloss = spec.finish === 'gloss';
  const { width: W, height: H, depth: D } = model.size;
  const colors = appearance.colors;
  const front = colors.front ?? '#d5d6d8';
  const backColor = colors.back ?? '#c9cbce';
  const material = String(appearance.options.backMaterial ?? 'chrome');
  const theme = (String(appearance.options.theme ?? 'classic') as ThemeName) || 'classic';
  const bus = useMemo(() => new WheelBus(), []);
  const [hold, setHold] = useState(false);
  const clicker = useSettings((s) => s.clicker) !== 'off';
  useWheelKeyboard(bus, true, clicker);

  // H toggles the Hold switch
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'h' || e.key === 'H') setHold((h) => !h);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const info = useMemo<DeviceInfo>(() => spec.info(appearance.finishId), [spec, appearance.finishId]);

  const edge = useMemo(() => {
    // polished plastic catches a bright line of light along the edge; brushed aluminium a soft one
    const sideAl = gloss
      ? `linear-gradient(90deg, ${shade(front, -0.2)} 0%, ${shade(front, 0)} 16%, ${shade(front, 0.16)} 42%, ${shade(front, 0.05)} 58%, ${shade(front, -0.04)} 84%, ${shade(front, -0.22)} 100%)`
      : `linear-gradient(90deg, ${shade(front, -0.16)} 0%, ${shade(front, -0.02)} 18%, ${shade(front, 0.04)} 50%, ${shade(front, -0.03)} 82%, ${shade(front, -0.18)} 100%)`;
    const chamfer = `linear-gradient(90deg, ${shade(front, 0.02)}, ${shade(front, 0.2)} 50%, ${shade(front, 0.02)})`;
    return (t: number): EdgeSlice => {
      if (t < FRONT_T) {
        const k = t / FRONT_T;
        return { color: k < 0.2 ? chamfer : sideAl, inset: k < 0.2 ? 0.4 * (1 - k / 0.2) : 0 };
      }
      if (t < FRONT_T + SEAM_T) return { color: material === 'painted' ? shade(backColor, -0.35) : '#3a3b3f', inset: 0.5 };
      const u = (t - FRONT_T - SEAM_T) / (1 - FRONT_T - SEAM_T);
      return { color: steelColor(u, material, backColor), inset: steelInset(u) };
    };
  }, [front, material, backColor, gloss, FRONT_T]);

  const backInset = steelInset(1);
  const winLeft = (W - WINDOW.w) / 2;
  const wheelTop = WHEEL.cy - WHEEL.size / 2;
  const wheelLeft = (W - WHEEL.size) / 2;

  // vertical position helpers for edge parts (z: + towards the front)
  const zAt = (t: number) => D / 2 - t * D;
  const insetAt = (t: number) => (t < FRONT_T + SEAM_T ? 0 : steelInset((t - FRONT_T - SEAM_T) / (1 - FRONT_T - SEAM_T)));
  // How steeply the edge curves in towards the back at depth t (degrees);
  // parts on the edge are tilted to match.
  const slopeAt = (t: number) => (Math.atan((insetAt(t + 0.01) - insetAt(t - 0.01)) / (0.02 * D)) * 180) / Math.PI;
  /** where a part centred at depth t sits, `gap` px out from the surface along its normal */
  const onEdge = (t: number, gap: number) => {
    const a = (slopeAt(t) * Math.PI) / 180;
    return { inset: insetAt(t) - gap * Math.cos(a), z: zAt(t) - gap * Math.sin(a), tilt: slopeAt(t) };
  };
  const portT = 0.5;
  const port = onEdge(portT, 0.35);
  const holdT = 0.47;
  const holdSlot = onEdge(holdT, 0.35);

  const frontStyle: CSSProperties = {
    ['--al' as string]: front,
    ['--al-hi' as string]: shade(front, 0.07),
    ['--al-lo' as string]: shade(front, -0.06),
  };

  const holdX = spec.holdX;
  const jackTop = spec.jack.side === 'top';
  const knobX = holdX + (hold ? 11 : -11);
  const steelKnob = material === 'painted' ? shade(backColor, 0.05) : '#b6b9be';

  return (
    <Device3D
      width={W}
      height={H}
      depth={D}
      radius={RADIUS}
      under={<BodyExtras />}
      over={<BodyExtras after />}
      edge={edge}
      breaks={[FRONT_T * 0.2, FRONT_T, FRONT_T + SEAM_T]}
      backInset={backInset}
      frontStyle={frontStyle}
      className="cl-device"
      front={
        <div className={`cl-front ${gloss ? 'cl-front-gloss' : ''} ${luminance(front) < 0.3 ? 'cl-front-dark' : ''}`}>
          <div className="cl-front-sheen" />
          <div className="cl-window" style={{ left: winLeft, top: WINDOW.top, width: WINDOW.w, height: WINDOW.h }}>
            <div className="cl-lcd" style={{ left: (WINDOW.w - LCD.w) / 2, top: (WINDOW.h - LCD.h) / 2, width: LCD.w, height: LCD.h }}>
              <ClickWheelOS bus={bus} width={LCD.w} height={LCD.h} theme={theme} hold={hold} modelId={model.id} info={info} caps={spec.caps} />
            </div>
            <div className="cl-glass" />
          </div>
          <div className="cl-wheel-well" style={{ left: wheelLeft - 2, top: wheelTop - 2, width: WHEEL.size + 4, height: WHEEL.size + 4 }}>
            <ClickWheel
              bus={bus}
              size={WHEEL.size}
              centerSize={WHEEL.center}
              wheelColor={colors.wheel ?? '#f6f6f6'}
              labelColor={colors.labels ?? '#aeb0b4'}
              centerColor={colors.center ?? '#d9dadc'}
              clicker={clicker}
              style={{ position: 'absolute', left: 2, top: 2 }}
            />
          </div>
          <Decals decals={appearance.decals} side="front" />
        </div>
      }
      back={
        <ClassicBack
          material={material}
          color={backColor}
          engraving={appearance.engraving}
          decals={appearance.decals}
          capacity={info.capacity}
          model={info.model}
          modelNo={spec.modelNo}
        />
      }
      decals={
        <>
          {/* ---- top edge: Hold switch slot ---- */}
          <EdgePlane x={holdX} y={-H / 2 + holdSlot.inset} z={holdSlot.z} w={44} h={13} side="top" tilt={holdSlot.tilt}>
            <div className={`cl-hold-slot ${hold ? 'on' : ''}`}>
              <div className="cl-hold-orange" />
            </div>
          </EdgePlane>
          {/* ---- the headphone jack (EarPods plug in here): bottom on the classic, top on the 5th generation ---- */}
          <EdgePlane
            x={spec.jack.x}
            y={jackTop ? -H / 2 + port.inset : H / 2 - port.inset}
            z={port.z}
            w={30}
            h={30}
            side={jackTop ? 'top' : 'bottom'}
            tilt={port.tilt}
          >
            <div className="cl-jack" />
          </EdgePlane>
          {/* ---- bottom edge: dock connector ---- */}
          <EdgePlane x={0} y={H / 2 - port.inset} z={port.z} w={136} h={20} side="bottom" tilt={port.tilt}>
            <div className="cl-dock">
              <div className="cl-dock-pins" />
            </div>
          </EdgePlane>
        </>
      }
    >
      <Box3D
        x={knobX}
        y={-H / 2 + insetAt(holdT) - 1.1}
        z={zAt(holdT)}
        w={20}
        h={3}
        d={9}
        rotate={`rotateX(${holdSlot.tilt.toFixed(2)}deg)`}
        color={shade(steelKnob, -0.15)}
        faces={{
          top: `repeating-linear-gradient(90deg, ${shade(steelKnob, 0.1)} 0 2px, ${shade(steelKnob, -0.08)} 2px 3.5px)`,
          front: shade(steelKnob, -0.05),
        }}
        radius={1}
        title={hold ? 'Hold is on (H)' : 'Hold switch (H)'}
        onClick={(e) => {
          e.stopPropagation();
          setHold((h) => !h);
        }}
        className="cl-hold-knob"
      />
    </Device3D>
  );
}

/** A flat part lying on the top/bottom edge, facing outwards. */
/**
 * A flat part on the top or bottom edge (the Hold slot, the ports). The steel
 * edge curves, so the part is tilted by `tilt` degrees to lie along the
 * surface at its centre: a tangent plane stays outside a convex surface, so
 * the edge never covers part of it.
 */
function EdgePlane({ x, y, z, w, h, side, tilt = 0, children }: { x: number; y: number; z: number; w: number; h: number; side: 'top' | 'bottom'; tilt?: number; children: React.ReactNode }) {
  const rot = side === 'top' ? `rotateX(${90 + tilt}deg)` : `rotateX(${-90 - tilt}deg)`;
  return (
    <div className="d3-decal" style={{ transform: `translate3d(${x}px, ${y}px, ${z}px) ${rot}` }}>
      <div style={{ position: 'absolute', width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2 }}>{children}</div>
    </div>
  );
}


