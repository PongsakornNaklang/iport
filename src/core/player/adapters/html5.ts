import type { Track } from '../../types';
import { connectElement, resumeAudio } from '../audioGraph';
import { getPool } from '../mediaHost';
import { resolveStreamUrl } from '../../sources/resolve';
import type { AdapterCallbacks, LoadOptions, MediaAdapter } from './types';

/**
 * Plays files and HTTP streams with a <video> element (it plays audio too,
 * and lets us show local videos).
 *
 * Two elements: `fx` is routed through Web Audio (EQ, Sound Check) and needs
 * CORS; `plain` is used for streams that don't allow cross-origin reads.
 */
export class Html5Adapter implements MediaAdapter {
  readonly kind = 'html5' as const;
  private fx: HTMLVideoElement;
  private plain: HTMLVideoElement;
  private active: HTMLVideoElement;
  private cb: AdapterCallbacks;
  private loadToken = 0;
  private wantPlay = false;

  constructor(cb: AdapterCallbacks) {
    this.cb = cb;
    this.fx = this.makeEl(true);
    this.plain = this.makeEl(false);
    this.active = this.fx;
  }

  /** The element currently playing — used by <VideoCanvas> to draw frames. */
  get element(): HTMLVideoElement {
    return this.active;
  }

  private makeEl(fx: boolean): HTMLVideoElement {
    const el = document.createElement('video');
    el.playsInline = true;
    el.preload = 'auto';
    if (fx) el.crossOrigin = 'anonymous';
    el.style.width = '1px';
    el.style.height = '1px';
    getPool().appendChild(el);

    const isActive = () => el === this.active;
    el.addEventListener('timeupdate', () => isActive() && this.cb.onTime(el.currentTime, this.duration(el)));
    el.addEventListener('durationchange', () => isActive() && this.cb.onTime(el.currentTime, this.duration(el)));
    el.addEventListener('playing', () => isActive() && this.cb.onPlaying());
    el.addEventListener('pause', () => isActive() && !el.ended && this.cb.onPaused());
    el.addEventListener('waiting', () => isActive() && this.cb.onLoading());
    el.addEventListener('ended', () => isActive() && this.cb.onEnded());
    const video = () => isActive() && this.cb.onVideo(el.videoWidth > 0 && el.videoHeight > 0);
    el.addEventListener('loadedmetadata', video);
    el.addEventListener('resize', video);
    return el;
  }

  private duration(el: HTMLMediaElement): number {
    return isFinite(el.duration) ? el.duration : 0;
  }

  async load(track: Track, opts: LoadOptions): Promise<void> {
    const token = ++this.loadToken;
    this.wantPlay = opts.autoplay;
    this.cb.onLoading();
    let url: string;
    try {
      url = await resolveStreamUrl(track);
    } catch (e) {
      if (token === this.loadToken) this.cb.onError(e instanceof Error ? e.message : 'Cannot load this item');
      return;
    }
    if (token !== this.loadToken) return;

    // Radio streams almost never send CORS headers; go straight to `plain`.
    const tryFx = track.source !== 'radio';
    const attempt = (el: HTMLVideoElement): Promise<boolean> =>
      new Promise((resolve) => {
        const other = el === this.fx ? this.plain : this.fx;
        other.pause();
        other.removeAttribute('src');
        other.load();
        this.active = el;
        if (el === this.fx) {
          try {
            connectElement(el);
          } catch {
            /* already connected */
          }
        }
        el.volume = opts.volume;
        el.playbackRate = opts.rate ?? 1;
        const cleanup = () => {
          el.removeEventListener('loadedmetadata', ok);
          el.removeEventListener('error', bad);
        };
        const ok = () => {
          cleanup();
          resolve(true);
        };
        const bad = () => {
          cleanup();
          resolve(false);
        };
        el.addEventListener('loadedmetadata', ok);
        el.addEventListener('error', bad);
        el.src = url;
        el.load();
      });

    let ok = tryFx ? await attempt(this.fx) : false;
    if (token !== this.loadToken) return;
    if (!ok && track.source !== 'local') {
      ok = await attempt(this.plain);
      if (token !== this.loadToken) return;
    }
    if (!ok) {
      this.cb.onError(track.source === 'local' ? 'This file format is not supported by your browser' : 'Cannot play this stream');
      return;
    }
    const el = this.active;
    if (opts.startAt && opts.startAt > 0 && isFinite(el.duration)) {
      try {
        el.currentTime = Math.min(opts.startAt, Math.max(0, el.duration - 1));
      } catch {
        /* not seekable */
      }
    }
    this.cb.onTime(el.currentTime, this.duration(el));
    if (this.wantPlay) this.play();
    else this.cb.onPaused();
  }

  play(): void {
    this.wantPlay = true;
    resumeAudio();
    const p = this.active.play();
    if (p)
      p.catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'NotAllowedError') this.cb.onPaused();
        else if (e instanceof DOMException && e.name === 'AbortError') {
          /* superseded by another load */
        } else this.cb.onError('Playback failed');
      });
  }

  pause(): void {
    this.wantPlay = false;
    this.active.pause();
  }

  prime(): void {
    const el = this.active;
    if (!el.currentSrc) return;
    resumeAudio();
    const wasMuted = el.muted;
    el.muted = true;
    const restore = () => {
      if (!this.wantPlay) el.pause();
      el.muted = wasMuted;
    };
    const p = el.play();
    if (p) p.then(restore, () => (el.muted = wasMuted));
    else restore();
  }

  seek(seconds: number): void {
    const el = this.active;
    if (!isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(seconds, el.duration - 0.05));
    this.cb.onTime(el.currentTime, this.duration(el));
  }

  setVolume(v: number): void {
    this.fx.volume = v;
    this.plain.volume = v;
  }

  setRate(r: number): void {
    this.active.playbackRate = r;
  }

  stop(): void {
    this.loadToken++;
    for (const el of [this.fx, this.plain]) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  }

  getTime(): number {
    return this.active.currentTime || 0;
  }

  getDuration(): number {
    return this.duration(this.active);
  }
}
