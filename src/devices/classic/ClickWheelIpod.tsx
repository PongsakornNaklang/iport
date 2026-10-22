/**
 * A Click Wheel iPod with a stainless steel back: the iPod classic and the
 * 5th generation iPod (Video) share it. What differs between them is in
 * `ClickWheelSpec`: the front (anodized aluminium or glossy plastic), how
 * much of the edge the front covers, where the headphone jack is, what
 * the back says and what the software can do.
 */
import { useContext, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Box3D, Device3D, type EdgeSlice } from '../../shell/Device3D';
import { BodyExtras, BodySlotContext, sockHint, useSockMouth } from '../../shell/bodySlot';
import { Decals } from '../../shell/decals/Decals';
import { isTypingTarget } from '../../shell/keyboard';
import { useStage } from '../../shell/stageStore';
import { useSettings } from '../../core/settings/store';
import { ClickWheel } from '../shared/clickwheel/ClickWheel';
import { WheelBus } from '../shared/clickwheel/bus';
import { useWheelKeyboard } from '../shared/clickwheel/useWheelKeyboard';
import { CLASSIC_LAYOUT, type DeviceProps } from '../types';
import { ClickWheelOS } from './os/ClickWheelOS';
import type { DeviceInfo, OSCaps, ThemeName } from './os/core';
import { AluminiumBack, ClassicBack } from './Back';
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
  /** "HOLD" printed beside the Hold switch and a headphones icon beside the jack (classic, 5th generation) */
  edgeMarks?: boolean;
  /** Hold switch slot length (px, default 44) */
  holdLen?: number;
  /** model number on the back ("A1238", and anything after it on that line) */
  modelNo: string;
  caps?: Partial<OSCaps>;
  /** the start-up screen: an Apple on black (default) or on white */
  bootStyle?: 'dark' | 'light';
  /**
   * The body. 'steel': a front plate on a mirror steel back that curves in
   * (classic, 5th generation). 'aluminium': one anodized piece whose sides
   * round over into the front and back (mini, nano), `round` px deep.
   */
  body?: { kind: 'steel' } | { kind: 'aluminium'; round: number };
  /** a monochrome LCD (the mini's grey-blue one) */
  mono?: boolean;
  /** the product name on the back under the Apple logo */
  wordmark?: string;
  /** plastic caps over the top and bottom ends (the mini's) */
  endCaps?: boolean;
  /** the front curves away at its sides (the nano's oval body): it darkens towards them */
  frontCurve?: boolean;
  /** aluminium back: the capacity in a small box, no small print (the nano's) */
  capacityBadge?: boolean;
}

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

const turnBlocked = () => sockHint('Take off the sock to turn the wheel');

/** depth bands (0 front … 1 back) of the mini's end caps */
const CAP_STRIPS: [number, number][] = Array.from({ length: 12 }, (_, i) => [0.06 + (i * 0.88) / 12, 0.06 + ((i + 1) * 0.88) / 12]);

export function ClickWheelIpod({ model, appearance, spec }: DeviceProps & { spec: ClickWheelSpec }) {
  const FRONT_T = spec.frontT;
  const L = model.clickWheel ?? CLASSIC_LAYOUT;
  const RADIUS = L.radius;
  const WINDOW = L.window;
  const LCD = L.lcd;
  const WHEEL = L.wheel;
  const body = spec.body ?? { kind: 'steel' };
  const alu = body.kind === 'aluminium';
  /** aluminium: how far the rounded side is pulled in at depth t (0 front … 1 back) */
  const roundInset = (t: number) => {
    if (!alu) return 0;
    const s = Math.min(0.96, Math.abs(2 * t - 1));
    return body.round * (1 - Math.sqrt(1 - s * s));
  };
  const gloss = spec.finish === 'gloss';
  const { width: W, height: H, depth: D } = model.size;
  const colors = appearance.colors;
  const front = colors.front ?? '#d5d6d8';
  const backColor = colors.back ?? '#c9cbce';
  const material = String(appearance.options.backMaterial ?? 'chrome');
  const theme = (String(appearance.options.theme ?? 'classic') as ThemeName) || 'classic';
  const bus = useMemo(() => new WheelBus(), []);
  // inside a sock the buttons press through the fabric, but the wheel can't be turned
  const mouth = useSockMouth();
  const wheelCovered = mouth != null && WHEEL.cy - H / 2 > mouth;
  const pullSock = useContext(BodySlotContext).pullSock;
  const [hold, setHold] = useState(false);
  // nano 4G: Cover Flow, video and photos ask for the iPod on its side, and
  // the stage lays it down. The picture turns only while it really lies on
  // its side: stood back up (the view controls), it shows them upright.
  const [wantsSide, setWantsSide] = useState(false);
  const rolled = useStage((s) => s.roll);
  const sideways = wantsSide && rolled;
  useEffect(() => {
    useStage.getState().autoRoll(wantsSide);
  }, [wantsSide]);
  useEffect(() => () => useStage.getState().autoRoll(false), []);
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
    // one anodized piece: the side faces out in the middle and turns towards front and back
    if (alu)
      return (t: number): EdgeSlice => {
        const s = 2 * t - 1;
        const lit = 0.07 - 0.1 * s - 0.16 * s * s; // light from the front, falling off round the curve
        const c = shade(front, lit);
        return {
          color: `linear-gradient(90deg, ${shade(front, lit - 0.16)} 0%, ${c} 15%, ${shade(front, lit + 0.05)} 50%, ${c} 85%, ${shade(front, lit - 0.18)} 100%)`,
          inset: roundInset(t),
        };
      };
    return (t: number): EdgeSlice => {
      if (t < FRONT_T) {
        const k = t / FRONT_T;
        return { color: k < 0.2 ? chamfer : sideAl, inset: k < 0.2 ? 0.4 * (1 - k / 0.2) : 0 };
      }
      if (t < FRONT_T + SEAM_T) return { color: material === 'painted' ? shade(backColor, -0.35) : '#3a3b3f', inset: 0.5 };
      const u = (t - FRONT_T - SEAM_T) / (1 - FRONT_T - SEAM_T);
      return { color: steelColor(u, material, backColor), inset: steelInset(u) };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front, material, backColor, gloss, FRONT_T, alu, alu && body.round]);

  const backInset = alu ? roundInset(1) : steelInset(1);
  const frontInset = alu ? roundInset(0) : 0;
  // the front face is inset by the rounded sides: place things on it in body coordinates
  const winLeft = (W - WINDOW.w) / 2 - frontInset;
  const wheelTop = WHEEL.cy - WHEEL.size / 2 - frontInset;
  const wheelLeft = (W - WHEEL.size) / 2 - frontInset;

  // vertical position helpers for edge parts (z: + towards the front)
  const zAt = (t: number) => D / 2 - t * D;
  const insetAt = (t: number) => (alu ? roundInset(t) : t < FRONT_T + SEAM_T ? 0 : steelInset((t - FRONT_T - SEAM_T) / (1 - FRONT_T - SEAM_T)));
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
  const holdLen = spec.holdLen ?? 44;
  const knobX = holdX + (hold ? 1 : -1) * holdLen * 0.25;
  const steelKnob = alu ? '#c9cbcf' : material === 'painted' ? shade(backColor, 0.05) : '#b6b9be';

  return (
    <div
      className="cl-root"
      style={{ width: W, height: H }}
    >
      <Device3D
        width={W}
        height={H}
        depth={D}
        radius={RADIUS}
        under={<BodyExtras />}
        over={<BodyExtras after />}
        edge={edge}
        breaks={alu ? undefined : [FRONT_T * 0.2, FRONT_T, FRONT_T + SEAM_T]}
        backInset={backInset}
        frontInset={frontInset}
        frontStyle={frontStyle}
        className="cl-device"
        front={
          <div className={`cl-front ${gloss ? 'cl-front-gloss' : ''} ${luminance(front) < 0.3 ? 'cl-front-dark' : ''}`}>
            <div className="cl-front-sheen" />
            {spec.frontCurve && <div className="cl-front-curve" />}
            <div className="cl-window" style={{ left: winLeft, top: WINDOW.top - frontInset, width: WINDOW.w, height: WINDOW.h }}>
              <div className="cl-lcd" style={{ left: (WINDOW.w - LCD.w) / 2, top: (WINDOW.h - LCD.h) / 2, width: LCD.w, height: LCD.h }}>
                <div
                  className="cl-lcd-turn"
                  // the picture stays upright: turned back the other way, a landscape screen
                  style={sideways ? { width: LCD.h, height: LCD.w, transform: `translateX(${LCD.w}px) rotate(90deg)` } : { width: LCD.w, height: LCD.h }}
                >
                  <ClickWheelOS
                    bus={bus}
                    width={sideways ? LCD.h : LCD.w}
                    height={sideways ? LCD.w : LCD.h}
                    color={!spec.mono}
                    theme={theme}
                    hold={hold}
                    modelId={model.id}
                    info={info}
                    caps={spec.caps}
                    bootStyle={spec.bootStyle}
                    onLandscape={spec.caps?.motion ? setWantsSide : undefined}
                  />
                </div>
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
                onBlockedTurn={wheelCovered ? turnBlocked : undefined}
                onPullDown={pullSock}
                style={{ position: 'absolute', left: 2, top: 2 }}
              />
            </div>
            <Decals decals={appearance.decals} side="front" />
          </div>
        }
        back={
          alu ? (
            <AluminiumBack
              color={colors.back ?? front}
              wordmark={spec.wordmark ?? 'iPod'}
              engraving={appearance.engraving}
              decals={appearance.decals}
              capacity={info.capacity}
              model={info.model}
              modelNo={spec.modelNo}
              badge={spec.capacityBadge}
            />
          ) : (
            <ClassicBack
            material={material}
            color={backColor}
            engraving={appearance.engraving}
            decals={appearance.decals}
            capacity={info.capacity}
            model={info.model}
            modelNo={spec.modelNo}
            />
          )
        }
        decals={
          <>
            {/* ---- top edge: Hold switch slot ---- */}
            <EdgePlane x={holdX} y={-H / 2 + holdSlot.inset} z={holdSlot.z} w={holdLen} h={13} side="top" tilt={holdSlot.tilt}>
              <div className={`cl-hold-slot ${hold ? 'on' : ''}`}>
                <div className="cl-hold-orange" />
              </div>
            </EdgePlane>
            {/* ---- printed on the top edge: HOLD to the right of the switch, headphones to the left of the jack ---- */}
            {spec.edgeMarks && (
              <>
                <EdgePlane x={holdX + holdLen / 2 + 17} y={-H / 2 + holdSlot.inset} z={holdSlot.z} w={26} h={10} side="top" tilt={holdSlot.tilt}>
                  <div className="cl-edge-mark cl-edge-hold">HOLD</div>
                </EdgePlane>
                {jackTop && (
                  <EdgePlane x={spec.jack.x - 26} y={-H / 2 + port.inset} z={port.z} w={14} h={14} side="top" tilt={port.tilt}>
                    <svg className="cl-edge-mark" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 15v-3a8 8 0 0 1 16 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      <rect x="3" y="14" width="5" height="7" rx="1.6" fill="currentColor" />
                      <rect x="16" y="14" width="5" height="7" rx="1.6" fill="currentColor" />
                    </svg>
                  </EdgePlane>
                )}
              </>
            )}
            {/* ---- the headphone jack (EarPods plug in here) ---- */}
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
            {/* ---- the mini's plastic end caps ---- */}
            {/* The tube's ends curve with its rounded sides, so each cap is laid on in strips that follow the curve. */}
            {spec.endCaps &&
              (['top', 'bottom'] as const).flatMap((side) =>
                CAP_STRIPS.map(([t0, t1], i) => {
                  const tc = (t0 + t1) / 2;
                  const at = onEdge(tc, 0.2);
                  const len = ((t1 - t0) * D) / Math.cos((at.tilt * Math.PI) / 180) + 0.8;
                  const cap = colors.caps ?? shade(front, -0.05);
                  // lit from the front, darker as it turns towards the back
                  const tone = shade(cap, 0.05 - tc * 0.12);
                  return (
                    <EdgePlane
                      key={`${side}${i}`}
                      x={0}
                      y={side === 'top' ? -H / 2 + at.inset : H / 2 - at.inset}
                      z={at.z}
                      w={W - 2 * RADIUS - 2}
                      h={len}
                      side={side}
                      tilt={at.tilt}
                    >
                      <div className="cl-endcap" style={{ ['--cap' as string]: tone } as CSSProperties} />
                    </EdgePlane>
                  );
                }),
              )}
            {/* ---- bottom edge: dock connector ---- */}
            <EdgePlane x={L.dockX ?? 0} y={H / 2 - port.inset} z={port.z} w={L.dockW} h={20} side="bottom" tilt={port.tilt}>
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
          w={Math.round(holdLen * 0.45)}
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
    </div>
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


