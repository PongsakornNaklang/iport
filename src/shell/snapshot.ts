/**
 * Save the iPod as a picture: what the stage shows, as decorated (case,
 * sock, stickers, EarPods), on a transparent background and cropped to the
 * iPod and its shadow.
 *
 * html-to-image redraws the DOM through an SVG <foreignObject>, which the
 * browser renders with the page's own engine, 3D transforms included.
 * Loaded only when used.
 */
import { useDecalSelection } from './decals/Decals';

/** parts of the stage that are not the iPod */
const SKIP = ['stage-floor', 's4-cap', 'vc-grip'];

export async function saveImage(name: string): Promise<void> {
  const stage = document.querySelector<HTMLElement>('.stage');
  if (!stage) throw new Error('no stage');
  // no selection outline in the picture
  const selected = useDecalSelection.getState().selected;
  useDecalSelection.getState().select(null);
  // the Aurora backdrop's glow is a ::before the copy would keep: off while copying
  stage.classList.add('snapshotting');
  // The copy is drawn in page order, without the 3D depth sort. A case or
  // sock is painted first (see shell/cover), so it would end up under the
  // iPod: move it after, showing only its outside (see app.css), which
  // around a convex iPod is always in front of it.
  const moved = [...stage.querySelectorAll<HTMLElement>('.cv')]
    .filter((el) => el.nextSibling)
    .map((el) => ({ el, parent: el.parentNode!, next: el.nextSibling }));
  for (const m of moved) m.parent.appendChild(m.el);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // nor does it leave out surfaces facing away (backface-visibility): do that here
  const culled = cullBackFaces(stage);
  try {
    const { toCanvas } = await import('html-to-image');
    const canvas = await toCanvas(stage, {
      pixelRatio: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
      skipFonts: true,
      // the backdrop goes (it is the stage's own background)
      style: { background: 'none', animation: 'none' },
      filter: (node) => !(node instanceof Element && SKIP.some((c) => node.classList.contains(c))),
    });
    const out = crop(canvas);
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
    if (!blob) throw new Error('no image');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } finally {
    for (const el of culled) el.style.visibility = '';
    for (const m of moved.reverse()) m.parent.insertBefore(m.el, m.next);
    stage.classList.remove('snapshotting');
    useDecalSelection.getState().select(selected);
  }
}

/**
 * Hide every 3D surface that has backface-visibility: hidden and faces away
 * from the camera, working out which way it faces from the transforms
 * between it and the stage. Returns what it hid.
 */
function cullBackFaces(stage: HTMLElement): HTMLElement[] {
  const rot = stage.querySelector('.stage-rot');
  if (!rot) return [];
  const cache = new Map<Element, DOMMatrix>();
  const own = (el: Element) => {
    const t = getComputedStyle(el).transform;
    return t && t !== 'none' ? new DOMMatrix(t) : new DOMMatrix();
  };
  const matrix = (el: Element): DOMMatrix => {
    const hit = cache.get(el);
    if (hit) return hit;
    const m = el === rot || !el.parentElement ? own(el) : matrix(el.parentElement).multiply(own(el));
    cache.set(el, m);
    return m;
  };
  const hidden: HTMLElement[] = [];
  for (const el of rot.querySelectorAll<HTMLElement>('.d3-facet, .d3-face, .d3-box-face, .d3-cap')) {
    if (getComputedStyle(el).backfaceVisibility !== 'hidden') continue;
    const n = matrix(el).transformPoint(new DOMPoint(0, 0, 1, 0));
    if (n.z < 0) {
      el.style.visibility = 'hidden';
      hidden.push(el);
    }
  }
  return hidden;
}

/** The smallest part of the canvas with anything in it, plus a margin. */
export function crop(canvas: HTMLCanvasElement, margin = 0.04): HTMLCanvasElement {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return canvas;
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * margin);
  x0 = Math.max(0, x0 - m);
  y0 = Math.max(0, y0 - m);
  x1 = Math.min(w - 1, x1 + m);
  y1 = Math.min(h - 1, y1 + m);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(canvas, -x0, -y0);
  return out;
}
