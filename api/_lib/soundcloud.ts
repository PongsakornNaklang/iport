/**
 * SoundCloud page scraping helpers (pure, unit-tested).
 * Public pages embed `window.__sc_hydration = [ { hydratable, data }, … ]`.
 * A set's first few tracks are complete; the rest are id-only stubs that the
 * widget can still play via https://api.soundcloud.com/tracks/<id>.
 */
import { extractJsonAfter } from './scrape.js';

export interface ScItem {
  url: string;
  title?: string;
  artist?: string;
  artwork?: string;
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

interface ScTrackData {
  id?: number;
  kind?: string;
  title?: string;
  permalink_url?: string;
  artwork_url?: string | null;
  duration?: number;
  full_duration?: number;
  genre?: string | null;
  release_date?: string | null;
  display_date?: string | null;
  created_at?: string | null;
  user?: { username?: string; avatar_url?: string };
  publisher_metadata?: { artist?: string; album_title?: string } | null;
}

interface ScPlaylistData {
  title?: string;
  permalink_url?: string;
  artwork_url?: string | null;
  user?: { username?: string; avatar_url?: string };
  tracks?: ScTrackData[];
}

export function extractHydration(html: string): { hydratable?: string; data?: unknown }[] | null {
  const h = extractJsonAfter(html, /window\.__sc_hydration\s*=\s*/);
  return Array.isArray(h) ? (h as { hydratable?: string; data?: unknown }[]) : null;
}

function year(t: ScTrackData): number | undefined {
  const d = t.release_date || t.display_date || t.created_at;
  const y = d ? parseInt(d.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) && y > 1900 ? y : undefined;
}

/** Full track object → item; null for stubs. */
export function trackItem(t: ScTrackData): ScItem | null {
  if (!t || !t.permalink_url || !t.title) return null;
  const ms = t.full_duration || t.duration;
  return {
    url: t.permalink_url.replace(/^http:/, 'https:').split('?')[0],
    title: t.title,
    artist: t.publisher_metadata?.artist || t.user?.username,
    artwork: t.artwork_url || t.user?.avatar_url || undefined,
    duration: ms ? Math.round(ms / 1000) : undefined,
    genre: t.genre || undefined,
    year: year(t),
  };
}

export function stubItem(id: number): ScItem {
  return { url: `https://api.soundcloud.com/tracks/${id}` };
}

/** Hydration → a set (playlist / album) or a single track. */
export function parseHydration(h: { hydratable?: string; data?: unknown }[], pageUrl: string): ScSet | null {
  const pl = h.find((x) => x.hydratable === 'playlist')?.data as ScPlaylistData | undefined;
  if (pl && Array.isArray(pl.tracks)) {
    const tracks = pl.tracks.map((t) => trackItem(t) ?? (typeof t.id === 'number' ? stubItem(t.id) : null)).filter((x): x is ScItem => !!x);
    return {
      kind: 'set',
      url: pl.permalink_url?.split('?')[0] || pageUrl,
      title: pl.title,
      artist: pl.user?.username,
      artwork: pl.artwork_url || pl.tracks.find((t) => t.artwork_url)?.artwork_url || undefined,
      tracks,
    };
  }
  const snd = h.find((x) => x.hydratable === 'sound')?.data as ScTrackData | undefined;
  const item = snd ? trackItem(snd) : null;
  if (item) return { kind: 'track', url: item.url, title: item.title, artist: item.artist, artwork: item.artwork, tracks: [item] };
  return null;
}

/** Stub ids still lacking metadata. */
export function stubIds(set: ScSet): number[] {
  return set.tracks
    .map((t) => /api\.soundcloud\.com\/tracks\/(\d+)$/.exec(t.url)?.[1])
    .filter((x): x is string => !!x)
    .map(Number);
}

/** Replace stubs with full items from an api-v2 `/tracks?ids=` response. */
export function fillStubs(set: ScSet, full: ScTrackData[]): ScSet {
  const byId = new Map<number, ScItem>();
  for (const t of full) {
    const it = trackItem(t);
    if (it && typeof t.id === 'number') byId.set(t.id, it);
  }
  return {
    ...set,
    tracks: set.tracks.map((t) => {
      const id = /api\.soundcloud\.com\/tracks\/(\d+)$/.exec(t.url)?.[1];
      return (id && byId.get(Number(id))) || t;
    }),
  };
}

/** <script src="https://a-v2.sndcdn.com/assets/….js"> URLs, last first (the client id lives near the end). */
export function assetScripts(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.reverse();
}

export function findClientId(js: string): string | undefined {
  return /client_id\s*[:=]\s*["']([A-Za-z0-9]{32})["']/.exec(js)?.[1] ?? /[?&]client_id=([A-Za-z0-9]{32})/.exec(js)?.[1];
}
