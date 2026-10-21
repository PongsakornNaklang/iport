/**
 * Building blocks shared by the media apps: track lists, album headers,
 * the "Now Playing" nav button and page spec.
 */
import type { ReactNode } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { useLibrary } from '../../../core/library/store';
import { player, usePlayer } from '../../../core/player/player';
import { formatTime, indexLetter } from '../../../core/util/format';
import type { Track } from '../../../core/types';
import { Glyph } from '../os/icons';
import { useNav, useTint, type PageSpec } from '../os/Nav';
import { Row, trackSubtitle } from '../os/ui';
import { NowPlaying } from './NowPlaying';

export const MUSIC_TINT = '#ff2d55';

export function nowPlayingSpec(): PageSpec {
  return { title: 'Now Playing', kind: 'nowplaying', bar: false, node: <NowPlaying />, theme: 'dark', bg: '#fff' };
}

/** Animated "now playing" bars in the nav bar. */
export function NowPlayingButton() {
  const current = usePlayer((s) => s.currentId);
  const status = usePlayer((s) => s.status);
  const nav = useNav();
  const tint = useTint();
  if (!current) return null;
  return (
    <button className="n7-npbtn" onClick={() => nav.push(nowPlayingSpec())} aria-label="Now Playing">
      <Glyph.eqBars size={16} color={tint} animate={status === 'playing'} />
    </button>
  );
}

/**
 * player.playTracks, making sure playback starts on the chosen item.
 * (Works around the shared player starting at index 0 when shuffle is off;
 * a no-op once that is fixed.)
 */
export function startPlayback(ids: string[], i: number, opts: { shuffle?: boolean; startAt?: number } = {}) {
  player.playTracks(ids, i, opts);
  if (opts.shuffle) return;
  const want = ids[i];
  const s = usePlayer.getState();
  if (want && s.queue[s.index] !== want) {
    const j = s.queue.indexOf(want);
    if (j >= 0) player.jumpTo(j);
  }
}

/** Start playing `ids` at `i` and show Now Playing. */
export function usePlayList() {
  const nav = useNav();
  return (ids: string[], i: number, opts: { shuffle?: boolean } = {}) => {
    startPlayback(ids, i, opts);
    nav.push(nowPlayingSpec());
  };
}

export function ShuffleRow({ ids }: { ids: string[] }) {
  const play = usePlayList();
  if (ids.length < 2) return null;
  return <Row title="Shuffle" icon={<Glyph.shuffle size={18} />} tinted onClick={() => play(ids, 0, { shuffle: true })} />;
}

function Speaker({ on }: { on: boolean }) {
  const tint = useTint();
  if (!on) return null;
  return (
    <span style={{ position: 'absolute', left: 3, top: '50%', marginTop: -6 }}>
      <Glyph.volHigh size={12} color={tint} />
    </span>
  );
}

/** A list of songs. `mode` decides what each row shows. */
export function TrackList({ ids, mode = 'song', letters }: { ids: string[]; mode?: 'song' | 'album' | 'plain' | 'art'; letters?: boolean }) {
  const tracks = useLibrary((s) => s.tracks);
  const current = usePlayer((s) => s.currentId);
  const play = usePlayList();
  const rows: ReactNode[] = [];
  let lastLetter = '';
  ids.forEach((id, i) => {
    const t = tracks[id];
    if (!t) return;
    if (letters) {
      const L = indexLetter(t.title);
      if (L !== lastLetter) {
        lastLetter = L;
        rows.push(
          <div key={`L${L}`} className="n7-letter">
            {L}
          </div>,
        );
      }
    }
    rows.push(<TrackRow key={id} t={t} mode={mode} n={i + 1} playing={current === id} onClick={() => play(ids, i)} />);
  });
  return <>{rows}</>;
}

export function TrackRow({ t, mode, n, playing, onClick }: { t: Track; mode: 'song' | 'album' | 'plain' | 'art'; n: number; playing: boolean; onClick: () => void }) {
  if (mode === 'album') {
    return (
      <Row
        className="n7-albumtrack"
        left={<span className="n7-trackno">{playing ? <Glyph.volHigh size={12} color="var(--tint)" /> : t.trackNo ?? n}</span>}
        title={t.title}
        detail={formatTime(t.duration)}
        onClick={onClick}
      />
    );
  }
  if (mode === 'art') {
    return <Row art={t.artwork} title={t.title} subtitle={trackSubtitle(t.artist, t.album)} onClick={onClick} left={<Speaker on={playing} />} />;
  }
  return (
    <Row
      title={t.title}
      subtitle={mode === 'song' ? trackSubtitle(t.artist, t.album) : undefined}
      onClick={onClick}
      left={<Speaker on={playing} />}
      className="n7-songrow"
    />
  );
}

export function AlbumHeader({ art, title, artist, meta }: { art?: string; title: string; artist?: string; meta?: string }) {
  return (
    <div className="n7-albumhead">
      <Artwork src={art} size={76} radius={2} />
      <div className="n7-albumhead-text">
        <div className="n7-albumhead-title">{title}</div>
        {artist && <div className="n7-albumhead-artist">{artist}</div>}
        {meta && <div className="n7-albumhead-meta">{meta}</div>}
      </div>
    </div>
  );
}

export function minutes(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m} Min${m === 1 ? '' : 's'}`;
}
