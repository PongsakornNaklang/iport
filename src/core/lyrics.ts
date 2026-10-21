/**
 * Lyrics for the current song.
 *
 * Embedded lyrics (ID3 USLT / iTunes ©lyr) come from the file. Otherwise we
 * look the song up on LRCLIB (https://lrclib.net) — a free, open lyrics
 * database with time-synced lyrics and no API key. Results are cached on the
 * track so each song is looked up once.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from './library/store';
import type { Track } from './types';

export interface LyricLine {
  /** seconds */
  time: number;
  text: string;
}

export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!tags.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of tags) {
      const frac = m[3] ? parseInt(m[3], 10) / Math.pow(10, m[3].length) : 0;
      out.push({ time: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Index of the line being sung at `position` (−1 before the first line). */
export function activeLine(lines: LyricLine[], position: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= position + 0.15) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

interface LrclibResult {
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  instrumental?: boolean;
}

const inflight = new Map<string, Promise<void>>();

function cleanTitle(t: string): string {
  return t
    .replace(/\s*[([](official|lyric|music|audio|video|hd|4k|remaster|visualizer)[^)\]]*[)\]]/gi, '')
    .replace(/\s*-\s*(official|lyric).*$/i, '')
    .trim();
}

/** Look up lyrics online once per track and store them on the track. */
export function fetchLyrics(track: Track): Promise<void> {
  if (track.lyrics || track.syncedLyrics || track.lyricsChecked) return Promise.resolve();
  if (track.mediaType !== 'music' && track.mediaType !== 'musicvideo') return Promise.resolve();
  if (!track.title || /unknown artist/i.test(track.artist)) return Promise.resolve();
  let p = inflight.get(track.id);
  if (p) return p;
  p = (async () => {
    const q = new URLSearchParams({ track_name: cleanTitle(track.title), artist_name: track.artist });
    if (track.album && !/^(unknown album|youtube|audius)$/i.test(track.album)) q.set('album_name', track.album);
    if (track.duration) q.set('duration', String(Math.round(track.duration)));
    let r: LrclibResult | null = null;
    try {
      const res = await fetch(`https://lrclib.net/api/get?${q}`);
      if (res.ok) r = (await res.json()) as LrclibResult;
      else if (res.status === 404) {
        // fuzzy search fallback
        const s = await fetch(`https://lrclib.net/api/search?${new URLSearchParams({ q: `${track.artist} ${cleanTitle(track.title)}` })}`);
        if (s.ok) {
          const list = (await s.json()) as LrclibResult[];
          r = list.find((x) => x.syncedLyrics) ?? list[0] ?? null;
        }
      }
    } catch {
      return; // offline — try again another time
    }
    useLibrary.getState().updateTrack(track.id, {
      lyricsChecked: true,
      ...(r?.plainLyrics ? { lyrics: r.plainLyrics } : {}),
      ...(r?.syncedLyrics ? { syncedLyrics: r.syncedLyrics } : {}),
    });
  })().finally(() => inflight.delete(track.id));
  inflight.set(track.id, p);
  return p;
}

/**
 * Lyrics for a track: `lines` when time-synced lyrics exist, `plain` text
 * otherwise. Triggers an online lookup when `autoFetch` is true.
 */
export function useLyrics(track: Track | undefined, autoFetch = true): { plain: string | null; lines: LyricLine[] | null; loading: boolean } {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!track || !autoFetch) return;
    if (track.lyrics || track.syncedLyrics || track.lyricsChecked) return;
    let alive = true;
    setLoading(true);
    fetchLyrics(track).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [track, autoFetch]);
  const lines = useMemo(() => (track?.syncedLyrics ? parseLrc(track.syncedLyrics) : null), [track?.syncedLyrics]);
  return { plain: track?.lyrics ?? (lines ? lines.map((l) => l.text).join('\n') : null), lines: lines && lines.length ? lines : null, loading };
}
