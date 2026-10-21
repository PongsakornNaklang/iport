/**
 * Helpers shared by the serverless functions (Web-standard Request/Response,
 * so they run on Vercel's Node runtime and in the local dev middleware).
 * Folders starting with "_" are not deployed as routes.
 */

export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, opts: { status?: number; cache?: string } = {}): Response {
  const status = opts.status ?? 200;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status >= 400 ? 'no-store' : (opts.cache ?? 's-maxage=3600, stale-while-revalidate=86400'),
      ...CORS_HEADERS,
    },
  });
}

export function fail(status: number, message: string): Response {
  return json({ error: message }, { status });
}

/** Map anything thrown inside a handler to a JSON error response. */
export function errorResponse(e: unknown, fallback = 'Something went wrong'): Response {
  if (e instanceof HttpError) return fail(e.status, e.message);
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return fail(504, 'The remote server took too long to answer.');
  console.error(e);
  return fail(502, fallback);
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'access-control-max-age': '86400' } });
}

export function fetchTimeout(url: string | URL, init: RequestInit = {}, ms = 9000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

/** Read a response body, refusing anything larger than `maxBytes`. */
export async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new HttpError(413, `The response is too large (over ${Math.round(maxBytes / 1048576)} MB).`);
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(413, `The response is too large (over ${Math.round(maxBytes / 1048576)} MB).`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

/** Decode bytes using the charset from Content-Type or the XML prolog (default UTF-8). */
export function decodeText(bytes: Uint8Array, contentType: string | null): string {
  let charset = /charset=["']?([\w-]+)/i.exec(contentType ?? '')?.[1];
  if (!charset) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
    charset = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function param(request: Request, name: string, maxLength = 2048): string | null {
  const v = new URL(request.url).searchParams.get(name);
  if (v == null) return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > maxLength) throw new HttpError(400, `"${name}" is too long.`);
  return t;
}
