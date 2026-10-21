/**
 * Podcasts: find shows with the iTunes directory, read their RSS/Atom feed
 * (through our `/api/feed` proxy, since most feeds don't send CORS headers),
 * and turn episodes into library tracks.
 */
import type { Track } from '../types';
import { apiText, fetchWithTimeout, firstOk, secureUrl, SourceError } from './net';
import { itunes, itunesArtwork, type ItunesResult } from './itunes';
import { parseClock, stripHtml } from './text';
import { attrOf, child, childrenNamed, find, parseXml, textOf, type XmlEl } from './xml';
import { makeTrack } from './track';

export interface PodcastShow {
  id: number;
  title: string;
  author: string;
  feedUrl: string;
  artwork?: string;
  genre?: string;
  episodeCount?: number;
}

export interface Episode {
  guid: string;
  title: string;
  url: string;
  type?: string;
  video: boolean;
  /** epoch ms */
  pubDate?: number;
  /** seconds */
  duration?: number;
  description: string;
  artwork?: string;
  episode?: number;
  season?: number;
}

export interface Feed {
  title: string;
  author?: string;
  description?: string;
  artwork?: string;
  link?: string;
  episodes: Episode[];
}

/** Suggested searches shown before the user types anything. */
export const PODCAST_SUGGESTIONS = ['Thai', 'News', 'Comedy', 'Technology', 'True Crime', 'History', 'Music', 'Learn English', 'Business', 'Science'];

function showFrom(r: ItunesResult): PodcastShow | null {
  if (!r.feedUrl) return null;
  return {
    id: r.collectionId ?? r.trackId ?? 0,
    title: r.collectionName ?? r.trackName ?? 'Podcast',
    author: r.artistName ?? '',
    feedUrl: r.feedUrl,
    artwork: r.artworkUrl600 ?? itunesArtwork(r.artworkUrl100),
    genre: r.primaryGenreName,
    episodeCount: r.trackCount,
  };
}

export async function searchPodcasts(term: string, country = 'us'): Promise<PodcastShow[]> {
  const results = await itunes('search', { term, media: 'podcast', entity: 'podcast', limit: '30', country });
  return results.map(showFrom).filter((s): s is PodcastShow => !!s);
}

/** podcasts.apple.com/…/id123456 → show (with its feed URL) */
export async function lookupPodcast(id: string | number): Promise<PodcastShow | null> {
  const results = await itunes('lookup', { id: String(id), entity: 'podcast' });
  for (const r of results) {
    const s = showFrom(r);
    if (s) return s;
  }
  return null;
}

export function parseApplePodcastUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (!/(^|\.)(podcasts|itunes)\.apple\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/id(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const MEDIA_EXT = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|mp4|m4v|mov|webm)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm)(\?|#|$)/i;

function parseDate(s: string | undefined): number | undefined {
  if (!s) return undefined;
  let t = Date.parse(s);
  if (Number.isNaN(t)) {
    // "Tue, 05 Mar 2024 10:00:00 PST" style zones Date can't read → drop the zone
    t = Date.parse(s.replace(/\s+[A-Z]{2,5}$/, ' GMT'));
  }
  return Number.isNaN(t) ? undefined : t;
}

function mediaOf(item: XmlEl): { url: string; type?: string } | undefined {
  // RSS <enclosure>
  for (const e of childrenNamed(item, 'enclosure')) {
    const url = e.attrs.url ?? e.attrs.URL;
    if (url) return { url: url.trim(), type: e.attrs.type };
  }
  // Media RSS
  for (const name of ['media:content', 'media:group']) {
    for (const e of childrenNamed(item, name)) {
      const c = name === 'media:group' ? child(e, 'media:content') : e;
      const url = c?.attrs.url;
      if (url && (/^(audio|video)\//.test(c?.attrs.type ?? '') || MEDIA_EXT.test(url) || c?.attrs.medium === 'audio' || c?.attrs.medium === 'video'))
        return { url: url.trim(), type: c?.attrs.type };
    }
  }
  // Atom <link rel="enclosure">
  for (const l of childrenNamed(item, 'link')) {
    if ((l.attrs.rel ?? '') === 'enclosure' && l.attrs.href) return { url: l.attrs.href.trim(), type: l.attrs.type };
  }
  return undefined;
}

/** Parse an RSS 2.0 / RSS 1.0 / Atom podcast feed. */
export function parseFeed(xml: string): Feed {
  const doc = parseXml(xml);
  const rss = find(doc, 'rss');
  const atom = rss ? undefined : find(doc, 'feed');
  const rdf = rss || atom ? undefined : find(doc, 'rdf:RDF');
  const channel = rss ? child(rss, 'channel') : (atom ?? (rdf ? child(rdf, 'channel') : undefined));
  if (!channel) throw new SourceError('This address isn’t a podcast feed.');

  const title = stripHtml(textOf(channel, 'title') ?? 'Podcast', 300);
  const author = stripHtml(textOf(channel, 'itunes:author', 'author', 'managingEditor', 'dc:creator', 'googleplay:author') ?? '', 200) || undefined;
  const authorAtom = atom ? textOf(child(channel, 'author'), 'name') : undefined;
  const artwork =
    attrOf(channel, 'itunes:image', 'href') ??
    textOf(child(channel, 'image'), 'url') ??
    attrOf(channel, 'media:thumbnail', 'url') ??
    attrOf(channel, 'googleplay:image', 'href') ??
    textOf(channel, 'logo', 'icon');
  const description = stripHtml(textOf(channel, 'itunes:summary', 'description', 'subtitle', 'itunes:subtitle'), 1200) || undefined;
  const link = textOf(channel, 'link') ?? childrenNamed(channel, 'link').find((l) => l.attrs.href)?.attrs.href;

  const itemEls = rss ? childrenNamed(channel, 'item') : atom ? childrenNamed(channel, 'entry') : childrenNamed(rdf, 'item');
  const episodes: Episode[] = [];
  for (const it of itemEls) {
    const media = mediaOf(it);
    if (!media || !/^https?:\/\//i.test(media.url)) continue;
    const t = stripHtml(textOf(it, 'title', 'itunes:title') ?? 'Episode', 300);
    const ep = parseInt(textOf(it, 'itunes:episode') ?? '', 10);
    const season = parseInt(textOf(it, 'itunes:season') ?? '', 10);
    const video = /^video\//i.test(media.type ?? '') || (!media.type && VIDEO_EXT.test(media.url));
    episodes.push({
      guid: textOf(it, 'guid', 'id') ?? media.url,
      title: t,
      url: media.url,
      type: media.type,
      video,
      pubDate: parseDate(textOf(it, 'pubDate', 'published', 'updated', 'dc:date')),
      duration: parseClock(textOf(it, 'itunes:duration')) ?? (parseInt(childrenNamed(it, 'media:content')[0]?.attrs.duration ?? '', 10) || undefined),
      description: stripHtml(textOf(it, 'itunes:summary', 'description', 'content:encoded', 'summary', 'content', 'itunes:subtitle'), 2000),
      artwork: attrOf(it, 'itunes:image', 'href') ?? attrOf(it, 'media:thumbnail', 'url'),
      episode: Number.isFinite(ep) ? ep : undefined,
      season: Number.isFinite(season) ? season : undefined,
    });
  }
  episodes.sort((a, b) => (b.pubDate ?? 0) - (a.pubDate ?? 0));
  return { title, author: author ?? authorAtom, description, artwork, link, episodes };
}

/** Fetch + parse a feed: our proxy first (CORS), then a direct request (works for CORS-enabled feeds). */
export async function fetchFeed(url: string): Promise<Feed> {
  const xml = await firstOk<string>([
    () => apiText('feed', { url }),
    async () => {
      const r = await fetchWithTimeout(url, { timeout: 12_000 });
      if (!r.ok) throw new SourceError(`The feed answered with an error (${r.status}).`);
      return r.text();
    },
  ]);
  return parseFeed(xml);
}

export function episodeTrack(feed: Feed, ep: Episode, feedUrl?: string): Track {
  return makeTrack({
    source: 'podcast',
    ref: secureUrl(ep.url),
    mediaType: 'podcast',
    hasVideo: ep.video || undefined,
    title: ep.title,
    artist: feed.author || feed.title,
    album: feed.title,
    show: feed.title,
    genre: 'Podcast',
    trackNo: ep.episode,
    pubDate: ep.pubDate,
    duration: ep.duration,
    description: ep.description ? ep.description.slice(0, 1500) : feedUrl ? `Feed: ${feedUrl}` : undefined,
    artwork: ep.artwork ?? feed.artwork,
    year: ep.pubDate ? new Date(ep.pubDate).getFullYear() : undefined,
  });
}
