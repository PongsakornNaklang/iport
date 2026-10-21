import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStateStorage, deleteBlob, forgetBlobUrl } from '../db';
import { uid, hash } from '../util/id';
import type {
  Alarm,
  CalendarEvent,
  Contact,
  Note,
  Photo,
  Playlist,
  SmartPlaylistKind,
  Track,
  VoiceMemo,
  WorldClock,
} from '../types';

export interface LibraryData {
  tracks: Record<string, Track>;
  playlists: Record<string, Playlist>;
  /** Display order of user + smart playlists */
  playlistOrder: string[];
  photos: Photo[];
  notes: Note[];
  contacts: Contact[];
  events: CalendarEvent[];
  alarms: Alarm[];
  worldClocks: WorldClock[];
  voiceMemos: VoiceMemo[];
  /** demo content has been offered/added once */
  seeded: boolean;
}

export interface LibraryActions {
  addTracks(tracks: Track[]): Track[];
  updateTrack(id: string, patch: Partial<Track>): void;
  removeTracks(ids: string[]): void;
  setRating(id: string, rating: number): void;
  recordPlay(id: string): void;
  recordSkip(id: string): void;
  setBookmark(id: string, seconds: number): void;

  createPlaylist(name: string, trackIds?: string[]): string;
  renamePlaylist(id: string, name: string): void;
  deletePlaylist(id: string): void;
  addToPlaylist(id: string, trackIds: string[]): void;
  removeFromPlaylist(id: string, index: number): void;
  movePlaylistItem(id: string, from: number, to: number): void;
  /** On-The-Go helpers (classic: hold center on a song) */
  addToOnTheGo(trackIds: string[]): void;
  clearOnTheGo(): void;
  saveOnTheGo(): string | null;
  saveGenius(seedId: string, trackIds: string[]): string;

  addPhotos(photos: Photo[]): void;
  removePhoto(id: string): void;
  togglePhotoFavorite(id: string): void;

  upsertNote(note: Partial<Note> & { id?: string }): string;
  removeNote(id: string): void;
  upsertContact(c: Partial<Contact> & { id?: string }): string;
  removeContact(id: string): void;
  upsertEvent(e: Partial<CalendarEvent> & { id?: string }): string;
  removeEvent(id: string): void;
  upsertAlarm(a: Partial<Alarm> & { id?: string }): string;
  removeAlarm(id: string): void;
  addWorldClock(c: Omit<WorldClock, 'id'>): void;
  removeWorldClock(id: string): void;
  addVoiceMemo(m: VoiceMemo): void;
  removeVoiceMemo(id: string): void;
  renameVoiceMemo(id: string, name: string): void;

  setSeeded(v: boolean): void;
  resetLibrary(): Promise<void>;
}

export type LibraryState = LibraryData & LibraryActions & { hydrated: boolean };

export const ON_THE_GO_ID = 'pl_on_the_go';

const SMART_DEFAULTS: { id: string; name: string; smart: SmartPlaylistKind }[] = [
  { id: 'pl_smart_90s', name: "90's Music", smart: 'nineties' },
  { id: 'pl_smart_classical', name: 'Classical Music', smart: 'classical' },
  { id: 'pl_smart_mv', name: 'Music Videos', smart: 'music-videos' },
  { id: 'pl_smart_top_rated', name: 'My Top Rated', smart: 'top-rated' },
  { id: 'pl_smart_recent_added', name: 'Recently Added', smart: 'recently-added' },
  { id: 'pl_smart_recent_played', name: 'Recently Played', smart: 'recently-played' },
  { id: 'pl_smart_top25', name: 'Top 25 Most Played', smart: 'top-25' },
];

function defaultPlaylists(): Pick<LibraryData, 'playlists' | 'playlistOrder'> {
  const playlists: Record<string, Playlist> = {};
  const order: string[] = [];
  for (const s of SMART_DEFAULTS) {
    playlists[s.id] = { id: s.id, name: s.name, smart: s.smart, trackIds: [], createdAt: 0 };
    order.push(s.id);
  }
  playlists[ON_THE_GO_ID] = { id: ON_THE_GO_ID, name: 'On-The-Go', onTheGo: true, trackIds: [], createdAt: 0 };
  order.push(ON_THE_GO_ID);
  return { playlists, playlistOrder: order };
}

function defaultData(): LibraryData {
  return {
    tracks: {},
    ...defaultPlaylists(),
    photos: [],
    notes: [],
    contacts: [],
    events: [],
    alarms: [],
    worldClocks: [
      { id: 'wc_bkk', city: 'Bangkok', timeZone: 'Asia/Bangkok' },
      { id: 'wc_cupertino', city: 'Cupertino', timeZone: 'America/Los_Angeles' },
      { id: 'wc_london', city: 'London', timeZone: 'Europe/London' },
      { id: 'wc_tokyo', city: 'Tokyo', timeZone: 'Asia/Tokyo' },
    ],
    voiceMemos: [],
    seeded: false,
  };
}

/** Dedupe key: the same YouTube video / file is only added once. */
export function trackKey(t: Pick<Track, 'source' | 'ref'>): string {
  return `${t.source}:${hash(t.ref)}`;
}

function blobKeysOfTrack(t: Track): string[] {
  const out: string[] = [];
  if (t.source === 'local') out.push(t.ref);
  return out;
}

function mapList<T extends { id: string }>(list: T[], id: string, fn: (x: T) => T): T[] {
  return list.map((x) => (x.id === id ? fn(x) : x));
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (setState, getState) => ({
      ...defaultData(),
      hydrated: false,

      addTracks(tracks) {
        const existing = getState().tracks;
        const byKey = new Map<string, string>();
        for (const t of Object.values(existing)) byKey.set(trackKey(t), t.id);
        const next = { ...existing };
        const added: Track[] = [];
        for (const t of tracks) {
          const k = trackKey(t);
          if (byKey.has(k)) {
            added.push(next[byKey.get(k)!]);
            continue;
          }
          byKey.set(k, t.id);
          next[t.id] = t;
          added.push(t);
        }
        setState({ tracks: next });
        return added;
      },

      updateTrack(id, patch) {
        const t = getState().tracks[id];
        if (!t) return;
        setState({ tracks: { ...getState().tracks, [id]: { ...t, ...patch } } });
      },

      removeTracks(ids) {
        const set = new Set(ids);
        const { tracks, playlists } = getState();
        const next: Record<string, Track> = {};
        for (const [id, t] of Object.entries(tracks)) {
          if (set.has(id)) {
            for (const k of blobKeysOfTrack(t)) {
              forgetBlobUrl(k);
              void deleteBlob(k);
            }
          } else next[id] = t;
        }
        // Artwork blobs may be shared between album tracks; only drop unused ones.
        const usedArt = new Set(Object.values(next).map((t) => t.artwork));
        for (const id of ids) {
          const art = tracks[id]?.artwork;
          if (art?.startsWith('idb:') && !usedArt.has(art)) {
            forgetBlobUrl(art.slice(4));
            void deleteBlob(art.slice(4));
          }
        }
        const pls: Record<string, Playlist> = {};
        for (const [pid, p] of Object.entries(playlists)) {
          pls[pid] = p.smart ? p : { ...p, trackIds: p.trackIds.filter((x) => !set.has(x)) };
        }
        setState({ tracks: next, playlists: pls });
      },

      setRating(id, rating) {
        getState().updateTrack(id, { rating: Math.max(0, Math.min(5, Math.round(rating))) });
      },

      recordPlay(id) {
        const t = getState().tracks[id];
        if (!t) return;
        getState().updateTrack(id, { playCount: (t.playCount ?? 0) + 1, lastPlayed: Date.now() });
      },

      recordSkip(id) {
        const t = getState().tracks[id];
        if (!t) return;
        getState().updateTrack(id, { skipCount: (t.skipCount ?? 0) + 1 });
      },

      setBookmark(id, seconds) {
        const t = getState().tracks[id];
        if (!t) return;
        if (Math.abs((t.bookmark ?? 0) - seconds) < 1) return;
        getState().updateTrack(id, { bookmark: seconds });
      },

      createPlaylist(name, trackIds = []) {
        const id = uid('pl');
        const { playlists, playlistOrder } = getState();
        setState({
          playlists: { ...playlists, [id]: { id, name, trackIds, createdAt: Date.now() } },
          playlistOrder: [...playlistOrder, id],
        });
        return id;
      },

      renamePlaylist(id, name) {
        const p = getState().playlists[id];
        if (!p) return;
        setState({ playlists: { ...getState().playlists, [id]: { ...p, name } } });
      },

      deletePlaylist(id) {
        if (id === ON_THE_GO_ID) return;
        const { playlists, playlistOrder } = getState();
        const next = { ...playlists };
        delete next[id];
        setState({ playlists: next, playlistOrder: playlistOrder.filter((x) => x !== id) });
      },

      addToPlaylist(id, trackIds) {
        const p = getState().playlists[id];
        if (!p || p.smart) return;
        setState({ playlists: { ...getState().playlists, [id]: { ...p, trackIds: [...p.trackIds, ...trackIds] } } });
      },

      removeFromPlaylist(id, index) {
        const p = getState().playlists[id];
        if (!p || p.smart) return;
        const ids = p.trackIds.slice();
        ids.splice(index, 1);
        setState({ playlists: { ...getState().playlists, [id]: { ...p, trackIds: ids } } });
      },

      movePlaylistItem(id, from, to) {
        const p = getState().playlists[id];
        if (!p || p.smart) return;
        const ids = p.trackIds.slice();
        const [x] = ids.splice(from, 1);
        ids.splice(to, 0, x);
        setState({ playlists: { ...getState().playlists, [id]: { ...p, trackIds: ids } } });
      },

      addToOnTheGo(trackIds) {
        getState().addToPlaylist(ON_THE_GO_ID, trackIds);
      },

      clearOnTheGo() {
        const p = getState().playlists[ON_THE_GO_ID];
        if (!p) return;
        setState({ playlists: { ...getState().playlists, [ON_THE_GO_ID]: { ...p, trackIds: [] } } });
      },

      saveOnTheGo() {
        const p = getState().playlists[ON_THE_GO_ID];
        if (!p || p.trackIds.length === 0) return null;
        const n = Object.values(getState().playlists).filter((x) => /^On-The-Go \d+$/.test(x.name)).length + 1;
        const id = getState().createPlaylist(`On-The-Go ${n}`, p.trackIds);
        getState().clearOnTheGo();
        return id;
      },

      saveGenius(seedId, trackIds) {
        const seed = getState().tracks[seedId];
        const id = getState().createPlaylist(seed ? seed.title : 'Genius', trackIds);
        const p = getState().playlists[id];
        setState({ playlists: { ...getState().playlists, [id]: { ...p, geniusSeed: seedId } } });
        return id;
      },

      addPhotos(photos) {
        setState({ photos: [...getState().photos, ...photos] });
      },

      removePhoto(id) {
        const ph = getState().photos.find((p) => p.id === id);
        if (ph) {
          forgetBlobUrl(ph.blobKey);
          void deleteBlob(ph.blobKey);
        }
        setState({ photos: getState().photos.filter((p) => p.id !== id) });
      },

      togglePhotoFavorite(id) {
        setState({ photos: mapList(getState().photos, id, (p) => ({ ...p, favorite: !p.favorite })) });
      },

      upsertNote(n) {
        const id = n.id ?? uid('note');
        const prev = getState().notes.find((x) => x.id === id);
        const note: Note = { title: '', body: '', ...prev, ...n, id, updatedAt: Date.now() };
        if (!note.title) note.title = note.body.split('\n')[0]?.slice(0, 40) || 'New Note';
        setState({ notes: upsert(getState().notes, note) });
        return id;
      },
      removeNote(id) {
        setState({ notes: getState().notes.filter((x) => x.id !== id) });
      },

      upsertContact(c) {
        const id = c.id ?? uid('ct');
        const prev = getState().contacts.find((x) => x.id === id);
        const contact: Contact = { firstName: '', lastName: '', phones: [], emails: [], ...prev, ...c, id };
        setState({ contacts: upsert(getState().contacts, contact) });
        return id;
      },
      removeContact(id) {
        setState({ contacts: getState().contacts.filter((x) => x.id !== id) });
      },

      upsertEvent(e) {
        const id = e.id ?? uid('ev');
        const prev = getState().events.find((x) => x.id === id);
        const now = Date.now();
        const ev: CalendarEvent = { title: 'New Event', start: now, end: now + 3600_000, ...prev, ...e, id };
        setState({ events: upsert(getState().events, ev) });
        return id;
      },
      removeEvent(id) {
        setState({ events: getState().events.filter((x) => x.id !== id) });
      },

      upsertAlarm(a) {
        const id = a.id ?? uid('al');
        const prev = getState().alarms.find((x) => x.id === id);
        const alarm: Alarm = { time: 7 * 60, label: 'Alarm', enabled: true, repeat: [], sound: 'Radar', ...prev, ...a, id };
        setState({ alarms: upsert(getState().alarms, alarm) });
        return id;
      },
      removeAlarm(id) {
        setState({ alarms: getState().alarms.filter((x) => x.id !== id) });
      },

      addWorldClock(c) {
        setState({ worldClocks: [...getState().worldClocks, { ...c, id: uid('wc') }] });
      },
      removeWorldClock(id) {
        setState({ worldClocks: getState().worldClocks.filter((x) => x.id !== id) });
      },

      addVoiceMemo(m) {
        setState({ voiceMemos: [...getState().voiceMemos, m] });
      },
      removeVoiceMemo(id) {
        const m = getState().voiceMemos.find((x) => x.id === id);
        if (m) {
          forgetBlobUrl(m.blobKey);
          void deleteBlob(m.blobKey);
        }
        setState({ voiceMemos: getState().voiceMemos.filter((x) => x.id !== id) });
      },
      renameVoiceMemo(id, name) {
        setState({ voiceMemos: mapList(getState().voiceMemos, id, (m) => ({ ...m, name })) });
      },

      setSeeded(v) {
        setState({ seeded: v });
      },

      async resetLibrary() {
        const { tracks, photos, voiceMemos } = getState();
        const keys = new Set<string>();
        for (const t of Object.values(tracks)) {
          blobKeysOfTrack(t).forEach((k) => keys.add(k));
          if (t.artwork?.startsWith('idb:')) keys.add(t.artwork.slice(4));
        }
        photos.forEach((p) => keys.add(p.blobKey));
        voiceMemos.forEach((m) => keys.add(m.blobKey));
        await Promise.all([...keys].map((k) => (forgetBlobUrl(k), deleteBlob(k))));
        setState({ ...defaultData(), seeded: true });
      },
    }),
    {
      name: 'iport-library-v1',
      version: 1,
      storage: createJSONStorage(() => idbStateStorage),
      partialize: (s) => {
        const { hydrated: _h, ...rest } = s;
        // functions are dropped by JSON.stringify
        return rest as unknown as LibraryState;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LibraryData>;
        const merged = { ...current, ...p } as LibraryState;
        // make sure built-in smart playlists always exist
        const defaults = defaultPlaylists();
        for (const id of defaults.playlistOrder) {
          if (!merged.playlists[id]) {
            merged.playlists = { ...merged.playlists, [id]: defaults.playlists[id] };
            merged.playlistOrder = [...merged.playlistOrder, id];
          }
        }
        return merged;
      },
      onRehydrateStorage: () => () => {
        useLibrary.setState({ hydrated: true });
      },
    },
  ),
);

/** Non-reactive access for engine code. */
export const library = () => useLibrary.getState();
