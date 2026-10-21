/**
 * Network helpers shared by the source modules: timeouts, friendly error
 * messages, calls to our own `/api/*` functions, and a JSONP fallback for
 * APIs that are not always CORS-friendly (iTunes).
 */

/** An error whose message is already fit to show to the user. */
export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceError';
  }
}

export const NO_SERVER_MSG =
  'This needs iPort’s server functions, which run when the site is deployed on Vercel (or with `vercel dev`).';

/** Turn anything thrown into a short, human message. */
export function friendlyError(e: unknown, what = 'the service'): string {
  if (e instanceof SourceError) return e.message;
  if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError'))
    return `${what} took too long to answer. Please try again.`;
  // fetch() rejects with a TypeError for network / CORS failures
  if (e instanceof TypeError) return `Couldn’t reach ${what}. Check your connection (or an ad blocker) and try again.`;
  if (e instanceof SyntaxError) return `${what} sent something unexpected. Please try again later.`;
  if (e instanceof Error && e.message) return e.message;
  return 'Something went wrong. Please try again.';
}

export interface FetchOpts extends RequestInit {
  /** ms, default 12 s */
  timeout?: number;
}

export async function fetchWithTimeout(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { timeout = 12_000, signal, ...init } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timed out', 'TimeoutError')), timeout);
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function getJson<T>(url: string, opts?: FetchOpts): Promise<T> {
  const r = await fetchWithTimeout(url, opts);
  if (!r.ok) throw new SourceError(`The service answered with an error (${r.status}).`);
  return (await r.json()) as T;
}

function isJsonResponse(r: Response): boolean {
  return /\bjson\b/i.test(r.headers.get('content-type') ?? '');
}

/**
 * Call one of our serverless functions (`/api/<name>?…`). When the functions
 * are not deployed (plain `vite` dev server) the SPA fallback answers with
 * HTML; that is reported as {@link NO_SERVER_MSG}.
 */
export async function apiJson<T>(name: string, params: Record<string, string>, opts?: FetchOpts): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetchWithTimeout(`/api/${name}?${qs}`, { timeout: 25_000, ...opts });
  if (!isJsonResponse(r)) throw new SourceError(NO_SERVER_MSG);
  const body = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new SourceError(body?.error || `Server error (${r.status}).`);
  return body;
}

/** Same as {@link apiJson} for text endpoints (the feed proxy). */
export async function apiText(name: string, params: Record<string, string>, opts?: FetchOpts): Promise<string> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetchWithTimeout(`/api/${name}?${qs}`, { timeout: 25_000, ...opts });
  const ct = r.headers.get('content-type') ?? '';
  if (/\bjson\b/i.test(ct)) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new SourceError(body.error || `Server error (${r.status}).`);
  }
  if (/text\/html/i.test(ct)) throw new SourceError(NO_SERVER_MSG);
  if (!r.ok) throw new SourceError(`Server error (${r.status}).`);
  return r.text();
}

let jsonpSeq = 0;
/** Classic JSONP: `<script src="…&callback=fn">`. Works where CORS does not. */
export function jsonp<T>(url: string, timeout = 12_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__iportJsonp${Date.now().toString(36)}${jsonpSeq++}`;
    const w = window as unknown as Record<string, unknown>;
    const s = document.createElement('script');
    const cleanup = () => {
      clearTimeout(timer);
      delete w[name];
      s.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new DOMException('Timed out', 'TimeoutError'));
    }, timeout);
    w[name] = (data: T) => {
      cleanup();
      resolve(data);
    };
    s.onerror = () => {
      cleanup();
      reject(new TypeError('JSONP request failed'));
    };
    s.src = `${url}${url.includes('?') ? '&' : '?'}callback=${name}`;
    document.head.appendChild(s);
  });
}

/**
 * Try a list of strategies in order and return the first success. If all
 * fail, rethrow the most useful error (a SourceError wins over network noise).
 */
export async function firstOk<T>(attempts: (() => Promise<T>)[]): Promise<T> {
  let best: unknown;
  for (const a of attempts) {
    try {
      return await a();
    } catch (e) {
      if (!best || (e instanceof SourceError && !(best instanceof SourceError) && (e as Error).message !== NO_SERVER_MSG)) best = e;
    }
  }
  throw best ?? new Error('Nothing to try');
}

/** Upgrade http:// media to https:// on secure pages (browsers block mixed content). */
export function secureUrl(url: string): string {
  if (typeof location !== 'undefined' && location.protocol === 'https:' && url.startsWith('http://')) {
    return `https://${url.slice(7)}`;
  }
  return url;
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Accept "example.com/x.mp3" as well as full URLs. Plain words and sentences
 * are not links (some browsers' URL parsers happily accept "https://hello world").
 */
export function normalizeUrl(input: string): string | null {
  const s = input.trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  if (!isHttpUrl(withScheme)) return null;
  const host = new URL(withScheme).hostname;
  if (!host.includes('.') && !host.includes(':') && host !== 'localhost') return null;
  return withScheme;
}
