/**
 * SoundCloud: link parsing, oEmbed metadata, and set (playlist/album)
 * expansion through our `/api/soundcloud` function.
 *
 * Tracks play through the SoundCloud Widget API, which accepts any public
 * permalink (or an api.soundcloud.com/tracks/<id> URL) as `ref`.
 */
import type { Track } from '../types';
import { apiJson, firstOk, getJson, SourceError } from './net';
import { prettifySlug } from './text';
import { makeTrack, singleAlbum } from './track';

export type ScKind = 'track' | 'set' | 'user' | 'short' | 'other';

export interface ScRef {
  /** canonical URL (no query, no trailing slash) */
  url: string;
  kind: ScKind;
}

const RESERVED = new Set([
  'discover',
  'stream',
  'search',
  'you',
  'charts',
  'upload',
  'pages',
  'terms-of-use',
  'settings',
  'messages',
  'notifications',
  'people',
  'tags',
  'popular',
  'feed',
  'jobs',
  'imprint',
  'signin',
  'logout',
  'mobile',
  'stations',
]);
const USER_SUBPAGES = new Set(['tracks', 'albums', 'likes', 'reposts', 'popular-tracks', 'followers', 'following', 'comments', 'spotlight', 'sets']);

export function parseSoundCloudUrl(input: string): ScRef | null {
  const s = input.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'on.soundcloud.com' && parts.length) return { url: `https://on.soundcloud.com/${parts[0]}`, kind: 'short' };
  if (host === 'api.soundcloud.com') {
    if (parts[0] === 'tracks' && /^\d+$/.test(parts[1] ?? '')) return { url: `https://api.soundcloud.com/tracks/${parts[1]}`, kind: 'track' };
    if (parts[0] === 'playlists' && /^\d+$/.test(parts[1] ?? '')) return { url: `https://api.soundcloud.com/playlists/${parts[1]}`, kind: 'set' };
    return null;
  }
  if (host !== 'soundcloud.com') return null;
  if (!parts.length) return null;
  if (RESERVED.has(parts[0].toLowerCase())) return { url: `https://soundcloud.com/${parts.join('/')}`, kind: 'other' };
  const user = parts[0];
  if (parts.length === 1) return { url: `https://soundcloud.com/${user}`, kind: 'user' };
  if (parts[1] === 'sets') {
    if (parts.length >= 3) return { url: `https://soundcloud.com/${user}/sets/${parts.slice(2, 4).join('/')}`, kind: 'set' };
    return { url: `https://soundcloud.com/${user}/sets`, kind: 'user' };
  }
  if (USER_SUBPAGES.has(parts[1])) return { url: `https://soundcloud.com/${user}/${parts[1]}`, kind: 'user' };
  // track; a 3rd segment may be the secret token of a private link (s-AbCdE)
  const secret = parts[2] && /^s-[A-Za-z0-9]+$/.test(parts[2]) ? `/${parts[2]}` : '';
  return { url: `https://soundcloud.com/${user}/${parts[1]}${secret}`, kind: 'track' };
}

/** "-large" (100px) → "-t500x500" */
export function scArtwork(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/-(large|t\d+x\d+|crop|small|badge|tiny|mini|original)\.(jpg|png)/, '-t500x500.$2');
}

/** Fallback names from the URL: soundcloud.com/odesza/say-my-name → ODESZA? we only know "Odesza", "Say My Name". */
export function namesFromUrl(url: string): { artist: string; title: string } {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const title = parts[1] === 'sets' ? parts[2] : parts[1];
    return { artist: prettifySlug(parts[0] ?? 'SoundCloud'), title: prettifySlug(title ?? 'SoundCloud Track') };
  } catch {
    return { artist: 'SoundCloud', title: 'SoundCloud Track' };
  }
}

export interface ScOEmbed {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  description?: string;
  html?: string;
}

export async function soundcloudOembed(url: string): Promise<ScOEmbed> {
  return firstOk<ScOEmbed>([
    () => getJson<ScOEmbed>(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`, { timeout: 9000 }),
    () => apiJson<ScOEmbed>('oembed', { url }, { timeout: 12_000 }),
  ]);
}

/** oEmbed titles are "Song by Artist"; strip the suffix. */
export function oembedTitle(o: ScOEmbed): string | undefined {
  const t = o.title?.trim();
  if (!t) return undefined;
  const a = o.author_name?.trim();
  if (a && t.toLowerCase().endsWith(` by ${a.toLowerCase()}`)) return t.slice(0, t.length - a.length - 4).trim();
  return t;
}

export interface ScItem {
  url: string;
  title?: string;
  artist?: string;
  artwork?: string;
  /** seconds */
  duration?: number;
  genre?: string;
  year?: number;
}

export interface ScSet {
  kind: 'set' | 'track';
  url: string;
  title?: string;
  artist?: string;
  artwork?: string;
  tracks: ScItem[];
}

export function scTrack(item: ScItem, opts: { album?: string; albumArtist?: string; trackNo?: number } = {}): Track {
  const fallback = namesFromUrl(item.url);
  const title = item.title || (item.url.includes('api.soundcloud.com') ? 'SoundCloud Track' : fallback.title);
  return makeTrack({
    source: 'soundcloud',
    ref: item.url,
    mediaType: 'music',
    title,
    artist: item.artist || (item.url.includes('api.soundcloud.com') ? 'SoundCloud' : fallback.artist),
    album: opts.album ?? singleAlbum(title),
    albumArtist: opts.albumArtist,
    trackNo: opts.trackNo,
    genre: item.genre,
    year: item.year,
    duration: item.duration,
    artwork: scArtwork(item.artwork),
  });
}

/** Expand a set (or resolve a short link) server-side. */
export async function soundcloudResolve(url: string): Promise<ScSet> {
  return apiJson<ScSet>('soundcloud', { url });
}

/**
 * Everything needed to add a SoundCloud link: one track, or every track of a
 * set (falling back to the set as a single item when it cannot be expanded).
 */
export async function soundcloudTracks(input: string): Promise<{ tracks: Track[]; title: string; note?: string }> {
  let ref = parseSoundCloudUrl(input);
  if (!ref) throw new SourceError('That doesn’t look like a SoundCloud link.');
  if (ref.kind === 'user' || ref.kind === 'other')
    throw new SourceError('Paste a link to a SoundCloud track or playlist (not a profile page).');

  if (ref.kind === 'short') {
    try {
      const r = await soundcloudResolve(ref.url);
      ref = parseSoundCloudUrl(r.url) ?? ref;
      if (r.kind === 'set' && r.tracks.length) return setToTracks(r);
      if (r.kind === 'track' && r.tracks[0]) return { tracks: [scTrack(r.tracks[0])], title: r.tracks[0].title ?? 'SoundCloud track' };
    } catch {
      throw new SourceError('Couldn’t open this short link. Open it in your browser and paste the full soundcloud.com address.');
    }
  }

  if (ref.kind === 'set') {
    try {
      const r = await soundcloudResolve(ref.url);
      if (r.tracks.length) return setToTracks(r);
    } catch {
      /* fall through: add as one item */
    }
    const o = await soundcloudOembed(ref.url).catch(() => ({}) as ScOEmbed);
    const title = oembedTitle(o) ?? namesFromUrl(ref.url).title;
    return {
      tracks: [scTrack({ url: ref.url, title, artist: o.author_name, artwork: o.thumbnail_url }, { album: title })],
      title,
      note: 'Added the playlist as one item (its tracks couldn’t be listed).',
    };
  }

  // single track
  let o: ScOEmbed = {};
  try {
    o = await soundcloudOembed(ref.url);
  } catch (e) {
    if (e instanceof SourceError && /\b404\b/.test(e.message)) throw new SourceError('That SoundCloud track is private or was removed.');
  }
  const title = oembedTitle(o);
  return { tracks: [scTrack({ url: ref.url, title, artist: o.author_name, artwork: o.thumbnail_url })], title: title ?? namesFromUrl(ref.url).title };
}

function setToTracks(r: ScSet): { tracks: Track[]; title: string } {
  const album = r.title || 'SoundCloud Playlist';
  return {
    title: album,
    tracks: r.tracks.map((t, i) =>
      scTrack({ ...t, artwork: t.artwork || r.artwork }, { album, albumArtist: r.artist, trackNo: i + 1 }),
    ),
  };
}

/** Search SoundCloud tracks (server-side, best effort — SoundCloud has no keyless public search API). */
export async function soundcloudSearch(q: string): Promise<Track[]> {
  const r = await apiJson<{ tracks: ScItem[] }>('soundcloud', { q });
  return (r.tracks ?? []).map((t) => scTrack(t));
}
