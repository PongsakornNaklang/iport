/**
 * GET /api/itunes?endpoint=search|lookup&term=…&media=…&entity=…&country=…
 * Passthrough to the iTunes Search API for browsers where it lacks CORS.
 * Only known parameters are forwarded.
 */
import { errorResponse, fail, fetchTimeout, HttpError, json, preflight } from './_lib/http.js';

const ALLOWED: Record<string, RegExp> = {
  term: /^[^\0]{1,200}$/,
  id: /^\d{1,15}(,\d{1,15}){0,49}$/,
  media: /^(movie|podcast|music|musicVideo|audiobook|shortFilm|tvShow|software|ebook|all)$/,
  entity: /^[a-zA-Z]{1,30}$/,
  attribute: /^[a-zA-Z]{1,30}$/,
  country: /^[a-zA-Z]{2}$/,
  lang: /^[a-z]{2}_[a-z]{2}$/i,
  limit: /^\d{1,3}$/,
  offset: /^\d{1,4}$/,
  explicit: /^(Yes|No)$/i,
  sort: /^(recent|popular)$/,
};

export async function GET(request: Request): Promise<Response> {
  try {
    const sp = new URL(request.url).searchParams;
    const endpoint = sp.get('endpoint') ?? 'search';
    if (endpoint !== 'search' && endpoint !== 'lookup') return fail(400, 'endpoint must be search or lookup');
    const out = new URLSearchParams();
    for (const [k, re] of Object.entries(ALLOWED)) {
      const v = sp.get(k);
      if (v == null || v === '') continue;
      if (!re.test(v)) return fail(400, `Invalid value for "${k}".`);
      out.set(k, v);
    }
    if (endpoint === 'search' && !out.get('term')) return fail(400, 'Pass a search term.');
    if (endpoint === 'lookup' && !out.get('id')) return fail(400, 'Pass an id to look up.');
    if (Number(out.get('limit') ?? 0) > 200) out.set('limit', '200');
    const res = await fetchTimeout(`https://itunes.apple.com/${endpoint}?${out}`, { headers: { accept: 'application/json' } }, 8000);
    if (!res.ok) throw new HttpError(502, `iTunes answered with an error (${res.status}).`);
    // iTunes labels its JSON as text/javascript
    const data = JSON.parse(await res.text()) as unknown;
    return json(data, { cache: 's-maxage=3600, stale-while-revalidate=86400' });
  } catch (e) {
    return errorResponse(e, 'iTunes could not be reached.');
  }
}

export function OPTIONS(): Response {
  return preflight();
}
