/**
 * Input on an iPod lying on its side.
 *
 * The stage turns the device with CSS, but pointer events arrive in screen
 * coordinates, and every device works out wheel angles, swipes and touch
 * positions from those and from getBoundingClientRect(). While the iPod lies
 * turned, an event that starts on it is given the coordinates it would have
 * had on an upright iPod, and while that event is being handled the device's
 * own elements report the rectangles they would have upright. So a swipe
 * along the screen of a turned iPod touch scrolls the way it would in your
 * hand, and the top of a turned click wheel is still Forward.
 *
 * The stage itself wants the true screen position (to turn the iPod in 3D):
 * it reads it with rawPoint().
 */
import { liveOrientation, ROLL_ANGLE } from './stageStore';

/** the device on the stage (everything that turns with it) */
const FRAME = '.stage-rot .device-enter';
/**
 * Content a device turns back the other way (a landscape video): on the
 * turned iPod it stands upright on screen, so its input needs no mapping.
 */
const UPRIGHT = '[data-upright]';
const PIVOT = '.stage-rot';

const POINTER = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture'];
const MOUSE = ['click', 'dblclick', 'auxclick', 'contextmenu', 'mousedown', 'mousemove', 'mouseup'];

type Raw = { x: number; y: number };
const raws = new WeakMap<Event, Raw>();
/** pointers that went down on the turned iPod: theirs until they lift */
const owned = new Set<number>();

let installed = false;
/** the browser's own getBoundingClientRect (set on install) */
let origRect: (() => DOMRect) | null = null;

/** lying fully turned (in between, input is left alone) */
const turned = () => Math.abs(liveOrientation.roll - ROLL_ANGLE) < 0.5;

/** the point the iPod turns about, on screen */
function pivot(): { x: number; y: number } | null {
  const el = document.querySelector(PIVOT);
  if (!el) return null;
  const r = origRect ? origRect.call(el) : el.getBoundingClientRect();
  return { x: r.left, y: r.top };
}

/** a screen point as it would be on the upright iPod (a quarter turn back) */
function unturn(x: number, y: number, p: { x: number; y: number }) {
  // the iPod is turned by ROLL_ANGLE (-90°): turn back by +90°
  return { x: p.x - (y - p.y), y: p.y + (x - p.x) };
}

function remap(e: MouseEvent) {
  if (raws.has(e)) return;
  const p = pivot();
  if (!p) return;
  const q = unturn(e.clientX, e.clientY, p);
  raws.set(e, { x: e.clientX, y: e.clientY });
  const dx = q.x - e.clientX;
  const dy = q.y - e.clientY;
  const def = (k: string, v: number) => Object.defineProperty(e, k, { value: v, configurable: true });
  def('clientX', q.x);
  def('clientY', q.y);
  def('x', q.x);
  def('y', q.y);
  def('pageX', e.pageX + dx);
  def('pageY', e.pageY + dy);
  const mx = e.movementX;
  const my = e.movementY;
  def('movementX', -my);
  def('movementY', mx);
}

const turnsWith = (el: Element) => !!el.closest(FRAME) && !el.closest(UPRIGHT);
const onFrame = (t: EventTarget | null) => t instanceof Element && turnsWith(t);

function onPointer(e: Event) {
  const pe = e as PointerEvent;
  if (pe.type === 'pointerdown' && turned() && onFrame(pe.target)) owned.add(pe.pointerId);
  if (owned.has(pe.pointerId) || (turned() && onFrame(pe.target))) remap(pe);
  if (pe.type === 'pointerup' || pe.type === 'pointercancel') {
    const id = pe.pointerId;
    // after this event has been handled everywhere
    setTimeout(() => owned.delete(id), 0);
  }
}

function onMouse(e: Event) {
  if (turned() && onFrame(e.target)) remap(e as MouseEvent);
}

/** Start mapping input on a turned iPod (once; the stage calls it). */
export function installRollInput() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  for (const t of POINTER) window.addEventListener(t, onPointer, true);
  for (const t of MOUSE) window.addEventListener(t, onMouse, true);
  const orig = Element.prototype.getBoundingClientRect;
  origRect = orig;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const r = orig.call(this);
    // only while an event we mapped is being handled, for the device's own parts
    const ev = window.event;
    if (!ev || !raws.has(ev) || !turnsWith(this)) return r;
    const p = pivot();
    if (!p) return r;
    const c = unturn(r.left + r.width / 2, r.top + r.height / 2, p);
    return new DOMRect(c.x - r.height / 2, c.y - r.width / 2, r.height, r.width);
  };
}

/** Where a pointer really is on screen, even on a turned iPod. */
export function rawPoint(e: { clientX: number; clientY: number; nativeEvent?: Event }): Raw {
  const r = e.nativeEvent && raws.get(e.nativeEvent);
  return r ?? { x: e.clientX, y: e.clientY };
}
