/**
 * Core data model shared by every iPod model.
 *
 * A Track is anything playable. Where the audio comes from is described by
 * `source` + `ref`; the player engine picks the right adapter for it.
 */

export type SourceKind =
  | 'local' // file the user imported; `ref` is the IndexedDB blob key
  | 'youtube' // `ref` is the 11-char video id
  | 'soundcloud' // `ref` is the track permalink URL
  | 'audius' // `ref` is the Audius track id
  | 'archive' // Internet Archive; `ref` is a direct file URL
  | 'radio' // internet radio; `ref` is the stream URL
  | 'podcast' // podcast episode; `ref` is the enclosure URL
  | 'preview' // iTunes 30s preview; `ref` is the preview URL
  | 'url'; // any direct media URL

export type MediaType =
  | 'music'
  | 'podcast'
  | 'audiobook'
  | 'musicvideo'
  | 'movie'
  | 'tvshow'
  | 'radio'
  | 'voicememo';

export interface Track {
  id: string;
  source: SourceKind;
  ref: string;
  mediaType: MediaType;
  /** true when the media has a picture worth showing (local video, YouTube). */
  hasVideo?: boolean;

  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  genre?: string;
  composer?: string;
  year?: number;
  trackNo?: number;
  discNo?: number;
  compilation?: boolean;
  /** seconds; 0/undefined when unknown (streams, not yet loaded) */
  duration?: number;
  /** Remote URL, or `idb:<key>` for artwork blobs stored locally. */
  artwork?: string;
  lyrics?: string;

  // Podcasts / audiobooks
  show?: string;
  description?: string;
  pubDate?: number;

  // Stats
  addedAt: number;
  playCount: number;
  skipCount: number;
  lastPlayed?: number;
  /** 0..5 stars */
  rating?: number;
  /** resume position for podcasts / audiobooks / videos (seconds) */
  bookmark?: number;
}

export type SmartPlaylistKind =
  | 'recently-added'
  | 'recently-played'
  | 'top-25'
  | 'top-rated'
  | 'nineties'
  | 'classical'
  | 'music-videos';

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  /** Smart playlists compute their contents from the library. */
  smart?: SmartPlaylistKind;
  /** The one-and-only On-The-Go playlist built on the device. */
  onTheGo?: boolean;
  /** Genius playlist seeded from a track. */
  geniusSeed?: string;
}

export interface Photo {
  id: string;
  name: string;
  /** IndexedDB blob key */
  blobKey: string;
  width: number;
  height: number;
  addedAt: number;
  album?: string;
  favorite?: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  company?: string;
  phones: { label: string; value: string }[];
  emails: { label: string; value: string }[];
  address?: string;
  birthday?: string;
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** epoch ms */
  start: number;
  end: number;
  allDay?: boolean;
  location?: string;
  notes?: string;
  color?: string;
}

export interface Alarm {
  id: string;
  /** minutes after midnight */
  time: number;
  label: string;
  enabled: boolean;
  /** 0=Sun..6=Sat; empty = once */
  repeat: number[];
  sound: string;
  /** play a track/playlist instead of a tone */
  playlistId?: string;
}

export interface WorldClock {
  id: string;
  city: string;
  timeZone: string;
}

export interface VoiceMemo {
  id: string;
  name: string;
  blobKey: string;
  duration: number;
  createdAt: number;
}

export type RepeatMode = 'off' | 'one' | 'all';
export type ShuffleMode = 'off' | 'songs' | 'albums';

export type PlayStatus = 'idle' | 'loading' | 'playing' | 'paused';
