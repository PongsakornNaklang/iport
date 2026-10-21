/**
 * Apple's iTunes Search API (free, no key): podcast directory and 30-second
 * song / music-video previews.
 * https://performance-partners.apple.com/search-api
 *
 * The API is usually CORS-friendly; when it is not we fall back to our
 * `/api/itunes` proxy and finally to JSONP, which the API also supports.
 */
import type { Track } from '../types';
import { apiJson, firstOk, getJson, jsonp, SourceError } from './net';
import { parseYear } from './text';
import { makeTrack } from './track';

export interface ItunesResult {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  collectionId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  collectionCensoredName?: string;
  trackCensoredName?: string;
  previewUrl?: string;
  artworkUrl30?: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  trackNumber?: number;
  discNumber?: number;
  feedUrl?: string;
  trackCount?: number;
  genres?: string[];
  country?: string;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesResult[];
}

export const ITUNES_COUNTRIES = [
  { code: 'th', name: 'Thailand' },
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'jp', name: 'Japan' },
  { code: 'kr', name: 'South Korea' },
  { code: 'sg', name: 'Singapore' },
  { code: 'au', name: 'Australia' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
];

/** `endpoint` is "search" or "lookup". */
export async function itunes(endpoint: 'search' | 'lookup', params: Record<string, string>): Promise<ItunesResult[]> {
  const qs = new URLSearchParams(params).toString();
  const url = `https://itunes.apple.com/${endpoint}?${qs}`;
  const j = await firstOk<ItunesResponse>([
    () => getJson<ItunesResponse>(url, { timeout: 9000 }),
    () => apiJson<ItunesResponse>('itunes', { endpoint, ...params }, { timeout: 12_000 }),
    () => jsonp<ItunesResponse>(url, 12_000),
  ]);
  if (!j || !Array.isArray(j.results)) throw new SourceError('The iTunes directory sent an unexpected answer.');
  return j.results;
}

/** "…/100x100bb.jpg" → "…/600x600bb.jpg" */
export function itunesArtwork(url: string | undefined, size = 600): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/(\d+)x(\d+)(bb|cc|sr)?(-\d+)?\.(jpg|png|webp)$/i, `/${size}x${size}bb.$5`).replace(/(\d+)x(\d+)bb/, `${size}x${size}bb`);
}

export function previewTrack(r: ItunesResult): Track | null {
  if (!r.previewUrl) return null;
  const video = r.kind === 'music-video';
  return makeTrack({
    source: 'preview',
    ref: r.previewUrl,
    mediaType: video ? 'musicvideo' : 'music',
    hasVideo: video || undefined,
    title: r.trackName ?? 'Preview',
    artist: r.artistName ?? 'Unknown Artist',
    album: r.collectionName ?? (r.trackName ? `${r.trackName} - Single` : ''),
    genre: r.primaryGenreName,
    year: parseYear(r.releaseDate),
    trackNo: r.trackNumber,
    discNo: r.discNumber,
    // the preview clip is 30 s, whatever the full song length is
    duration: 30,
    artwork: itunesArtwork(r.artworkUrl100 ?? r.artworkUrl60),
  });
}

export async function searchPreviews(term: string, opts: { country?: string; video?: boolean } = {}): Promise<{ result: ItunesResult; track: Track }[]> {
  const results = await itunes('search', {
    term,
    media: opts.video ? 'musicVideo' : 'music',
    entity: opts.video ? 'musicVideo' : 'song',
    limit: '50',
    country: opts.country ?? 'us',
  });
  const out: { result: ItunesResult; track: Track }[] = [];
  for (const r of results) {
    const t = previewTrack(r);
    if (t) out.push({ result: r, track: t });
  }
  return out;
}
