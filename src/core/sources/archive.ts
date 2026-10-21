/**
 * Internet Archive (archive.org): millions of free / public-domain
 * recordings and films. Both APIs used here send CORS headers.
 *  - search:   https://archive.org/advancedsearch.php
 *  - metadata: https://archive.org/metadata/<identifier>
 */
import type { MediaType, Track } from '../types';
import { getJson, SourceError } from './net';
import { firstString, parseClock, parseYear } from './text';
import { makeTrack } from './track';

export type ArchiveKind = 'audio' | 'movies';

export interface ArchiveCollection {
  id: string;
  label: string;
  kind: ArchiveKind;
  query: string;
}

/** Curated starting points (all free to stream). */
export const ARCHIVE_COLLECTIONS: ArchiveCollection[] = [
  { id: 'etree', label: 'Live Music', kind: 'audio', query: 'collection:(etree)' },
  { id: 'netlabels', label: 'Netlabels', kind: 'audio', query: 'collection:(netlabels)' },
  { id: '78rpm', label: '78 RPMs', kind: 'audio', query: 'collection:(georgeblood OR 78rpm)' },
  { id: 'oldtimeradio', label: 'Old Time Radio', kind: 'audio', query: 'collection:(oldtimeradio)' },
  { id: 'librivox', label: 'Audiobooks (LibriVox)', kind: 'audio', query: 'collection:(librivoxaudio)' },
  { id: 'feature_films', label: 'Feature Films', kind: 'movies', query: 'collection:(feature_films)' },
  { id: 'cartoons', label: 'Classic Cartoons', kind: 'movies', query: 'collection:(classic_cartoons)' },
  { id: 'silent', label: 'Silent Films', kind: 'movies', query: 'collection:(silent_films)' },
  { id: 'scifi', label: 'Sci‑Fi & Horror', kind: 'movies', query: 'collection:(SciFi_Horror)' },
];

export interface ArchiveHit {
  identifier: string;
  title: string;
  creator?: string;
  year?: number;
  mediatype: string;
  downloads?: number;
}

interface AdvancedSearch {
  response?: { numFound: number; docs: Record<string, unknown>[] };
}

/** Escape user text for the Lucene query parser. */
function luceneEscape(s: string): string {
  return s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');
}

export function buildArchiveQuery(text: string, kind: ArchiveKind, collection?: ArchiveCollection): string {
  const parts: string[] = [];
  const q = text.trim();
  if (q) {
    const words = q.split(/\s+/).map(luceneEscape).join(' ');
    parts.push(`(title:(${words}) OR creator:(${words}) OR subject:(${words}) OR description:(${words}))`);
  }
  if (collection) parts.push(collection.query);
  parts.push(`mediatype:(${kind})`);
  // hide items that can't be streamed
  parts.push('-access-restricted-item:(true)');
  return parts.join(' AND ');
}

export async function archiveSearch(
  text: string,
  kind: ArchiveKind,
  collection?: ArchiveCollection,
  page = 1,
): Promise<{ hits: ArchiveHit[]; total: number }> {
  const params = new URLSearchParams();
  params.set('q', buildArchiveQuery(text, kind, collection));
  for (const f of ['identifier', 'title', 'creator', 'year', 'date', 'mediatype', 'downloads']) params.append('fl[]', f);
  params.append('sort[]', 'downloads desc');
  params.set('rows', '40');
  params.set('page', String(page));
  params.set('output', 'json');
  const j = await getJson<AdvancedSearch>(`https://archive.org/advancedsearch.php?${params}`, { timeout: 15_000 });
  const docs = j.response?.docs ?? [];
  return {
    total: j.response?.numFound ?? 0,
    hits: docs.map((d) => ({
      identifier: String(d.identifier),
      title: firstString(d.title) ?? String(d.identifier),
      creator: firstString(d.creator),
      year: parseYear(firstString(d.year) ?? firstString(d.date)),
      mediatype: firstString(d.mediatype) ?? kind,
      downloads: typeof d.downloads === 'number' ? d.downloads : undefined,
    })),
  };
}

export interface ArchiveFileMeta {
  name: string;
  source?: string;
  format?: string;
  title?: string;
  creator?: string;
  album?: string;
  track?: string;
  length?: string;
  size?: string;
}

export interface ArchiveMetadata {
  metadata?: Record<string, unknown>;
  files?: ArchiveFileMeta[];
  is_dark?: boolean;
}

export interface ArchiveFile {
  name: string;
  url: string;
  title: string;
  creator?: string;
  trackNo?: number;
  duration?: number;
  format: string;
  video: boolean;
  size?: number;
}

export interface ArchiveItem {
  identifier: string;
  title: string;
  creator?: string;
  year?: number;
  description?: string;
  collections: string[];
  mediatype: string;
  artwork: string;
  files: ArchiveFile[];
}

/** Lower rank = better. Formats browsers can stream, best first. */
const AUDIO_RANK: Record<string, number> = {
  'VBR MP3': 1,
  MP3: 2,
  '128Kbps MP3': 2,
  '256Kbps MP3': 2,
  '320Kbps MP3': 3,
  '64Kbps MP3': 4,
  'Ogg Vorbis': 5,
  'Advanced Audio Coding': 6,
  'AAC': 6,
  Opus: 6,
  Flac: 8,
  '24bit Flac': 9,
  WAVE: 10,
};
const VIDEO_RANK: Record<string, number> = {
  'h.264': 1,
  'h.264 IA': 1,
  'MPEG4': 2,
  '512Kb MPEG4': 3,
  'h.264 HD': 4,
  'HiRes MPEG4': 4,
  'WebM': 5,
  'Ogg Video': 6,
};

const AUDIO_EXT = /\.(mp3|ogg|oga|opus|m4a|aac|flac|wav)$/i;
const VIDEO_EXT = /\.(mp4|m4v|webm|ogv)$/i;

export function archiveDownloadUrl(identifier: string, name: string): string {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${name.split('/').map(encodeURIComponent).join('/')}`;
}

function stem(name: string): string {
  return name.replace(/\.[^./]+$/, '').replace(/(_vbr|_64kb|_128kb|_256kb|_512kb|\.ia)$/i, '');
}

/**
 * Pick one playable file per recording (prefers VBR MP3 for audio and
 * h.264 MP4 for video), in track order.
 */
export function pickPlayableFiles(identifier: string, files: ArchiveFileMeta[], kind: ArchiveKind): ArchiveFile[] {
  const wantVideo = kind === 'movies';
  const best = new Map<string, { f: ArchiveFileMeta; rank: number; video: boolean }>();
  for (const f of files) {
    if (!f?.name || /(^|\/)__ia_thumb|_spectrogram|\.(png|jpe?g|gif|txt|xml|sqlite|torrent|json|srt|vtt|afpk|log|md5|ffp|cue|m3u|pdf|zip|gz)$/i.test(f.name)) continue;
    const fmt = f.format ?? '';
    let rank: number | undefined;
    let video = false;
    if (wantVideo) {
      rank = VIDEO_RANK[fmt];
      if (rank === undefined && VIDEO_EXT.test(f.name) && !/^(Thumbnail|Animated GIF)/i.test(fmt)) rank = 7;
      video = rank !== undefined;
      // films without a video derivative may still have an audio track
      if (rank === undefined) {
        const a = AUDIO_RANK[fmt];
        if (a !== undefined) rank = 20 + a;
      }
    } else {
      rank = AUDIO_RANK[fmt];
      if (rank === undefined && AUDIO_EXT.test(f.name) && !/spectrogram|waveform/i.test(fmt)) rank = 9;
    }
    if (rank === undefined) continue;
    const key = stem(f.name);
    const cur = best.get(key);
    if (!cur || rank < cur.rank) best.set(key, { f, rank, video });
  }
  const out: ArchiveFile[] = [];
  for (const { f, video } of best.values()) {
    const trackNo = f.track ? parseInt(f.track, 10) : undefined;
    out.push({
      name: f.name,
      url: archiveDownloadUrl(identifier, f.name),
      title: (f.title || f.name.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/_/g, ' ')).trim(),
      creator: f.creator,
      trackNo: trackNo && Number.isFinite(trackNo) ? trackNo : undefined,
      duration: parseClock(f.length),
      format: f.format ?? '',
      video,
      size: f.size ? parseInt(f.size, 10) : undefined,
    });
  }
  // prefer explicit track numbers, then natural file-name order
  out.sort(
    (a, b) =>
      (a.trackNo ?? 1e9) - (b.trackNo ?? 1e9) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
  // drop "sample" snippets when full versions exist
  return out.length > 1 ? out.filter((f) => !/_sample\./i.test(f.name)) : out;
}

/** archive.org/details/<id>[/…] or /download/<id>/… → identifier */
export function parseArchiveUrl(input: string): string | null {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    if (!/(^|\.)archive\.org$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/(details|download|embed|stream)\/([^/?#]+)/);
    return m ? decodeURIComponent(m[2]) : null;
  } catch {
    return null;
  }
}

export function toArchiveItem(identifier: string, j: ArchiveMetadata): ArchiveItem {
  if (!j || j.is_dark || !j.metadata) throw new SourceError('This archive.org item is not available.');
  const m = j.metadata;
  const mediatype = firstString(m.mediatype) ?? 'audio';
  const kind: ArchiveKind = mediatype === 'movies' ? 'movies' : 'audio';
  const collections = ([] as unknown[]).concat(m.collection ?? []).map(String);
  return {
    identifier,
    title: firstString(m.title) ?? identifier,
    creator: firstString(m.creator),
    year: parseYear(firstString(m.year) ?? firstString(m.date)),
    description: firstString(m.description),
    collections,
    mediatype,
    artwork: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    files: pickPlayableFiles(identifier, j.files ?? [], kind),
  };
}

export async function archiveItem(identifier: string): Promise<ArchiveItem> {
  const j = await getJson<ArchiveMetadata>(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, { timeout: 15_000 });
  return toArchiveItem(identifier, j);
}

export function archiveTrack(item: ArchiveItem, f: ArchiveFile): Track {
  const audiobook = item.collections.some((c) => /librivox|audio_bookspoetry/i.test(c));
  const mediaType: MediaType = f.video ? 'movie' : audiobook ? 'audiobook' : 'music';
  const single = item.files.length === 1;
  return makeTrack({
    source: 'archive',
    ref: f.url,
    mediaType,
    hasVideo: f.video || undefined,
    title: single && f.video ? item.title : f.title,
    artist: f.creator || item.creator || 'Internet Archive',
    album: item.title,
    year: item.year,
    trackNo: f.trackNo,
    duration: f.duration,
    genre: audiobook ? 'Audiobook' : undefined,
    description: item.description ? item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600) : undefined,
    artwork: item.artwork,
  });
}
