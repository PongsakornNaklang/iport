import type { Track } from '../../types';
import { currentHost } from '../mediaHost';
import type { AdapterCallbacks, LoadOptions, MediaAdapter } from './types';

/* Minimal typings for the SoundCloud Widget API */
interface SCSound {
  title?: string;
  duration?: number;
  artwork_url?: string | null;
  user?: { username?: string; avatar_url?: string };
}
interface SCWidget {
  bind(ev: string, fn: (e?: { currentPosition?: number; relativePosition?: number }) => void): void;
  unbind(ev: string): void;
  load(url: string, opts: Record<string, unknown> & { callback?: () => void }): void;
  play(): void;
  pause(): void;
  seekTo(ms: number): void;
  setVolume(v: number): void;
  getDuration(cb: (ms: number) => void): void;
  getPosition(cb: (ms: number) => void): void;
  getCurrentSound(cb: (s: SCSound | null) => void): void;
}
interface SCNamespace {
  Widget: ((el: HTMLIFrameElement) => SCWidget) & {
    Events: Record<'READY' | 'PLAY' | 'PAUSE' | 'FINISH' | 'PLAY_PROGRESS' | 'ERROR' | 'LOAD_PROGRESS', string>;
  };
}
declare global {
  interface Window {
    SC?: SCNamespace;
  }
}

let apiPromise: Promise<SCNamespace> | null = null;
function loadApi(): Promise<SCNamespace> {
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://w.soundcloud.com/player/api.js';
      s.async = true;
      s.onload = () => (window.SC ? resolve(window.SC) : reject(new Error('SoundCloud unavailable')));
      s.onerror = () => {
        apiPromise = null;
        reject(new Error('SoundCloud could not be reached'));
      };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

const WIDGET_PARAMS =
  'auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true&buying=false&sharing=false&download=false';

export function soundcloudArtwork(url: string | null | undefined): string | undefined {
  // "-large" is 100x100; "-t500x500" is the big one
  return url ? url.replace('-large.', '-t500x500.') : undefined;
}

export class SoundCloudAdapter implements MediaAdapter {
  readonly kind = 'soundcloud' as const;
  private cb: AdapterCallbacks;
  private iframe: HTMLIFrameElement | null = null;
  private widget: SCWidget | null = null;
  private ready: Promise<SCWidget> | null = null;
  private url: string | null = null;
  private duration = 0;
  private position = 0;
  private volume = 1;
  private wantPlay = false;

  constructor(cb: AdapterCallbacks) {
    this.cb = cb;
  }

  private ensure(host: HTMLElement, firstUrl: string): Promise<SCWidget> {
    if (this.ready && this.iframe?.isConnected && this.iframe.parentElement === host) return this.ready;
    this.destroy();
    const iframe = document.createElement('iframe');
    iframe.allow = 'autoplay; encrypted-media';
    iframe.className = 'iport-sc';
    Object.assign(iframe.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0' });
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(firstUrl)}&${WIDGET_PARAMS}`;
    host.appendChild(iframe);
    this.iframe = iframe;
    this.ready = loadApi().then(
      (SC) =>
        new Promise<SCWidget>((resolve, reject) => {
          const w = SC.Widget(iframe);
          const E = SC.Widget.Events;
          const t = window.setTimeout(() => reject(new Error('SoundCloud did not respond')), 15000);
          w.bind(E.READY, () => {
            window.clearTimeout(t);
            resolve(w);
          });
          w.bind(E.PLAY, () => {
            this.cb.onPlaying();
            this.fetchMeta();
          });
          w.bind(E.PAUSE, () => this.cb.onPaused());
          w.bind(E.FINISH, () => this.cb.onEnded());
          w.bind(E.ERROR, () => this.cb.onError('SoundCloud could not play this track'));
          w.bind(E.PLAY_PROGRESS, (e) => {
            this.position = (e?.currentPosition ?? 0) / 1000;
            this.cb.onTime(this.position, this.duration);
          });
          this.widget = w;
        }),
    );
    return this.ready;
  }

  private fetchMeta() {
    const w = this.widget;
    if (!w) return;
    w.getDuration((ms) => {
      this.duration = ms / 1000;
    });
    w.getCurrentSound((s) => {
      if (!s) return;
      this.cb.onMeta({
        title: s.title,
        artist: s.user?.username,
        duration: s.duration ? s.duration / 1000 : undefined,
        artwork: soundcloudArtwork(s.artwork_url ?? s.user?.avatar_url),
      });
    });
  }

  async load(track: Track, opts: LoadOptions): Promise<void> {
    const url = track.ref;
    const reuse = !!this.ready && this.iframe?.parentElement === currentHost();
    this.url = url;
    this.wantPlay = opts.autoplay;
    this.volume = opts.volume;
    this.duration = track.duration ?? 0;
    this.position = 0;
    this.cb.onLoading();
    let w: SCWidget;
    try {
      w = await this.ensure(currentHost(), url);
    } catch (e) {
      this.cb.onError(e instanceof Error ? e.message : 'SoundCloud unavailable');
      return;
    }
    if (this.url !== url) return;
    const start = () => {
      w.setVolume(Math.round(this.volume * 100));
      w.getDuration((ms) => {
        this.duration = ms / 1000;
        this.cb.onTime(0, this.duration);
      });
      if (opts.startAt) w.seekTo(opts.startAt * 1000);
      if (this.wantPlay) w.play();
      else this.cb.onPaused();
      this.fetchMeta();
    };
    if (reuse) {
      w.load(url, {
        auto_play: opts.autoplay,
        hide_related: true,
        show_comments: false,
        show_reposts: false,
        visual: true,
        callback: start,
      });
    } else start();
  }

  play(): void {
    this.wantPlay = true;
    this.widget?.play();
  }
  pause(): void {
    this.wantPlay = false;
    this.widget?.pause();
  }
  seek(seconds: number): void {
    this.widget?.seekTo(seconds * 1000);
    this.position = seconds;
    this.cb.onTime(seconds, this.duration);
  }
  setVolume(v: number): void {
    this.volume = v;
    this.widget?.setVolume(Math.round(v * 100));
  }
  setRate(): void {
    /* not supported by the widget */
  }
  stop(): void {
    this.wantPlay = false;
    this.url = null;
    this.widget?.pause();
  }
  getTime(): number {
    return this.position;
  }
  getDuration(): number {
    return this.duration;
  }

  rehost(host: HTMLElement): void {
    if (!this.iframe || this.iframe.parentElement === host || !this.url) return;
    const url = this.url;
    const at = this.position;
    const playing = this.wantPlay;
    this.destroy();
    void this.load(
      { id: '', source: 'soundcloud', ref: url, mediaType: 'music', title: '', artist: '', album: '', addedAt: 0, playCount: 0, skipCount: 0 },
      { autoplay: playing, startAt: at, volume: this.volume },
    );
  }

  private destroy() {
    this.iframe?.remove();
    this.iframe = null;
    this.widget = null;
    this.ready = null;
  }
}
