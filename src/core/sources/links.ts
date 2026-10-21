/**
 * "Paste any link": figure out what a URL points to and turn it into tracks.
 * YouTube / SoundCloud / archive.org / Apple Podcasts / RSS feeds / direct
 * media files are recognised; anything else can be added as a stream.
 */
import type { MediaType, Track } from '../types';
import { parseArchiveUrl } from './archive';
import { normalizeUrl, secureUrl } from './net';
import { parseApplePodcastUrl } from './podcasts';
import { parseSoundCloudUrl, type ScRef } from './soundcloud';
import { fileTitleFromUrl } from './text';
import { makeTrack } from './track';
import { parseYouTubeUrl, type YouTubeRef } from './youtube';

export type LinkKind =
  | { kind: 'youtube'; ref: YouTubeRef; url: string }
  | { kind: 'soundcloud'; ref: ScRef; url: string }
  | { kind: 'archive'; id: string; url: string }
  | { kind: 'apple-podcast'; id: string; url: string }
  | { kind: 'feed'; url: string }
  | { kind: 'media'; url: string; video: boolean }
  | { kind: 'unknown'; url: string };

const AUDIO_EXT = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac|weba|mpga)$/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|ogv)$/i;
const FEED_HINT =
  /(\.(rss|xml|atom)$)|(\/(feed|rss|podcast|atom)(\.xml)?\/?$)|(^feeds?\.)|(\.libsyn\.com$)|(anchor\.fm$)|(megaphone\.fm$)|(simplecast\.com$)|(art19\.com$)|(buzzsprout\.com$)|(podbean\.com$)|(omny\.fm$)|(acast\.com$)|(spreaker\.com$)|(transistor\.fm$)|(captivate\.fm$)|(soundcloud\.com\/users\/soundcloud:users:)/i;

export function classifyLink(input: string): LinkKind | null {
  const url = normalizeUrl(input);
  if (!url) {
    // bare YouTube id
    const yt = parseYouTubeUrl(input);
    return yt ? { kind: 'youtube', ref: yt, url: input.trim() } : null;
  }
  const yt = parseYouTubeUrl(url);
  if (yt) return { kind: 'youtube', ref: yt, url };
  const u = new URL(url);
  if (/feeds\.soundcloud\.com$/i.test(u.hostname)) return { kind: 'feed', url };
  const sc = parseSoundCloudUrl(url);
  if (sc) return { kind: 'soundcloud', ref: sc, url };
  const apple = parseApplePodcastUrl(url);
  if (apple) return { kind: 'apple-podcast', id: apple, url };
  const path = u.pathname.toLowerCase();
  if (/(^|\.)archive\.org$/i.test(u.hostname) && !path.startsWith('/download/')) {
    const id = parseArchiveUrl(url);
    if (id) return { kind: 'archive', id, url };
  }
  if (AUDIO_EXT.test(path)) return { kind: 'media', url, video: false };
  if (VIDEO_EXT.test(path)) return { kind: 'media', url, video: true };
  if (FEED_HINT.test(path) || FEED_HINT.test(u.hostname)) return { kind: 'feed', url };
  return { kind: 'unknown', url };
}

export interface DirectOpts {
  title?: string;
  artist?: string;
  album?: string;
  mediaType?: MediaType;
  video?: boolean;
}

/** A track for any direct http(s) media URL (or a radio stream). */
export function directTrack(url: string, opts: DirectOpts = {}): Track {
  const video = opts.video ?? VIDEO_EXT.test(new URL(url).pathname);
  const mediaType: MediaType = opts.mediaType ?? (video ? 'movie' : 'music');
  const host = new URL(url).hostname.replace(/^www\./, '');
  return makeTrack({
    source: mediaType === 'radio' ? 'radio' : 'url',
    ref: secureUrl(url),
    mediaType,
    hasVideo: video || undefined,
    title: opts.title?.trim() || fileTitleFromUrl(url),
    artist: opts.artist?.trim() || host,
    album: opts.album?.trim() || (mediaType === 'radio' ? 'Internet Radio' : ''),
  });
}
