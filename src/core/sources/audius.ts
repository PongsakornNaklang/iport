/**
 * Audius — free, open music streaming with a public API (no key needed).
 * https://docs.audius.org/developers/api
 */
import { uid } from '../util/id';
import type { Track } from '../types';

const APP = 'iPort';
let hostPromise: Promise<string> | null = null;

async function host(): Promise<string> {
  if (!hostPromise) {
    hostPromise = fetch('https://api.audius.co')
      .then((r) => r.json())
      .then((j: { data?: string[] }) => {
        const hosts = j.data ?? [];
        if (!hosts.length) throw new Error('no hosts');
        return hosts[Math.floor(Math.random() * hosts.length)];
      })
      .catch(() => 'https://discoveryprovider.audius.co');
  }
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
}

function toTrack(a: AudiusTrack): Track {
  const year = a.release_date ? new Date(a.release_date).getFullYear() : undefined;
  return {
    id: uid('t'),
    source: 'audius',
    ref: a.id,
    mediaType: 'music',
    title: a.title,
    artist: a.user?.name || a.user?.handle || 'Unknown Artist',
    album: 'Audius',
    genre: a.genre || undefined,
    year: year && !isNaN(year) ? year : undefined,
    duration: a.duration,
    artwork: a.artwork?.['480x480'] || a.artwork?.['150x150'] || undefined,
    addedAt: Date.now(),
    playCount: 0,
    skipCount: 0,
  };
}

async function get<T>(path: string): Promise<T> {
  const h = await host();
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${h}/v1${path}${sep}app_name=${APP}`);
  if (!r.ok) throw new Error(`Audius error ${r.status}`);
  const j = (await r.json()) as { data: T };
  return j.data;
}

export async function audiusSearch(query: string): Promise<Track[]> {
  const data = await get<AudiusTrack[]>(`/tracks/search?query=${encodeURIComponent(query)}`);
  return data.slice(0, 40).map(toTrack);
}

export async function audiusTrending(genre?: string): Promise<Track[]> {
  const q = genre ? `?genre=${encodeURIComponent(genre)}` : '';
  const data = await get<AudiusTrack[]>(`/tracks/trending${q}`);
  return data.slice(0, 40).map(toTrack);
}
