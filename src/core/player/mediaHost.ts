/**
 * Where iframes (YouTube / SoundCloud) and the <video> element physically live.
 *
 * Moving an iframe in the DOM reloads it, so the player keeps one "host"
 * element. A device screen registers its <MediaLayer> as the host; devices
 * without a screen (shuffle) fall back to an invisible pool element.
 */

type Listener = (host: HTMLElement) => void;

let pool: HTMLElement | null = null;
const stack: HTMLElement[] = [];
const listeners = new Set<Listener>();

export function getPool(): HTMLElement {
  if (!pool) {
    pool = document.createElement('div');
    pool.id = 'iport-media-pool';
    // YouTube requires a real, non-zero-size player; keep it tiny and out of the way.
    Object.assign(pool.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '200px',
      height: '200px',
      opacity: '0.001',
      pointerEvents: 'none',
      zIndex: '-1',
      overflow: 'hidden',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(pool);
  }
  return pool;
}

export function currentHost(): HTMLElement {
  return stack[stack.length - 1] ?? getPool();
}

export function registerHost(el: HTMLElement): () => void {
  stack.push(el);
  notify();
  return () => {
    const i = stack.lastIndexOf(el);
    if (i >= 0) stack.splice(i, 1);
    notify();
  };
}

export function onHostChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let lastNotified: HTMLElement | null = null;
function notify() {
  // defer so React can finish mounting/unmounting first
  queueMicrotask(() => {
    const h = currentHost();
    if (h === lastNotified) return;
    lastNotified = h;
    listeners.forEach((l) => l(h));
  });
}
