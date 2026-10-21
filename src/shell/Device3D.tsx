import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { buildShell, liningSlices, radiusCss, type Facet, type Radius, type ShellDetail } from './edgeShell';

export type { CornerRadii, Radius } from './edgeShell';

/**
 * A device body with real thickness, built from CSS 3D planes.
 *
 *  - `front` and `back` are ordinary DOM (fully interactive on the front).
 *  - The sides follow an edge profile: each depth has an inset and a color,
 *    which gives curved/chamfered edges (iPod classic's chrome back, iPod
 *    touch's rounded aluminium sides…). They are one continuous faceted
 *    surface, see edgeShell.ts.
 *
 * The coordinate origin is the centre of the device; +z points at the viewer.
 */
export interface EdgeSlice {
  /** how far the outline is pulled in at this depth, px */
  inset?: number;
  /** CSS background of the edge at this depth (laid out across the whole device box) */
  color: string;
}

export interface Device3DProps {
  width: number;
  height: number;
  depth: number;
  /** corner radius of the outline, px, or elliptical radii per corner */
  radius: Radius;
  front: ReactNode;
  back: ReactNode;
  /** Edge profile from the front (t=0) to the back (t=1). */
  edge: (t: number) => EdgeSlice;
  /**
   * Depths (0–1) where the profile or the finish changes abruptly (a seam,
   * the edge of the cover glass), so the surface breaks exactly there.
   */
  breaks?: number[];
  /** Inset of the front/back faces (when the edge curves in towards a face). */
  frontInset?: number;
  backInset?: number;
  frontStyle?: CSSProperties;
  backStyle?: CSSProperties;
  /** Extra 3D parts (use <Box3D>), positioned relative to the device centre. */
  children?: ReactNode;
  /**
   * Flat parts just outside the outline (ports, edge labels). Painted before
   * the sides so Chrome's 3D depth sort uses them as the first planes and
   * never cuts them along the planes of the sides (which shows up as
   * hairline stripes).
   */
  decals?: ReactNode;
  /** Painted first of all: a case or sock around the body (see shell/cover). */
  under?: ReactNode;
  /**
   * A shell with nothing inside it (a case): no solid lining behind the
   * sides, which would hide what is inside.
   */
  hollow?: boolean;
  /** CSS mask image for a facet of the sides (holes cut in a case); keep it stable */
  facetMask?: (f: Facet) => string | undefined;
  /** coarser sides (soft things like a sock need fewer pieces); keep it stable */
  detail?: ShellDetail;
  className?: string;
}

export function Device3D({
  width,
  height,
  depth,
  radius,
  front,
  back,
  edge,
  breaks,
  frontInset = 0,
  backInset = 0,
  frontStyle,
  backStyle,
  children,
  decals,
  under,
  hollow = false,
  facetMask,
  detail,
  className,
}: Device3DProps) {
  const half = depth / 2;
  const breakKey = breaks?.join(',') ?? '';
  const radiusKey = radiusCss(radius, 0);
  const sides = useMemo(
    () => (
      <Shell
        width={width}
        height={height}
        depth={depth}
        radius={radius}
        edge={edge}
        breaks={breakKey}
        frontInset={frontInset}
        backInset={backInset}
        hollow={hollow}
        facetMask={facetMask}
        detail={detail}
      />
    ),
    // radius by value (callers may pass a new object each render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, depth, radiusKey, edge, breakKey, frontInset, backInset, hollow, facetMask, detail],
  );

  return (
    <div className={`d3-root ${className ?? ''}`} style={{ width, height }}>
      {under}
      {decals}
      {sides}
      <div
        className="d3-face d3-back"
        style={{
          inset: backInset,
          borderRadius: radiusCss(radius, backInset),
          transform: `rotateY(180deg) translateZ(${half}px)`,
          ...backStyle,
        }}
      >
        {back}
      </div>
      <div
        className="d3-face d3-front"
        style={{
          inset: frontInset,
          borderRadius: radiusCss(radius, frontInset),
          transform: `translateZ(${half}px)`,
          ...frontStyle,
        }}
      >
        {front}
      </div>
      {children}
    </div>
  );
}

/** The sides as one faceted surface (no gaps at any angle). */
function Shell({
  width,
  height,
  depth,
  radius,
  edge,
  breaks,
  frontInset,
  backInset,
  hollow,
  facetMask,
  detail,
}: {
  width: number;
  height: number;
  depth: number;
  radius: Radius;
  edge: (t: number) => EdgeSlice;
  breaks: string;
  frontInset: number;
  backInset: number;
  hollow: boolean;
  facetMask?: (f: Facet) => string | undefined;
  detail?: ShellDetail;
}) {
  const facets = useMemo(
    () => buildShell(width, height, depth, radius, edge, breaks ? breaks.split(',').map(Number) : [], detail),
    [width, height, depth, radius, edge, breaks, detail],
  );
  const lining = useMemo(() => (hollow ? [] : liningSlices(edge, depth, radius)), [hollow, edge, depth, radius]);
  const half = depth / 2;
  const front = edge(0);
  const back = edge(1);
  // Where a face overhangs the sides (it is wider than the outline at that
  // depth) its underside would be see-through: give it a backing that faces
  // the other way. Where the face is narrower, fill the ring around it.
  const cap = (z: number, faceInset: number, s: EdgeSlice, facing: 1 | -1) => {
    const edgeInset = s.inset ?? 0;
    if (hollow || Math.abs(faceInset - edgeInset) < 0.05) return null; // the sides meet the face exactly
    const overhang = faceInset < edgeInset;
    const inset = Math.min(faceInset, edgeInset);
    const turn = overhang ? facing === 1 : facing === -1; // a backing faces away from the face it backs
    return (
      <div
        className="d3-cap"
        style={{
          inset,
          borderRadius: radiusCss(radius, inset),
          background: s.color,
          transform: `translateZ(${z}px)${turn ? ' rotateY(180deg)' : ''}`,
        }}
      />
    );
  };
  return (
    <>
      {/* just inside each face, never in its plane (coplanar layers flicker) */}
      {cap(half - 0.04, frontInset, front, 1)}
      {cap(-half + 0.04, backInset, back, -1)}
      {facets.map((fa) => {
        const mask = facetMask?.(fa);
        const holes = mask ? { maskImage: mask, WebkitMaskImage: mask, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' } : null;
        return (
          <div key={fa.key} className="d3-facet" style={{ width: fa.w, height: fa.h, transform: fa.matrix, clipPath: fa.clip, ...holes }}>
            <i style={{ width: fa.base.w, height: fa.base.h, background: fa.base.color, transform: fa.base.matrix }} />
            {fa.blend && (
              <b style={{ maskImage: fa.blend.mask, WebkitMaskImage: fa.blend.mask }}>
                <i style={{ width: fa.blend.w, height: fa.blend.h, background: fa.blend.color, transform: fa.blend.matrix }} />
              </b>
            )}
          </div>
        );
      })}
      {/*
        * Painted after the sides: Chrome's 3D sort cuts every later layer
        * along the planes of earlier ones, and cut edges sparkle. Inside the
        * shell these cross nothing, so nothing gets cut.
        */}
      {lining.map((l) => (
        <div
          key={l.t}
          className="d3-lining"
          style={{ inset: l.inset, borderRadius: radiusCss(radius, l.inset), background: l.color, transform: `translateZ(${(half - l.t * depth).toFixed(2)}px)` }}
        />
      ))}
    </>
  );
}

/**
 * A rounded slab standing out of one of the device's edges (side buttons):
 * a small Device3D turned so its front face points along `facing`.
 *
 *  - facing ±x: the outer face is `w` along the device's z by `h` along y
 *  - facing ±y: the outer face is `w` along the device's x by `h` along z
 *
 * `t` is how far it stands out (its depth); x/y/z is its centre relative to
 * the device centre.
 */
export function Slab3D({
  x,
  y,
  z = 0,
  facing,
  w,
  h,
  t,
  radius,
  face,
  edge,
  title,
  className,
  onPointerDown,
  onPointerUp,
}: {
  x: number;
  y: number;
  z?: number;
  facing: '-x' | '+x' | '-y' | '+y';
  w: number;
  h: number;
  t: number;
  radius: number;
  /** CSS background of the outer face */
  face: string;
  edge: (t: number) => EdgeSlice;
  title?: string;
  className?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
}) {
  const turn = { '-x': 'rotateY(-90deg)', '+x': 'rotateY(90deg)', '-y': 'rotateX(90deg)', '+y': 'rotateX(-90deg)' }[facing];
  return (
    <div
      className={`d3-box ${className ?? ''}`}
      data-control={onPointerDown ? '' : undefined}
      title={title}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ transform: `translate3d(${x}px, ${y}px, ${z}px) ${turn}` }}
    >
      <div className="d3-slab" style={{ left: -w / 2, top: -h / 2 }}>
        <Device3D
          width={w}
          height={h}
          depth={t}
          radius={Math.min(radius, w / 2, h / 2)}
          edge={edge}
          frontInset={edge(0).inset ?? 0}
          front={<div className="d3-slab-face" style={{ background: face }} />}
          back={null}
        />
      </div>
    </div>
  );
}

/**
 * A solid cuboid (buttons, switches, the shuffle's clip…).
 * x/y/z is the centre of the box relative to the device centre.
 */
export function Box3D({
  x,
  y,
  z = 0,
  w,
  h,
  d,
  color,
  faces,
  radius = 0,
  rotate,
  onPointerDown,
  onPointerUp,
  onClick,
  title,
  className,
}: {
  x: number;
  y: number;
  z?: number;
  w: number;
  h: number;
  d: number;
  color: string;
  /** per-face background overrides */
  faces?: Partial<Record<'front' | 'back' | 'left' | 'right' | 'top' | 'bottom', string>>;
  radius?: number;
  rotate?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  className?: string;
}) {
  const face = (name: keyof NonNullable<typeof faces>, fw: number, fh: number, transform: string): ReactNode => (
    <div
      className="d3-box-face"
      style={{
        width: fw,
        height: fh,
        marginLeft: -fw / 2,
        marginTop: -fh / 2,
        background: faces?.[name] ?? color,
        borderRadius: name === 'front' || name === 'back' ? radius : Math.min(radius, Math.min(fw, fh) / 2),
        transform,
      }}
    />
  );
  return (
    <div
      className={`d3-box ${className ?? ''}`}
      data-control={onPointerDown || onClick ? '' : undefined}
      title={title}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={onClick}
      style={{ transform: `translate3d(${x}px, ${y}px, ${z}px)${rotate ? ` ${rotate}` : ''}` }}
    >
      {face('front', w, h, `translateZ(${d / 2}px)`)}
      {face('back', w, h, `rotateY(180deg) translateZ(${d / 2}px)`)}
      {face('right', d, h, `rotateY(90deg) translateZ(${w / 2}px)`)}
      {face('left', d, h, `rotateY(-90deg) translateZ(${w / 2}px)`)}
      {face('top', w, d, `rotateX(90deg) translateZ(${h / 2}px)`)}
      {face('bottom', w, d, `rotateX(-90deg) translateZ(${h / 2}px)`)}
    </div>
  );
}

/**
 * A flat decal on one of the device's edges (ports, grilles, the
 * headphone jack…). `side` picks the edge; `offset` is along that edge from
 * its centre; size is length × (fraction of) depth.
 */
export function EdgeDecal({
  side,
  offset = 0,
  length,
  thickness,
  width,
  height,
  depth,
  zOffset = 0,
  children,
  style,
}: {
  side: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  length: number;
  thickness: number;
  width: number;
  height: number;
  depth: number;
  zOffset?: number;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  void depth;
  let transform = '';
  const horizontal = side === 'top' || side === 'bottom';
  const w = horizontal ? length : thickness;
  const h = horizontal ? thickness : length;
  if (side === 'top') transform = `translate3d(${offset}px, ${-height / 2 - 0.6}px, ${zOffset}px) rotateX(90deg)`;
  if (side === 'bottom') transform = `translate3d(${offset}px, ${height / 2 + 0.6}px, ${zOffset}px) rotateX(-90deg)`;
  if (side === 'left') transform = `translate3d(${-width / 2 - 0.6}px, ${offset}px, ${zOffset}px) rotateY(-90deg)`;
  if (side === 'right') transform = `translate3d(${width / 2 + 0.6}px, ${offset}px, ${zOffset}px) rotateY(90deg)`;
  return (
    <div className="d3-decal" style={{ transform }}>
      {/* top/bottom: x = along the edge, y = through the thickness (front at +y).
          left/right: x = through the thickness, y = along the edge. */}
      <div
        style={{
          position: 'absolute',
          width: w,
          height: h,
          marginLeft: -w / 2,
          marginTop: -h / 2,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}
