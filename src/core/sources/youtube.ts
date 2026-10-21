/**
 * YouTube: URL parsing, "Artist - Title" splitting, search / playlists via
 * our `/api/youtube` function, and oEmbed metadata.
 *
 * Playback itself goes through the YouTube IFrame API (player adapter), so a
 * YouTube track only needs `ref: <11-char video id>`.
 */
import type { Track } from '../types';
import { apiJson, fetchWithTimeout, firstOk, getJson, SourceError } from './net';
import { makeTrack, singleAlbum } from './track';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{2,64}$/;

export interface YouTubeRef {
  videoId?: string;
  listId?: string;
}

/**
 * Understands watch / youtu.be / Shorts / embed / live / music.youtube /
 * playlist URLs (with or without scheme) and bare video ids.
 */
export function parseYouTubeUrl(input: string): YouTubeRef | null {
  const s = input.trim();
  if (!s) return null;
  // bare id (but not an 11-letter word): ids almost always contain digits, _ - or inner capitals
  if (VIDEO_ID.test(s) && (/[0-9_-]/.test(s) || /[A-Z]/.test(s.slice(1)))) return { videoId: s };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music|gaming)\./, '');
  let videoId: string | null = null;
  if (host === 'youtu.be') {
    videoId = u.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    const first = parts[0]?.toLowerCase();
    if (first === 'watch') videoId = u.searchParams.get('v');
    else if (first && ['shorts', 'embed', 'v', 'e', 'live'].includes(first)) videoId = parts[1] ?? null;
    else if (first === 'attribution_link') {
      const inner = u.searchParams.get('u');
      return inner ? parseYouTubeUrl(`https://www.youtube.com${inner.startsWith('/') ? '' : '/'}${inner}`) : null;
    } else if (first !== 'playlist' && !u.searchParams.get('list')) return null;
    if (!videoId && u.searchParams.get('v')) videoId = u.searchParams.get('v');
  } else return null;

  const out: YouTubeRef = {};
  if (videoId && VIDEO_ID.test(videoId)) out.videoId = videoId;
  const list = u.searchParams.get('list');
  if (list && LIST_ID.test(list)) out.listId = list;
  return out.videoId || out.listId ? out : null;
}

/** Mixes (RD…), Liked (LL) and Watch Later (WL) cannot be read without signing in. */
export function isExpandableList(listId: string): boolean {
  return !/^(RD|UL|LL|WL|FL)/.test(listId);
}

/** YouTube Music album playlists start with OLAK5uy_. */
export function isAlbumList(listId: string): boolean {
  return listId.startsWith('OLAK5uy_');
}

export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

const NOISE =
  /\b(official|video|audio|lyrics?|lyric video|visuali[sz]er|m\/?v|hd|hq|4k|uhd|1080p|clip officiel|videoclip|en vivo oficial|color coded|eng ?sub|sub español|full song|explicit|เนื้อเพลง|ฟังเพลง)\b/i;

/** Remove "(Official Video)", "[Lyrics]", "| Official MV" style noise; keep "(feat. …)", "(Remix)", "(Live)". */
export function cleanVideoTitle(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/\s*[([【「『〔]([^)\]】」』〕]*)[)\]】」』〕]/g, (m, inner: string) =>
    NOISE.test(inner) && !/\b(feat|ft)\.?\b|remix|cover|version|live/i.test(inner) ? '' : m,
  );
  // "Title | Official MV | Label" → keep the first meaningful segment
  const segs = s.split(/\s+[|｜]\s+/);
  if (segs.length > 1) s = segs.find((p) => !NOISE.test(p) || p.length > 40) ?? segs[0];
  s = s.replace(/\s*[-–—:]?\s*\bofficial\s+(music\s+)?(video|audio|mv|lyric video)\s*$/i, '');
  s = s.replace(/\s*#\S+/g, ''); // hashtags in Shorts titles
  return s.replace(/\s+/g, ' ').replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, '').trim() || raw.trim();
}

/** "RickAstleyVEVO" → "Rick Astley", "Queen - Topic" → "Queen", "LinkinParkOfficial" → "Linkin Park" */
export function cleanChannelName(raw: string | undefined): string {
  const orig = (raw ?? '').trim();
  let s = orig.replace(/\s*-\s*Topic$/i, '');
  let squashed = false;
  if (/.VEVO$/i.test(s)) {
    s = s.replace(/\s*VEVO$/i, '');
    squashed = true;
  }
  if (/.Official(\s*(YouTube\s*)?Channel)?$/i.test(s)) {
    s = s.replace(/\s*Official(\s*(YouTube\s*)?Channel)?$/i, '');
    squashed = true;
  }
  s = s.replace(/(.)\s+(YouTube\s+)?Channel$/i, '$1');
  if (squashed && !/\s/.test(s)) s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  return s.trim() || orig;
}

/**
 * Best-effort split of a video title into artist + title.
 * "Queen – Bohemian Rhapsody (Official Video Remastered)" → { artist: "Queen", title: "Bohemian Rhapsody" }
 * Without a separator the (cleaned) channel name is the artist.
 */
export function splitArtistTitle(rawTitle: string, channel?: string): { artist: string; title: string } {
  const cleaned = cleanVideoTitle(rawTitle);
  const ch = cleanChannelName(channel);
  // Auto-generated "Artist - Topic" channels: the title is already just the song.
  if (channel && /\s-\s*Topic$/i.test(channel)) return { artist: ch, title: cleaned };

  const dash = cleaned.match(/^(.+?)\s+[-–—~]\s+(.+)$/) ?? cleaned.match(/^(.+?)\s*[–—]\s*(.+)$/);
  if (dash && dash[1].length <= 80) {
    const left = dash[1].trim();
    const right = dash[2].trim();
    // Some channels post "Title - Artist"; if the right side equals the channel, swap.
    if (ch && right.toLowerCase() === ch.toLowerCase() && left.toLowerCase() !== ch.toLowerCase()) return { artist: right, title: left };
    return { artist: left, title: right };
  }
  // Japanese style: Artist「Title」 / Artist『Title』
  const jp = rawTitle.match(/^(.+?)\s*[「『](.+?)[」』]/);
  if (jp) return { artist: jp[1].trim(), title: jp[2].trim() };
  // Artist "Title"
  const q = cleaned.match(/^(.+?)\s+["“](.+?)["”]$/);
  if (q) return { artist: q[1].trim(), title: q[2].trim() };
  return { artist: ch || 'YouTube', title: cleaned };
}

export interface YtItem {
  id: string;
  title: string;
  channel?: string;
  duration?: string;
  seconds?: number;
  thumbnail?: string;
}

export interface YtPlaylist {
  id: string;
  title: string;
  author?: string;
  items: YtItem[];
}

export interface YtTrackOpts {
  musicVideo?: boolean;
  album?: string;
  albumArtist?: string;
  trackNo?: number;
}

export function youtubeTrack(item: YtItem, opts: YtTrackOpts = {}): Track {
  const { artist, title } = splitArtistTitle(item.title, item.channel);
  return makeTrack({
    source: 'youtube',
    ref: item.id,
    mediaType: opts.musicVideo ? 'musicvideo' : 'music',
    hasVideo: true,
    title,
    artist,
    album: opts.album ?? singleAlbum(title),
    albumArtist: opts.albumArtist,
    trackNo: opts.trackNo,
    duration: item.seconds,
    artwork: youtubeThumb(item.id),
  });
}

/** "th-TH" → "TH": the region YouTube should rank results for. */
export function browserRegion(langs: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []): string | undefined {
  for (const l of langs) {
    const m = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(l ?? '');
    if (m) return m[1].toUpperCase();
  }
  return undefined;
}

/** Search YouTube videos (server-side scrape, no API key). */
export async function youtubeSearch(q: string): Promise<YtItem[]> {
  const gl = browserRegion();
  const items = await apiJson<YtItem[]>('youtube', gl ? { q, gl } : { q });
  if (!Array.isArray(items)) throw new SourceError('YouTube search is unavailable right now.');
  return items;
}

export async function youtubePlaylist(listId: string): Promise<YtPlaylist> {
  if (!isExpandableList(listId)) throw new SourceError('Mixes and private lists can’t be imported. Paste a public playlist link.');
  return apiJson<YtPlaylist>('youtube', { list: listId });
}

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

/** Title + channel for one video: YouTube oEmbed → our proxy → noembed.com. */
export async function youtubeInfo(id: string): Promise<YtItem> {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const o = await firstOk<OEmbed>([
    () => getJson<OEmbed>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { timeout: 8000 }),
    () => apiJson<OEmbed>('oembed', { url: watch }, { timeout: 10_000 }),
    async () => {
      const r = await fetchWithTimeout(`https://noembed.com/embed?url=${encodeURIComponent(watch)}`, { timeout: 8000 });
      const j = (await r.json()) as OEmbed & { error?: string };
      if (j.error || !j.title) throw new SourceError('Video not found');
      return j;
    },
  ]);
  if (!o.title) throw new SourceError('This video is private or unavailable.');
  return { id, title: o.title, channel: o.author_name, thumbnail: youtubeThumb(id) };
}

/** Build a track for a single video id; falls back to a placeholder title that fixes itself on first play. */
export async function youtubeTrackFromId(id: string, opts: YtTrackOpts = {}): Promise<Track> {
  try {
    return youtubeTrack(await youtubeInfo(id), opts);
  } catch {
    return makeTrack({
      source: 'youtube',
      ref: id,
      mediaType: opts.musicVideo ? 'musicvideo' : 'music',
      hasVideo: true,
      title: 'YouTube Video',
      artist: 'YouTube',
      album: '',
      artwork: youtubeThumb(id),
    });
  }
}
