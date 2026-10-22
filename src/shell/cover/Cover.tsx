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
import { coverGeometry, holeMask, holesOnFacet, roundedInset, type CoverGeometry, type SockGeometry } from './geometry';
import { girth, sockMesh, type SockFacet } from './sockMesh';
import { liveOrientation } from '../stageStore';
import './cover.css';

export interface CoverInfo {
  fit: CoverFit;
  choice: CoverChoice;
  pxPerMm: number;
  size: { width: number; height: number; depth: number };
}

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

/**
 * Apple's rib knit: wide raised ribs (lit in the middle, shaded into the
 * groove between them), each made of fine knitted Vs. One tile is 5 mm of
 * rib and groove by two rows of stitches (1.2 mm).
 */
const RIB = (() => {
  const v = (cx: number, y: number) =>
    `<ellipse cx='${cx - 2}' cy='${y}' rx='2.1' ry='3.5' transform='rotate(-30 ${cx - 2} ${y})'/>` +
    `<ellipse cx='${cx + 2}' cy='${y}' rx='2.1' ry='3.5' transform='rotate(30 ${cx + 2} ${y})'/>`;
  const stitches = [5.5, 14, 22.5, 31].flatMap((cx) => [v(cx, 3), v(cx, 9)]).join('');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='50' height='12' viewBox='0 0 50 12'>` +
    `<defs><linearGradient id='r' x1='0' x2='1'>` +
    `<stop offset='0' stop-color='#000' stop-opacity='.14'/><stop offset='.1' stop-color='#fff' stop-opacity='.05'/>` +
    `<stop offset='.32' stop-color='#fff' stop-opacity='.14'/><stop offset='.56' stop-color='#fff' stop-opacity='.04'/>` +
    `<stop offset='.7' stop-color='#000' stop-opacity='.1'/><stop offset='.8' stop-color='#000' stop-opacity='.22'/>` +
    `<stop offset='.9' stop-color='#000' stop-opacity='.22'/><stop offset='1' stop-color='#000' stop-opacity='.14'/></linearGradient></defs>` +
    `<rect width='50' height='12' fill='url(#r)'/>` +
    `<g fill='#fff' fill-opacity='.16' stroke='#000' stroke-opacity='.2' stroke-width='.55'>${stitches}</g>` +
    `<g fill='#000' fill-opacity='.12'><ellipse cx='40' cy='3' rx='2.6' ry='1.4'/><ellipse cx='46' cy='9' rx='2.6' ry='1.4'/></g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
/** a little unevenness, as yarn has */
const YARN = (() => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='2' seed='3'/>` +
    `<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -0.9 0.55'/></filter><rect width='80' height='80' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
const RIB_MM = [5, 1.2];

/** px the toe's sections reach up into the section above, to fill the gap a bend opens */
const COLLAR = (d: number) => Math.min(6, d * 0.4);

function Sock({ s, color, pxPerMm, after }: { s: SockGeometry; color: string; pxPerMm: number; after: boolean }) {
  const cuff = mix(color, '#fff', 34);
  // The rows, cut at the hinges: [0] hangs on the iPod, the others bend.
  const sections = useMemo(() => {
    const relaxed = girth(s.rows[s.hinges[s.hinges.length - 1]]);
    const cuts = [0, ...s.hinges, s.rows.length - 1];
    return cuts.slice(0, -1).map((from, k) => {
      const facets = sockMesh(s.rows.slice(from, cuts[k + 1] + 1), relaxed, 4, from);
      if (k > 0) {
        // a collar just inside the section above, hidden until the toe bends
        const h = s.rows[from];
        const inside = { ...h, w: h.w - 1.2, d: Math.max(0.5, h.d - 1.2), r: Math.max(0, h.r - 0.6) };
        facets.push(...sockMesh([{ ...inside, y: h.y - COLLAR(h.d) }, inside], relaxed, 4, 100 + k * 10));
      }
      return { y: s.rows[from].y, facets };
    });
  }, [s]);
  const hinges = useRef<(HTMLDivElement | null)[]>([]);
  useSway(after, hinges);
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
          background: `linear-gradient(${shade}, ${shade}), ${YARN} ${fa.bx.toFixed(1)}px ${fa.by.toFixed(1)}px / 80px 80px, ${RIB} ${fa.bx.toFixed(2)}px ${fa.by.toFixed(2)}px / ${size}, ${base}`,
        }}
      />
    );
  };
  if (!after) {
    // beside the iPod: painted before it (see the top of this file)
    return (
      <div className="cv cv-sock" style={vars} aria-hidden="true">
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
        {sections[k].facets.map(facet)}
        {nest(k + 1)}
      </div>
    );
  const top = s.rows[0];
  return (
    <div className="cv cv-sock" style={vars} aria-hidden="true">
      {sections[0].facets.filter((fa) => fa.row >= s.sleeve).map(facet)}
      {nest(1)}
      {/* the folded edge of the opening, seen from above */}
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
      <div className="cv-sock-tag" style={{ left: s.tag.x, top: s.tag.y, width: s.tag.w, height: s.tag.h }}>
        <svg viewBox="0 0 170 170" aria-hidden="true">
          <path d={APPLE_LOGO} />
        </svg>
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
      // which way is down, in the iPod's own axes (the stage turns it rotateX(rx) rotateY(ry))
      const rx = (liveOrientation.rx * Math.PI) / 180;
      const ry = (liveOrientation.ry * Math.PI) / 180;
      const g = [Math.sin(ry) * Math.sin(rx), Math.cos(rx), -Math.cos(ry) * Math.sin(rx)];
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
