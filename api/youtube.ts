/**
 * GET /api/youtube?q=<search>        → YtItem[]   (videos only, no API key)
 * GET /api/youtube?list=<playlistId> → { id, title, author, items: YtItem[] }
 * GET /api/youtube?id=<videoId>      → { id, title, channel, thumbnail }
 */
import { BROWSER_UA, decodeText, errorResponse, fail, fetchTimeout, HttpError, json, param, preflight, readCapped } from './_lib/http.js';
import {
  extractClientVersion,
  extractInitialData,
  parseContinuation,
  parsePlaylistPage,
  parseSearchResults,
  type YtItem,
} from './_lib/youtube.js';

const HEADERS: Record<string, string> = {
  'user-agent': BROWSER_UA,
  'accept-language': 'en-US,en;q=0.9',
  // skip the EU consent interstitial
  cookie: 'CONSENT=YES+cb; SOCS=CAI',
};

async function getPage(url: string, ms: number): Promise<string> {
  const res = await fetchTimeout(url, { headers: HEADERS }, ms);
  if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, res.status === 404 ? 'Not found on YouTube.' : `YouTube answered with an error (${res.status}).`);
  return decodeText(await readCapped(res, 10 * 1024 * 1024), res.headers.get('content-type'));
}

async function search(q: string, gl: string | null): Promise<Response> {
  // sp=EgIQAQ%3D%3D = "Type: Video" filter
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D&hl=en${gl ? `&gl=${gl}` : ''}`;
  const html = await getPage(url, 8000);
  const data = extractInitialData(html);
  if (!data) throw new HttpError(502, 'Couldn’t read YouTube’s results. Please try again later.');
  return json(parseSearchResults(data, 30), { cache: 's-maxage=21600, stale-while-revalidate=86400' });
}

async function playlist(list: string): Promise<Response> {
  const deadline = Date.now() + 8500;
  const html = await getPage(`https://www.youtube.com/playlist?list=${encodeURIComponent(list)}&hl=en`, 7000);
  const data = extractInitialData(html);
  if (!data) throw new HttpError(502, 'Couldn’t read this playlist. Please try again later.');
  const page = parsePlaylistPage(data, list, 500);
  if (!page.items.length) throw new HttpError(404, 'This playlist is empty, private, or doesn’t exist.');

  // Pages of 100: follow continuations while time allows (max 500 videos).
  const clientVersion = extractClientVersion(html) ?? '2.20250101.00.00';
  const items: YtItem[] = [...page.items];
  const seen = new Set(items.map((i) => i.id));
  let token = page.continuation;
  while (token && items.length < 500 && deadline - Date.now() > 1500) {
    try {
      const res = await fetchTimeout(
        'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false',
        {
          method: 'POST',
          headers: { ...HEADERS, 'content-type': 'application/json', origin: 'https://www.youtube.com' },
          body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion, hl: 'en', gl: 'US' } }, continuation: token }),
        },
        Math.min(4000, deadline - Date.now()),
      );
      if (!res.ok) break;
      const more = parseContinuation(await res.json(), 200);
      for (const it of more.items) if (!seen.has(it.id)) (seen.add(it.id), items.push(it));
      token = more.continuation;
    } catch {
      break;
    }
  }
  return json({ id: page.id, title: page.title, author: page.author, items: items.slice(0, 500) }, { cache: 's-maxage=3600, stale-while-revalidate=86400' });
}

async function info(id: string): Promise<Response> {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const res = await fetchTimeout(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { headers: HEADERS }, 7000);
  if (res.status === 404 || res.status === 400) throw new HttpError(404, 'This video is private or doesn’t exist.');
  if (res.status === 401 || res.status === 403) throw new HttpError(403, 'The owner doesn’t allow this video to be embedded.');
  if (!res.ok) throw new HttpError(502, `YouTube answered with an error (${res.status}).`);
  const o = (await res.json()) as { title?: string; author_name?: string };
  return json({ id, title: o.title ?? 'YouTube Video', channel: o.author_name, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }, { cache: 's-maxage=86400' });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const q = param(request, 'q', 200);
    const list = param(request, 'list', 80);
    const id = param(request, 'id', 20);
    const glRaw = param(request, 'gl', 2);
    const gl = glRaw && /^[A-Za-z]{2}$/.test(glRaw) ? glRaw.toUpperCase() : null;
    if (q) return await search(q, gl);
    if (list) {
      if (!/^[A-Za-z0-9_-]{2,64}$/.test(list)) return fail(400, 'That is not a valid playlist id.');
      return await playlist(list);
    }
    if (id) {
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return fail(400, 'That is not a valid video id.');
      return await info(id);
    }
    return fail(400, 'Use ?q=<search>, ?list=<playlist id> or ?id=<video id>.');
  } catch (e) {
    return errorResponse(e, 'YouTube could not be reached. Please try again.');
  }
}

export function OPTIONS(): Response {
  return preflight();
}
