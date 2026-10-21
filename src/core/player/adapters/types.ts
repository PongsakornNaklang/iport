import type { Track } from '../../types';

export interface AdapterCallbacks {
  onTime(position: number, duration: number): void;
  onPlaying(): void;
  onPaused(): void;
  onLoading(): void;
  onEnded(): void;
  onError(message: string): void;
  /** Whether the current media has a picture (local video / YouTube). */
  onVideo(hasVideo: boolean): void;
  /** Metadata discovered while playing (YouTube title, SoundCloud artwork…) */
  onMeta(meta: Partial<Pick<Track, 'title' | 'artist' | 'duration' | 'artwork'>>): void;
}

export interface LoadOptions {
  autoplay: boolean;
  startAt?: number;
  volume: number;
  rate?: number;
}

export interface MediaAdapter {
  readonly kind: 'html5' | 'youtube' | 'soundcloud';
  load(track: Track, opts: LoadOptions): Promise<void>;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  /** 0..1 (already includes volume limit) */
  setVolume(v: number): void;
  setRate(r: number): void;
  /** Stop and release the current media. */
  stop(): void;
  getTime(): number;
  getDuration(): number;
  /** The host element changed (device switched); re-create iframes if needed. */
  rehost?(host: HTMLElement): void;
  /**
   * Called from a click while the sound is held back: lets the browser count
   * a play() a moment later as started by the listener (Safari requires that),
   * without making a sound.
   */
  prime?(): void;
}
