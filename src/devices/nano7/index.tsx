/**
 * iPod nano (7th generation) — 2012, refreshed 2015.
 * 39.6 × 76.5 × 5.4 mm, 2.5" 240×432 Multi-Touch display, Home button,
 * volume / play-pause on the left edge, Sleep/Wake on top, Lightning +
 * headphone jack at the bottom.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Box3D, Device3D, EdgeDecal, Slab3D, type EdgeSlice } from '../../shell/Device3D';
import { BodyExtras, SockScreenGuard } from '../../shell/bodySlot';
import { Decals } from '../../shell/decals/Decals';
import { isTypingTarget } from '../../shell/keyboard';
import { player, usePlayer } from '../../core/player/player';
import { useLibrary } from '../../core/library/store';
import { songs } from '../../core/library/selectors';
import { useAlarmState } from '../../core/alarms';
import type { Decal, DeviceProps } from '../types';
import { nano, useNano, useNanoData } from './state';
import { Screen } from './os/Screen';
import { APPLE_PATH } from './os/icons';
import { navBack } from './apps/registry';
import { useServices } from './services';
import './nano7.css';

const W = 308;
const H = 595;
const D = 42;
const R = 38;
/** chamfer → side, side → shaded back curve (where k = 0.6 below) */
const NANO_BREAKS = [0.1, 0.6 + 0.4 * Math.sqrt(0.6)];
const SCREEN = { left: 34, top: 60, width: 240, height: 432 };
const HOME = { x: 154, y: 544, d: 44 };

function luminance(c: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---------------------------------------------------------------- button logic

function wake() {
  useNano.setState({ asleep: false, locked: true });
}
function sleep() {
  useNano.setState({ asleep: true, sheet: null, editing: false });
}

export const buttons = {
  home() {
    const s = useNano.getState();
    if (s.asleep) return wake();
    if (s.locked) {
      useNano.setState({ locked: false });
      return;
    }
    nano.goHome();
  },
  sleepWake() {
    if (useNano.getState().asleep) wake();
    else sleep();
  },
  volume(dir: 1 | -1) {
    player.volumeBy(dir / 16);
    if (!useNano.getState().asleep) nano.showVolume();
  },
  playPause() {
    const { currentId, queue } = usePlayer.getState();
    if (!currentId && !queue.length) {
      const ids = songs(useLibrary.getState().tracks).map((t) => t.id);
      if (ids.length) player.playTracks(ids, 0);
      return;
    }
    player.toggle();
  },
  previous() {
    player.prev();
  },
};

/** single = play/pause, double = next, triple = previous (like the real side button) */
function useMultiClick() {
  const st = useRef({ n: 0, t: 0 });
  return () => {
    const s = st.current;
    s.n++;
    window.clearTimeout(s.t);
    s.t = window.setTimeout(() => {
      if (s.n === 1) buttons.playPause();
      else if (s.n === 2) player.next();
      else buttons.previous();
      s.n = 0;
    }, 360);
  };
}

// ---------------------------------------------------------------- parts

function SideButton({
  x,
  y,
  w,
  h,
  d,
  color,
  faces,
  onPress,
  title,
  axis,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  color: string;
  faces: Record<string, string>;
  onPress: () => void;
  title: string;
  axis: 'x' | 'y';
}) {
  const [down, setDown] = useState(false);
  const push = down ? 1.6 : 0;
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      setDown(true);
      onPress();
    },
    onPointerUp: () => setDown(false),
  };
  useEffect(() => {
    if (!down) return;
    const up = () => setDown(false);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [down]);
  const px = axis === 'x' ? x + push : x;
  const py = axis === 'y' ? y + push : y;
  // a pill: rounded ends, and a slightly rounded rim around the outer face
  const edge = useMemo(() => {
    const rim = 1.2;
    return (t: number): EdgeSlice => {
      const dd = t * (axis === 'x' ? w : h);
      return {
        inset: dd < rim ? rim - Math.sqrt(rim * rim - (rim - dd) * (rim - dd)) : 0,
        color: faces[axis === 'x' ? 'top' : 'left'] ?? color,
      };
    };
  }, [axis, w, h, faces, color]);
  return (
    <>
      {axis === 'x' ? (
        <Slab3D x={px} y={py} facing={x < 0 ? '-x' : '+x'} w={d} h={h} t={w} radius={d / 2} face={faces[x < 0 ? 'left' : 'right'] ?? color} edge={edge} title={title} {...handlers} />
      ) : (
        <Slab3D x={px} y={py} facing={y < 0 ? '-y' : '+y'} w={w} h={d} t={h} radius={d / 2} face={faces[y < 0 ? 'top' : 'bottom'] ?? color} edge={edge} title={title} {...handlers} />
      )}
      {/* generous invisible hit area so the thin buttons are easy to press */}
      <Box3D
        x={axis === 'x' ? x - 5 * Math.sign(x) : x}
        y={axis === 'y' ? y - 5 * Math.sign(y) : y}
        w={axis === 'x' ? 16 : w + 8}
        h={axis === 'y' ? 16 : h + 8}
        d={D - 6}
        color="transparent"
        title={title}
        className="n7-hit"
        {...handlers}
      />
    </>
  );
}

function HomeButton({ color, dark }: { color: string; dark: boolean }) {
  const [down, setDown] = useState(false);
  return (
    <div
      className={`n7-homebtn ${down ? 'down' : ''} ${dark ? 'dark' : 'light'}`}
      data-control
      title="Home (H)"
      style={{ left: HOME.x - HOME.d / 2, top: HOME.y - HOME.d / 2, width: HOME.d, height: HOME.d, ['--home' as string]: color } as CSSProperties}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        setDown(true);
        buttons.home();
      }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
    >
      <div className="n7-homebtn-glyph" />
    </div>
  );
}

function Back({ body, engraving, red, decals }: { body: string; engraving: [string, string]; red?: boolean; decals?: Decal[] }) {
  const L = luminance(body);
  const ink = L > 0.55 ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.45)';
  const logoFill = L > 0.55 ? `color-mix(in srgb, ${body} 72%, #000)` : `color-mix(in srgb, ${body} 55%, #fff)`;
  return (
    <div className="n7-rear" style={{ ['--body' as string]: body, color: ink } as CSSProperties}>
      <div className="n7-rear-tex" />
      <svg className="n7-rear-logo" viewBox="0 0 24 24" width="50" height="60">
        <defs>
          <linearGradient id="n7logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={logoFill} />
            <stop offset="0.5" stopColor={L > 0.55 ? `color-mix(in srgb, ${body} 60%, #000)` : `color-mix(in srgb, ${body} 40%, #fff)`} />
            <stop offset="1" stopColor={logoFill} />
          </linearGradient>
        </defs>
        <path d={APPLE_PATH} fill="url(#n7logo)" />
      </svg>
      <div className="n7-rear-wordmark">iPod</div>
      {(engraving[0] || engraving[1]) && (
        <div className="n7-rear-engraving">
          <div>{engraving[0]}</div>
          <div>{engraving[1]}</div>
        </div>
      )}
      <Decals decals={decals} ink={ink} shadow={L > 0.55 ? '0 0.5px 0 rgba(255,255,255,0.5)' : '0 -0.5px 0 rgba(0,0,0,0.3)'} />
      {red && (
        <div className="n7-rear-red">
          (PRODUCT)<sup>RED</sup>
        </div>
      )}
      <div className="n7-rear-print">
        <div>Designed by Apple in California&nbsp;&nbsp;Assembled in China</div>
        <div>Model No.: A1446&nbsp;&nbsp;EMC 2592&nbsp;&nbsp;16GB</div>
        <div className="n7-rear-marks">
          <span>CE</span>
          <span>FC</span>
          <svg viewBox="0 0 10 12" width="7" height="8">
            <path d="M2 3h6l-.7 8H2.7zM1 2.2h8M3.5 1h3" fill="none" stroke="currentColor" strokeWidth="0.8" />
            <path d="M1 1l8 10M9 1 1 11" stroke="currentColor" strokeWidth="0.7" />
          </svg>
        </div>
      </div>
      <div className="n7-rear-sheen" />
    </div>
  );
}

// ---------------------------------------------------------------- device

export default function IpodNano7({ appearance }: DeviceProps) {
  const body = appearance.colors.body ?? '#626569';
  const glass = appearance.colors.front ?? '#111113';
  const home = appearance.colors.home ?? '#1b1b1d';
  const wallpaper = String(appearance.options.wallpaper ?? 'dark');
  const darkGlass = luminance(glass) < 0.4;
  const asleep = useNano((s) => s.asleep);
  const video = useNano((s) => s.video);
  const turnForVideo = useNanoData((s) => s.turnForVideo);
  const playClick = useMultiClick();

  useServices();

  // wake up for alarms
  const ringing = useAlarmState((s) => s.ringing);
  useEffect(() => {
    if (ringing && useNano.getState().asleep) useNano.setState({ asleep: false });
  }, [ringing]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'h' || k === 'H') buttons.home();
      else if (k === 'l' || k === 'L') buttons.sleepWake();
      else if (k === '+' || k === '=') buttons.volume(1);
      else if (k === '-' || k === '_') buttons.volume(-1);
      else if (k === ' ') {
        e.preventDefault();
        playClick();
      } else if (k === 'Escape' || k === 'Backspace') {
        const s = useNano.getState();
        if (s.sheet) nano.closeSheet();
        else if (s.video) useNano.setState({ video: false });
        else if (s.app && !navBack(s.app)) nano.goHome();
      } else if (k === 'ArrowRight' && !useNano.getState().app) useNano.setState({ homePage: Math.min(1, useNano.getState().homePage + 1) });
      else if (k === 'ArrowLeft' && !useNano.getState().app) useNano.setState({ homePage: Math.max(0, useNano.getState().homePage - 1) });
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playClick]);

  const bodyHi = `color-mix(in srgb, ${body} 84%, #fff)`;
  const bodyLo = `color-mix(in srgb, ${body} 72%, #000)`;
  const bodyMid = `color-mix(in srgb, ${body} 90%, #000)`;
  const side = `linear-gradient(90deg, ${bodyHi} 0%, ${bodyMid} 7%, ${bodyMid} 93%, ${bodyLo} 100%)`;
  const chamfer = `linear-gradient(90deg, color-mix(in srgb, ${body} 55%, #fff) 0%, color-mix(in srgb, ${body} 70%, #fff) 50%, color-mix(in srgb, ${body} 62%, #fff) 100%)`;

  const btnFaces = {
    left: `linear-gradient(90deg, ${bodyLo}, ${bodyHi} 45%, ${bodyMid})`,
    right: `linear-gradient(90deg, ${bodyLo}, ${bodyHi} 45%, ${bodyMid})`,
    top: `linear-gradient(180deg, ${bodyLo}, ${bodyHi} 45%, ${bodyMid})`,
    front: bodyHi,
    back: bodyLo,
    bottom: bodyLo,
  };

  return (
    <Device3D
      className={`n7-device ${video && turnForVideo ? 'n7-landscape' : ''}`}
      width={W}
      height={H}
      depth={D}
      radius={R}
      under={<BodyExtras />}
      over={<BodyExtras after />}
      backInset={3.5}
      breaks={NANO_BREAKS}
      edge={(t) => {
        if (t < 0.1) return { inset: (1 - t / 0.1) * 1.4, color: chamfer };
        const k = t > 0.6 ? Math.pow((t - 0.6) / 0.4, 2) : 0;
        return { inset: k * 3.5, color: k > 0.6 ? `linear-gradient(90deg, ${bodyMid}, ${bodyLo} 50%, ${bodyMid})` : side };
      }}
      frontStyle={{ background: body }}
      backStyle={{ background: body }}
      front={
        <div className={`n7-front ${darkGlass ? 'n7-glass-dark' : 'n7-glass-light'}`} style={{ ['--body' as string]: body, ['--glass' as string]: glass } as CSSProperties}>
          <div className="n7-rim" />
          <div className="n7-glass" />
          <div className="n7-mask" style={{ left: SCREEN.left - 3, top: SCREEN.top - 3, width: SCREEN.width + 6, height: SCREEN.height + 6 }} />
          <div className="n7-screen-window" style={SCREEN}>
            <Screen wallpaper={wallpaper} />
          </div>
          <SockScreenGuard area={SCREEN} height={H} />
          <HomeButton color={home} dark={darkGlass} />
          <div className={`n7-glare ${asleep ? 'n7-glare-strong' : ''}`} />
          <Decals decals={appearance.decals} side="front" />
        </div>
      }
      back={<Back body={body} engraving={appearance.engraving} red={appearance.finishId === 'red'} decals={appearance.decals} />}
      decals={
        <>
          {/* bottom: headphone jack (centre x = -86, matches registry `jack`) + Lightning */}
          <EdgeDecal side="bottom" offset={-86} length={26} thickness={26} width={W} height={H} depth={D}>
            <div className="n7-jack" />
          </EdgeDecal>
          <EdgeDecal side="bottom" offset={0} length={56} thickness={14} width={W} height={H} depth={D}>
            <div className="n7-lightning">
              <div />
            </div>
          </EdgeDecal>
        </>
      }
    >
      {/* left edge: volume up, play/pause, volume down */}
      <SideButton axis="x" x={-W / 2 - 0.4} y={-H / 2 + 128} w={4} h={34} d={15} color={bodyHi} faces={btnFaces} onPress={() => buttons.volume(1)} title="Volume Up (+)" />
      <SideButton axis="x" x={-W / 2 - 0.4} y={-H / 2 + 170} w={4} h={17} d={15} color={bodyHi} faces={btnFaces} onPress={playClick} title="Play/Pause (Space) — double-click: next, triple-click: previous" />
      <SideButton axis="x" x={-W / 2 - 0.4} y={-H / 2 + 212} w={4} h={34} d={15} color={bodyHi} faces={btnFaces} onPress={() => buttons.volume(-1)} title="Volume Down (−)" />
      {/* top edge: Sleep/Wake */}
      <SideButton axis="y" x={W / 2 - 66} y={-H / 2 - 0.4} w={44} h={4} d={15} color={bodyHi} faces={btnFaces} onPress={buttons.sleepWake} title="Sleep/Wake (L)" />
    </Device3D>
  );
}
