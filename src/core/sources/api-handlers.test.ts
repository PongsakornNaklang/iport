/**
 * Request-level tests for the serverless functions in /api: input
 * validation, the feed proxy's SSRF guard (DNS + every redirect hop), size
 * cap, JSON errors and cache headers. fetch() and DNS are mocked — no network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dns = vi.hoisted(() => ({ answers: new Map<string, string[]>() }));
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    const a = dns.answers.get(host);
    if (!a) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    return a.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  }),
}));

const { GET: feed } = await import('../../../api/feed.ts');
const { GET: youtube } = await import('../../../api/youtube.ts');
const { GET: itunes } = await import('../../../api/itunes.ts');
const { GET: oembed } = await import('../../../api/oembed.ts');
const { GET: soundcloud } = await import('../../../api/soundcloud.ts');

const req = (path: string) => new Request(`https://iport.test${path}`);
const q = (u: string) => encodeURIComponent(u);

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
function routes(r: Route) {
  fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => r(String(input instanceof Request ? input.url : input), init));
  vi.stubGlobal('fetch', fetchMock);
}

const RSS = '<?xml version="1.0"?><rss version="2.0"><channel><title>Show</title><item><title>Ep</title><enclosure url="https://cdn.example.com/1.mp3" type="audio/mpeg"/></item></channel></rss>';

beforeEach(() => {
  dns.answers.clear();
  dns.answers.set('feeds.example.com', ['93.184.216.34']);
  dns.answers.set('cdn.example.com', ['93.184.216.35']);
  routes(() => new Response('unexpected fetch', { status: 599 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function body(r: Response): Promise<{ error?: string } & Record<string, unknown>> {
  return (await r.json()) as { error?: string } & Record<string, unknown>;
}

describe('/api/feed', () => {
  it('needs a url and answers with a JSON error', async () => {
    const r = await feed(req('/api/feed'));
    expect(r.status).toBe(400);
    expect(r.headers.get('content-type')).toMatch(/json/);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect((await body(r)).error).toMatch(/url/i);
  });

  it.each(['http://127.0.0.1/feed.xml', 'http://[::1]/x', 'http://localhost:3000/rss', 'http://intranet/rss', 'http://169.254.169.254/latest/meta-data', 'http://printer.local/feed'])(
    'blocks private target %s without fetching',
    async (u) => {
      const r = await feed(req(`/api/feed?url=${q(u)}`));
      expect(r.status).toBe(400);
      expect((await body(r)).error).toMatch(/private/i);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects non-web schemes and credentials', async () => {
    expect((await feed(req(`/api/feed?url=${q('file:///etc/passwd')}`))).status).toBe(400);
    expect((await feed(req(`/api/feed?url=${q('ftp://feeds.example.com/x')}`))).status).toBe(400);
    expect((await feed(req(`/api/feed?url=${q('https://user:pw@feeds.example.com/x')}`))).status).toBe(400);
  });

  it('blocks hosts whose DNS points into a private network', async () => {
    dns.answers.set('evil.example.com', ['10.0.0.5']);
    const r = await feed(req(`/api/feed?url=${q('https://evil.example.com/rss')}`));
    expect(r.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-checks every redirect hop', async () => {
    routes((u) => (u.startsWith('https://feeds.example.com/') ? new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }) : new Response('secret')));
    const r = await feed(req(`/api/feed?url=${q('https://feeds.example.com/show.rss')}`));
    expect(r.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('follows public redirects and returns the feed with cache headers', async () => {
    routes((u) =>
      u === 'https://feeds.example.com/old'
        ? new Response(null, { status: 301, headers: { location: '/new.xml' } })
        : new Response(RSS, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } }),
    );
    const r = await feed(req(`/api/feed?url=${q('https://feeds.example.com/old')}`));
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<rss');
    expect(r.headers.get('cache-control')).toMatch(/s-maxage=\d+/);
    expect(r.headers.get('x-feed-url')).toBe('https://feeds.example.com/new.xml');
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('refuses pages that are not feeds', async () => {
    routes(() => new Response('<!doctype html><html><body>hi</body></html>', { headers: { 'content-type': 'text/html' } }));
    const r = await feed(req(`/api/feed?url=${q('https://feeds.example.com/page')}`));
    expect(r.status).toBe(415);
    routes(() => new Response('{}', { headers: { 'content-type': 'image/png' } }));
    expect((await feed(req(`/api/feed?url=${q('https://feeds.example.com/x.png')}`))).status).toBe(415);
  });

  it('caps the size (declared and streamed)', async () => {
    routes(() => new Response(RSS, { headers: { 'content-type': 'text/xml', 'content-length': String(50 * 1024 * 1024) } }));
    expect((await feed(req(`/api/feed?url=${q('https://feeds.example.com/huge')}`))).status).toBe(413);
    const chunk = new Uint8Array(1024 * 1024).fill(32);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent++ < 8) c.enqueue(chunk);
        else c.close();
      },
    });
    routes(() => new Response(stream, { headers: { 'content-type': 'text/xml' } }));
    expect((await feed(req(`/api/feed?url=${q('https://feeds.example.com/stream')}`))).status).toBe(413);
  });

  it('maps upstream errors', async () => {
    routes(() => new Response('gone', { status: 404 }));
    const r = await feed(req(`/api/feed?url=${q('https://feeds.example.com/gone')}`));
    expect(r.status).toBe(404);
    expect((await body(r)).error).toMatch(/no longer exists/);
  });
});

describe('/api/youtube', () => {
  it('validates its parameters', async () => {
    expect((await youtube(req('/api/youtube'))).status).toBe(400);
    expect((await youtube(req('/api/youtube?list=bad%20id!'))).status).toBe(400);
    expect((await youtube(req('/api/youtube?id=short'))).status).toBe(400);
    expect((await youtube(req(`/api/youtube?q=${'x'.repeat(300)}`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches YouTube and answers JSON with a CDN cache header', async () => {
    const data = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [{ videoRenderer: { videoId: 'dQw4w9WgXcQ', title: { runs: [{ text: 'Rick Astley - Never Gonna Give You Up' }] }, ownerText: { runs: [{ text: 'Rick Astley' }] }, lengthText: { simpleText: '3:33' } } }],
                  },
                },
              ],
            },
          },
        },
      },
    };
    routes((u) => {
      expect(u).toContain('search_query=thai%20pop');
      return new Response(`<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    });
    const r = await youtube(req('/api/youtube?q=thai%20pop'));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/s-maxage/);
    const items = (await r.json()) as { id: string; seconds: number }[];
    expect(items[0]).toMatchObject({ id: 'dQw4w9WgXcQ', seconds: 213 });
  });

  it('turns a YouTube outage into a friendly JSON error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    routes(() => {
      throw new TypeError('fetch failed');
    });
    const r = await youtube(req('/api/youtube?q=anything'));
    expect(r.status).toBe(502);
    expect((await body(r)).error).toMatch(/YouTube/);
  });
});

describe('/api/itunes', () => {
  it('only forwards known, valid parameters', async () => {
    routes((u) => {
      const p = new URL(u).searchParams;
      expect(u.startsWith('https://itunes.apple.com/search?')).toBe(true);
      expect(p.get('term')).toBe('bodyslam');
      expect(p.get('country')).toBe('th');
      expect(p.has('callback')).toBe(false);
      return new Response(JSON.stringify({ resultCount: 0, results: [] }), { headers: { 'content-type': 'text/javascript' } });
    });
    const r = await itunes(req('/api/itunes?endpoint=search&term=bodyslam&media=music&country=th&callback=evil'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ resultCount: 0, results: [] });
    expect(r.headers.get('cache-control')).toMatch(/s-maxage/);
  });

  it('rejects bad input', async () => {
    expect((await itunes(req('/api/itunes?endpoint=rss&term=x'))).status).toBe(400);
    expect((await itunes(req('/api/itunes?endpoint=search&term=x&country=thailand'))).status).toBe(400);
    expect((await itunes(req('/api/itunes?endpoint=search'))).status).toBe(400);
    expect((await itunes(req('/api/itunes?endpoint=lookup&id=abc'))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/api/oembed', () => {
  it('is limited to SoundCloud and YouTube', async () => {
    const r = await oembed(req(`/api/oembed?url=${q('https://example.com/a')}`));
    expect(r.status).toBe(400);
    expect((await oembed(req(`/api/oembed?url=${q('http://127.0.0.1/')}`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes through only the oEmbed fields', async () => {
    routes((u) => {
      expect(u.startsWith('https://soundcloud.com/oembed?')).toBe(true);
      return new Response(JSON.stringify({ title: 'Song by Artist', author_name: 'Artist', thumbnail_url: 'https://i1.sndcdn.com/a-t500x500.jpg', secret: 'x', height: 400 }));
    });
    const r = await oembed(req(`/api/oembed?url=${q('https://soundcloud.com/artist/song')}`));
    expect(await r.json()).toEqual({ title: 'Song by Artist', author_name: 'Artist', thumbnail_url: 'https://i1.sndcdn.com/a-t500x500.jpg' });
  });

  it('reports private / removed items', async () => {
    routes(() => new Response('Not found', { status: 404 }));
    const r = await oembed(req(`/api/oembed?url=${q('https://soundcloud.com/artist/gone')}`));
    expect(r.status).toBe(404);
    expect((await body(r)).error).toMatch(/private|removed/);
  });
});

describe('/api/soundcloud', () => {
  it('only reads soundcloud.com pages', async () => {
    expect((await soundcloud(req('/api/soundcloud'))).status).toBe(400);
    expect((await soundcloud(req(`/api/soundcloud?url=${q('https://evil.example.com/x/sets/y')}`))).status).toBe(400);
    expect((await soundcloud(req(`/api/soundcloud?url=${q('javascript:alert(1)')}`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('expands a set from the page hydration', async () => {
    const hydration = [
      {
        hydratable: 'playlist',
        data: {
          title: 'Chill Set',
          permalink_url: 'https://soundcloud.com/dj/sets/chill',
          user: { username: 'DJ' },
          tracks: [{ id: 1, title: 'One', permalink_url: 'https://soundcloud.com/dj/one', duration: 61000, user: { username: 'DJ' } }, { id: 2 }],
        },
      },
    ];
    routes((u) =>
      u === 'https://soundcloud.com/dj/sets/chill'
        ? new Response(`<script>window.__sc_hydration = ${JSON.stringify(hydration)};</script>`, { headers: { 'content-type': 'text/html' } })
        : new Response('', { status: 404 }),
    );
    const r = await soundcloud(req(`/api/soundcloud?url=${q('https://soundcloud.com/dj/sets/chill?si=abc')}`));
    expect(r.status).toBe(200);
    const set = (await r.json()) as { kind: string; title: string; tracks: { url: string; duration?: number }[] };
    expect(set.kind).toBe('set');
    expect(set.title).toBe('Chill Set');
    expect(set.tracks).toEqual([
      expect.objectContaining({ url: 'https://soundcloud.com/dj/one', duration: 61 }),
      { url: 'https://api.soundcloud.com/tracks/2' },
    ]);
  });
});
