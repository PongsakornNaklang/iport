/**
 * The music player: one queue, many sources.
 *
 * UI code reads state with `usePlayer(selector)` and drives it with the
 * `player` actions object. Every iPod model shares this — switching models
 * keeps the music playing.
 */
import { create } from 'zustand';
import type { PlayStatus, RepeatMode, ShuffleMode, Track } from '../types';
import { useLibrary } from '../library/store';
import { albumKey } from '../library/selectors';
import { AUDIOBOOK_RATES, useSettings } from '../settings/store';
import { setEq, setSoundCheck } from './audioGraph';
import { Html5Adapter } from './adapters/html5';
import { YouTubeAdapter } from './adapters/youtube';
import { SoundCloudAdapter } from './adapters/soundcloud';
import type { AdapterCallbacks, MediaAdapter } from './adapters/types';
import { onHostChange } from './mediaHost';
import { resolveArtwork } from '../library/artwork';
import { splitArtistTitle } from '../sources/youtube';

export interface PlayerState {
  /** Track ids in playback order (shuffled when shuffle is on). */
  queue: string[];
  /** The same tracks in their original order. */
  baseQueue: string[];
  index: number;
  currentId: string | null;
  status: PlayStatus;
  position: number;
  duration: number;
  error: string | null;
  /** Which adapter is active — devices use this to decide what to show. */
  kind: MediaAdapter['kind'] | null;
  /** epoch ms when the sleep timer pauses playback, or null */
  sleepAt: number | null;
  /** bumps whenever a new track starts (for UI animations) */
  trackSerial: number;
  /** the current media has a picture (local video or YouTube) */
  hasVideo: boolean;
}

export const usePlayer = create<PlayerState>(() => ({
  queue: [],
  baseQueue: [],
  index: 0,
  currentId: null,
  status: 'idle',
  position: 0,
  duration: 0,
  error: null,
  kind: null,
  sleepAt: null,
  trackSerial: 0,
  hasVideo: false,
}));

const get = usePlayer.getState;
const set = usePlayer.setState;

// ---------------------------------------------------------------- adapters

let html5: Html5Adapter | null = null;
let youtube: YouTubeAdapter | null = null;
let soundcloud: SoundCloudAdapter | null = null;
let active: MediaAdapter | null = null;
let consecutiveErrors = 0;
/** true after restoring a session: the queue is known but no media is loaded */
let needsLoad = false;
let lastBookmarkSave = 0;
let errorTimer: number | undefined;

function makeCallbacks(kind: MediaAdapter['kind']): AdapterCallbacks {
  const isActive = () => active?.kind === kind;
  return {
    onTime(position, duration) {
      if (!isActive()) return;
      const d = duration || get().duration;
      set({ position, duration: d });
      maybeSaveBookmark(position, d);
    },
    onPlaying() {
      if (!isActive()) return;
      consecutiveErrors = 0;
      set({ status: 'playing', error: null });
      updateMediaSessionState();
    },
    onPaused() {
      if (!isActive()) return;
      set({ status: get().currentId ? 'paused' : 'idle' });
      saveBookmarkNow();
      updateMediaSessionState();
    },
    onLoading() {
      if (!isActive()) return;
      if (get().status !== 'paused') set({ status: 'loading' });
    },
    onEnded() {
      if (!isActive()) return;
      handleEnded();
    },
    onError(message) {
      if (!isActive()) return;
      handleError(message);
    },
    onVideo(hasVideo) {
      if (!isActive()) return;
      if (get().hasVideo !== hasVideo) set({ hasVideo });
    },
    onMeta(meta) {
      if (!isActive()) return;
      const id = get().currentId;
      if (!id) return;
      const t = useLibrary.getState().tracks[id];
      if (!t) return;
      const patch: Partial<Track> = {};
      const placeholderArtist = !t.artist || /^unknown artist$|^youtube$|^soundcloud$/i.test(t.artist);
      if (meta.title && (!t.title || t.title === t.ref || /^(loading|youtube video|soundcloud track)/i.test(t.title))) {
        if (t.source === 'youtube') {
          // "Artist - Song (Official Video)" → artist + song
          const split = splitArtistTitle(meta.title, meta.artist);
          patch.title = split.title;
          if (placeholderArtist) patch.artist = split.artist;
        } else patch.title = meta.title;
      }
      if (meta.artist && placeholderArtist && !patch.artist) patch.artist = meta.artist;
      if (meta.duration && !t.duration) patch.duration = meta.duration;
      if (meta.artwork && !t.artwork) patch.artwork = meta.artwork;
      if (Object.keys(patch).length) {
        useLibrary.getState().updateTrack(id, patch);
        updateMediaSessionMeta();
      }
    },
  };
}

function adapterFor(t: Track): MediaAdapter {
  if (t.source === 'youtube') return (youtube ??= new YouTubeAdapter(makeCallbacks('youtube')));
  if (t.source === 'soundcloud') return (soundcloud ??= new SoundCloudAdapter(makeCallbacks('soundcloud')));
  return (html5 ??= new Html5Adapter(makeCallbacks('html5')));
}

/** The <video> element used for local/stream media (for drawing video frames). */
export function getHtml5Element(): HTMLVideoElement | null {
  return html5?.element ?? null;
}

if (typeof window !== 'undefined') {
  onHostChange((host) => {
    youtube?.rehost(host);
    soundcloud?.rehost(host);
  });
}

// ---------------------------------------------------------------- helpers

function track(id: string | null): Track | undefined {
  return id ? useLibrary.getState().tracks[id] : undefined;
}

export function effectiveVolume(): number {
  const s = useSettings.getState();
  return Math.max(0, Math.min(s.volume, s.volumeLimit));
}

function rateFor(t: Track | undefined): number {
  if (!t || t.mediaType !== 'audiobook') return 1;
  return AUDIOBOOK_RATES[useSettings.getState().audiobookSpeed] ?? 1;
}

function resumesFromBookmark(t: Track): boolean {
  return t.mediaType === 'podcast' || t.mediaType === 'audiobook' || t.mediaType === 'movie' || t.mediaType === 'tvshow';
}

function maybeSaveBookmark(position: number, duration: number) {
  const now = Date.now();
  if (now - lastBookmarkSave < 5000) return;
  lastBookmarkSave = now;
  const t = track(get().currentId);
  if (t && resumesFromBookmark(t) && duration > 0) {
    useLibrary.getState().setBookmark(t.id, position > duration - 10 ? 0 : position);
  }
}

function saveBookmarkNow() {
  lastBookmarkSave = 0;
  maybeSaveBookmark(get().position, get().duration);
}

export function shuffleArray<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Shuffle by album: album order random, tracks inside an album keep their order. */
function shuffleAlbums(ids: string[]): string[] {
  const tracks = useLibrary.getState().tracks;
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const t = tracks[id];
    const k = t ? albumKey(t) : id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(id);
  }
  return shuffleArray([...groups.values()]).flat();
}

function buildOrder(base: string[], startId: string | null, mode: ShuffleMode): string[] {
  if (mode === 'off') return base.slice();
  if (mode === 'albums') {
    const order = shuffleAlbums(base);
    if (!startId) return order;
    // start with the chosen track's album, from the chosen track
    const t = track(startId);
    const k = t ? albumKey(t) : null;
    const tracks = useLibrary.getState().tracks;
    const albumIds = order.filter((id) => tracks[id] && albumKey(tracks[id]) === k);
    const rest = order.filter((id) => !albumIds.includes(id));
    const from = albumIds.indexOf(startId);
    return [...albumIds.slice(from), ...rest, ...albumIds.slice(0, from)];
  }
  const rest = shuffleArray(base.filter((id) => id !== startId));
  return startId ? [startId, ...rest] : rest;
}

// ---------------------------------------------------------------- core flow

async function loadIndex(index: number, autoplay: boolean, startAt?: number) {
  needsLoad = false;
  const { queue } = get();
  const id = queue[index];
  const t = track(id);
  window.clearTimeout(errorTimer);
  if (!t) {
    set({ currentId: null, status: 'idle', index: 0 });
    return;
  }
  const next = adapterFor(t);
  if (active && active !== next) active.stop();
  active = next;
  const start = startAt ?? (resumesFromBookmark(t) && t.bookmark && (!t.duration || t.bookmark < t.duration - 10) ? t.bookmark : 0);
  set({
    index,
    currentId: id,
    position: start,
    duration: t.duration ?? 0,
    error: null,
    kind: next.kind,
    hasVideo: false,
    status: autoplay ? 'loading' : 'paused',
    trackSerial: get().trackSerial + 1,
  });
  updateMediaSessionMeta();
  await next.load(t, { autoplay, startAt: start, volume: effectiveVolume(), rate: rateFor(t) });
}

function handleEnded() {
  const { currentId, index, queue } = get();
  if (currentId) useLibrary.getState().recordPlay(currentId);
  if (currentId) useLibrary.getState().setBookmark(currentId, 0);
  const repeat = useSettings.getState().repeat;
  if (repeat === 'one') {
    void loadIndex(index, true, 0);
    return;
  }
  if (index + 1 < queue.length) {
    void loadIndex(index + 1, true);
  } else if (repeat === 'all' && queue.length) {
    const mode = useSettings.getState().shuffle;
    if (mode !== 'off') set({ queue: buildOrder(get().baseQueue, null, mode) });
    void loadIndex(0, true);
  } else {
    // End of the list: the iPod stops and Now Playing goes away.
    active?.stop();
    set({ status: 'idle', currentId: null, position: 0, kind: null });
    updateMediaSessionMeta();
  }
}

function handleError(message: string) {
  consecutiveErrors++;
  set({ error: message, status: 'paused' });
  const { index, queue } = get();
  // skip unplayable items like the iPod does, but don't loop forever
  if (consecutiveErrors < Math.min(queue.length, 8) && index + 1 < queue.length) {
    errorTimer = window.setTimeout(() => void loadIndex(index + 1, true), 1800);
  }
}

// ---------------------------------------------------------------- media session

async function updateMediaSessionMeta() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const t = track(get().currentId);
  if (!t) {
    navigator.mediaSession.metadata = null;
    return;
  }
  const art = await resolveArtwork(t.artwork);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album,
      artwork: art ? [{ src: art, sizes: '512x512' }] : [],
    });
  } catch {
    /* ignore */
  }
}

function updateMediaSessionState() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = get().status === 'playing' ? 'playing' : 'paused';
}

if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  const h = (a: MediaSessionAction, fn: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, fn);
    } catch {
      /* unsupported action */
    }
  };
  h('play', () => player.play());
  h('pause', () => player.pause());
  h('previoustrack', () => player.prev());
  h('nexttrack', () => player.next());
  h('seekto', (d) => d.seekTime != null && player.seek(d.seekTime));
}

// ---------------------------------------------------------------- public API

export const player = {
  /** Start playing a list of tracks from `startIndex`. */
  playTracks(ids: string[], startIndex = 0, opts: { shuffle?: boolean; startAt?: number } = {}) {
    const base = ids.filter((id) => track(id));
    if (!base.length) return;
    let mode = useSettings.getState().shuffle;
    if (opts.shuffle) {
      mode = mode === 'off' ? 'songs' : mode;
      if (useSettings.getState().shuffle === 'off') useSettings.getState().set('shuffle', 'songs');
    }
    const startId = opts.shuffle ? null : base[Math.max(0, Math.min(startIndex, base.length - 1))] ?? null;
    const queue = buildOrder(base, startId, mode);
    consecutiveErrors = 0;
    set({ baseQueue: base, queue });
    void loadIndex(startId ? Math.max(0, queue.indexOf(startId)) : 0, true, opts.startAt);
  },

  playTrack(id: string) {
    player.playTracks([id], 0);
  },

  play() {
    const { currentId, queue } = get();
    if (!currentId) {
      if (queue.length) void loadIndex(get().index, true);
      return;
    }
    // Restored from a previous visit: nothing is loaded yet.
    if (!active || needsLoad) {
      needsLoad = false;
      void loadIndex(get().index, true, get().position);
      return;
    }
    active.play();
  },

  pause() {
    active?.pause();
  },

  toggle() {
    const s = get().status;
    if (s === 'playing' || s === 'loading') player.pause();
    else player.play();
  },

  next() {
    const { index, queue, position, currentId } = get();
    if (!queue.length) return;
    if (currentId && position > 2 && position < 20) useLibrary.getState().recordSkip(currentId);
    const autoplay = get().status === 'playing' || get().status === 'loading';
    if (index + 1 < queue.length) void loadIndex(index + 1, autoplay);
    else if (useSettings.getState().repeat === 'all') void loadIndex(0, autoplay);
    else {
      active?.stop();
      set({ status: 'idle', currentId: null, position: 0, kind: null });
      updateMediaSessionMeta();
    }
  },

  prev() {
    const { index, queue, position } = get();
    if (!queue.length) return;
    const autoplay = get().status === 'playing' || get().status === 'loading';
    if (position > 3 || (index === 0 && useSettings.getState().repeat !== 'all')) {
      player.seek(0);
      return;
    }
    const i = index > 0 ? index - 1 : queue.length - 1;
    void loadIndex(i, autoplay);
  },

  /** Jump to a queue position (Up Next lists). */
  jumpTo(index: number) {
    if (index >= 0 && index < get().queue.length) void loadIndex(index, true);
  },

  seek(seconds: number) {
    if (active && !needsLoad) active.seek(Math.max(0, seconds));
    set({ position: Math.max(0, seconds) });
  },

  seekBy(delta: number) {
    const { position, duration } = get();
    const target = Math.max(0, duration ? Math.min(duration - 0.5, position + delta) : position + delta);
    player.seek(target);
  },

  setVolume(v: number) {
    useSettings.getState().set('volume', Math.max(0, Math.min(1, v)));
    active?.setVolume(effectiveVolume());
  },

  volumeBy(delta: number) {
    player.setVolume(useSettings.getState().volume + delta);
  },

  setShuffle(mode: ShuffleMode) {
    useSettings.getState().set('shuffle', mode);
    const { baseQueue, currentId } = get();
    if (!baseQueue.length) return;
    const queue = buildOrder(baseQueue, currentId, mode);
    set({ queue, index: currentId ? Math.max(0, queue.indexOf(currentId)) : 0 });
  },

  setRepeat(mode: RepeatMode) {
    useSettings.getState().set('repeat', mode);
  },

  cycleRepeat() {
    const r = useSettings.getState().repeat;
    player.setRepeat(r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');
  },

  cycleShuffle() {
    const s = useSettings.getState().shuffle;
    player.setShuffle(s === 'off' ? 'songs' : s === 'songs' ? 'albums' : 'off');
  },

  /** Insert right after the current track ("Play Next"). */
  enqueueNext(ids: string[]) {
    const { queue, index, baseQueue, currentId } = get();
    if (!currentId) return player.playTracks(ids);
    const q = queue.slice();
    q.splice(index + 1, 0, ...ids);
    set({ queue: q, baseQueue: [...baseQueue, ...ids] });
  },

  /** Append to the end ("Play Later"). */
  enqueue(ids: string[]) {
    const { queue, baseQueue, currentId } = get();
    if (!currentId) return player.playTracks(ids);
    set({ queue: [...queue, ...ids], baseQueue: [...baseQueue, ...ids] });
  },

  removeFromQueue(i: number) {
    const { queue, index } = get();
    if (i === index) return;
    const q = queue.slice();
    q.splice(i, 1);
    set({ queue: q, index: i < index ? index - 1 : index });
  },

  stop() {
    active?.stop();
    set({ status: 'idle', currentId: null, position: 0, queue: [], baseQueue: [], index: 0, kind: null });
    updateMediaSessionMeta();
  },

  /** Minutes until playback pauses, or null to cancel. */
  setSleepTimer(minutes: number | null) {
    set({ sleepAt: minutes ? Date.now() + minutes * 60_000 : null });
  },

  applyRate() {
    active?.setRate(rateFor(track(get().currentId)));
  },
};

// Keep audio effects / volume in sync with settings.
if (typeof window !== 'undefined') {
  let prev = useSettings.getState();
  setEq(prev.eq);
  setSoundCheck(prev.soundCheck);
  useSettings.subscribe((s) => {
    if (s.eq !== prev.eq) setEq(s.eq);
    if (s.soundCheck !== prev.soundCheck) setSoundCheck(s.soundCheck);
    if (s.volume !== prev.volume || s.volumeLimit !== prev.volumeLimit) active?.setVolume(effectiveVolume());
    if (s.audiobookSpeed !== prev.audiobookSpeed) player.applyRate();
    prev = s;
  });

  // Sleep timer
  window.setInterval(() => {
    const { sleepAt, status } = get();
    if (sleepAt && Date.now() >= sleepAt) {
      set({ sleepAt: null });
      if (status === 'playing') player.pause();
    }
  }, 1000);
}

// Remember the queue and position across visits, like a real iPod.
const SESSION_KEY = 'iport-player-v1';
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Pick<PlayerState, 'queue' | 'baseQueue' | 'index' | 'currentId' | 'position' | 'duration'>;
      if (s.currentId && Array.isArray(s.queue) && s.queue.length) {
        needsLoad = true;
        set({
          queue: s.queue,
          baseQueue: s.baseQueue ?? s.queue,
          index: Math.max(0, Math.min(s.index ?? 0, s.queue.length - 1)),
          currentId: s.currentId,
          position: s.position ?? 0,
          duration: s.duration ?? 0,
          status: 'paused',
        });
      }
    }
  } catch {
    /* corrupt or unavailable storage */
  }
  let lastSave = 0;
  let pending: number | undefined;
  const save = () => {
    lastSave = Date.now();
    const { queue, baseQueue, index, currentId, position, duration } = get();
    try {
      if (!currentId) localStorage.removeItem(SESSION_KEY);
      else localStorage.setItem(SESSION_KEY, JSON.stringify({ queue, baseQueue, index, currentId, position, duration }));
    } catch {
      /* quota */
    }
  };
  usePlayer.subscribe((s, prev) => {
    const structural = s.currentId !== prev.currentId || s.queue !== prev.queue || s.index !== prev.index;
    if (structural || Date.now() - lastSave > 4000) {
      window.clearTimeout(pending);
      save();
    } else {
      window.clearTimeout(pending);
      pending = window.setTimeout(save, 4000);
    }
  });
  window.addEventListener('pagehide', save);
}

/** Convenience hook: the current track object. */
export function useCurrentTrack(): Track | undefined {
  const id = usePlayer((s) => s.currentId);
  return useLibrary((s) => (id ? s.tracks[id] : undefined));
}
