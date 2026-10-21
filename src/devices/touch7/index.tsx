/**
 * iPod touch (7th generation, 2019) — the last iPod.
 * 58.6 × 123.4 × 6.1 mm → 376 × 791 × 39 px, 4" Retina display (320 × 568 pt).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box3D, Device3D, EdgeDecal } from '../../shell/Device3D';
import { isTypingTarget } from '../../shell/keyboard';
import { player } from '../../core/player/player';
import type { DeviceProps } from '../types';
import { APPLE_LOGO } from './os/icons';
import { os, prefs, useOS } from './os/store';
import { Screen } from './os/Screen';
import './touch7.css';
import './os/os.css';
import './os/ui.css';
import './apps/apps.css';

const SCREEN_W = 320;
const SCREEN_H = 568;
const RADIUS = 54;
const FRONT_INSET = 2.6;
const BACK_INSET = 4.6;

function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return 0.5;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Home button: click, double-click (app switcher), hold (Siri). */
function useHomeButton() {
  const pending = useRef<number | undefined>(undefined);
  const longTimer = useRef<number | undefined>(undefined);
  const longFired = useRef(false);
  const [pressed, setPressed] = useState(false);

  const down = () => {
    setPressed(true);
    longFired.current = false;
    window.clearTimeout(longTimer.current);
    longTimer.current = window.setTimeout(() => {
      longFired.current = true;
      window.clearTimeout(pending.current);
      pending.current = undefined;
      os.homeLong();
    }, 650);
  };
  const up = () => {
    setPressed(false);
    window.clearTimeout(longTimer.current);
    if (longFired.current) return;
    const st = useOS.getState();
    if (pending.current) {
      window.clearTimeout(pending.current);
      pending.current = undefined;
      os.homeDouble();
      return;
    }
    // nothing to wait for on the lock screen
    if (!st.screenOn || st.locked) {
      os.homeClick();
      return;
    }
    pending.current = window.setTimeout(() => {
      pending.current = undefined;
      os.homeClick();
    }, 240);
  };
  const cancel = () => {
    setPressed(false);
    window.clearTimeout(longTimer.current);
  };
  useEffect(
    () => () => {
      window.clearTimeout(pending.current);
      window.clearTimeout(longTimer.current);
    },
    [],
  );
  return { pressed, down, up, cancel };
}

export default function IpodTouch({ model, appearance }: DeviceProps) {
  const { width, height, depth } = model.size;
  const back = appearance.colors.back ?? '#6b6c70';
  const front = appearance.colors.front ?? '#0d0d0f';
  const darkFront = luminance(front) < 0.35;
  const landscape = useOS((s) => s.landscape);
  const home = useHomeButton();
  const rootRef = useRef<HTMLDivElement>(null);
  const [lsScale, setLsScale] = useState(1);
  const [btn, setBtn] = useState<string | null>(null);

  // fit the rotated body on narrow viewports
  useEffect(() => {
    if (!landscape || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const projected = Math.max(r.width, r.height);
    const avail = window.innerWidth * 0.94;
    setLsScale(Math.min(1, avail / Math.max(1, projected)));
  }, [landscape]);

  // keyboard: H home, L sleep/wake, +/- volume, space play/pause
  useEffect(() => {
    let hDown = false;
    const onDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'h' || k === 'H') {
        if (!hDown) {
          hDown = true;
          home.down();
        }
        e.preventDefault();
      } else if (k === 'l' || k === 'L') {
        if (e.repeat) return;
        os.sleepWake();
        flash('sleep');
      } else if (k === '+' || k === '=' || k === 'ArrowUp') {
        if (k === 'ArrowUp' && !e.shiftKey) return;
        volume(+1);
        e.preventDefault();
      } else if (k === '-' || k === '_' || k === 'ArrowDown') {
        if (k === 'ArrowDown' && !e.shiftKey) return;
        volume(-1);
        e.preventDefault();
      } else if (k === ' ') {
        e.preventDefault();
        if (!e.repeat) player.toggle();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        if (hDown) {
          hDown = false;
          home.up();
        }
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (id: string) => {
    setBtn(id);
    window.setTimeout(() => setBtn((b) => (b === id ? null : b)), 160);
  };
  const volume = (dir: number) => {
    flash(dir > 0 ? 'vup' : 'vdown');
    const st = useOS.getState();
    if (st.app === 'camera' && !st.locked && st.screenOn && !st.overlay) {
      useOS.setState({ shutterSerial: st.shutterSerial + 1 });
      return;
    }
    player.volumeBy(dir * 0.0625);
    os.volumeHud();
  };

  // auto-lock
  useEffect(() => {
    let last = Date.now();
    const bump = () => (last = Date.now());
    window.addEventListener('pointerdown', bump, true);
    window.addEventListener('keydown', bump, true);
    const t = window.setInterval(() => {
      const m = prefs().autoLock;
      const st = useOS.getState();
      if (m > 0 && st.screenOn && !st.videoOpen && Date.now() - last > m * 60_000) os.sleep();
    }, 5000);
    return () => {
      window.removeEventListener('pointerdown', bump, true);
      window.removeEventListener('keydown', bump, true);
      window.clearInterval(t);
    };
  }, []);

  const edge = useMemo(() => {
    return (t: number) => {
      const u = t * 2 - 1;
      const R = u < 0 ? 3.4 : 6.2;
      const a = Math.abs(u);
      const inset = R * (1 - Math.pow(1 - Math.pow(a, 2.6), 1 / 2.6));
      if (t < 0.085) {
        // the cover glass
        return { inset, color: darkFront ? '#08080a' : `color-mix(in srgb, ${front} 86%, #9a9aa0)` };
      }
      // anodized aluminium: lighter towards the front, darker towards the back
      const shade = u < 0 ? Math.round(14 * (1 - a) + 4) : Math.round(18 * a);
      const tone = u < 0 ? `color-mix(in srgb, ${back} ${100 - shade}%, #fff)` : `color-mix(in srgb, ${back} ${100 - shade}%, #000)`;
      return {
        inset,
        color: `linear-gradient(90deg, rgb(255 255 255 / calc(0.06 - var(--lx, 0) * 0.22)) 0%, transparent 9%, transparent 91%, rgb(255 255 255 / calc(0.06 + var(--lx, 0) * 0.22)) 100%), linear-gradient(180deg, rgb(255 255 255 / calc(0.10 + var(--ly, 0) * 0.2)) 0%, transparent 6%, transparent 94%, rgb(0 0 0 / 0.14) 100%), ${tone}`,
      };
    };
  }, [back, front, darkFront]);

  const half = depth / 2;
  const btnColor = `color-mix(in srgb, ${back} 92%, #fff)`;
  const btnSide = `color-mix(in srgb, ${back} 80%, #000)`;
  const sx = width / 2;
  const sy = height / 2;

  return (
    <div
      ref={rootRef}
      className={`t7-root ${landscape ? 'is-landscape' : ''}`}
      style={{ width, height, transform: landscape ? `rotate(-90deg) scale(${lsScale})` : undefined }}
    >
      <Device3D
        width={width}
        height={height}
        depth={depth}
        radius={RADIUS}
        slices={28}
        frontInset={FRONT_INSET}
        backInset={BACK_INSET}
        edge={edge}
        frontStyle={{ overflow: 'clip' }}
        backStyle={{ overflow: 'clip' }}
        decals={
          <>
            {/* bottom edge: headphone jack, Lightning, speaker */}
            <EdgeDecal side="bottom" offset={-96} length={22} thickness={22} width={width} height={height} depth={depth}>
              <div className="t7-jack" />
            </EdgeDecal>
            <EdgeDecal side="bottom" offset={0} length={50} thickness={12} width={width} height={height} depth={depth}>
              <div className="t7-lightning" />
            </EdgeDecal>
            <EdgeDecal side="bottom" offset={78} length={64} thickness={8} width={width} height={height} depth={depth}>
              <div className="t7-speaker">
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
            </EdgeDecal>
            <EdgeDecal side="top" offset={-40} length={6} thickness={6} width={width} height={height} depth={depth} zOffset={-half * 0.1}>
              <div className="t7-pinhole" />
            </EdgeDecal>
          </>
        }
        front={
          <div className={`t7-front ${darkFront ? 'dark' : 'light'}`} style={{ background: front }}>
            <div className="t7-glass-edge" />
            <div className="t7-camera-front" style={{ top: 56 - FRONT_INSET }} />
            <div
              className="t7-panel"
              style={{ left: (width - SCREEN_W) / 2 - FRONT_INSET - 5, top: (height - SCREEN_H) / 2 - FRONT_INSET - 5 }}
            >
              <div className="t7-screen-wrap">
                <Screen appearance={appearance} />
              </div>
            </div>
            <button
              className={`t7-homebtn ${home.pressed ? 'pressed' : ''}`}
              data-control=""
              aria-label="Home button"
              title="Home (H) · double-press: app switcher · hold: Siri"
              style={{ top: height - 56 - 32 - FRONT_INSET }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                home.down();
              }}
              onPointerUp={home.up}
              onPointerCancel={home.cancel}
              onContextMenu={(e) => e.preventDefault()}
            />
            <div className="t7-front-glare" />
          </div>
        }
        back={
          <div className={`t7-backside ${luminance(back) > 0.55 ? 'lightback' : ''}`} style={{ background: back, ['--t7-back' as string]: back }}>
            <div className="t7-back-tex" />
            <div className="t7-back-sheen" />
            <div className="t7-rear-cam">
              <div className="t7-rear-lens" />
            </div>
            <div className="t7-rear-mic" />
            <svg className="t7-apple" viewBox="0 0 170 170" aria-hidden>
              <defs>
                <linearGradient id="t7-apple-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fafafa" />
                  <stop offset=".45" stopColor="#bfc0c4" />
                  <stop offset=".55" stopColor="#e8e8ea" />
                  <stop offset="1" stopColor="#8d8e92" />
                </linearGradient>
              </defs>
              <path d={APPLE_LOGO} fill="url(#t7-apple-g)" />
            </svg>
            <div className="t7-wordmark">iPod</div>
            {(appearance.engraving[0] || appearance.engraving[1]) && (
              <div className="t7-engrave">
                {appearance.engraving[0] && <div>{appearance.engraving[0]}</div>}
                {appearance.engraving[1] && <div>{appearance.engraving[1]}</div>}
              </div>
            )}
            <div className="t7-reg">
              Designed by Apple in California&nbsp;&nbsp;Assembled in China&nbsp;&nbsp;Model A2178
              <br />
              FCC ID: BCGA2178&nbsp;&nbsp;IC: 579C-A2178
            </div>
          </div>
        }
      >
        {/* Sleep/Wake on the top edge (right) */}
        <Box3D
          x={sx - 70}
          y={-sy - 1.1 + (btn === 'sleep' ? 0.8 : 0)}
          w={34}
          h={3}
          d={9}
          radius={1.5}
          color={btnColor}
          faces={{ front: btnSide, back: btnSide, top: btnColor }}
          title="Sleep/Wake (L)"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            flash('sleep');
            os.sleepWake();
          }}
        />
        {/* Volume + / − on the left edge */}
        <Box3D
          x={-sx - 1.1 + (btn === 'vup' ? 0.8 : 0)}
          y={-sy + 150}
          w={3}
          h={30}
          d={9}
          radius={1.5}
          color={btnColor}
          faces={{ front: btnSide, back: btnSide, left: btnColor }}
          title="Volume up (+)"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            volume(+1);
          }}
        />
        <Box3D
          x={-sx - 1.1 + (btn === 'vdown' ? 0.8 : 0)}
          y={-sy + 196}
          w={3}
          h={30}
          d={9}
          radius={1.5}
          color={btnColor}
          faces={{ front: btnSide, back: btnSide, left: btnColor }}
          title="Volume down (−)"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            volume(-1);
          }}
        />
      </Device3D>
    </div>
  );
}
