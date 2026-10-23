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
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { CoverChoice, CoverFit } from '../../devices/types';
import { APPLE_LOGO } from '../../core/util/appleLogo';
import { Device3D, type EdgeSlice } from '../Device3D';
import type { Facet } from '../edgeShell';
import { PULL_FILL } from './sockPull';
import { coverGeometry, holeMask, holesOnFacet, roundedInset, type CoverGeometry, type SockGeometry } from './geometry';
import { girth, sockMesh, type SockFacet } from './sockMesh';
import { sockCuff } from './sockColors';
import { liveOrientation } from '../stageStore';
import './cover.css';

export interface CoverInfo {
  fit: CoverFit;
  choice: CoverChoice;
  pxPerMm: number;
  size: { width: number; height: number; depth: number };
}

/**
 * Fabric and silicone are soft: their sides need fewer, longer pieces than
 * metal. Each piece is a 3D layer the browser sorts every frame, so this
 * keeps a case to about 250 of them (a phone turning an iPod in one feels it).
 */
const SOFT = { bandPx: 20, curveTol: 2, corner: 5 };

const mix = (c: string, other: string, pct: number) => `color-mix(in srgb, ${c} ${100 - pct}%, ${other})`;

/** The case or sock on the device (rendered through shell/bodySlot). */
/**
 * `rim`, for a sock drawn in a 3D space of its own over the iPod (Stage.tsx):
 * 'only' draws just the rim of its opening and its tag, in the iPod's space
 * (the iPod comes up through the rim, and can hide the tag); 'none' all the
 * rest, with a second tag for when it is seen from the tag's side (the
 * stage shows one tag or the other).
 */
export function Cover({ info, after = false, rim = 'with' }: { info: CoverInfo; after?: boolean; rim?: 'with' | 'none' | 'only' }) {
  const { fit, choice, pxPerMm, size } = info;
  const kind = choice.kind === 'none' ? 'silicone' : choice.kind;
  const g = useMemo(() => coverGeometry(fit, kind, pxPerMm, size), [fit, kind, pxPerMm, size]);
  if (g.sock) return <Sock s={g.sock} color={choice.color} pxPerMm={pxPerMm} after={after} rim={rim} />;
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

/** A rounded rectangle as SVG path data. */
const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
  const n = (v: number) => +v.toFixed(2);
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`
  );
};

/**
 * Openings are cut with clip-path paths (even-odd: an outline with a hole).
 * Not masks: a mask doesn't survive saving the iPod as a picture.
 */
const cutOut = (outline: string, hole: string) => `path(evenodd, '${outline} ${hole}')`;

/** The lip around the front opening (and stitching on leather). */
function CaseFront({ g }: { g: CoverGeometry }) {
  const ring = g.t + g.lip - g.round;
  const fw = g.w - 2 * g.round;
  const fh = g.h - 2 * g.round;
  const r = Math.max(0, g.radius - g.round);
  const clip = cutOut(roundRect(0, 0, fw, fh, r), roundRect(ring, ring, fw - 2 * ring, fh - 2 * ring, r - ring));
  return (
    <>
      <div className="cv-ring cv-tex" style={{ clipPath: clip }} />
      <div className="cv-stitch" style={{ inset: ring * 0.45, borderRadius: Math.max(0, g.radius - g.round - ring * 0.45) }} />
    </>
  );
}

function CaseBack({ g, fit }: { g: CoverGeometry; fit: CoverFit }) {
  // the camera hole, from the body's back to the cover's back face
  const cam = fit.camera;
  const off = g.t - g.round;
  const fw = g.w - 2 * g.round;
  const fh = g.h - 2 * g.round;
  let clip: string | undefined;
  if (cam) {
    const cx = cam.x + off;
    const cy = cam.y + off;
    const r = cam.d / 2;
    clip = cutOut(roundRect(0, 0, fw, fh, Math.max(0, g.radius - g.round)), `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
  }
  return (
    <>
      <div className="cv-fill cv-tex" style={{ clipPath: clip }} />
      <div className="cv-stitch" style={{ inset: 4 * (g.t / 8), borderRadius: Math.max(0, g.radius - g.round - 4 * (g.t / 8)) }} />
    </>
  );
}

// ------------------------------------------------------------------ socks

/**
 * Apple's knit, as on their swatches: broad stripes of two stitches side by
 * side, nearly as wide as each other. The knit rib (the sock's color) is
 * columns of Vs; the purl stripe beside it, rows of little sideways bumps,
 * catches more light and looks paler. One tile is one rib and one purl
 * stripe, 11 stitches across (5 + 6), by two rows of stitches. Only light
 * and shade are drawn: the color under it shows through.
 */
const RIB = (() => {
  const W = 110;
  const H = 16;
  let knit = '';
  for (let c = 0; c < 5; c++)
    for (let r = 0; r < 2; r++) {
      const x = 5 + c * 10;
      const y = 4 + r * 8;
      knit +=
        `<ellipse cx='${x - 2.3}' cy='${y}' rx='2.3' ry='4.5' transform='rotate(-28 ${x - 2.3} ${y})'/>` +
        `<ellipse cx='${x + 2.3}' cy='${y}' rx='2.3' ry='4.5' transform='rotate(28 ${x + 2.3} ${y})'/>`;
    }
  let purl = '';
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 7; c++) {
      const x = 50 + c * 10 + (r % 2 ? 5 : 0);
      if (x < 51 || x > 109) continue;
      purl += `<ellipse cx='${x}' cy='${2 + r * 4}' rx='3.3' ry='1.25'/>`;
    }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'>` +
    // the purl stripe, softly edged
    `<defs><linearGradient id='p' x1='0' x2='1'>` +
    `<stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.44' stop-color='#fff' stop-opacity='0'/>` +
    `<stop offset='.48' stop-color='#fff' stop-opacity='.24'/><stop offset='.97' stop-color='#fff' stop-opacity='.24'/>` +
    `<stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient></defs>` +
    `<rect width='${W}' height='${H}' fill='url(#p)'/>` +
    `<g fill='#fff' fill-opacity='.13' stroke='#000' stroke-opacity='.2' stroke-width='.6'>${knit}</g>` +
    `<g fill='#fff' fill-opacity='.2' stroke='#000' stroke-opacity='.07' stroke-width='.5'>${purl}</g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
/** one tile (a rib and a purl stripe, two rows), mm, unstretched */
const RIB_MM = [8.5, 1.4];
/**
 * Pieces round each corner of the sock's cross-section: every piece is a 3D
 * layer the browser sorts and draws again each frame the iPod moves. Round
 * the iPod the corners are soft and the shading baked in, so three read as
 * smooth; the empty toe below is nearly flat, and one will do.
 */
const CORNER = 3;
const TOE_CORNER = 1;

/** px the toe's sections reach up into the section above, to fill the gap a bend opens */
const COLLAR = (d: number) => Math.min(6, d * 0.4);

function Sock({ s, color, pxPerMm, after, rim }: { s: SockGeometry; color: string; pxPerMm: number; after: boolean; rim: 'with' | 'none' | 'only' }) {
  const cuff = sockCuff(color);
  // The rows, cut at the hinges: [0] hangs on the iPod, the others bend.
  const sections = useMemo(() => {
    const loose = s.rows[s.hinges[s.hinges.length - 1]];
    const cuts = [0, ...s.hinges, s.rows.length - 1];
    return cuts.slice(0, -1).map((from, k) => {
      const corner = k > 0 ? TOE_CORNER : CORNER;
      const relaxed = girth(loose, corner);
      const facets = sockMesh(s.rows.slice(from, cuts[k + 1] + 1), relaxed, corner, from);
      if (k > 0) {
        // a collar just inside the section above, hidden until the toe bends
        const h = s.rows[from];
        const inside = { ...h, w: h.w - 1.2, d: Math.max(0.5, h.d - 1.2), r: Math.max(0, h.r - 0.6) };
        facets.push(...sockMesh([{ ...inside, y: h.y - COLLAR(h.d) }, inside], relaxed, corner, 100 + k * 10));
      }
      return { y: s.rows[from].y, facets };
    });
  }, [s]);
  // When it's pulled down (cover/sockPull), the fabric that leaves the iPod
  // narrows at once below it and makes the toe longer: this straight piece,
  // as narrow as the toe's top, is stretched to fill that length.
  const filler = useMemo(() => {
    const r = s.rows[s.hinges[0]];
    const relaxed = girth(s.rows[s.hinges[s.hinges.length - 1]], TOE_CORNER);
    return { y: r.y, facets: sockMesh([r, { ...r, y: r.y + PULL_FILL }], relaxed, TOE_CORNER, 200) };
  }, [s]);
  const hinges = useRef<(HTMLDivElement | null)[]>([]);
  useSway(after && rim !== 'only', hinges);
  const vars = {
    ['--cv' as string]: color,
    ['--cv-cuff' as string]: cuff,
    ['--mm' as string]: `${pxPerMm}px`,
  } as CSSProperties;
  const facet = (fa: SockFacet) => {
    const shade =
      fa.light > 0.55 ? `rgba(255,255,255,${((fa.light - 0.55) * 0.35).toFixed(3)})` : `rgba(0,0,0,${Math.min(0.45, (0.55 - fa.light) * 0.3).toFixed(3)})`;
    const base = s.cuffEnd <= fa.top ? color : s.cuffEnd >= fa.top + fa.h ? cuff : `linear-gradient(180deg, ${cuff} ${(s.cuffEnd - fa.top).toFixed(2)}px, ${color} 0)`;
    const size = `${(RIB_MM[0] * pxPerMm * fa.stretch).toFixed(2)}px ${RIB_MM[1] * pxPerMm}px`;
    return (
      <div
        key={fa.key}
        className="d3-facet"
        style={{
          width: fa.w,
          height: fa.h,
          transform: fa.matrix,
          background: `linear-gradient(${shade}, ${shade}), ${RIB} ${fa.bx.toFixed(2)}px ${fa.by.toFixed(2)}px / ${size}, ${base}`,
        }}
      />
    );
  };
  if (!after) {
    // beside the iPod: painted before it (see the top of this file)
    // pulled down, it gathers towards the iPod's bottom (scaled about it)
    return (
      <div className="cv cv-sock cv-sock-sleeve" style={{ ...vars, transformOrigin: `0 ${s.rows[s.sleeve].y}px 0` }} aria-hidden="true">
        {sections[0].facets.filter((fa) => fa.row < s.sleeve).map(facet)}
      </div>
    );
  }
  // each bending section hangs inside the one above, from its hinge
  const nest = (k: number): React.ReactNode =>
    k >= sections.length ? null : (
      <div
        className="cv-hinge"
        ref={(n) => {
          hinges.current[k - 1] = n;
        }}
        style={{ transformOrigin: `0 ${sections[k].y}px 0` }}
      >
        {k === 1 && (
          <div className="cv-pull-fill" style={{ transformOrigin: `0 ${filler.y}px 0` }}>
            {filler.facets.map(facet)}
          </div>
        )}
        <div className={k === 1 ? 'cv-pull-toe' : 'cv-group'}>
          {sections[k].facets.map(facet)}
          {nest(k + 1)}
        </div>
      </div>
    );
  const top = s.rows[0];
  // the folded edge of the opening, seen from above
  const ring = (
    <div
      className="cv-ring cv-sock-rim"
      style={{
        width: top.w,
        height: top.d,
        borderRadius: top.r,
        borderWidth: 1.4 * pxPerMm,
        transform: `translate3d(${-top.w / 2}px, ${s.mouth - top.d / 2}px, 0) rotateX(90deg)`,
      }}
    />
  );
  const tag = (
    <div className={`cv-sock-tag ${rim === 'none' ? 'cv-tag-near' : rim === 'only' ? 'cv-tag-far' : ''}`} style={{ left: s.tag.x, top: s.tag.y, width: s.tag.w, height: s.tag.h }}>
      <svg viewBox="0 0 170 170" aria-hidden="true">
        <path d={APPLE_LOGO} />
      </svg>
    </div>
  );
  if (rim === 'only')
    return (
      <div className="cv cv-sock-mouth" style={vars} aria-hidden="true">
        <div className="cv-pull-shift">
          {ring}
          {tag}
        </div>
      </div>
    );
  return (
    <div className="cv cv-sock" style={vars} aria-hidden="true">
      {/* below the iPod: pushed up, it gets shorter (scaled about the iPod's bottom) */}
      <div className="cv-pull-below" style={{ transformOrigin: `0 ${s.rows[s.sleeve].y}px 0` }}>
        {sections[0].facets.filter((fa) => fa.row >= s.sleeve).map(facet)}
        {nest(1)}
      </div>
      <div className="cv-pull-shift">
        {rim === 'with' && ring}
        {tag}
      </div>
    </div>
  );
}

/**
 * The empty toe is soft: it sags towards the ground as the iPod tilts and
 * swings a little when it moves, springing back, then settles. The bend is
 * shared between the hinges, so it curves rather than folding in one place.
 * It only bends forwards and back: a flat strip of fabric hardly bends
 * within its own plane.
 */
function useSway(on: boolean, hinges: React.RefObject<(HTMLDivElement | null)[]>) {
  useEffect(() => {
    if (!on) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const st = { x: 0, vx: 0, last: performance.now(), shown: '' };
    const LIMIT = 70;
    const GIVE = 0.6; // how far it goes towards hanging straight down
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - st.last) / 1000);
      st.last = now;
      // which way is down, in the iPod's own axes (the stage turns it rotateX(rx) rotateY(ry) rotateZ(roll))
      const rx = (liveOrientation.rx * Math.PI) / 180;
      const ry = (liveOrientation.ry * Math.PI) / 180;
      const g0 = [Math.sin(ry) * Math.sin(rx), Math.cos(rx), -Math.cos(ry) * Math.sin(rx)];
      // …then turned in its own plane when it lies on its side
      const rr = (liveOrientation.roll * Math.PI) / 180;
      const g = [g0[0] * Math.cos(rr) + g0[1] * Math.sin(rr), -g0[0] * Math.sin(rr) + g0[1] * Math.cos(rr), g0[2]];
      const deg = (a: number) => Math.max(-LIMIT, Math.min(LIMIT, (a * 180) / Math.PI));
      const tx = deg(Math.atan2(g[2], Math.max(0.05, g[1]))) * GIVE;
      if (reduce) st.x = tx;
      else {
        // a damped spring towards hanging
        const k = 70;
        const c = 7;
        st.vx += (k * (tx - st.x) - c * st.vx) * dt;
        st.x += st.vx * dt;
      }
      const n = Math.max(1, hinges.current.length);
      const t = `rotateX(${(st.x / n).toFixed(2)}deg)`;
      if (t === st.shown) return;
      st.shown = t;
      for (const h of hinges.current) if (h) h.style.transform = t;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on, hinges]);
}
