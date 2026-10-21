/**
 * GET /api/feed?url=<rss or atom url>
 * Fetches a podcast feed for the browser (most feeds don't send CORS
 * headers). http/https only, private networks blocked (also after
 * redirects), 10 s timeout, 5 MB cap, must look like XML.
 */
import { CORS_HEADERS, decodeText, errorResponse, fail, HttpError, param, preflight, readCapped } from './_lib/http.js';
import { safeFetch } from './_lib/guard.js';

const MAX_BYTES = 5 * 1024 * 1024;

function looksLikeFeed(text: string): boolean {
  const head = text.replace(/^﻿/, '').trimStart().slice(0, 2048).toLowerCase();
  return /^<\?xml|^<rss[\s>]|^<feed[\s>]|^<rdf:rdf[\s>]/.test(head) || (/^<!--/.test(head) && /<(rss|feed|rdf:rdf)[\s>]/.test(head));
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = param(request, 'url', 2048);
    if (!url) return fail(400, 'Pass the feed address as ?url=');
    const { res, url: finalUrl } = await safeFetch(
      url,
      {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; iPortFeedReader/1.0; +https://github.com/) like iTunes',
          accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5',
        },
      },
      { timeout: 10_000 },
    );
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new HttpError(res.status === 404 || res.status === 410 ? 404 : 502, res.status === 404 || res.status === 410 ? 'That feed no longer exists.' : `The feed server answered with an error (${res.status}).`);
    }
    const ct = res.headers.get('content-type') ?? '';
    const xmlType = /(xml|rss|atom)/i.test(ct);
    if (!xmlType && !/^(text\/(plain|html)|application\/octet-stream|binary\/octet-stream)?(;|$)/i.test(ct)) {
      await res.body?.cancel().catch(() => undefined);
      throw new HttpError(415, 'That address isn’t a podcast feed (it is not XML).');
    }
    const text = decodeText(await readCapped(res, MAX_BYTES), ct);
    if (!looksLikeFeed(text)) throw new HttpError(415, 'That address isn’t a podcast feed (no RSS or Atom found).');
    return new Response(text, {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 's-maxage=900, stale-while-revalidate=3600',
        'x-feed-url': finalUrl,
        'x-content-type-options': 'nosniff',
        ...CORS_HEADERS,
        'access-control-expose-headers': 'x-feed-url',
      },
    });
  } catch (e) {
    return errorResponse(e, 'The feed could not be fetched.');
  }
}

export function OPTIONS(): Response {
  return preflight();
}
