/**
 * Cases and iPod Socks.
 *
 * A cover is a hollow Device3D around the body. It is painted before the
 * body: Chrome depth-sorts 3D layers with a BSP tree built in paint order,
 * and a convex cover's planes all have the body on one side, so painted
 * first it never cuts the body (cut edges sparkle). It takes no pointer
 * events: the iPod's controls work through it, as they do through a real
 * silicone case or a sock.
 *
 * A sock's toe, its Apple tag and the rim of its opening lie partly outside
 * the iPod's outline (beside or below it), where its planes would cut it, so
 * those are painted after the body instead (`after`).
 */
import { useCallback, useMemo, type CSSProperties } from 'react';
import type { CoverChoice, CoverFit } from '../../devices/types';
import { APPLE_LOGO } from '../../core/util/appleLogo';
import { Device3D, type EdgeSlice } from '../Device3D';
import type { Facet } from '../edgeShell';
import { coverGeometry, holeMask, holesOnFacet, roundedInset, type CoverGeometry, type SockGeometry, type SockPiece } from './geometry';
import './cover.css';

export interface CoverInfo {
  fit: CoverFit;
  choice: CoverChoice;
  pxPerMm: number;
  size: { width: number; height: number; depth: number };
}

/**
 * Rib knit, like Apple's socks: a raised column of knitted Vs, then a sunken
 * purl rib. Tiled at 3 × 2 mm.
 */
const KNIT =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='8' viewBox='0 0 10 8'%3E%3Crect x='6.2' width='3.8' height='8' fill='rgba(0,0,0,0.18)'/%3E%3Cg stroke='rgba(0,0,0,0.2)' stroke-width='0.45' fill='rgba(255,255,255,0.17)'%3E%3Cellipse cx='1.9' cy='4' rx='1.55' ry='4.6' transform='rotate(-20 1.9 4)'/%3E%3Cellipse cx='4.4' cy='4' rx='1.55' ry='4.6' transform='rotate(20 4.4 4)'/%3E%3C/g%3E%3C/svg%3E\")";
const STITCH_MM = [3, 2];
/** Fabric and silicone are soft: their sides need fewer, longer pieces than metal. */
const SOFT = { bandPx: 9, curveTol: 0.5 };

const mix = (c: string, other: string, pct: number) => `color-mix(in srgb, ${c} ${100 - pct}%, ${other})`;

/** The case or sock on the device (rendered through shell/bodySlot). */
export function Cover({ info, after = false }: { info: CoverInfo; after?: boolean }) {
  const { fit, choice, pxPerMm, size } = info;
  const kind = choice.kind === 'none' ? 'silicone' : choice.kind;
  const g = useMemo(() => coverGeometry(fit, kind, pxPerMm, size), [fit, kind, pxPerMm, size]);
  if (g.sock) return <Sock s={g.sock} color={choice.color} pxPerMm={pxPerMm} after={after} />;
  return after ? null : <Case g={g} fit={fit} kind={kind} color={choice.color} pxPerMm={pxPerMm} />;
}

function Case({ g, fit, kind, color, pxPerMm }: { g: CoverGeometry; fit: CoverFit; kind: string; color: string; pxPerMm: number }) {
  const clear = kind === 'clear';

  // The sides: lit from the top left, a little darker towards the back.
  // Plain shading only: an image here (the knit) is drawn stretched over
  // each piece, and where a piece also has a hole masked out of it that
  // costs seconds per frame.
  const edge = useMemo(() => {
    // Clear polycarbonate: mostly see-through, catching the light along its edges.
    // A little grey, so even a colorless case shows its edges where they refract.
    const glass = (pct: number) => `color-mix(in srgb, color-mix(in srgb, ${color} 55%, #66707c) ${pct}%, transparent)`;
    const tones = Array.from({ length: 5 }, (_, i) => {
      if (clear) return `linear-gradient(150deg, rgba(255,255,255,0.55), ${glass(18 + i * 3)} 45%, ${glass(30 + i * 3)})`;
      const dark = 4 + i * 4;
      return `linear-gradient(150deg, ${mix(color, '#fff', 14)}, ${mix(color, '#000', dark)} 55%, ${mix(color, '#000', dark + 14)})`;
    });
    return (u: number): EdgeSlice => ({
      inset: roundedInset(u, g.d, g.round),
      color: tones[Math.min(4, Math.floor(u * 5))],
    });
  }, [color, clear, g]);

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
        front={<CaseFront g={g} />}
        back={<CaseBack g={g} fit={fit} />}
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

// ------------------------------------------------------------------ socks

/** Fabric is soft and plain: no cut-outs, fewer pieces. */
const SLEEVE_DETAIL = { ...SOFT, open: 'top' as const };

function Sock({ s, color, pxPerMm, after }: { s: SockGeometry; color: string; pxPerMm: number; after: boolean }) {
  const cuffColor = mix(color, '#fff', 30);
  const vars = {
    ['--cv' as string]: color,
    ['--cv-cuff' as string]: cuffColor,
    ['--cv-tag' as string]: mix(color, '#fff', 58),
    ['--mm' as string]: `${pxPerMm}px`,
    ['--cv-knit' as string]: KNIT,
    ['--cv-stitch' as string]: `${STITCH_MM[0] * pxPerMm}px ${STITCH_MM[1] * pxPerMm}px`,
  } as CSSProperties;
  if (!after) {
    // the sleeve, around the iPod: painted before it
    return (
      <div className="cv cv-sock" style={vars} aria-hidden="true">
        <SockPart p={s.sleeve} color={color} cuff={s.cuff} cuffColor={cuffColor} />
      </div>
    );
  }
  return (
    <div className="cv cv-sock" style={vars} aria-hidden="true">
      <SockPart p={s.toe} color={color} />
      {/* the folded edge of the opening, seen from above */}
      <div
        className="cv-ring cv-sock-rim"
        style={{
          width: s.sleeve.w,
          height: s.sleeve.d,
          borderRadius: s.sleeve.round,
          borderWidth: 1.4 * pxPerMm,
          transform: `translate3d(${-s.sleeve.w / 2}px, ${s.mouth - s.sleeve.d / 2}px, 0) rotateX(90deg)`,
        }}
      />
      <div className="cv-sock-tag" style={{ left: s.tag.x, top: s.tag.y, width: s.tag.w, height: s.tag.h }}>
        <svg viewBox="0 0 170 170" aria-hidden="true">
          <path d={APPLE_LOGO} />
        </svg>
      </div>
    </div>
  );
}

/** One rounded piece of a sock: the sleeve (open at the top, with the cuff) or the toe. */
function SockPart({ p, color, cuff, cuffColor }: { p: SockPiece; color: string; cuff?: number; cuffColor?: string }) {
  const edge = useMemo(() => {
    // the cuff, then the body color, laid out down the piece; shaded lighter
    // at the top left and darker towards the back
    // (soft-edged: each band lays it out from its own inset, which would show as steps)
    const soft = p.round * 0.6;
    const base = cuff && cuffColor ? `linear-gradient(180deg, ${cuffColor} ${cuff - soft}px, ${color} ${cuff + soft}px)` : color;
    const tones = Array.from({ length: 5 }, (_, i) => {
      const dark = (0.04 + i * 0.035).toFixed(3);
      return `linear-gradient(150deg, rgba(255,255,255,0.12), rgba(0,0,0,${dark}) 55%, rgba(0,0,0,${(+dark + 0.12).toFixed(3)})), ${base}`;
    });
    return (u: number): EdgeSlice => ({ inset: roundedInset(u, p.d, p.round), color: tones[Math.min(4, Math.floor(u * 5))] });
  }, [p, color, cuff, cuffColor]);
  const open = !!cuff;
  // with the top open, the faces run right up to the opening
  const faceStyle: CSSProperties = { background: 'none', ...(open ? { top: 0 } : null) };
  const face = (back: boolean) => (
    <div className={`cv-fill cv-knit ${back ? 'cv-knit-back' : ''}`}>
      {open && <div className="cv-cuff" style={{ height: cuff }} />}
      <div className="cv-fold" />
    </div>
  );
  return (
    <div className="cv-piece" style={{ transform: `translate3d(${-p.w / 2}px, ${p.cy - p.h / 2}px, 0)` }}>
      <Device3D
        width={p.w}
        height={p.h}
        depth={p.d}
        radius={p.radius}
        edge={edge}
        hollow
        detail={open ? SLEEVE_DETAIL : SOFT}
        frontInset={p.round}
        backInset={p.round}
        frontStyle={faceStyle}
        backStyle={faceStyle}
        front={face(false)}
        back={face(true)}
      />
    </div>
  );
}
