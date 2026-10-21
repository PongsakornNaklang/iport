/**
 * FM Radio. The nano 7G's tuner, mapped onto the library's internet radio
 * stations: every station gets a frequency on the dial. Between stations you
 * hear static. Pausing shows Live Pause (how far behind live you are).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { useLibrary } from '../../../core/library/store';
import { radioStations } from '../../../core/library/selectors';
import { getAudioContext } from '../../../core/player/audioGraph';
import { effectiveVolume, player, usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { formatTime } from '../../../core/util/format';
import { useNow } from '../../../core/util/hooks';
import { hash } from '../../../core/util/id';
import type { Track } from '../../../core/types';
import { nano, useNanoData, type RadioRegion } from '../state';
import { clamp, tween, useDrag } from '../os/gesture';
import { Glyph } from '../os/icons';
import { NavStack, useNav } from '../os/Nav';
import { Empty, Page, Row, Slider } from '../os/ui';
import { useAppNav } from './registry';

const TINT = '#ff2d55';
const PX_PER_MHZ = 70;

interface Band {
  min: number;
  max: number;
  step: number;
}
export function bandOf(r: RadioRegion): Band {
  if (r === 'americas') return { min: 87.9, max: 107.9, step: 0.2 };
  if (r === 'japan') return { min: 76.0, max: 95.0, step: 0.1 };
  return { min: 87.5, max: 108.0, step: 0.1 };
}
const snap = (f: number, b: Band) => clamp(Math.round((f - b.min) / b.step) * b.step + b.min, b.min, b.max);
const fmt = (f: number) => f.toFixed(1);

/** Library stations (or, failing that, streams that look like radio) placed on the dial. */
function useStations(): { freq: number; track: Track }[] {
  const tracks = useLibrary((s) => s.tracks);
  const region = useNanoData((s) => s.radioRegion);
  return useMemo(() => {
    let list = radioStations(tracks);
    if (!list.length) list = Object.values(tracks).filter((t) => /\bradio\b|24\/7|\blive\b/i.test(`${t.title} ${t.album}`));
    const b = bandOf(region);
    const slots = Math.round((b.max - b.min) / b.step) + 1;
    const used = new Set<number>();
    return [...list]
      .sort((a, b2) => a.id.localeCompare(b2.id))
      .map((t) => {
        let slot = parseInt(hash(t.id + region), 36) % slots;
        // keep stations at least 0.6 MHz apart, like real ones
        const near = (s: number) => [...used].some((u) => Math.abs(u - s) * b.step < 0.6);
        let guard = 0;
        while (near(slot) && guard++ < slots) slot = (slot + 7) % slots;
        used.add(slot);
        return { freq: Math.round((b.min + slot * b.step) * 10) / 10, track: t };
      })
      .sort((a, b2) => a.freq - b2.freq);
  }, [tracks, region]);
}

// ---------------------------------------------------------------- radio state + static

interface RadioState {
  on: boolean;
  /** epoch ms when paused (Live Pause) */
  pausedAt: number | null;
  /** seconds behind live after resuming from a pause */
  behind: number;
}
const useRadio = create<RadioState>(() => ({ on: false, pausedAt: null, behind: 0 }));

let noise: { src: AudioBufferSourceNode; gain: GainNode; timer: number } | null = null;
function startStatic() {
  if (noise) return;
  try {
    const c = getAudioContext();
    if (c.state === 'suspended') void c.resume();
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.6 + w * 0.4; // a little pink-ish
      d[i] = last + (Math.random() < 0.0006 ? (Math.random() - 0.5) * 3 : 0); // crackles
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.5;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(bp).connect(gain).connect(c.destination);
    src.start();
    const level = () => 0.11 * effectiveVolume() * (0.85 + Math.random() * 0.3);
    gain.gain.setTargetAtTime(level(), c.currentTime, 0.05);
    const timer = window.setInterval(() => gain.gain.setTargetAtTime(level(), c.currentTime, 0.08), 180);
    noise = { src, gain, timer };
  } catch {
    /* no audio */
  }
}
function stopStatic() {
  if (!noise) return;
  const n = noise;
  noise = null;
  window.clearInterval(n.timer);
  try {
    const c = getAudioContext();
    n.gain.gain.setTargetAtTime(0, c.currentTime, 0.03);
    window.setTimeout(() => n.src.stop(), 150);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- app

export function RadioApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('radio');
  return <NavStack root={{ title: 'Radio', node: <Tuner active={active} />, bar: false, theme: 'light', bg: '#121214' }} tint={TINT} active={active} apiRef={apiRef} />;
}

function Tuner({ active }: { active: boolean }) {
  const nav = useNav();
  const region = useNanoData((s) => s.radioRegion);
  const band = bandOf(region);
  const saved = useNanoData((s) => s.radioFreq);
  const favorites = useNanoData((s) => s.radioFavorites);
  const stations = useStations();
  const [freq, setFreqState] = useState(() => snap(saved, band));
  const freqRef = useRef(freq);
  const on = useRadio((s) => s.on);
  const pausedAt = useRadio((s) => s.pausedAt);
  const currentId = usePlayer((s) => s.currentId);
  const status = usePlayer((s) => s.status);
  const volume = useSettings((s) => s.volume);
  const scale = useRef<HTMLDivElement>(null);
  const cancel = useRef<null | (() => void)>(null);

  const station = stations.find((s) => Math.abs(s.freq - freq) < 0.05);
  const isFav = favorites.some((f) => Math.abs(f - freq) < 0.05);

  const setFreq = (f: number) => {
    freqRef.current = f;
    setFreqState(f);
    if (scale.current) scale.current.style.transform = `translate3d(${(-(f - band.min) * PX_PER_MHZ).toFixed(1)}px,0,0)`;
  };
  useEffect(() => {
    setFreq(snap(saved, band));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  const commit = (f: number) => {
    const s = snap(f, band);
    useNanoData.getState().set('radioFreq', s);
    const recent = [s, ...useNanoData.getState().radioRecent.filter((x) => Math.abs(x - s) > 0.05)].slice(0, 12);
    useNanoData.getState().set('radioRecent', recent);
    if (!useRadio.getState().on) useRadio.setState({ on: true, pausedAt: null, behind: 0 });
  };

  const glideTo = (target: number) => {
    cancel.current?.();
    const t = snap(target, band);
    cancel.current = tween(freqRef.current, t, clamp(Math.abs(t - freqRef.current) * 160, 180, 900), setFreq, () => commit(t));
  };

  // the radio drives the shared player: station → stream, between stations → static
  const stationTrackIds = useMemo(() => new Set(stations.map((s) => s.track.id)), [stations]);
  useEffect(() => {
    if (!on || pausedAt) {
      stopStatic();
      return;
    }
    if (station) {
      stopStatic();
      if (currentId !== station.track.id) player.playTracks([station.track.id], 0);
    } else {
      if (currentId && stationTrackIds.has(currentId) && (status === 'playing' || status === 'loading')) player.pause();
      if (active) startStatic();
      else stopStatic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, pausedAt, station?.track.id, active]);

  // music started elsewhere: the radio turns off
  useEffect(() => {
    if (on && currentId && !stationTrackIds.has(currentId)) {
      useRadio.setState({ on: false, pausedAt: null, behind: 0 });
      stopStatic();
    }
  }, [currentId, on, stationTrackIds]);

  useEffect(() => () => stopStatic(), []);

  const base = useRef(0);
  const drag = useDrag({
    axis: 'x',
    onStart: () => {
      cancel.current?.();
      base.current = freqRef.current;
    },
    onMove: (d) => setFreq(clamp(base.current - d.dx / PX_PER_MHZ, band.min, band.max)),
    onEnd: (d, moved) => {
      if (!moved) return;
      const fling = clamp(-d.velocity * 260, -260, 260) / PX_PER_MHZ;
      glideTo(clamp(freqRef.current + fling, band.min, band.max));
    },
  });

  const seek = (dir: 1 | -1) => {
    if (!stations.length) {
      glideTo(freqRef.current + dir * band.step);
      return;
    }
    const f = freqRef.current;
    const list = dir > 0 ? stations.filter((s) => s.freq > f + 0.05) : stations.filter((s) => s.freq < f - 0.05).reverse();
    glideTo((list[0] ?? (dir > 0 ? stations[0] : stations[stations.length - 1])).freq);
  };

  const toggle = () => {
    const r = useRadio.getState();
    if (!r.on) {
      useRadio.setState({ on: true, pausedAt: null, behind: 0 });
      return;
    }
    if (r.pausedAt) {
      useRadio.setState({ pausedAt: null, behind: r.behind + (Date.now() - r.pausedAt) / 1000 });
      if (station) player.play();
    } else {
      useRadio.setState({ pausedAt: Date.now() });
      if (station) player.pause();
    }
  };

  const toggleFav = () => {
    const f = snap(freqRef.current, band);
    const favs = useNanoData.getState().radioFavorites;
    const next = isFav ? favs.filter((x) => Math.abs(x - f) > 0.05) : [...favs, f].sort((a, b) => a - b);
    useNanoData.getState().set('radioFavorites', next);
    nano.toast(isFav ? 'Removed from Favorites' : 'Added to Favorites');
  };

  const width = (band.max - band.min) * PX_PER_MHZ;
  const ticks = useMemo(() => {
    const out: ReactNode[] = [];
    const n = Math.round((band.max - band.min) / 0.1);
    for (let i = 0; i <= n; i++) {
      const f = band.min + i * 0.1;
      const whole = Math.abs(f - Math.round(f)) < 0.01;
      const half = Math.abs(f * 2 - Math.round(f * 2)) < 0.01;
      const x = i * 0.1 * PX_PER_MHZ;
      out.push(<line key={i} x1={x} x2={x} y1={whole ? 18 : half ? 26 : 31} y2={40} stroke={whole ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth={whole ? 1.5 : 1} />);
      if (whole && Math.round(f) % 2 === 0)
        out.push(
          <text key={`t${i}`} x={x} y={56} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.75)" fontFamily="-apple-system, Helvetica, Arial">
            {Math.round(f)}
          </text>,
        );
    }
    return out;
  }, [band.min, band.max]);

  const playing = on && !pausedAt;
  const signal = station ? 4 : stations.some((s) => Math.abs(s.freq - freq) < 0.45) ? 1 : 0;

  return (
    <div className="n7-radio">
      <div className="n7-radio-head">
        <button onClick={() => nav.push({ title: 'Radio', node: <StationsPage stations={stations} onTune={glideTo} /> })} aria-label="Stations">
          <Glyph.list size={17} color="#fff" />
        </button>
        <div className="n7-radio-band">
          FM
          <span className="n7-radio-signal">
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className={i < signal ? 'on' : ''} style={{ height: 3 + i * 2 }} />
            ))}
          </span>
        </div>
        <button onClick={toggleFav} aria-label="Favorite">
          <Glyph.star size={18} color={isFav ? '#ffcc00' : '#fff'} filled={isFav} />
        </button>
      </div>
      <div className="n7-radio-freq">
        {fmt(freq)}
        <span>MHz</span>
      </div>
      <div className="n7-radio-rds">
        {station ? (
          <>
            <div className="n7-radio-name">{station.track.title}</div>
            <div className="n7-radio-song">{station.track.artist}</div>
          </>
        ) : (
          <div className="n7-radio-song">{on ? 'No Station' : ' '}</div>
        )}
      </div>
      <div className="n7-radio-dial" data-noswipe {...drag}>
        <div className="n7-radio-scale" ref={scale} style={{ width, transform: `translate3d(${-(freq - band.min) * PX_PER_MHZ}px,0,0)` }}>
          <svg width={width + 2} height="64" style={{ overflow: 'visible' }}>
            {ticks}
            {stations.map((s) => (
              <circle key={s.track.id} cx={(s.freq - band.min) * PX_PER_MHZ} cy={9} r={2.3} fill="rgba(255,255,255,0.8)" />
            ))}
            {favorites.map((f) => (
              <path key={`f${f}`} d="M0-4l1.2 2.6 2.8.3-2.1 1.9.6 2.8L0 2.2-2.5 3.6l.6-2.8L-4-1.1l2.8-.3z" fill="#ffcc00" transform={`translate(${(f - band.min) * PX_PER_MHZ} 9)`} />
            ))}
          </svg>
        </div>
        <div className="n7-radio-needle" />
        <div className="n7-radio-fade" />
      </div>
      <div className="n7-radio-ctrls">
        <button onClick={() => seek(-1)} aria-label="Previous station">
          <Glyph.prev size={24} color="#fff" />
        </button>
        <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Glyph.pause size={30} color="#fff" /> : <Glyph.play size={30} color="#fff" />}
        </button>
        <button onClick={() => seek(1)} aria-label="Next station">
          <Glyph.next size={24} color="#fff" />
        </button>
      </div>
      <LivePause station={!!station} />
      <Slider
        className="n7-radio-vol"
        value={volume}
        onChange={(v) => player.setVolume(v)}
        min={<Glyph.volLow size={13} color="rgba(255,255,255,0.6)" />}
        max={<Glyph.volHigh size={14} color="rgba(255,255,255,0.6)" />}
        color="#fff"
        knob={16}
      />
      <div className="n7-radio-bottom">
        {(
          [
            ['local', 'Local Stations'],
            ['fav', 'Favorites'],
            ['recent', 'Recent'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => nav.push({ title: 'Radio', node: <StationsPage stations={stations} onTune={glideTo} initial={k} /> })}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function LivePause({ station }: { station: boolean }) {
  const pausedAt = useRadio((s) => s.pausedAt);
  const behind = useRadio((s) => s.behind);
  const on = useRadio((s) => s.on);
  const now = useNow(500);
  const lag = behind + (pausedAt ? (now.getTime() - pausedAt) / 1000 : 0);
  const maxLag = 15 * 60;
  const p = clamp(1 - lag / maxLag, 0, 1);
  const goLive = () => {
    useRadio.setState({ pausedAt: null, behind: 0 });
    const id = usePlayer.getState().currentId;
    if (station && id) player.playTracks([id], 0);
  };
  return (
    <div className={`n7-livepause ${lag > 0.5 ? 'on' : ''}`} data-noswipe>
      <span className="n7-lp-t">{lag > 0.5 ? `-${formatTime(lag)}` : on ? 'LIVE' : ''}</span>
      <div className="n7-lp-bar">
        <div className="n7-lp-buffer" />
        <div className="n7-lp-pos" style={{ left: `${p * 100}%` }} />
      </div>
      <button className="n7-lp-live" onClick={goLive} disabled={lag <= 0.5}>
        Live
      </button>
    </div>
  );
}

type Tab = 'local' | 'fav' | 'recent';
function StationsPage({ stations, onTune, initial = 'local' }: { stations: { freq: number; track: Track }[]; onTune: (f: number) => void; initial?: Tab }) {
  const nav = useNav();
  const favorites = useNanoData((s) => s.radioFavorites);
  const recent = useNanoData((s) => s.radioRecent);
  const [tab, setTab] = useState<Tab>(initial);
  const name = (f: number) => stations.find((s) => Math.abs(s.freq - f) < 0.05)?.track.title;
  const tune = (f: number) => {
    nav.pop();
    window.setTimeout(() => onTune(f), 250);
  };
  const list = tab === 'local' ? stations.map((s) => s.freq) : tab === 'fav' ? favorites : recent;
  return (
    <>
      <div className="n7-radio-tabs">
        {(
          [
            ['local', 'Local Stations'],
            ['fav', 'Favorites'],
            ['recent', 'Recent'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 34, left: 0, right: 0, bottom: 0 }}>
        {list.length === 0 ? (
          <Empty
            title={tab === 'local' ? 'No Stations' : tab === 'fav' ? 'No Favorites' : 'No Recent Stations'}
            text={tab === 'local' ? 'Add internet radio stations in the Library panel — each one gets its own frequency.' : tab === 'fav' ? 'Tap ☆ on the tuner to save a station.' : undefined}
          />
        ) : (
          <Page>
            {list.map((f) => (
              <Row key={f} left={<span className="n7-radio-listfreq">{fmt(f)}</span>} title={name(f) ?? 'FM'} subtitle={name(f) ? stations.find((s) => Math.abs(s.freq - f) < 0.05)?.track.artist : 'No station'} onClick={() => tune(f)} />
            ))}
          </Page>
        )}
      </div>
    </>
  );
}
