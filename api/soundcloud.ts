/**
 * GET /api/soundcloud?url=<soundcloud track / set / on.soundcloud.com link>
 *   → { kind: 'set' | 'track', url, title, artist, artwork, tracks: ScItem[] }
 * GET /api/soundcloud?q=<search>  → { tracks: ScItem[] }   (best effort)
 * Best effort: reads the public page's hydration JSON. Tracks the page only
 * lists by id are completed via api-v2 when a public client id can be found;
 * otherwise they are returned as api.soundcloud.com/tracks/<id> URLs (which
 * the widget plays fine; titles fill in on first play).
 */
import { BROWSER_UA, decodeText, errorResponse, fail, fetchTimeout, HttpError, json, param, preflight, readCapped } from './_lib/http.js';
import { assetScripts, extractHydration, fillStubs, findClientId, parseHydration, stubIds, trackItem, type ScItem, type ScSet } from './_lib/soundcloud.js';

const HEADERS = { 'user-agent': BROWSER_UA, 'accept-language': 'en-US,en;q=0.9' };
const SC_HOST = /^((www|m)\.)?soundcloud\.com$/i;

/** Public web client id, scraped from SoundCloud's JS bundles (cached while the function is warm). */
let cachedClientId: { id: string; at: number } | null = null;

async function clientIdFrom(html: string, deadline: number): Promise<string | undefined> {
  if (cachedClientId && Date.now() - cachedClientId.at < 6 * 3600_000) return cachedClientId.id;
  for (const src of assetScripts(html).slice(0, 6)) {
    if (deadline - Date.now() < 1500) return undefined;
    try {
      const r = await fetchTimeout(src, { headers: HEADERS }, Math.min(3000, deadline - Date.now()));
      if (!r.ok) continue;
      const id = findClientId(await r.text());
      if (id) {
        cachedClientId = { id, at: Date.now() };
        return id;
      }
    } catch {
      /* try the next bundle */
    }
  }
  return undefined;
}

async function search(q: string, deadline: number): Promise<Response> {
  let clientId = cachedClientId && Date.now() - cachedClientId.at < 6 * 3600_000 ? cachedClientId.id : undefined;
  if (!clientId) {
    const home = await fetchTimeout('https://soundcloud.com/discover', { headers: HEADERS }, 5000);
    if (!home.ok) throw new HttpError(502, 'SoundCloud search is unavailable right now. Paste a link instead.');
    clientId = await clientIdFrom(decodeText(await readCapped(home, 8 * 1024 * 1024), home.headers.get('content-type')), deadline);
  }
  if (!clientId) throw new HttpError(502, 'SoundCloud search is unavailable right now. Paste a link instead.');
  const r = await fetchTimeout(
    `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&limit=30&client_id=${clientId}`,
    { headers: HEADERS },
    Math.max(1000, Math.min(5000, deadline - Date.now())),
  );
  if (r.status === 401 || r.status === 403) cachedClientId = null;
  if (!r.ok) throw new HttpError(502, 'SoundCloud search is unavailable right now. Paste a link instead.');
  const body = (await r.json()) as { collection?: unknown[] };
  const tracks = (body.collection ?? [])
    .map((t) => trackItem(t as Parameters<typeof trackItem>[0]))
    .filter((t): t is ScItem => !!t);
  return json({ tracks }, { cache: 's-maxage=21600, stale-while-revalidate=86400' });
}

async function fillFromApi(html: string, set: ScSet, deadline: number): Promise<ScSet> {
  const ids = stubIds(set);
  if (!ids.length) return set;
  const clientId = await clientIdFrom(html, deadline);
  if (!clientId) return set;
  let out = set;
  for (let i = 0; i < ids.length && deadline - Date.now() > 1000; i += 50) {
    try {
      const r = await fetchTimeout(
        `https://api-v2.soundcloud.com/tracks?ids=${ids.slice(i, i + 50).join(',')}&client_id=${clientId}`,
        { headers: HEADERS },
        Math.min(3000, deadline - Date.now()),
      );
      if (!r.ok) break;
      const full = (await r.json()) as unknown;
      if (Array.isArray(full)) out = fillStubs(out, full);
    } catch {
      break;
    }
  }
  return out;
}

export async function GET(request: Request): Promise<Response> {
  const deadline = Date.now() + 8500;
  try {
    const q = param(request, 'q', 200);
    if (q) return await search(q, deadline);
    const raw = param(request, 'url', 1024);
    if (!raw) return fail(400, 'Pass a SoundCloud link as ?url= (or a search as ?q=)');
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return fail(400, 'That is not a valid URL.');
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return fail(400, 'Only web addresses are allowed.');
    const host = u.hostname.toLowerCase();
    if (host === 'on.soundcloud.com') {
      // short link → follow its redirect, which must land on soundcloud.com
      const r = await fetchTimeout(`https://on.soundcloud.com${u.pathname}`, { headers: HEADERS, redirect: 'manual' }, 5000);
      const loc = r.headers.get('location');
      await r.body?.cancel().catch(() => undefined);
      if (!loc) throw new HttpError(404, 'That short link doesn’t lead anywhere.');
      u = new URL(loc, 'https://on.soundcloud.com');
      if (!SC_HOST.test(u.hostname)) throw new HttpError(400, 'That short link doesn’t lead to SoundCloud.');
    } else if (!SC_HOST.test(host)) {
      return fail(400, 'Only soundcloud.com links are supported.');
    }
    const pageUrl = `https://soundcloud.com${u.pathname.replace(/\/+$/, '')}`;
    const res = await fetchTimeout(pageUrl, { headers: HEADERS }, 7000);
    if (res.status === 404) throw new HttpError(404, 'That SoundCloud page doesn’t exist (or is private).');
    if (!res.ok) throw new HttpError(502, `SoundCloud answered with an error (${res.status}).`);
    const html = decodeText(await readCapped(res, 8 * 1024 * 1024), res.headers.get('content-type'));
    const hydration = extractHydration(html);
    let set = hydration ? parseHydration(hydration, pageUrl) : null;
    if (!set) throw new HttpError(404, 'Couldn’t find any tracks on that SoundCloud page.');
    set = await fillFromApi(html, set, deadline);
    return json(set, { cache: 's-maxage=21600, stale-while-revalidate=86400' });
  } catch (e) {
    return errorResponse(e, 'SoundCloud could not be reached.');
  }
}

export function OPTIONS(): Response {
  return preflight();
}
