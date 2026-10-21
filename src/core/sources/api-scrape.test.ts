/** Tests for the serverless scraping helpers in /api/_lib (pure functions, fixtures below). */
import { describe, expect, it } from 'vitest';
import { collect, decodeJsString, extractJsonAfter } from '../../../api/_lib/scrape.ts';
import {
  clockToSeconds,
  extractClientVersion,
  extractInitialData,
  parseContinuation,
  parsePlaylistPage,
  parseSearchResults,
} from '../../../api/_lib/youtube.ts';
import { assetScripts, extractHydration, fillStubs, findClientId, parseHydration, stubIds } from '../../../api/_lib/soundcloud.ts';
import { isBlockedHostname, isPrivateIp } from '../../../api/_lib/ip.ts';

const vr = (id: string, title: string, channel: string, length?: string) => ({
  videoRenderer: {
    videoId: id,
    title: { runs: [{ text: title }] },
    ownerText: { runs: [{ text: channel }] },
    ...(length ? { lengthText: { simpleText: length, accessibility: {} } } : { badges: [{ metadataBadgeRenderer: { label: 'LIVE' } }] }),
    thumbnail: { thumbnails: [{ url: `https://i.ytimg.com/vi/${id}/hq720.jpg?sqp=x` }] },
  },
});

const SEARCH_DATA = {
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  vr('dQw4w9WgXcQ', 'Rick Astley - Never Gonna Give You Up (Official Music Video)', 'Rick Astley', '3:33'),
                  { channelRenderer: { channelId: 'UC1', title: { simpleText: 'Rick Astley' } } },
                  vr('jfKfPfyJRdk', 'lofi hip hop radio 📚 beats to relax/study to', 'Lofi Girl'),
                  { shelfRenderer: { content: { verticalListRenderer: { items: [vr('kXYiU_JCYtU', 'Numb [Official Music Video] - Linkin Park', 'Linkin Park', '3:07')] } } } },
                  vr('dQw4w9WgXcQ', 'duplicate', 'Rick Astley', '3:33'),
                  vr('bad', 'not an id', 'x', '1:00'),
                ],
              },
            },
            { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'NEXT' } } } },
          ],
        },
      },
    },
  },
};

const html = (data: unknown) =>
  `<!DOCTYPE html><html><head><script nonce="x">var ytcfg={};ytcfg.set({"INNERTUBE_CLIENT_VERSION":"2.20251015.01.00"});</script></head><body>` +
  `<script nonce="abc">var ytInitialData = ${JSON.stringify(data)};</script><script>var other = {"a":"}"};</script></body></html>`;

describe('scrape helpers', () => {
  it('extracts JSON objects after a marker, ignoring braces inside strings', () => {
    const page = 'x = {"a":"} { tricky \\" quote","b":[1,{"c":2}]}; more';
    expect(extractJsonAfter(page, 'x = ')).toEqual({ a: '} { tricky " quote', b: [1, { c: 2 }] });
    expect(extractJsonAfter('nope', 'x = ')).toBeNull();
    expect(extractJsonAfter('window.__sc_hydration = [{"a":1},{"b":"]"}];', /window\.__sc_hydration\s*=\s*/)).toEqual([{ a: 1 }, { b: ']' }]);
  });

  it('handles the escaped-string form', () => {
    const page = `var ytInitialData = '\\x7b\\x22a\\x22:\\x22caf\\u00e9\\x22\\x7d';`;
    expect(extractInitialData(page)).toEqual({ a: 'café' });
    expect(decodeJsString('a\\nb\\x41\\u0042')).toBe('a\nbAB');
  });

  it('collects in document order', () => {
    const found = collect({ a: [{ k: { n: 1 } }, { x: { k: { n: 2 } } }], k: { n: 3, k: { n: 99 } } }, ['k']);
    expect(found.map((f) => f.value.n)).toEqual([1, 2, 3]);
  });
});

describe('YouTube scraping', () => {
  it('parses search results', () => {
    const data = extractInitialData(html(SEARCH_DATA));
    const items = parseSearchResults(data);
    expect(items.map((i) => i.id)).toEqual(['dQw4w9WgXcQ', 'jfKfPfyJRdk', 'kXYiU_JCYtU']);
    expect(items[0]).toEqual({
      id: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
      channel: 'Rick Astley',
      duration: '3:33',
      seconds: 213,
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    });
    expect(items[1].duration).toBeUndefined(); // live
    expect(extractClientVersion(html(SEARCH_DATA))).toBe('2.20251015.01.00');
  });

  it('parses lockup view models', () => {
    const data = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            lockupViewModel: {
              contentId: 'hT_nvWreIhg',
              contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
              contentImage: {
                thumbnailViewModel: {
                  overlays: [{ thumbnailOverlayBadgeViewModel: { thumbnailBadges: [{ thumbnailBadgeViewModel: { text: '4:43' } }] } }],
                },
              },
              metadata: {
                lockupMetadataViewModel: {
                  title: { content: 'OneRepublic - Counting Stars' },
                  metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: 'OneRepublicVEVO' } }] }] } },
                },
              },
            },
          },
        },
      },
    };
    expect(parseSearchResults(data)).toEqual([
      { id: 'hT_nvWreIhg', title: 'OneRepublic - Counting Stars', channel: 'OneRepublicVEVO', duration: '4:43', seconds: 283, thumbnail: 'https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg' },
    ]);
  });

  const pvr = (id: string, title: string, secs: string, playable = true) => ({
    playlistVideoRenderer: {
      videoId: id,
      title: { runs: [{ text: title }] },
      shortBylineText: { runs: [{ text: 'Queen Official' }] },
      lengthSeconds: secs,
      lengthText: { simpleText: '0:00' },
      isPlayable: playable,
    },
  });

  it('parses a playlist page with continuation', () => {
    const data = {
      metadata: { playlistMetadataRenderer: { title: 'Queen Greatest Hits' } },
      header: { playlistHeaderRenderer: { ownerText: { runs: [{ text: 'Queen Official' }] } } },
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        itemSectionRenderer: {
                          contents: [
                            {
                              playlistVideoListRenderer: {
                                contents: [
                                  pvr('fJ9rUzIMcZQ', 'Queen – Bohemian Rhapsody (Official Video Remastered)', '360'),
                                  pvr('xxxxxxxxxxx', '[Private video]', '0', false),
                                  pvr('-tJYN-eG1zk', 'Queen - We Will Rock You (Official Video)', '122'),
                                  { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'TOKEN2' } } } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };
    const page = parsePlaylistPage(extractInitialData(html(data)), 'PLtest');
    expect(page.title).toBe('Queen Greatest Hits');
    expect(page.author).toBe('Queen Official');
    expect(page.items.map((i) => [i.id, i.seconds, i.duration])).toEqual([
      ['fJ9rUzIMcZQ', 360, '0:00'],
      ['-tJYN-eG1zk', 122, '0:00'],
    ]);
    expect(page.continuation).toBe('TOKEN2');

    const cont = parseContinuation({
      onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [pvr('2ZBtPf7FOoM', 'Queen - Killer Queen', '180')] } }],
    });
    expect(cont.items.map((i) => i.id)).toEqual(['2ZBtPf7FOoM']);
    expect(cont.continuation).toBeUndefined();
  });

  it('parses clocks', () => {
    expect(clockToSeconds('1:02:03')).toBe(3723);
    expect(clockToSeconds('LIVE')).toBeUndefined();
  });
});

describe('SoundCloud scraping', () => {
  const hydration = [
    { hydratable: 'anonymousId', data: 'x' },
    {
      hydratable: 'playlist',
      data: {
        title: 'Summer Set',
        permalink_url: 'https://soundcloud.com/artist/sets/summer-set',
        artwork_url: 'https://i1.sndcdn.com/artworks-abc-large.jpg',
        user: { username: 'Artist' },
        tracks: [
          {
            id: 1,
            title: 'One',
            permalink_url: 'https://soundcloud.com/artist/one',
            artwork_url: null,
            full_duration: 201000,
            genre: 'House',
            display_date: '2021-06-01T00:00:00Z',
            user: { username: 'Artist', avatar_url: 'https://i1.sndcdn.com/avatars-x-large.jpg' },
          },
          { id: 2, kind: 'track', monetization_model: 'NOT_APPLICABLE', policy: 'ALLOW' },
        ],
      },
    },
  ];
  const page = `<html><script crossorigin src="https://a-v2.sndcdn.com/assets/0-aaa.js"></script><script crossorigin src="https://a-v2.sndcdn.com/assets/49-bbb.js"></script><script>window.__sc_hydration = ${JSON.stringify(hydration)};</script></html>`;

  it('reads a set with stubs', () => {
    const h = extractHydration(page)!;
    const set = parseHydration(h, 'https://soundcloud.com/artist/sets/summer-set')!;
    expect(set.kind).toBe('set');
    expect(set.title).toBe('Summer Set');
    expect(set.tracks).toEqual([
      { url: 'https://soundcloud.com/artist/one', title: 'One', artist: 'Artist', artwork: 'https://i1.sndcdn.com/avatars-x-large.jpg', duration: 201, genre: 'House', year: 2021 },
      { url: 'https://api.soundcloud.com/tracks/2' },
    ]);
    expect(stubIds(set)).toEqual([2]);
    const filled = fillStubs(set, [{ id: 2, title: 'Two', permalink_url: 'https://soundcloud.com/artist/two', duration: 90000, user: { username: 'Artist' } }]);
    expect(filled.tracks[1]).toMatchObject({ url: 'https://soundcloud.com/artist/two', title: 'Two', duration: 90 });
  });

  it('reads a single track', () => {
    const h = [{ hydratable: 'sound', data: { id: 5, title: 'Solo', permalink_url: 'https://soundcloud.com/a/solo', duration: 1000, user: { username: 'A' } } }];
    expect(parseHydration(h, 'x')).toMatchObject({ kind: 'track', tracks: [{ url: 'https://soundcloud.com/a/solo', title: 'Solo' }] });
  });

  it('finds asset scripts and a client id', () => {
    expect(assetScripts(page)).toEqual(['https://a-v2.sndcdn.com/assets/49-bbb.js', 'https://a-v2.sndcdn.com/assets/0-aaa.js']);
    expect(findClientId('foo({client_id:"abcdefghijABCDEFGHIJ0123456789xy",env:"production"})')).toBe('abcdefghijABCDEFGHIJ0123456789xy');
    expect(findClientId('nothing here')).toBeUndefined();
  });
});

describe('SSRF guard', () => {
  it.each(['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.5.4', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1', '::ffff:7f00:1'])(
    'blocks %s',
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('allows %s', (ip) => expect(isPrivateIp(ip)).toBe(false));
  it('blocks local names', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('printer.local')).toBe(true);
    expect(isBlockedHostname('intranet')).toBe(true);
    expect(isBlockedHostname('feeds.megaphone.fm')).toBe(false);
  });
});
