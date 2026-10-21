import type { Track } from '../../types';
import { currentHost } from '../mediaHost';
import type { AdapterCallbacks, LoadOptions, MediaAdapter } from './types';

/* Minimal typings for the YouTube IFrame API */
interface YTPlayer {
  loadVideoById(o: { videoId: string; startSeconds?: number }): void;
  cueVideoById(o: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  setPlaybackRate(r: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoData?(): { title?: string; author?: string; video_id?: string };
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: Record<string, (e: { data: number; target: YTPlayer }) => void>;
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT!);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => {
        apiPromise = null;
        reject(new Error('YouTube could not be reached'));
      };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

const ERRORS: Record<number, string> = {
  2: 'Invalid YouTube video',
  5: 'YouTube player error',
  100: 'Video not found or private',
  101: 'The owner does not allow this video to play here',
  150: 'The owner does not allow this video to play here',
};

/** YouTube states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued */
export class YouTubeAdapter implements MediaAdapter {
  readonly kind = 'youtube' as const;
  private player: YTPlayer | null = null;
  private ready: Promise<YTPlayer> | null = null;
  private container: HTMLDivElement | null = null;
  private cb: AdapterCallbacks;
  private timer: number | undefined;
  private videoId: string | null = null;
  private wantPlay = false;
  private volume = 1;
  private rate = 1;
  private metaSent = false;

  constructor(cb: AdapterCallbacks) {
    this.cb = cb;
  }

  private ensure(host: HTMLElement): Promise<YTPlayer> {
    if (this.ready && this.container && this.container.isConnected && this.container.parentElement === host) return this.ready;
    this.destroyPlayer();
    const container = document.createElement('div');
    container.className = 'iport-yt';
    Object.assign(container.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    const mount = document.createElement('div');
    container.appendChild(mount);
    host.appendChild(container);
    this.container = container;
    this.ready = loadYouTubeApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          const p = new YT.Player(mount, {
            width: '100%',
            height: '100%',
            host: 'https://www.youtube-nocookie.com',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              playsinline: 1,
              rel: 0,
              origin: location.origin,
            },
            events: {
              onReady: () => resolve(p),
              onStateChange: (e) => this.onState(e.data),
              onError: (e) => this.cb.onError(ERRORS[e.data] ?? 'YouTube error'),
            },
          });
          this.player = p;
          const iframe = container.querySelector('iframe');
          if (iframe) {
            iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
            Object.assign(iframe.style, { width: '100%', height: '100%', border: '0', display: 'block' });
          }
        }),
    );
    return this.ready;
  }

  private onState(s: number) {
    if (s === 1) {
      this.cb.onPlaying();
      this.startTimer();
      this.sendMeta();
    } else if (s === 2) {
      this.stopTimer();
      this.tick();
      this.cb.onPaused();
    } else if (s === 3) {
      this.cb.onLoading();
    } else if (s === 0) {
      this.stopTimer();
      this.cb.onEnded();
    } else if (s === 5 && !this.wantPlay) {
      this.cb.onPaused();
    }
  }

  private sendMeta() {
    if (this.metaSent || !this.player) return;
    this.metaSent = true;
    const d = this.player.getVideoData?.();
    const dur = this.player.getDuration();
    this.cb.onMeta({ title: d?.title || undefined, artist: d?.author || undefined, duration: dur || undefined });
  }

  private tick = () => {
    if (!this.player) return;
    this.cb.onTime(this.player.getCurrentTime() || 0, this.player.getDuration() || 0);
  };

  private startTimer() {
    this.stopTimer();
    this.timer = window.setInterval(this.tick, 250);
  }
  private stopTimer() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  async load(track: Track, opts: LoadOptions): Promise<void> {
    this.videoId = track.ref;
    this.wantPlay = opts.autoplay;
    this.volume = opts.volume;
    this.rate = opts.rate ?? 1;
    this.metaSent = false;
    this.cb.onLoading();
    this.cb.onVideo(true);
    let p: YTPlayer;
    try {
      p = await this.ensure(currentHost());
    } catch (e) {
      this.cb.onError(e instanceof Error ? e.message : 'YouTube unavailable');
      return;
    }
    if (this.videoId !== track.ref) return; // superseded
    p.setVolume(Math.round(this.volume * 100));
    if (opts.autoplay) p.loadVideoById({ videoId: track.ref, startSeconds: opts.startAt ?? 0 });
    else {
      p.cueVideoById({ videoId: track.ref, startSeconds: opts.startAt ?? 0 });
      this.cb.onTime(opts.startAt ?? 0, track.duration ?? 0);
      this.cb.onPaused();
    }
    p.setPlaybackRate(this.rate);
  }

  play(): void {
    this.wantPlay = true;
    this.player?.playVideo();
  }
  pause(): void {
    this.wantPlay = false;
    this.player?.pauseVideo();
  }
  seek(seconds: number): void {
    this.player?.seekTo(seconds, true);
    this.cb.onTime(seconds, this.player?.getDuration() ?? 0);
  }
  setVolume(v: number): void {
    this.volume = v;
    this.player?.setVolume(Math.round(v * 100));
  }
  setRate(r: number): void {
    this.rate = r;
    this.player?.setPlaybackRate(r);
  }
  stop(): void {
    this.wantPlay = false;
    this.videoId = null;
    this.stopTimer();
    try {
      this.player?.stopVideo();
    } catch {
      /* not ready */
    }
  }
  getTime(): number {
    return this.player?.getCurrentTime() ?? 0;
  }
  getDuration(): number {
    return this.player?.getDuration() ?? 0;
  }

  /** The device screen changed: rebuild the iframe inside the new host and resume. */
  rehost(host: HTMLElement): void {
    if (!this.container || this.container.parentElement === host) return;
    const id = this.videoId;
    const at = this.getTime();
    const playing = this.wantPlay;
    this.destroyPlayer();
    if (id) {
      void this.load(
        { id: '', source: 'youtube', ref: id, mediaType: 'music', title: '', artist: '', album: '', addedAt: 0, playCount: 0, skipCount: 0 },
        { autoplay: playing, startAt: at, volume: this.volume, rate: this.rate },
      );
    }
  }

  private destroyPlayer() {
    this.stopTimer();
    try {
      this.player?.destroy();
    } catch {
      /* ignore */
    }
    this.player = null;
    this.ready = null;
    this.container?.remove();
    this.container = null;
  }
}
