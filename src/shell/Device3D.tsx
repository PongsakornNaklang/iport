import type { CSSProperties, ReactNode } from 'react';

/**
 * A device body with real thickness, built from CSS 3D planes.
 *
 *  - `front` and `back` are ordinary DOM (fully interactive on the front).
 *  - The sides are a stack of rounded "slices" between them. Varying each
 *    slice's inset and color gives curved/chamfered edges (iPod classic's
 *    chrome back, iPod touch's rounded aluminium sides…).
 *
 * The coordinate origin is the centre of the device; +z points at the viewer.
 */
export interface EdgeSlice {
  /** how far this slice is pulled in from the outline, px */
  inset?: number;
  /** CSS background for this slice */
  color: string;
}

export interface Device3DProps {
  width: number;
  height: number;
  depth: number;
  /** corner radius of the outline, px (or CSS radius string for elliptical corners) */
  radius: number | string;
  front: ReactNode;
  back: ReactNode;
  /** Edge profile from the front (t=0) to the back (t=1). */
  edge: (t: number) => EdgeSlice;
  slices?: number;
  /** Inset of the front/back faces (when the edge curves in towards a face). */
  frontInset?: number;
  backInset?: number;
  frontStyle?: CSSProperties;
  backStyle?: CSSProperties;
  /** Extra 3D parts (use <Box3D>), positioned relative to the device centre. */
  children?: ReactNode;
  className?: string;
}

function radiusMinus(r: number | string, inset: number): number | string {
  return typeof r === 'number' ? Math.max(0, r - inset) : r;
}

export function Device3D({
  width,
  height,
  depth,
  radius,
  front,
  back,
  edge,
  slices,
  frontInset = 0,
  backInset = 0,
  frontStyle,
  backStyle,
  children,
  className,
}: Device3DProps) {
  const n = slices ?? Math.max(6, Math.min(28, Math.round(depth / 2.2)));
  const half = depth / 2;
  const sliceEls: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const z = half - t * depth;
    const s = edge(t);
    const inset = s.inset ?? 0;
    sliceEls.push(
      <div
        key={i}
        className="d3-slice"
        style={{
          inset,
          borderRadius: radiusMinus(radius, inset),
          background: s.color,
          transform: `translateZ(${z.toFixed(2)}px)`,
        }}
      />,
    );
  }

  return (
    <div className={`d3-root ${className ?? ''}`} style={{ width, height }}>
      {sliceEls}
      <div
        className="d3-face d3-back"
        style={{
          inset: backInset,
          borderRadius: radiusMinus(radius, backInset),
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
          borderRadius: radiusMinus(radius, frontInset),
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
