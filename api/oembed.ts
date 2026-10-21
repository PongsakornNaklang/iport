/**
 * GET /api/oembed?url=<soundcloud or youtube url>
 * oEmbed passthrough for the two providers the player supports (allow-listed).
 */
import { errorResponse, fail, fetchTimeout, HttpError, json, param, preflight } from './_lib/http.js';

const PROVIDERS: { host: RegExp; endpoint: string }[] = [
  { host: /^((www|m)\.)?soundcloud\.com$|^on\.soundcloud\.com$|^api\.soundcloud\.com$/i, endpoint: 'https://soundcloud.com/oembed' },
  { host: /^((www|m|music)\.)?youtube\.com$|^youtu\.be$/i, endpoint: 'https://www.youtube.com/oembed' },
];

const FIELDS = ['title', 'author_name', 'author_url', 'thumbnail_url', 'html', 'description', 'provider_name', 'type'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const raw = param(request, 'url', 1024);
    if (!raw) return fail(400, 'Pass ?url=');
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return fail(400, 'That is not a valid URL.');
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return fail(400, 'Only web addresses are allowed.');
    const p = PROVIDERS.find((x) => x.host.test(u.hostname));
    if (!p) return fail(400, 'Only SoundCloud and YouTube links are supported.');
    const res = await fetchTimeout(`${p.endpoint}?format=json&url=${encodeURIComponent(u.toString())}`, { headers: { accept: 'application/json' } }, 8000);
    if (res.status === 404 || res.status === 400) throw new HttpError(404, 'Not found — it may be private or removed.');
    if (res.status === 401 || res.status === 403) throw new HttpError(403, 'The owner doesn’t allow this to be embedded.');
    if (!res.ok) throw new HttpError(502, `The provider answered with an error (${res.status}).`);
    const data = (await res.json()) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const f of FIELDS) if (typeof data[f] === 'string') out[f] = data[f];
    return json(out, { cache: 's-maxage=86400, stale-while-revalidate=604800' });
  } catch (e) {
    return errorResponse(e, 'The provider could not be reached.');
  }
}

export function OPTIONS(): Response {
  return preflight();
}
