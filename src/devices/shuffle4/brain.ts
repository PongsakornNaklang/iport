/**
 * The iPod shuffle (4th generation) firmware: buttons, three-way switch,
 * status light and VoiceOver, following Apple's iPod shuffle User Guide.
 *
 *  Center ▶❙❙   click = play/pause · double-click = next · triple-click = previous
 *               double-click & hold = fast-forward · triple-click & hold = rewind
 *               hold 3 s = lock/unlock buttons (light blinks orange/green ×3)
 *  ◀◀ / ▶▶     click = previous (restart) / next · hold = rewind / fast-forward
 *  + / −        volume (orange ×3 at the limit; a tone when paused)
 *  VoiceOver    click = title & artist · double-click = battery
 *               hold = playlist menu (◀◀/▶▶ browse, ▶❙❙ or VoiceOver choose, hold to leave)
 *  Switch       OFF · play in order · shuffle
 *
 * One instance lives while the device is mounted; UI state is published in
 * the small `useS4` store so the hardware can render it.
 */
import { create } from 'zustand';
import { effectiveVolume, player, usePlayer } from '../../core/player/player';
import { useLibrary } from '../../core/library/store';
import { audiobooks, geniusMixes, playlistTracks, podcasts, songs } from '../../core/library/selectors';
import { useSettings } from '../../core/settings/store';
import { playClick, playTone } from '../../core/sound/click';
import type { Playlist } from '../../core/types';
import { speak, stopSpeech, warmUpSpeech } from './speech';

export type LedColor = 'off' | 'green' | 'orange' | 'red';
export type Zone = 'center' | 'next' | 'prev' | 'up' | 'down' | 'vo';
/** 0 = OFF, 1 = play in order, 2 = shuffle */
export type SwitchPos = 0 | 1 | 2;

export interface Caption {
  text: string;
  hint?: string;
  id: number;
}

interface UiState {
  led: LedColor;
  caption: Caption | null;
  pressed: Partial<Record<Zone, boolean>>;
  locked: boolean;
  menu: boolean;
}

export const useS4 = create<UiState>(() => ({ led: 'off', caption: null, pressed: {}, locked: false, menu: false }));

const VOLUME_STEP = 1 / 16;

interface Seg {
  c: LedColor;
  ms: number;
}
const blink = (c: LedColor, n: number, on = 170, off = 170): Seg[] =>
  Array.from({ length: n }, (_, i) => (i < n - 1 ? [{ c, ms: on }, { c: 'off' as LedColor, ms: off }] : [{ c, ms: on }])).flat();

// ---------------------------------------------------------------- press detector

interface PressOpts {
  /** clicks to wait for before firing (1 = fire on release) */
  maxClicks: () => number;
  /** hold threshold for the n-th press of a sequence, or null for none */
  holdMs: (n: number) => number | null;
  onClick: (n: number) => void;
  onHold?: (n: number) => void;
  onHoldEnd?: (n: number) => void;
}

/** Single / double / triple click and click-and-hold, like Apple's remote. */
class Press {
  private o: PressOpts;
  private waiting = 0;
  private cur = 0;
  private isDown = false;
  private holding = false;
  private holdT = 0;
  private finT = 0;
  constructor(o: PressOpts) {
    this.o = o;
  }
  down() {
    if (this.isDown) return;
    this.isDown = true;
    window.clearTimeout(this.finT);
    this.cur = this.waiting + 1;
    const h = this.o.holdMs(this.cur);
    if (h != null) {
      this.holdT = window.setTimeout(() => {
        this.holding = true;
        this.waiting = 0;
        this.o.onHold?.(this.cur);
      }, h);
    }
  }
  up() {
    if (!this.isDown) return;
    this.isDown = false;
    window.clearTimeout(this.holdT);
    if (this.holding) {
      this.holding = false;
      this.waiting = 0;
      this.o.onHoldEnd?.(this.cur);
      return;
    }
    this.waiting = this.cur;
    if (this.waiting >= this.o.maxClicks()) this.fire();
    else this.finT = window.setTimeout(() => this.fire(), 330);
  }
  private fire() {
    const n = this.waiting;
    this.waiting = 0;
    if (n) this.o.onClick(n);
  }
  cancel() {
    window.clearTimeout(this.holdT);
    window.clearTimeout(this.finT);
    if (this.holding) this.o.onHoldEnd?.(this.cur);
    this.isDown = this.holding = false;
    this.waiting = 0;
  }
}

// ---------------------------------------------------------------- the brain

interface MenuItem {
  label: string;
  hint?: string;
  ids: string[];
}

export interface BrainEnv {
  modelId: string;
  battery: () => { level: number; charging: boolean };
  playlists: () => Playlist[];
}

export class ShuffleBrain {
  private env: BrainEnv;
  private ticker = 0;
  private override: { t0: number; segs: Seg[]; total: number } | null = null;
  private pausedSince: number | null = null;
  private seekT = 0;
  private volT = 0;
  private voBusy = false;
  private resumeAfter = false;
  private voSeq = 0;
  private captionSeq = 0;
  private captionT = 0;
  private menu: { items: MenuItem[]; index: number; timer: number } | null = null;
  private unsub: () => void;
  private presses: Record<'center' | 'next' | 'prev' | 'vo', Press>;

  constructor(env: BrainEnv) {
    this.env = env;
    warmUpSpeech();
    useS4.setState({ led: 'off', caption: null, pressed: {}, locked: false, menu: false });

    this.presses = {
      center: new Press({
        maxClicks: () => (this.menu ? 1 : 3),
        holdMs: (n) => (n === 1 ? (this.menu ? null : 3000) : 420),
        onClick: (n) => this.centerClick(n),
        onHold: (n) => (n === 1 ? this.toggleLock() : this.startSeek(n === 2 ? 1 : -1)),
        onHoldEnd: () => this.stopSeek(),
      }),
      next: new Press({
        maxClicks: () => 1,
        holdMs: () => (this.menu ? null : 480),
        onClick: () => this.skip(1),
        onHold: () => this.startSeek(1),
        onHoldEnd: () => this.stopSeek(),
      }),
      prev: new Press({
        maxClicks: () => 1,
        holdMs: () => (this.menu ? null : 480),
        onClick: () => this.skip(-1),
        onHold: () => this.startSeek(-1),
        onHoldEnd: () => this.stopSeek(),
      }),
      vo: new Press({
        maxClicks: () => (this.menu ? 1 : 2),
        holdMs: () => 800,
        onClick: (n) => this.voClick(n),
        onHold: () => this.voHold(),
      }),
    };

    this.unsub = usePlayer.subscribe((s, prev) => {
      if (s.status === prev.status) return;
      if (s.status === 'paused') {
        if (this.pausedSince == null && !this.voBusy) this.pausedSince = performance.now();
      } else if (s.status === 'playing' || s.status === 'loading') {
        this.pausedSince = null;
        // Music started from elsewhere (library panel…) while the switch is off.
        if (!this.power() && !this.voBusy) {
          this.setPower(true);
          this.flash(blink('green', 1, 600));
        }
      } else {
        this.pausedSince = null;
      }
    });

    const st = usePlayer.getState().status;
    if (!this.power() && (st === 'playing' || st === 'loading')) this.setPower(true);

    this.ticker = window.setInterval(this.tick, 40);
  }

  dispose() {
    window.clearInterval(this.ticker);
    window.clearTimeout(this.captionT);
    this.unsub();
    for (const p of Object.values(this.presses)) p.cancel();
    this.stopSeek();
    this.stopVolumeRepeat();
    if (this.menu) window.clearTimeout(this.menu.timer);
    this.menu = null;
    stopSpeech();
    // Hand the music back to whichever iPod is mounted next.
    if (this.voBusy && this.resumeAfter) player.play();
    this.voBusy = false;
  }

  // ------------------------------------------------------------ switch / power

  power(): boolean {
    const v = useSettings.getState().device[this.env.modelId]?.power;
    return v === undefined ? true : !!v;
  }

  private setPower(on: boolean) {
    useSettings.getState().setDevice(this.env.modelId, 'power', on);
  }

  switchPos(): SwitchPos {
    if (!this.power()) return 0;
    return useSettings.getState().shuffle === 'off' ? 1 : 2;
  }

  setSwitch(pos: SwitchPos) {
    const wasOn = this.power();
    if (pos === 0) {
      if (!wasOn) return;
      this.setPower(false);
      this.shutdown();
      return;
    }
    const shuffle = useSettings.getState().shuffle;
    if (pos === 2 && shuffle === 'off') player.setShuffle('songs');
    if (pos === 1 && shuffle !== 'off') player.setShuffle('off');
    if (!wasOn) {
      this.setPower(true);
      this.pausedSince = null;
      // The light shows the charge when you switch on: green, orange or red.
      this.flash(blink(this.batteryColor(), 1, 750));
    } else {
      this.flash(blink('green', 1, 160));
    }
  }

  /** Click on the switch: OFF → in order → shuffle → OFF. */
  cycleSwitch() {
    const p = this.switchPos();
    this.setSwitch(((p + 1) % 3) as SwitchPos);
  }

  private shutdown() {
    if (this.menu) {
      window.clearTimeout(this.menu.timer);
      this.menu = null;
    }
    this.voSeq++;
    stopSpeech();
    this.voBusy = false;
    this.resumeAfter = false;
    this.hideCaption(0);
    for (const p of Object.values(this.presses)) p.cancel();
    this.stopSeek();
    this.stopVolumeRepeat();
    this.override = null;
    this.pausedSince = null;
    useS4.setState({ locked: false, menu: false });
    const st = usePlayer.getState().status;
    if (st === 'playing' || st === 'loading') player.pause();
  }

  // ------------------------------------------------------------ status light

  private tick = () => {
    const now = performance.now();
    let c: LedColor = 'off';
    const o = this.override;
    if (o) {
      const el = now - o.t0;
      if (el >= o.total) this.override = null;
      else {
        let acc = 0;
        for (const s of o.segs) {
          acc += s.ms;
          if (el < acc) {
            c = s.c;
            break;
          }
        }
      }
    }
    if (!this.override) c = this.background(now);
    if (useS4.getState().led !== c) useS4.setState({ led: c });
  };

  private background(now: number): LedColor {
    if (!this.power()) return 'off';
    // "Green blinks for 60 seconds" while paused.
    if (this.pausedSince != null && !this.voBusy && !this.menu) {
      const el = now - this.pausedSince;
      if (el < 60_000) return el % 1100 < 330 ? 'green' : 'off';
    }
    return 'off';
  }

  private flash(segs: Seg[]) {
    if (!this.power()) return;
    this.override = { t0: performance.now(), segs, total: segs.reduce((a, s) => a + s.ms, 0) };
    this.tick();
  }

  private batteryColor(): LedColor {
    const l = this.env.battery().level;
    return l >= 0.5 ? 'green' : l >= 0.25 ? 'orange' : 'red';
  }

  // ------------------------------------------------------------ input

  /** A button went down (pointer or keyboard). */
  down(z: Zone) {
    if (useS4.getState().pressed[z]) return;
    useS4.setState((s) => ({ pressed: { ...s.pressed, [z]: true } }));
    playClick(0.16);
    if (z === 'up' || z === 'down') {
      this.volumeStep(z === 'up' ? 1 : -1);
      this.stopVolumeRepeat();
      this.volT = window.setTimeout(() => {
        this.volT = window.setInterval(() => this.volumeStep(z === 'up' ? 1 : -1, true), 150);
      }, 450);
      return;
    }
    this.presses[z].down();
  }

  up(z: Zone) {
    if (!useS4.getState().pressed[z]) return;
    useS4.setState((s) => ({ pressed: { ...s.pressed, [z]: false } }));
    if (z === 'up' || z === 'down') {
      this.stopVolumeRepeat();
      return;
    }
    this.presses[z].up();
  }

  releaseAll() {
    for (const z of Object.keys(useS4.getState().pressed) as Zone[]) this.up(z);
  }

  private guard(): boolean {
    if (!this.power()) return false;
    if (useS4.getState().locked) {
      this.flash(blink('orange', 1, 260));
      return false;
    }
    return true;
  }

  private centerClick(n: number) {
    if (!this.guard()) return;
    if (this.menu) return this.menuSelect();
    if (n === 1) this.playPause();
    else if (n === 2) this.skip(1);
    else this.skip(-1);
  }

  private toggleLock() {
    if (!this.power() || this.menu) return;
    const locked = !useS4.getState().locked;
    useS4.setState({ locked });
    this.flash(blink(locked ? 'orange' : 'green', 3, 200, 180));
  }

  private isPlaying(): boolean {
    const s = usePlayer.getState().status;
    return s === 'playing' || s === 'loading';
  }

  playPause() {
    // Pressing play while VoiceOver talks: act on what the listener thinks is happening.
    if (this.voBusy && !this.menu) {
      const wasPlaying = this.resumeAfter;
      this.endVo(false);
      if (wasPlaying) {
        this.pausedSince = performance.now();
        return;
      }
    }
    const st = usePlayer.getState();
    if (!st.currentId) {
      if (st.queue.length) {
        player.jumpTo(0);
      } else if (!this.playAllSongs()) {
        return;
      }
      this.flash(blink('green', 1, 900));
      return;
    }
    if (this.isPlaying()) {
      player.pause();
      this.pausedSince = performance.now();
      this.override = null;
    } else {
      player.play();
      this.pausedSince = null;
      this.flash(blink('green', 1, 900));
    }
  }

  /** Start "All Songs" in the switch's order. Returns false when the library is empty. */
  private playAllSongs(): boolean {
    const ids = songs(useLibrary.getState().tracks).map((t) => t.id);
    if (!ids.length) {
      this.flash(blink('orange', 3));
      void this.announce('No songs');
      return false;
    }
    this.playList(ids);
    return true;
  }

  private playList(ids: string[]) {
    if (this.switchPos() === 2) player.playTracks(ids, 0, { shuffle: true });
    else player.playTracks(ids, 0);
  }

  private skip(d: 1 | -1) {
    if (!this.guard()) return;
    if (this.menu) return this.menuMove(d);
    const st = usePlayer.getState();
    if (!st.queue.length) {
      this.flash(blink('orange', 1, 260));
      return;
    }
    if (this.voBusy) this.endVo(true);
    if (d > 0) player.next();
    else player.prev();
    this.flash(blink('green', 1, 180));
  }

  private startSeek(dir: 1 | -1) {
    if (!this.guard() || this.menu) return;
    if (!usePlayer.getState().currentId) return;
    this.flash(blink('green', 1, 220));
    this.stopSeek();
    const t0 = performance.now();
    this.seekT = window.setInterval(() => {
      const el = performance.now() - t0;
      // scan faster the longer you hold
      const step = el < 2500 ? 1.25 : el < 6000 ? 3 : 6;
      player.seekBy(dir * step);
    }, 250);
  }

  private stopSeek() {
    window.clearInterval(this.seekT);
    this.seekT = 0;
  }

  private stopVolumeRepeat() {
    window.clearTimeout(this.volT);
    window.clearInterval(this.volT);
    this.volT = 0;
  }

  private volumeStep(d: 1 | -1, repeating = false) {
    if (!this.power()) return;
    if (useS4.getState().locked) {
      if (!repeating) this.flash(blink('orange', 1, 260));
      return;
    }
    const s = useSettings.getState();
    const cap = Math.min(1, s.volumeLimit);
    const atLimit = d > 0 ? s.volume >= cap - 0.001 : s.volume <= 0.001;
    if (atLimit) {
      // "Orange blinks three times": volume limit reached.
      this.stopVolumeRepeat();
      if (!this.override || this.override.segs[0].c !== 'orange') this.flash(blink('orange', 3));
      return;
    }
    const v = Math.max(0, Math.min(cap, Math.round((s.volume + d * VOLUME_STEP) * 1000) / 1000));
    player.setVolume(v);
    const nowAtLimit = d > 0 ? v >= cap - 0.001 : v <= 0.001;
    this.flash(nowAtLimit ? blink('orange', 3) : blink('green', 1, 140));
    // "You hear a tone when you change the volume while iPod shuffle is paused."
    if (!this.isPlaying() && !this.voBusy) playTone(1046, 70, { type: 'sine', volume: 0.04 + effectiveVolume() * 0.22 });
  }

  // ------------------------------------------------------------ VoiceOver

  private voClick(n: number) {
    if (!this.guard()) return;
    if (this.menu) return this.menuSelect();
    if (n >= 2) void this.announceBattery();
    else void this.announceTrack();
  }

  private voHold() {
    if (!this.guard()) return;
    if (this.menu) this.exitMenu(true);
    else this.enterMenu();
  }

  private speechVolume(): number {
    return Math.max(0.25, Math.min(1, effectiveVolume() * 1.4));
  }

  private showCaption(text: string, hint?: string) {
    window.clearTimeout(this.captionT);
    useS4.setState({ caption: { text, hint, id: ++this.captionSeq } });
  }

  private hideCaption(delay = 1100) {
    window.clearTimeout(this.captionT);
    const id = this.captionSeq;
    const hide = () => {
      if (this.captionSeq === id) useS4.setState({ caption: null });
    };
    if (delay <= 0) hide();
    else this.captionT = window.setTimeout(hide, delay);
  }

  /** Pause the music while VoiceOver talks (it resumes afterwards). */
  private beginVo() {
    if (this.voBusy) return;
    this.voBusy = true;
    this.resumeAfter = this.isPlaying();
    if (this.resumeAfter) player.pause();
  }

  private endVo(resume: boolean) {
    this.voSeq++;
    stopSpeech();
    this.hideCaption();
    const shouldResume = resume && this.resumeAfter && this.power();
    this.voBusy = false;
    this.resumeAfter = false;
    if (shouldResume) player.play();
  }

  private async announce(text: string, hint?: string, caption = text): Promise<void> {
    const seq = ++this.voSeq;
    this.beginVo();
    this.showCaption(caption, hint);
    await speak(text, this.speechVolume());
    if (seq !== this.voSeq) return;
    this.endVo(true);
  }

  private announceTrack() {
    const st = usePlayer.getState();
    const t = st.currentId ? useLibrary.getState().tracks[st.currentId] : undefined;
    if (!t) return this.announce('Not playing');
    const artist = t.artist && !/^unknown artist$/i.test(t.artist) ? t.artist : '';
    const spoken = artist ? `${t.title}, ${artist}` : t.title;
    return this.announce(spoken, artist || undefined, t.title);
  }

  private announceBattery() {
    const { level } = this.env.battery();
    let msg: string;
    if (level >= 0.95) msg = 'Battery full';
    else if (level >= 0.7) msg = 'Battery 75%';
    else if (level >= 0.45) msg = 'Battery 50%';
    else if (level >= 0.2) msg = 'Battery 25%';
    else msg = 'Battery low';
    const c = this.batteryColor();
    this.flash(blink(c, 1, Math.min(2400, 600 + msg.length * 60)));
    return this.announce(msg.replace('%', ' percent'), undefined, msg);
  }

  // ------------------------------------------------------------ playlist menu

  private buildMenu(): MenuItem[] {
    const tracks = useLibrary.getState().tracks;
    const items: MenuItem[] = [];
    const all = songs(tracks).map((t) => t.id);
    if (all.length) items.push({ label: 'All Songs', ids: all });
    for (const p of this.env.playlists()) {
      if (p.onTheGo) continue;
      const ids = playlistTracks(tracks, p);
      if (ids.length) items.push({ label: p.name, hint: 'Playlist', ids });
    }
    for (const mix of geniusMixes(tracks)) items.push({ label: mix.name, hint: 'Genius Mix', ids: mix.trackIds });
    for (const show of podcasts(tracks)) items.push({ label: show.name, hint: 'Podcast', ids: show.trackIds });
    const books = audiobooks(tracks).map((t) => t.id);
    if (books.length) items.push({ label: 'Audiobooks', ids: books });
    return items;
  }

  private enterMenu() {
    const items = this.buildMenu();
    if (!items.length) {
      this.flash(blink('orange', 3));
      void this.announce('No songs');
      return;
    }
    this.voSeq++;
    this.beginVo();
    const last = useSettings.getState().device[this.env.modelId]?.list as string | undefined;
    const start = Math.max(0, items.findIndex((i) => i.label === last));
    const m = { items, index: start, timer: 0 };
    this.menu = m;
    useS4.setState({ menu: true });
    // the tone that says "you're in the playlist menu"
    playTone(660, 90, { volume: 0.12 });
    playTone(990, 120, { volume: 0.12, delayMs: 110 });
    this.showCaption('Playlists', 'Playlist menu');
    m.timer = window.setTimeout(() => this.speakItem(start), 420);
  }

  private async speakItem(i: number) {
    const m = this.menu;
    if (!m) return;
    window.clearTimeout(m.timer);
    m.index = i;
    const item = m.items[i];
    const seq = ++this.voSeq;
    this.showCaption(item.label, `${item.hint ? `${item.hint} · ` : ''}${i + 1} of ${m.items.length}`);
    const ok = await speak(item.label, this.speechVolume());
    if (!ok || seq !== this.voSeq || this.menu !== m) return;
    m.timer = window.setTimeout(() => {
      if (this.menu !== m) return;
      if (i + 1 < m.items.length) void this.speakItem(i + 1);
      else this.exitMenu(true);
    }, 650);
  }

  private menuMove(d: 1 | -1) {
    const m = this.menu;
    if (!m) return;
    const n = m.items.length;
    void this.speakItem((m.index + d + n) % n);
  }

  private menuSelect() {
    const m = this.menu;
    if (!m) return;
    const item = m.items[m.index];
    window.clearTimeout(m.timer);
    this.menu = null;
    useS4.setState({ menu: false });
    this.endVo(false);
    this.showCaption(item.label, 'Playing');
    this.hideCaption(1400);
    useSettings.getState().setDevice(this.env.modelId, 'list', item.label);
    playTone(880, 80, { volume: 0.1 });
    this.playList(item.ids);
    this.flash(blink('green', 1, 900));
  }

  private exitMenu(resume: boolean) {
    const m = this.menu;
    if (!m) return;
    window.clearTimeout(m.timer);
    this.menu = null;
    useS4.setState({ menu: false });
    playTone(990, 80, { volume: 0.1 });
    playTone(660, 110, { volume: 0.1, delayMs: 100 });
    this.endVo(resume);
  }
}
