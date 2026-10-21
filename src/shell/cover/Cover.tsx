/**
 * Cases and iPod Socks.
 *
 * A cover is a hollow Device3D around the body. It is painted before the
 * body: Chrome depth-sorts 3D layers with a BSP tree built in paint order,
 * and a convex cover's planes all have the body on one side, so painted
 * first it never cuts the body (cut edges sparkle). It takes no pointer
 * events: the iPod's controls work through it, as they do through a real
 * silicone case or a sock.
 */
import { useCallback, useMemo, type CSSProperties } from 'react';
import type { CoverChoice, CoverFit } from '../../devices/types';
import { Device3D, type EdgeSlice } from '../Device3D';
import type { Facet } from '../edgeShell';
import { coverGeometry, holeMask, holesOnFacet, roundedInset, type CoverGeometry } from './geometry';
import './cover.css';

export interface CoverInfo {
  fit: CoverFit;
  choice: CoverChoice;
  pxPerMm: number;
  size: { width: number; height: number; depth: number };
  jackNy?: 1 | -1;
}

/** One knitted stitch: two leaning loops (a V). Tiled at 3.4 × 2.6 mm. */
const KNIT =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cg stroke='rgba(0,0,0,0.24)' stroke-width='0.5' fill='rgba(255,255,255,0.15)'%3E%3Cellipse cx='2.7' cy='5' rx='2.3' ry='5.6' transform='rotate(-22 2.7 5)'/%3E%3Cellipse cx='7.3' cy='5' rx='2.3' ry='5.6' transform='rotate(22 7.3 5)'/%3E%3C/g%3E%3C/svg%3E\")";
const STITCH_MM = [3.4, 2.6];
/** Fabric and silicone are soft: their sides need fewer, longer pieces than metal. */
const SOFT = { bandPx: 9, curveTol: 0.5 };

const mix = (c: string, other: string, pct: number) => `color-mix(in srgb, ${c} ${100 - pct}%, ${other})`;

/** The case or sock on the device (rendered through shell/bodySlot). */
export function Cover({ info }: { info: CoverInfo }) {
  const { fit, choice, pxPerMm, size, jackNy } = info;
  const kind = choice.kind === 'none' ? 'silicone' : choice.kind;
  const color = choice.color;
  const g = useMemo(() => coverGeometry(fit, kind, pxPerMm, size, jackNy), [fit, kind, pxPerMm, size, jackNy]);
  const sock = kind === 'sock';

  // The sides: lit from the top left, a little darker towards the back.
  // A sock's are knitted too.
  const edge = useMemo(() => {
    const knit = `${KNIT} 0 0 / ${STITCH_MM[0] * pxPerMm}px ${STITCH_MM[1] * pxPerMm}px, `;
    const tones = Array.from({ length: 5 }, (_, i) => {
      const dark = 4 + i * 4;
      const shade = `linear-gradient(150deg, ${mix(color, '#fff', sock ? 10 : 14)}, ${mix(color, '#000', dark)} 55%, ${mix(color, '#000', dark + 14)})`;
      return sock ? knit + shade : shade;
    });
    return (u: number): EdgeSlice => ({
      inset: roundedInset(u, g.d, g.round),
      color: tones[Math.min(4, Math.floor(u * 5))],
    });
  }, [color, sock, g, pxPerMm]);

  const facetMask = useCallback(
    (fa: Facet) => {
      const rects = holesOnFacet(fa, g.holes);
      return rects.length ? holeMask(fa.w, fa.h, rects, (r) => Math.min(r.w, r.h) / 2) : undefined;
    },
    [g],
  );

  const vars = {
    ['--cv' as string]: color,
    ['--cv-hi' as string]: mix(color, '#fff', 16),
    ['--cv-lo' as string]: mix(color, '#000', 22),
    ['--mm' as string]: `${pxPerMm}px`,
    ['--cv-knit' as string]: KNIT,
    ['--cv-stitch' as string]: `${STITCH_MM[0] * pxPerMm}px ${STITCH_MM[1] * pxPerMm}px`,
  } as CSSProperties;

  return (
    <div className={`cv cv-${kind}`} style={{ ...vars, transform: `translate3d(${g.cx - g.w / 2}px, ${g.cy - g.h / 2}px, ${g.cz}px)` }} aria-hidden="true">
      <Device3D
        width={g.w}
        height={g.h}
        depth={g.d}
        radius={g.radius}
        edge={edge}
        hollow
        facetMask={facetMask}
        detail={SOFT}
        frontInset={g.round}
        backInset={g.round}
        frontStyle={{ background: 'none' }}
        backStyle={{ background: 'none' }}
        front={sock ? <SockFace g={g} /> : <CaseFront g={g} />}
        back={sock ? <SockFace g={g} back /> : <CaseBack g={g} fit={fit} />}
      />
    </div>
  );
}

/** The lip around the front opening (and stitching on leather). */
function CaseFront({ g }: { g: CoverGeometry }) {
  const ring = g.t + g.lip - g.round;
  return (
    <>
      <div className="cv-ring cv-tex" style={{ borderWidth: ring }} />
      <div className="cv-stitch" style={{ inset: ring * 0.45, borderRadius: Math.max(0, g.radius - g.round - ring * 0.45) }} />
    </>
  );
}

function CaseBack({ g, fit }: { g: CoverGeometry; fit: CoverFit }) {
  // the camera hole, from the body's back to the cover's back face
  const cam = fit.camera;
  const off = g.t - g.round;
  const mask = cam ? `radial-gradient(circle ${cam.d / 2}px at ${cam.x + off}px ${cam.y + off}px, #0000 calc(100% - 0.6px), #000)` : undefined;
  return (
    <>
      <div className="cv-fill cv-tex" style={{ maskImage: mask, WebkitMaskImage: mask }} />
      <div className="cv-stitch" style={{ inset: 4 * (g.t / 8), borderRadius: Math.max(0, g.radius - g.round - 4 * (g.t / 8)) }} />
    </>
  );
}

/** Knitted fabric, with the ribbed cuff at the mouth. */
function SockFace({ g, back }: { g: CoverGeometry; back?: boolean }) {
  const cuff = 9 * (g.t / 1.4);
  return (
    <div className={`cv-fill cv-knit ${back ? 'cv-knit-back' : ''}`}>
      <div className="cv-cuff" style={{ height: cuff, [g.mouth === 'top' ? 'top' : 'bottom']: 0 }} />
      <div className="cv-fold" />
    </div>
  );
}
