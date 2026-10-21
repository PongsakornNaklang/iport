/**
 * Small pieces of UI state shared by the Library panel:
 *  - useSticky: state that survives closing/reopening the panel (memory, + optional localStorage)
 *  - preview player for search results (one <audio>, pauses the iPod while it plays)
 *  - addToLibrary(): add tracks + toast + optional play
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { trackKey, useLibrary } from '@/core/library/store';
import { effectiveVolume, player, usePlayer } from '@/core/player/player';
import type { Track } from '@/core/types';
import { toast } from '../toast';

// ------------------------------------------------------------------ sticky state

const memory = new Map<string, unknown>();

function readLocal<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(`iport.lib.${key}`);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, v: unknown): void {
  try {
    localStorage.setItem(`iport.lib.${key}`, JSON.stringify(v));
  } catch {
    /* private mode / quota */
  }
}

/** Like useState, but the value is kept while the panel is closed (and across reloads with `persist`). */
export function useSticky<T>(key: string, initial: T, persist = false): [T, (v: T | ((prev: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    if (memory.has(key)) return memory.get(key) as T;
    if (persist) {
      const s = readLocal<T>(key);
      if (s !== undefined) return s;
    }
    return initial;
  });
  const first = useRef(true);
  useEffect(() => {
    memory.set(key, v);
    if (persist && !first.current) writeLocal(key, v);
    first.current = false;
  }, [key, v, persist]);
  return [v, setV];
}

export function getStickyPref<T>(key: string, fallback: T): T {
  if (memory.has(key)) return memory.get(key) as T;
  return readLocal<T>(key) ?? fallback;
}

// ------------------------------------------------------------------ preview player

interface PreviewState {
  key: string | null;
  status: 'idle' | 'loading' | 'playing' | 'error';
}

export const usePreview = create<PreviewState>(() => ({ key: null, status: 'idle' }));

let audio: HTMLAudioElement | null = null;
let unsub: (() => void) | null = null;

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('playing', () => usePreview.setState({ status: 'playing' }));
    audio.addEventListener('waiting', () => usePreview.setState({ status: 'loading' }));
    audio.addEventListener('ended', () => usePreview.setState({ key: null, status: 'idle' }));
    audio.addEventListener('error', () => {
      if (usePreview.getState().key) {
        usePreview.setState({ status: 'error' });
        toast('This item can’t be previewed here');
      }
    });
    // the iPod starting playback stops the preview
    unsub = usePlayer.subscribe((s, prev) => {
      if ((s.status === 'playing' || s.status === 'loading') && s.status !== prev.status && usePreview.getState().key) stopPreview();
    });
  }
  return audio;
}

export function stopPreview(): void {
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  usePreview.setState({ key: null, status: 'idle' });
}

/** Toggle a preview. `url` may be a promise (Audius resolves a node first). */
export async function togglePreview(key: string, url: string | (() => Promise<string>)): Promise<void> {
  if (usePreview.getState().key === key) {
    stopPreview();
    return;
  }
  const a = el();
  usePreview.setState({ key, status: 'loading' });
  const ps = usePlayer.getState().status;
  if (ps === 'playing' || ps === 'loading') player.pause();
  try {
    const src = typeof url === 'string' ? url : await url();
    if (usePreview.getState().key !== key) return;
    a.src = src;
    a.volume = Math.max(0.05, effectiveVolume());
    await a.play();
  } catch (e) {
    if (usePreview.getState().key !== key) return;
    if (e instanceof DOMException && e.name === 'AbortError') return;
    usePreview.setState({ status: 'error' });
    toast('This item can’t be previewed here');
  }
}

export function disposePreview(): void {
  stopPreview();
  unsub?.();
  unsub = null;
  audio = null;
}

// ------------------------------------------------------------------ library helpers

/** Set of dedupe keys of everything in the library — for "already added" checkmarks. */
export function useLibraryKeys(): Set<string> {
  const tracks = useLibrary((s) => s.tracks);
  return useMemo(() => new Set(Object.values(tracks).map(trackKey)), [tracks]);
}

export function isInLibrary(keys: Set<string>, t: Pick<Track, 'source' | 'ref'>): boolean {
  return keys.has(trackKey(t));
}

/** Add tracks (deduped), toast a summary, optionally start playing them. Returns the library copies. */
export function addToLibrary(tracks: Track[], opts: { play?: boolean; quiet?: boolean; label?: string } = {}): Track[] {
  if (!tracks.length) return [];
  const added = useLibrary.getState().addTracks(tracks);
  const fresh = added.filter((t, i) => t.id === tracks[i]?.id).length;
  if (opts.play) player.playTracks(added.map((t) => t.id), 0);
  if (!opts.quiet) {
    const what = opts.label ?? (added.length === 1 ? `“${added[0].title}”` : `${added.length} items`);
    if (opts.play) toast(`Playing ${what}`);
    else if (fresh === 0) toast(added.length === 1 ? 'Already in your library' : 'All of these are already in your library');
    else toast(`Added ${fresh === added.length ? what : `${fresh} new item${fresh === 1 ? '' : 's'}`} to your library`);
  }
  return added;
}

/** Plain-language source names for badges. */
export const SOURCE_LABEL: Record<Track['source'], string> = {
  local: 'Local',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  audius: 'Audius',
  archive: 'Archive',
  radio: 'Radio',
  podcast: 'Podcast',
  preview: 'Preview',
  url: 'Link',
};

export const MEDIA_LABEL: Record<Track['mediaType'], string> = {
  music: 'Music',
  musicvideo: 'Music Video',
  movie: 'Movie',
  tvshow: 'TV Show',
  podcast: 'Podcast',
  audiobook: 'Audiobook',
  radio: 'Radio Station',
  voicememo: 'Voice Memo',
};
