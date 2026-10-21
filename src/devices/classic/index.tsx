/**
 * iPod classic (160GB, late 2009) — the showpiece.
 *
 * 61.8 × 103.5 × 10.5 mm at 6.3 px/mm: anodized aluminium front, a
 * mirror-polished stainless steel back that curves into the sides, Hold
 * switch on top, headphone jack and 30-pin dock connector on the bottom.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Box3D, Device3D, type EdgeSlice } from '../../shell/Device3D';
import { isTypingTarget } from '../../shell/keyboard';
import { useSettings } from '../../core/settings/store';
import { ClickWheel } from '../shared/clickwheel/ClickWheel';
import { WheelBus } from '../shared/clickwheel/bus';
import { useWheelKeyboard } from '../shared/clickwheel/useWheelKeyboard';
import type { DeviceProps } from '../types';
import { ClickWheelOS } from './os/ClickWheelOS';
import type { DeviceInfo, ThemeName } from './os/core';
import { ClassicBack } from './Back';
import { luminance, shade } from './color';
import './hardware.css';

const RADIUS = 42;
const WINDOW = { w: 336, h: 256, top: 38 };
const LCD = { w: 320, h: 240 };
const WHEEL = { size: 236, center: 92, cy: 471 };
/** front aluminium plate: share of the thickness */
const FRONT_T = 0.17;
const SEAM_T = 0.03;
/** how far the steel back curves in at the back face */
const CURVE = 15;

const INFO_BASE: DeviceInfo = {
  product: 'iPod classic',
  name: 'iPod',
  capacity: '160GB',
  capacityBytes: 160e9,
  version: '2.0.4',
  model: 'MC293',
  serial: '8K9461PSZ2C',
  format: 'Mac',
};

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

export default function IpodClassic({ model, appearance }: DeviceProps) {
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

  const info = useMemo<DeviceInfo>(() => ({ ...INFO_BASE, model: appearance.finishId === 'black' || appearance.finishId === 'u2' ? 'MC297' : 'MC293' }), [appearance.finishId]);

  const edge = useMemo(() => {
    const sideAl = `linear-gradient(90deg, ${shade(front, -0.16)} 0%, ${shade(front, -0.02)} 18%, ${shade(front, 0.04)} 50%, ${shade(front, -0.03)} 82%, ${shade(front, -0.18)} 100%)`;
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
  }, [front, material, backColor]);

  const backInset = steelInset(1);
  const winLeft = (W - WINDOW.w) / 2;
  const wheelTop = WHEEL.cy - WHEEL.size / 2;
  const wheelLeft = (W - WHEEL.size) / 2;

  // vertical position helpers for edge parts (z: + towards the front)
  const zAt = (t: number) => D / 2 - t * D;
  const insetAt = (t: number) => (t < FRONT_T + SEAM_T ? 0 : steelInset((t - FRONT_T - SEAM_T) / (1 - FRONT_T - SEAM_T)));
  const portT = 0.5;
  const portZ = zAt(portT);
  const portInset = insetAt(portT);

  const frontStyle: CSSProperties = {
    ['--al' as string]: front,
    ['--al-hi' as string]: shade(front, 0.07),
    ['--al-lo' as string]: shade(front, -0.06),
  };

  const holdX = -W / 2 + 64;
  const knobX = holdX + (hold ? 11 : -11);
  const steelKnob = material === 'painted' ? shade(backColor, 0.05) : '#b6b9be';

  return (
    <Device3D
      width={W}
      height={H}
      depth={D}
      radius={RADIUS}
      edge={edge}
      breaks={[FRONT_T * 0.2, FRONT_T, FRONT_T + SEAM_T]}
      backInset={backInset}
      frontStyle={frontStyle}
      className="cl-device"
      front={
        <div className={`cl-front ${luminance(front) < 0.3 ? 'cl-front-dark' : ''}`}>
          <div className="cl-front-sheen" />
          <div className="cl-window" style={{ left: winLeft, top: WINDOW.top, width: WINDOW.w, height: WINDOW.h }}>
            <div className="cl-lcd" style={{ left: (WINDOW.w - LCD.w) / 2, top: (WINDOW.h - LCD.h) / 2, width: LCD.w, height: LCD.h }}>
              <ClickWheelOS bus={bus} width={LCD.w} height={LCD.h} theme={theme} hold={hold} modelId={model.id} info={info} />
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
        </div>
      }
      back={<ClassicBack material={material} color={backColor} engraving={appearance.engraving} capacity={info.capacity} model={info.model} />}
      decals={
        <>
          {/* ---- top edge: Hold switch slot ---- */}
          <EdgePlane x={holdX} y={-H / 2 + insetAt(0.47) - 0.35} z={zAt(0.47)} w={44} h={13} side="top">
            <div className={`cl-hold-slot ${hold ? 'on' : ''}`}>
              <div className="cl-hold-orange" />
            </div>
          </EdgePlane>
          {/* ---- bottom edge: headphone jack (EarPods plug in here) + dock connector ---- */}
          <EdgePlane x={-W / 2 + 74} y={H / 2 - portInset + 0.35} z={portZ} w={30} h={30} side="bottom">
            <div className="cl-jack" />
          </EdgePlane>
          <EdgePlane x={0} y={H / 2 - portInset + 0.35} z={portZ} w={136} h={20} side="bottom">
            <div className="cl-dock">
              <div className="cl-dock-pins" />
            </div>
          </EdgePlane>
        </>
      }
    >
      <Box3D
        x={knobX}
        y={-H / 2 + insetAt(0.47) - 1.1}
        z={zAt(0.47)}
        w={20}
        h={3}
        d={9}
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
function EdgePlane({ x, y, z, w, h, side, children }: { x: number; y: number; z: number; w: number; h: number; side: 'top' | 'bottom'; children: React.ReactNode }) {
  const rot = side === 'top' ? 'rotateX(90deg)' : 'rotateX(-90deg)';
  return (
    <div className="d3-decal" style={{ transform: `translate3d(${x}px, ${y}px, ${z}px) ${rot}` }}>
      <div style={{ position: 'absolute', width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2 }}>{children}</div>
    </div>
  );
}


