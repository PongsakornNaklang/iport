/**
 * Audius — free, open music streaming with a public API (no key needed).
 * https://docs.audius.org/developers/api
 */
import type { Track } from '../types';
import { fetchWithTimeout, SourceError } from './net';
import { makeTrack, singleAlbum } from './track';

const APP = 'iPort';
const FALLBACK_HOSTS = ['https://api.audius.co', 'https://discoveryprovider.audius.co'];

/** Genre names exactly as the trending endpoint expects them. */
export const AUDIUS_GENRES = [
  'Electronic',
  'Hip-Hop/Rap',
  'Pop',
  'R&B/Soul',
  'Rock',
  'Alternative',
  'Lo-Fi',
  'Ambient',
  'House',
  'Techno',
  'Dubstep',
  'Drum & Bass',
  'Jazz',
  'Acoustic',
  'Funk',
  'Latin',
  'Reggae',
  'Classical',
  'Soundtrack',
  'Experimental',
  'Folk',
  'Country',
  'World',
  'Metal',
  'Punk',
  'Trap',
  'Future Bass',
];

let hostPromise: Promise<string> | null = null;
const badHosts = new Set<string>();

async function pickHost(): Promise<string> {
  try {
    const r = await fetchWithTimeout('https://api.audius.co', { timeout: 6000 });
    const j = (await r.json()) as { data?: unknown };
    const hosts = (Array.isArray(j.data) ? j.data : []).filter(
      (h): h is string => typeof h === 'string' && /^https:\/\//.test(h) && !badHosts.has(h),
    );
    if (hosts.length) return hosts[Math.floor(Math.random() * hosts.length)];
  } catch {
    /* fall through */
  }
  return FALLBACK_HOSTS.find((h) => !badHosts.has(h)) ?? FALLBACK_HOSTS[0];
}

async function host(): Promise<string> {
  if (!hostPromise) hostPromise = pickHost();
  return hostPromise;
}

export async function audiusStreamUrl(id: string): Promise<string> {
  return `${await host()}/v1/tracks/${encodeURIComponent(id)}/stream?app_name=${APP}`;
}

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  mood?: string;
  release_date?: string;
  artwork?: Record<string, string> | null;
  user: { name: string; handle: string };
  permalink?: string;
  play_count?: number;
  is_streamable?: boolean;
}

function toTrack(a: AudiusTrack): Track {
  const year = a.release_date ? new Date(a.release_date).getFullYear() : undefined;
  const title = a.title?.trim() || 'Untitled';
  return makeTrack({
    source: 'audius',
    ref: a.id,
    mediaType: 'music',
    title,
    artist: a.user?.name || a.user?.handle || 'Unknown Artist',
    album: singleAlbum(title),
    genre: a.genre || undefined,
    year: year && !isNaN(year) ? year : undefined,
    duration: a.duration,
    artwork: a.artwork?.['480x480'] || a.artwork?.['1000x1000'] || a.artwork?.['150x150'] || undefined,
  });
}

async function get<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const h = await host();
    try {
      const r = await fetchWithTimeout(`${h}/v1${path}${sep}app_name=${APP}`, { timeout: 12_000 });
      if (!r.ok) throw new SourceError(`Audius answered with an error (${r.status}).`);
      const j = (await r.json()) as { data: T };
      return j.data;
    } catch (e) {
      lastErr = e;
      // try another node
      badHosts.add(h);
      hostPromise = null;
    }
  }
  throw lastErr;
}

export interface AudiusResult {
  track: Track;
  plays?: number;
}

function results(data: AudiusTrack[] | undefined): AudiusResult[] {
  return (data ?? [])
    .filter((a) => a && a.id && a.is_streamable !== false)
    .slice(0, 50)
    .map((a) => ({ track: toTrack(a), plays: a.play_count }));
}

export async function audiusSearchResults(query: string): Promise<AudiusResult[]> {
  return results(await get<AudiusTrack[]>(`/tracks/search?query=${encodeURIComponent(query)}`));
}

export async function audiusTrendingResults(genre?: string, time: 'week' | 'month' | 'allTime' = 'week'): Promise<AudiusResult[]> {
  const params = new URLSearchParams({ time });
  if (genre) params.set('genre', genre);
  return results(await get<AudiusTrack[]>(`/tracks/trending?${params}`));
}

export async function audiusSearch(query: string): Promise<Track[]> {
  return (await audiusSearchResults(query)).map((r) => r.track);
}

export async function audiusTrending(genre?: string): Promise<Track[]> {
  return (await audiusTrendingResults(genre)).map((r) => r.track);
}
