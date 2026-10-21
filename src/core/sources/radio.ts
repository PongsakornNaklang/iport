/**
 * Internet radio via radio-browser.info — a free, community-run station
 * directory with an open, CORS-enabled API.
 * https://api.radio-browser.info/
 */
import type { Track } from '../types';
import { getJson, SourceError } from './net';
import { makeTrack } from './track';

export interface Station {
  stationuuid: string;
  name: string;
  url_resolved: string;
  url?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  language?: string;
  codec?: string;
  bitrate?: number;
  homepage?: string;
  hls?: number;
  lastcheckok?: number;
  clickcount?: number;
}

export const RADIO_COUNTRIES: { code: string; name: string }[] = [
  { code: 'TH', name: 'Thailand' },
  { code: '', name: 'Worldwide' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
];

export const RADIO_TAGS = ['pop', 'rock', 'jazz', 'classical', 'lofi', 'chillout', 'news', 'hits', 'electronic', 'hip hop', 'country', 'ambient', 'k-pop', 'thai'];

const FALLBACK = 'https://de1.api.radio-browser.info';
let serverPromise: Promise<string> | null = null;

/** radio-browser asks clients to pick a random mirror. */
function server(): Promise<string> {
  if (!serverPromise) {
    serverPromise = getJson<{ name: string }[]>('https://all.api.radio-browser.info/json/servers', { timeout: 6000 })
      .then((list) => {
        const names = [...new Set(list.map((s) => s.name).filter((n) => /^[a-z0-9.-]+$/i.test(n)))];
        if (!names.length) return FALLBACK;
        return `https://${names[Math.floor(Math.random() * names.length)]}`;
      })
      .catch(() => FALLBACK);
  }
  return serverPromise;
}

async function query(path: string, params: Record<string, string | number | boolean>): Promise<Station[]> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const base = await server();
  let list: Station[];
  try {
    list = await getJson<Station[]>(`${base}/json/${path}?${qs}`, { timeout: 12_000 });
  } catch (e) {
    if (base === FALLBACK) throw e;
    serverPromise = Promise.resolve(FALLBACK);
    list = await getJson<Station[]>(`${FALLBACK}/json/${path}?${qs}`, { timeout: 12_000 });
  }
  if (!Array.isArray(list)) throw new SourceError('The radio directory sent an unexpected answer.');
  return playableStations(list);
}

/** Only HTTPS streams play on an HTTPS page; drop duplicates and HLS (needs hls.js outside Safari). */
export function playableStations(list: Station[]): Station[] {
  const seen = new Set<string>();
  const out: Station[] = [];
  for (const s of list) {
    const url = (s.url_resolved || s.url || '').trim();
    if (!/^https:\/\//i.test(url)) continue;
    if (s.hls === 1 || /\.m3u8(\?|$)/i.test(url)) continue;
    if (s.lastcheckok === 0) continue;
    const key = `${s.name.trim().toLowerCase()}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...s, name: s.name.trim(), url_resolved: url });
  }
  return out;
}

/** Most-clicked stations, optionally in one country. */
export function topStations(countrycode = '', limit = 60): Promise<Station[]> {
  const params: Record<string, string | number | boolean> = {
    order: 'clickcount',
    reverse: true,
    limit,
    hidebroken: true,
  };
  if (countrycode) params.countrycode = countrycode;
  return query('stations/search', params);
}

export function searchStations(opts: { name?: string; tag?: string; countrycode?: string; limit?: number }): Promise<Station[]> {
  const params: Record<string, string | number | boolean> = {
    order: 'clickcount',
    reverse: true,
    limit: opts.limit ?? 80,
    hidebroken: true,
  };
  if (opts.name?.trim()) params.name = opts.name.trim();
  if (opts.tag?.trim()) params.tag = opts.tag.trim().toLowerCase();
  if (opts.countrycode) params.countrycode = opts.countrycode;
  return query('stations/search', params);
}

/** Tell the directory a station was used (helps its popularity ranking). Fire and forget. */
export function countStationClick(uuid: string): void {
  void server()
    .then((b) => fetch(`${b}/json/url/${encodeURIComponent(uuid)}`))
    .catch(() => undefined);
}

export function stationTags(s: Station): string[] {
  return (s.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function stationTrack(s: Station): Track {
  const tags = stationTags(s);
  const genre = tags[0] ? tags[0].replace(/\b\p{Ll}/gu, (c) => c.toUpperCase()) : undefined;
  const favicon = s.favicon && /^https:\/\//i.test(s.favicon) ? s.favicon : undefined;
  return makeTrack({
    source: 'radio',
    ref: s.url_resolved,
    mediaType: 'radio',
    title: s.name,
    artist: [s.country, genre].filter(Boolean).join(' · ') || 'Internet Radio',
    album: 'Internet Radio',
    genre,
    description: [s.codec, s.bitrate ? `${s.bitrate} kbps` : '', s.homepage ?? ''].filter(Boolean).join(' · ') || undefined,
    artwork: favicon,
  });
}
