/**
 * Click Wheel input events.
 *
 * The <ClickWheel> component (and the keyboard / mouse-wheel mapping) emit
 * these; the OS and games subscribe. Buttons follow the real device:
 *
 *   menu (top) · prev (left) · next (right) · play (bottom) · select (center)
 *
 * For each button:  down → (hold after 600 ms, then repeat every 100 ms) → up.
 * `click` fires on release when the press was short (no hold).
 */
export type WheelButton = 'menu' | 'prev' | 'next' | 'play' | 'select';

export type WheelEvent =
  | { type: 'scroll'; steps: number; velocity: number }
  | { type: 'down'; button: WheelButton }
  | { type: 'up'; button: WheelButton; held: boolean }
  | { type: 'click'; button: WheelButton }
  | { type: 'hold'; button: WheelButton }
  | { type: 'repeat'; button: WheelButton; count: number }
  | { type: 'touch'; active: boolean };

export type WheelListener = (e: WheelEvent) => void;

export const HOLD_MS = 600;
export const REPEAT_MS = 100;

export class WheelBus {
  private listeners: WheelListener[] = [];
  private pressed = new Map<WheelButton, { t: number; held: boolean; holdTimer: number; repeatTimer: number; count: number }>();
  /** When true (hold switch on), nothing is emitted except 'touch'. */
  locked = false;
  /** Called for every input even when locked (e.g. to show the lock icon / wake the backlight). */
  onAnyInput: (() => void) | null = null;

  /**
   * Subscribe. The most recent subscriber gets events first; return `true`
   * from a listener to stop propagation to older subscribers (modal screens,
   * games). Returns an unsubscribe function.
   */
  on(fn: WheelListener | ((e: WheelEvent) => boolean | void)): () => void {
    this.listeners.unshift(fn as WheelListener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(e: WheelEvent): void {
    this.onAnyInput?.();
    if (this.locked && e.type !== 'touch' && e.type !== 'up') return;
    for (const l of [...this.listeners]) {
      if ((l as (e: WheelEvent) => boolean | void)(e) === true) break;
    }
  }

  scroll(steps: number, velocity = 0): void {
    if (steps) this.emit({ type: 'scroll', steps, velocity });
  }

  down(button: WheelButton): void {
    if (this.pressed.has(button)) return;
    const p = { t: performance.now(), held: false, holdTimer: 0, repeatTimer: 0, count: 0 };
    p.holdTimer = window.setTimeout(() => {
      p.held = true;
      this.emit({ type: 'hold', button });
      p.repeatTimer = window.setInterval(() => {
        p.count++;
        this.emit({ type: 'repeat', button, count: p.count });
      }, REPEAT_MS);
    }, HOLD_MS);
    this.pressed.set(button, p);
    this.emit({ type: 'down', button });
  }

  up(button: WheelButton): void {
    const p = this.pressed.get(button);
    if (!p) return;
    window.clearTimeout(p.holdTimer);
    window.clearInterval(p.repeatTimer);
    this.pressed.delete(button);
    this.emit({ type: 'up', button, held: p.held });
    if (!p.held) this.emit({ type: 'click', button });
  }

  /** Cancel a press without firing click (e.g. it turned into a scroll). */
  cancel(button: WheelButton): void {
    const p = this.pressed.get(button);
    if (!p) return;
    window.clearTimeout(p.holdTimer);
    window.clearInterval(p.repeatTimer);
    this.pressed.delete(button);
    this.emit({ type: 'up', button, held: true });
  }

  isDown(button: WheelButton): boolean {
    return this.pressed.has(button);
  }

  releaseAll(): void {
    for (const b of [...this.pressed.keys()]) this.cancel(b);
  }
}
