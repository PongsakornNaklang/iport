import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Artwork } from '../../../core/library/Artwork';
import { geniusPlaylist } from '../../../core/library/selectors';
import { useLibrary } from '../../../core/library/store';
import { activeLine, useLyrics } from '../../../core/lyrics';
import { player, useCurrentTrack, usePlayer } from '../../../core/player/player';
import { AUDIOBOOK_RATES, useSettings, type AudiobookSpeed } from '../../../core/settings/store';
import { formatTime } from '../../../core/util/format';
import { nano, useNanoData } from '../state';
import { useArtOverlay } from '../os/context';
import { clamp, useDrag } from '../os/gesture';
import { Glyph } from '../os/icons';
import { Chevron, useNav, usePage, useTint } from '../os/Nav';
import { ScrollView, type ScrollApi } from '../os/ScrollView';
import { Row, Slider } from '../os/ui';
import { t as tr } from '../os/i18n';

function Marquee({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [dist, setDist] = useState(0);
  useLayoutEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const over = i.scrollWidth - b.clientWidth;
    setDist(over > 2 ? over + 24 : 0);
  }, [text]);
  return (
    <div ref={box} className={`n7-marquee ${className ?? ''}`}>
      <span
        ref={inner}
        className={dist ? 'run' : ''}
        style={dist ? { ['--d' as string]: `-${dist}px`, animationDuration: `${Math.max(6, dist / 18 + 4)}s` } : undefined}
      >
        {text}
      </span>
    </div>
  );
}

function Scrubber({ position, duration, live }: { position: number; duration: number; live: boolean }) {
  const tint = useTint();
  const [scrub, setScrub] = useState<number | null>(null);
  const val = useRef(0);
  const track = useRef<HTMLDivElement>(null);
  const frac = (lx: number) => clamp(lx / Math.max(1, track.current?.offsetWidth ?? 1), 0, 1);
  const drag = useDrag({
    axis: 'x',
    immediate: true,
    onStart: (d) => {
      val.current = frac(d.lx);
      setScrub(val.current);
    },
    onMove: (d) => {
      val.current = frac(d.lx);
      setScrub(val.current);
    },
    onEnd: () => {
      if (duration > 0) player.seek(val.current * duration);
      setScrub(null);
    },
  });
  const p = scrub ?? (duration > 0 ? clamp(position / duration, 0, 1) : 0);
  const pos = scrub != null ? scrub * duration : position;
  return (
    <div className={`n7-scrub ${scrub != null ? 'active' : ''}`} data-noswipe>
      <span className="n7-scrub-t">{formatTime(pos)}</span>
      <div className="n7-scrub-track" ref={track} {...(live ? {} : drag)}>
        <div className="n7-scrub-rail" />
        <div className="n7-scrub-fill" style={{ width: `${p * 100}%`, background: tint }} />
        {!live && <div className="n7-scrub-head" style={{ left: `${p * 100}%`, background: tint }} />}
      </div>
      <span className="n7-scrub-t">{live ? 'Live' : `-${formatTime(Math.max(0, duration - pos))}`}</span>
    </div>
  );
}

/** Press: tap = action, hold = scan (fast-forward / rewind). */
function ScanButton({ onTap, scan, children, label }: { onTap: () => void; scan: number; children: React.ReactNode; label: string }) {
  const st = useRef({ t: 0, iv: 0, scanned: false });
  const down = () => {
    const s = st.current;
    s.scanned = false;
    s.t = window.setTimeout(() => {
      s.scanned = true;
      player.seekBy(scan);
      s.iv = window.setInterval(() => player.seekBy(scan), 220);
    }, 450);
  };
  const up = () => {
    const s = st.current;
    window.clearTimeout(s.t);
    window.clearInterval(s.iv);
  };
  return (
    <button
      className="n7-np-btn"
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onClick={() => {
        if (!st.current.scanned) onTap();
      }}
    >
      {children}
    </button>
  );
}

const SPEEDS: AudiobookSpeed[] = ['normal', 'faster', 'slower'];

export function NowPlaying() {
  const { top, active, settled } = usePage();
  const nav = useNav();
  const tint = useTint();
  const track = useCurrentTrack();
  const currentId = usePlayer((s) => s.currentId);
  const status = usePlayer((s) => s.status);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const index = usePlayer((s) => s.index);
  const qlen = usePlayer((s) => s.queue.length);
  const shuffle = useSettings((s) => s.shuffle);
  const repeat = useSettings((s) => s.repeat);
  const volume = useSettings((s) => s.volume);
  const limit = useSettings((s) => s.volumeLimit);
  const speed = useSettings((s) => s.audiobookSpeed);
  const lyricsInfo = useNanoData((s) => s.lyricsInfo);
  const overlay = useArtOverlay();
  const [info, setInfo] = useState(false);
  const [lyricsOn, setLyricsOn] = useState(false);
  const { plain, lines, loading } = useLyrics(track, lyricsOn);
  const lyricScroll = useRef<ScrollApi>(null);
  const lineIdx = lines ? activeLine(lines, position) : -1;

  const visible = settled && active;
  useEffect(() => {
    if (!visible) return;
    nano.claimArt(1);
    return () => nano.claimArt(-1);
  }, [visible]);

  // Playback reached the end of the list: Now Playing goes away.
  const had = useRef(!!currentId);
  useEffect(() => {
    if (currentId) had.current = true;
    else if (had.current && top) nav.pop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  useEffect(() => {
    if (lines && lineIdx >= 0) lyricScroll.current?.scrollTo(Math.max(0, lineIdx * 19 - 70), true);
  }, [lineIdx, lines]);

  const playing = status === 'playing' || status === 'loading';
  const spoken = track?.mediaType === 'podcast' || track?.mediaType === 'audiobook';
  const live = !!track && (track.mediaType === 'radio' || (!duration && playing));
  const rating = track?.rating ?? 0;

  const more = () => {
    if (!track) return;
    const acts = [];
    if (track.mediaType === 'music' || track.mediaType === 'musicvideo') {
      acts.push({
        label: 'Genius Playlist',
        onSelect: () => {
          const ids = geniusPlaylist(useLibrary.getState().tracks, track.id);
          if (ids.length > 1) {
            player.playTracks(ids, 0);
            nano.toast('Genius Playlist');
          } else nano.toast('Not enough songs for Genius');
        },
      });
      acts.push({ label: lyricsOn ? 'Hide Lyrics' : 'Show Lyrics', onSelect: () => setLyricsOn((v) => !v) });
    }
    acts.push({
      label: 'Add to On-The-Go',
      onSelect: () => {
        useLibrary.getState().addToOnTheGo([track.id]);
        nano.toast('Added to On-The-Go');
      },
    });
    if (spoken) {
      acts.push({
        label: `Play Speed: ${AUDIOBOOK_RATES[speed]}×`,
        onSelect: () => useSettings.getState().set('audiobookSpeed', SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]),
      });
    }
    acts.push({
      label: usePlayer.getState().sleepAt ? 'Cancel Sleep Timer' : 'Sleep Timer…',
      onSelect: () => {
        if (usePlayer.getState().sleepAt) {
          player.setSleepTimer(null);
          return;
        }
        nano.sheet(
          [15, 30, 60, 120].map((m) => ({
            label: m < 60 ? `${m} Minutes` : `${m / 60} Hour${m > 60 ? 's' : ''}`,
            onSelect: () => {
              player.setSleepTimer(m);
              nano.toast(`Sleep in ${m} min`);
            },
          })),
          'Pause playback after',
        );
      },
    });
    nano.sheet(acts, track.title);
  };

  const art = (
    <div className="n7-np-art" onClick={() => setInfo((v) => !v)}>
      <Artwork src={track?.artwork} size={240} />
    </div>
  );

  const overlayUi =
    visible && overlay
      ? createPortal(
          <>
            <button className="n7-np-corner left" onClick={() => nav.pop()} aria-label="Back">
              <Chevron size={13} color="#fff" weight={2.6} />
            </button>
            <button className="n7-np-corner right" onClick={() => nav.push({ title: 'Up Next', node: <UpNext />, theme: 'dark' })} aria-label="Track list">
              <Glyph.list size={14} color="#fff" />
            </button>
            {info && !lyricsOn && (
              <>
                <div className="n7-np-info-top">
                  {tr('Song')} {index + 1} of {qlen}
                </div>
                <div className="n7-np-info-bottom" data-noswipe>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => track && useLibrary.getState().setRating(track.id, rating === n ? n - 1 : n)}>
                      <Glyph.star size={19} color="#fff" filled={n <= rating} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {lyricsOn && lyricsInfo && (
              <div className="n7-np-lyrics" data-noswipe onClick={() => setLyricsOn(false)}>
                <ScrollView ref={lyricScroll} indicator={false}>
                  <div className="n7-np-lyrics-body">
                    {lines
                      ? lines.map((l, i) => (
                          <div key={i} className={i === lineIdx ? 'on' : ''}>
                            {l.text || '♪'}
                          </div>
                        ))
                      : plain
                        ? plain.split('\n').map((l, i) => <div key={i}>{l || ' '}</div>)
                        : <div className="n7-np-lyrics-none">{loading ? 'Loading lyrics…' : 'No lyrics available'}</div>}
                  </div>
                </ScrollView>
              </div>
            )}
          </>,
          overlay,
        )
      : null;

  return (
    <div className="n7-np" style={{ ['--tint' as string]: tint } as React.CSSProperties}>
      {art}
      {overlayUi}
      <Scrubber position={position} duration={duration} live={live} />
      <div className="n7-np-titles">
        <Marquee className="n7-np-title" text={track?.title ?? 'Not Playing'} />
        <Marquee className="n7-np-sub" text={track ? [track.artist, track.album].filter(Boolean).join(' — ') : ''} />
      </div>
      <div className="n7-np-ctrls">
        {spoken && (
          <button className="n7-np-btn small" onClick={() => player.seekBy(-15)} aria-label="Back 15 seconds">
            <Glyph.replay size={22} color="#111" n={15} />
          </button>
        )}
        <ScanButton onTap={() => player.prev()} scan={-6} label="Previous">
          <Glyph.prev size={26} color="#111" />
        </ScanButton>
        <button className="n7-np-btn play" onClick={() => player.toggle()} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Glyph.pause size={30} color="#111" /> : <Glyph.play size={30} color="#111" />}
        </button>
        <ScanButton onTap={() => player.next()} scan={6} label="Next">
          <Glyph.next size={26} color="#111" />
        </ScanButton>
        {spoken && (
          <button className="n7-np-btn small" onClick={() => player.seekBy(30)} aria-label="Forward 30 seconds">
            <Glyph.forward size={22} color="#111" n={30} />
          </button>
        )}
      </div>
      <Slider
        className="n7-np-vol"
        value={Math.min(volume, limit) / (limit || 1)}
        onChange={(v) => player.setVolume(v * limit)}
        min={<Glyph.volLow size={13} color="#8e8e93" />}
        max={<Glyph.volHigh size={14} color="#8e8e93" />}
        color="#111"
        knob={16}
      />
      <div className="n7-np-modes">
        <button className={repeat !== 'off' ? 'on' : ''} onClick={() => player.cycleRepeat()}>
          {repeat === 'one' ? 'Repeat 1' : repeat === 'all' ? 'Repeat All' : 'Repeat'}
        </button>
        <button onClick={more}>More</button>
        <button className={shuffle !== 'off' ? 'on' : ''} onClick={() => player.cycleShuffle()}>
          {shuffle === 'albums' ? 'Albums' : 'Shuffle'}
        </button>
      </div>
    </div>
  );
}

/** The queue ("track list" button on Now Playing). */
function UpNext() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const tracks = useLibrary((s) => s.tracks);
  return (
    <ScrollView className="n7-plain">
      {queue.map((id, i) => {
        const t = tracks[id];
        if (!t) return null;
        return (
          <Row
            key={`${id}-${i}`}
            art={t.artwork}
            title={t.title}
            subtitle={t.artist}
            detail={formatTime(t.duration)}
            className={i === index ? 'n7-row-current' : ''}
            left={i === index ? <span className="n7-upnext-dot" /> : undefined}
            onClick={() => player.jumpTo(i)}
          />
        );
      })}
    </ScrollView>
  );
}
