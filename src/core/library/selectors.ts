/**
 * Derived views over the library: the lists every iPod menu is built from.
 * All functions are pure and memoized on the `tracks` object identity, so
 * calling them from render is cheap.
 */
import { useMemo } from 'react';
import { compareTitles, sortKey } from '../util/format';
import type { MediaType, Playlist, Track } from '../types';
import { useLibrary } from './store';

type Tracks = Record<string, Track>;

function memoByRef<A extends object, R>(fn: (a: A) => R): (a: A) => R {
  let lastA: A | undefined;
  let lastR: R;
  return (a: A) => {
    if (a !== lastA) {
      lastR = fn(a);
      lastA = a;
    }
    return lastR;
  };
}

export const MUSIC_TYPES: MediaType[] = ['music', 'musicvideo'];
export const VIDEO_TYPES: MediaType[] = ['musicvideo', 'movie', 'tvshow'];

export const allTracks = memoByRef((tracks: Tracks) => Object.values(tracks));

/** All songs (audio music + music videos count as songs, like iTunes). */
export const songs = memoByRef((tracks: Tracks) =>
  allTracks(tracks)
    .filter((t) => t.mediaType === 'music' || t.mediaType === 'musicvideo')
    .sort((a, b) => compareTitles(a.title, b.title)),
);

export function artistOf(t: Track): string {
  return (t.albumArtist || t.artist || 'Unknown Artist').trim() || 'Unknown Artist';
}

export interface ArtistInfo {
  name: string;
  trackIds: string[];
  albumKeys: string[];
}

export const artists = memoByRef((tracks: Tracks): ArtistInfo[] => {
  const map = new Map<string, ArtistInfo>();
  for (const t of songs(tracks)) {
    if (t.compilation) continue; // compilations live under Compilations
    const name = (t.artist || 'Unknown Artist').trim() || 'Unknown Artist';
    let a = map.get(name.toLowerCase());
    if (!a) map.set(name.toLowerCase(), (a = { name, trackIds: [], albumKeys: [] }));
    a.trackIds.push(t.id);
    const k = albumKey(t);
    if (!a.albumKeys.includes(k)) a.albumKeys.push(k);
  }
  return [...map.values()].sort((a, b) => compareTitles(a.name, b.name));
});

export interface AlbumInfo {
  key: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  artwork?: string;
  compilation: boolean;
  /** sorted by disc/track number */
  trackIds: string[];
  duration: number;
}

export function albumKey(t: Track): string {
  const artist = t.compilation ? 'Various Artists' : artistOf(t);
  return `${sortKey(t.album || 'Unknown Album')}::${sortKey(artist)}`;
}

export const albums = memoByRef((tracks: Tracks): AlbumInfo[] => {
  const map = new Map<string, AlbumInfo & { _tracks: Track[] }>();
  for (const t of songs(tracks)) {
    const k = albumKey(t);
    let a = map.get(k);
    if (!a) {
      a = {
        key: k,
        title: t.album || 'Unknown Album',
        artist: t.compilation ? 'Various Artists' : artistOf(t),
        year: t.year,
        genre: t.genre,
        artwork: t.artwork,
        compilation: !!t.compilation,
        trackIds: [],
        duration: 0,
        _tracks: [],
      };
      map.set(k, a);
    }
    a._tracks.push(t);
    if (!a.artwork && t.artwork) a.artwork = t.artwork;
    if (!a.year && t.year) a.year = t.year;
    a.duration += t.duration ?? 0;
  }
  const out: AlbumInfo[] = [];
  for (const a of map.values()) {
    a._tracks.sort(
      (x, y) =>
        (x.discNo ?? 1) - (y.discNo ?? 1) ||
        (x.trackNo ?? 9999) - (y.trackNo ?? 9999) ||
        compareTitles(x.title, y.title),
    );
    const { _tracks, ...info } = a;
    info.trackIds = _tracks.map((t) => t.id);
    out.push(info);
  }
  return out.sort((a, b) => compareTitles(a.title, b.title) || compareTitles(a.artist, b.artist));
});

export const albumsByKey = memoByRef((tracks: Tracks) => {
  const m = new Map<string, AlbumInfo>();
  for (const a of albums(tracks)) m.set(a.key, a);
  return m;
});

export function albumsOfArtist(tracks: Tracks, artistName: string): AlbumInfo[] {
  const a = artists(tracks).find((x) => x.name.toLowerCase() === artistName.toLowerCase());
  if (!a) return [];
  const m = albumsByKey(tracks);
  return a.albumKeys
    .map((k) => m.get(k)!)
    .filter(Boolean)
    .sort((x, y) => (x.year ?? 0) - (y.year ?? 0) || compareTitles(x.title, y.title));
}

/** All songs by an artist, in album order. */
export function tracksOfArtist(tracks: Tracks, artistName: string): string[] {
  const a = artists(tracks).find((x) => x.name.toLowerCase() === artistName.toLowerCase());
  if (!a) return [];
  const mine = new Set(a.trackIds);
  return albumsOfArtist(tracks, artistName).flatMap((al) => al.trackIds.filter((id) => mine.has(id)));
}

export const compilations = memoByRef((tracks: Tracks) => albums(tracks).filter((a) => a.compilation));

function groupBy(tracks: Tracks, field: 'genre' | 'composer'): { name: string; trackIds: string[] }[] {
  const map = new Map<string, { name: string; trackIds: string[] }>();
  for (const t of songs(tracks)) {
    const v = (t[field] || '').trim();
    if (!v) continue;
    let g = map.get(v.toLowerCase());
    if (!g) map.set(v.toLowerCase(), (g = { name: v, trackIds: [] }));
    g.trackIds.push(t.id);
  }
  return [...map.values()].sort((a, b) => compareTitles(a.name, b.name));
}

export const genres = memoByRef((tracks: Tracks) => groupBy(tracks, 'genre'));
export const composers = memoByRef((tracks: Tracks) => groupBy(tracks, 'composer'));

export interface ShowInfo {
  name: string;
  artwork?: string;
  /** newest first */
  trackIds: string[];
  unplayed: number;
}

function shows(tracks: Tracks, type: MediaType): ShowInfo[] {
  const map = new Map<string, ShowInfo & { _t: Track[] }>();
  for (const t of allTracks(tracks)) {
    if (t.mediaType !== type) continue;
    const name = t.show || t.album || t.artist || 'Unknown';
    let s = map.get(name);
    if (!s) map.set(name, (s = { name, artwork: t.artwork, trackIds: [], unplayed: 0, _t: [] }));
    s._t.push(t);
    if (!t.playCount) s.unplayed++;
  }
  return [...map.values()]
    .map(({ _t, ...s }) => ({
      ...s,
      trackIds: _t.sort((a, b) => (b.pubDate ?? b.addedAt) - (a.pubDate ?? a.addedAt)).map((t) => t.id),
    }))
    .sort((a, b) => compareTitles(a.name, b.name));
}

export const podcasts = memoByRef((tracks: Tracks) => shows(tracks, 'podcast'));
export const audiobooks = memoByRef((tracks: Tracks) =>
  allTracks(tracks)
    .filter((t) => t.mediaType === 'audiobook')
    .sort((a, b) => compareTitles(a.title, b.title)),
);

export function videosOf(tracks: Tracks, type: 'movie' | 'tvshow' | 'musicvideo'): Track[] {
  return allTracks(tracks)
    .filter((t) => t.mediaType === type)
    .sort((a, b) => compareTitles(a.title, b.title));
}

export const radioStations = memoByRef((tracks: Tracks) =>
  allTracks(tracks)
    .filter((t) => t.mediaType === 'radio')
    .sort((a, b) => compareTitles(a.title, b.title)),
);

export const voiceMemoTracks = memoByRef((tracks: Tracks) =>
  allTracks(tracks).filter((t) => t.mediaType === 'voicememo'),
);

/** Resolve a playlist's track list (smart playlists computed live). */
export function playlistTracks(tracks: Tracks, p: Playlist): string[] {
  if (!p.smart) return p.trackIds.filter((id) => tracks[id]);
  const s = songs(tracks);
  switch (p.smart) {
    case 'recently-added':
      return [...s].sort((a, b) => b.addedAt - a.addedAt).slice(0, 100).map((t) => t.id);
    case 'recently-played':
      return s
        .filter((t) => t.lastPlayed)
        .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
        .slice(0, 25)
        .map((t) => t.id);
    case 'top-25':
      return s
        .filter((t) => t.playCount > 0)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 25)
        .map((t) => t.id);
    case 'top-rated':
      return s
        .filter((t) => (t.rating ?? 0) >= 4)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .map((t) => t.id);
    case 'nineties':
      return s.filter((t) => t.year && t.year >= 1990 && t.year <= 1999).map((t) => t.id);
    case 'classical':
      return s.filter((t) => /classical/i.test(t.genre ?? '')).map((t) => t.id);
    case 'music-videos':
      return allTracks(tracks)
        .filter((t) => t.mediaType === 'musicvideo')
        .map((t) => t.id);
  }
}

export function orderedPlaylists(playlists: Record<string, Playlist>, order: string[]): Playlist[] {
  const seen = new Set<string>();
  const out: Playlist[] = [];
  for (const id of order) {
    const p = playlists[id];
    if (p && !seen.has(id)) {
      out.push(p);
      seen.add(id);
    }
  }
  for (const p of Object.values(playlists)) if (!seen.has(p.id)) out.push(p);
  return out;
}

/** Simple library search across titles, artists, albums. */
export function searchLibrary(tracks: Tracks, query: string, limit = 200): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const scored: { t: Track; s: number }[] = [];
  for (const t of allTracks(tracks)) {
    const hay = `${t.title} ${t.artist} ${t.album} ${t.show ?? ''}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    let s = 0;
    if (t.title.toLowerCase().startsWith(q)) s += 10;
    if (t.artist.toLowerCase().startsWith(q)) s += 5;
    if (t.album.toLowerCase().startsWith(q)) s += 3;
    scored.push({ t, s });
  }
  return scored
    .sort((a, b) => b.s - a.s || compareTitles(a.t.title, b.t.title))
    .slice(0, limit)
    .map((x) => x.t);
}

/**
 * Genius: builds a playlist of songs that "go great with" the seed.
 * Without the cloud service we approximate with genre/artist/era similarity.
 */
export function geniusPlaylist(tracks: Tracks, seedId: string, size = 25): string[] {
  const seed = tracks[seedId];
  if (!seed) return [];
  const pool = songs(tracks).filter((t) => t.id !== seedId);
  const scored = pool.map((t) => {
    let s = Math.random() * 0.8;
    if (t.genre && seed.genre && t.genre.toLowerCase() === seed.genre.toLowerCase()) s += 3;
    if (t.artist === seed.artist) s += 1.5;
    if (t.album === seed.album) s -= 0.5; // prefer variety
    if (t.year && seed.year) s += Math.max(0, 2 - Math.abs(t.year - seed.year) / 5);
    if ((t.rating ?? 0) >= 4) s += 0.5;
    return { id: t.id, s };
  });
  scored.sort((a, b) => b.s - a.s);
  // avoid more than 3 songs per artist
  const perArtist = new Map<string, number>();
  const out = [seedId];
  for (const { id } of scored) {
    const a = tracks[id].artist;
    const c = perArtist.get(a) ?? 0;
    if (c >= 3) continue;
    perArtist.set(a, c + 1);
    out.push(id);
    if (out.length >= size) break;
  }
  return out;
}

/** Genius Mixes: up to 12 genre-based endless mixes. */
export function geniusMixes(tracks: Tracks): { name: string; trackIds: string[]; artwork: string[] }[] {
  return genres(tracks)
    .filter((g) => g.trackIds.length >= 3)
    .slice(0, 12)
    .map((g) => {
      const ids = [...g.trackIds].sort(() => Math.random() - 0.5);
      const arts = [...new Set(ids.map((id) => tracks[id].artwork).filter(Boolean) as string[])].slice(0, 4);
      return { name: `${g.name} Mix`, trackIds: ids, artwork: arts };
    });
}

// ---------- React hooks ----------

export function useTracks(): Tracks {
  return useLibrary((s) => s.tracks);
}

export function useSongs() {
  const t = useTracks();
  return songs(t);
}
export function useArtists() {
  const t = useTracks();
  return artists(t);
}
export function useAlbums() {
  const t = useTracks();
  return albums(t);
}
export function usePlaylists() {
  const playlists = useLibrary((s) => s.playlists);
  const order = useLibrary((s) => s.playlistOrder);
  return useMemo(() => orderedPlaylists(playlists, order), [playlists, order]);
}
export function usePlaylistTracks(p: Playlist | undefined): string[] {
  const t = useTracks();
  return useMemo(() => (p ? playlistTracks(t, p) : []), [t, p]);
}
