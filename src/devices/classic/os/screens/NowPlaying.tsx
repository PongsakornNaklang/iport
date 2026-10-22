import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Artwork } from '../../../../core/library/Artwork';
import { useLibrary } from '../../../../core/library/store';
import { activeLine, useLyrics } from '../../../../core/lyrics';
import { player, useCurrentTrack, usePlayer } from '../../../../core/player/player';
import { useDeviceSetting, useSettings } from '../../../../core/settings/store';
import type { ShuffleMode, Track } from '../../../../core/types';
import { formatTime } from '../../../../core/util/format';
import { clamp, useHeader, useInput, useMedia, useOS, useScreen } from '../core';
import { GeniusGlyph, RepeatGlyph, ShuffleGlyph, SpeakerLevel, Star } from '../glyphs';
import { Marquee } from '../ListView';
import { songMenu, startGenius } from './Music';
import { geniusPlaylist } from '../../../../core/library/selectors';
import { t as tx } from '../i18n';

type Mode = 'progress' | 'scrub' | 'genius' | 'rating' | 'shuffle' | 'lyrics';

export function isVideoTrack(t: Track | undefined): boolean {
  if (!t) return false;
  return t.mediaType === 'movie' || t.mediaType === 'tvshow' || t.mediaType === 'musicvideo' || (t.source === 'local' && !!t.hasVideo);
}

export function NowPlaying({ video }: { video?: boolean }) {
  const os = useOS();
  const { active } = useScreen();
  const t = useCurrentTrack();
  const currentId = usePlayer((s) => s.currentId);

  // the iPod leaves Now Playing when the list ends
  const hadTrack = useRef(!!currentId);
  useEffect(() => {
    if (currentId) hadTrack.current = true;
    else if (hadTrack.current && active) os.nav.pop();
  }, [currentId, active, os]);

  if (!t) return <NothingPlaying />;
  if (video || isVideoTrack(t)) return <VideoView t={t} />;
  return <MusicView t={t} />;
}

function NothingPlaying() {
  useHeader('light');
  return (
    <div className="cl-message">
      <b>{tx('Nothing Playing')}</b>
    </div>
  );
}

// ------------------------------------------------------------------ music

function MusicView({ t }: { t: Track }) {
  const os = useOS();
  const { active } = useScreen();
  useHeader('light');
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration) || t.duration || 0;
  const index = usePlayer((s) => s.index);
  const qlen = usePlayer((s) => s.queue.length);
  const status = usePlayer((s) => s.status);
  const kind = usePlayer((s) => s.kind);
  const hasVideo = usePlayer((s) => s.hasVideo);
  const shuffle = useSettings((s) => s.shuffle);
  const repeat = useSettings((s) => s.repeat);
  const volume = useSettings((s) => s.volume);
  const volumeLimit = useSettings((s) => s.volumeLimit);
  const lyrics = useLyrics(t);
  const hasLyrics = !!(lyrics.plain || lyrics.lines);

  const [mode, setMode] = useState<Mode>('progress');
  const [poke, setPoke] = useState(0);
  const [volShown, setVolShown] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [lyricScroll, setLyricScroll] = useState(0);
  /** Genius slider position 0..1 */
  const [slide, setSlide] = useState(0);
  const geniusOK = useMemo(() => os.caps.genius && geniusPlaylist(useLibrary.getState().tracks, t.id).length >= 3, [os.caps.genius, t.id]);
  const scrubTimer = useRef<number | undefined>(undefined);
  const volTimer = useRef<number | undefined>(undefined);

  // back to the progress bar after a few idle seconds
  useEffect(() => {
    if (mode === 'progress' || mode === 'lyrics') return;
    const tm = window.setTimeout(() => setMode('progress'), 6000);
    return () => window.clearTimeout(tm);
  }, [mode, poke]);
  useEffect(() => {
    setMode((m) => (m === 'lyrics' || m === 'genius' ? 'progress' : m));
    setLyricScroll(0);
  }, [t.id]);
  useEffect(() => {
    if (mode !== 'genius') setSlide(0);
  }, [mode]);
  useEffect(
    () => () => {
      window.clearTimeout(scrubTimer.current);
      window.clearTimeout(volTimer.current);
    },
    [],
  );

  const playerError = usePlayer((s) => s.error);
  const showYouTube = active && kind === 'youtube' && hasVideo && status === 'playing' && !playerError;
  // the classic's wide screen: art on the left; a tall one (nano 4G): art on top;
  // a grey LCD (mini): no art, just the text
  const layout = !os.color ? 'text' : os.height > os.width ? 'tall' : 'wide';
  const artSize = layout === 'tall' ? Math.round(os.width * 0.6) : 126;
  const art = layout === 'tall' ? { left: Math.round((os.width - artSize) / 2), top: 12, size: artSize } : { left: 12, top: 14, size: artSize };
  useMedia(showYouTube ? { visible: true, style: { inset: `${os.hdr + art.top}px auto auto ${art.left}px`, width: art.size, height: art.size }, fit: 'cover' } : null);

  useInput((e) => {
    if (e.type === 'scroll') {
      setPoke((p) => p + 1);
      const dir = Math.sign(e.steps);
      switch (mode) {
        case 'progress': {
          player.volumeBy(e.steps / 32);
          setVolShown(true);
          window.clearTimeout(volTimer.current);
          volTimer.current = window.setTimeout(() => setVolShown(false), 1600);
          break;
        }
        case 'scrub': {
          const step = Math.max(1, duration / 100) * (e.velocity > 20 ? 3 : 1);
          setScrub((s) => {
            const v = clamp((s ?? usePlayer.getState().position) + e.steps * step, 0, Math.max(0, duration - 0.5));
            window.clearTimeout(scrubTimer.current);
            scrubTimer.current = window.setTimeout(() => {
              player.seek(v);
              setScrub(null);
            }, 350);
            return v;
          });
          break;
        }
        case 'genius': {
          if (!geniusOK) break;
          const v = clamp(slide + e.steps / 9, 0, 1);
          setSlide(v);
          if (v >= 1) {
            setMode('progress');
            startGenius(os, t.id);
          }
          break;
        }
        case 'rating': {
          const cur = useLibrary.getState().tracks[t.id]?.rating ?? 0;
          useLibrary.getState().setRating(t.id, clamp(cur + dir, 0, 5));
          break;
        }
        case 'shuffle': {
          const modes: ShuffleMode[] = ['off', 'songs', 'albums'];
          const i = modes.indexOf(useSettings.getState().shuffle);
          player.setShuffle(modes[clamp(i + dir, 0, 2)]);
          break;
        }
        case 'lyrics':
          setLyricScroll((s) => Math.max(0, s + e.steps));
          break;
      }
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      setPoke((p) => p + 1);
      setVolShown(false);
      setMode((m) => {
        if (m === 'progress') return 'scrub';
        if (m === 'scrub') return os.caps.genius ? 'genius' : 'rating';
        if (m === 'genius') return 'rating';
        if (m === 'rating') return 'shuffle';
        if (m === 'shuffle') return hasLyrics ? 'lyrics' : 'progress';
        return 'progress';
      });
      return true;
    }
    if (e.type === 'hold' && e.button === 'select') {
      songMenu(os, t.id, 'nowplaying');
      return true;
    }
    if ((e.type === 'down' || e.type === 'up' || e.type === 'repeat') && e.button === 'select') return true;
    return false;
  });

  const pos = scrub ?? position;
  const frac = duration > 0 ? clamp(pos / duration, 0, 1) : 0;
  const rating = t.rating ?? 0;

  let bottom: React.ReactNode;
  if (volShown && mode === 'progress') {
    const max = volumeLimit;
    bottom = (
      <div className="cl-np-vol">
        <SpeakerLevel loud={false} />
        <div className="cl-bar">
          <div className="cl-bar-fill" style={{ width: `${clamp(volume / 1, 0, 1) * 100}%` }} />
          {max < 1 && <div className="cl-bar-limit" style={{ left: `${max * 100}%` }} />}
        </div>
        <SpeakerLevel loud />
      </div>
    );
  } else if (mode === 'genius') {
    bottom = (
      <div className="cl-np-genius">
        <GeniusGlyph size={16} />
        {geniusOK ? (
          <div className="cl-np-slider">
            <span className="cl-np-slider-label" style={{ opacity: 1 - slide * 1.6 }}>
              Start Genius
            </span>
            <span className="cl-np-slider-knob" style={{ left: `calc(${slide} * (100% - 34px) + 1px)` }}>
              <GeniusGlyph size={12} color="#fff" />
            </span>
          </div>
        ) : (
          <span className="cl-np-genius-na">{tx('Genius is not available for this song')}</span>
        )}
      </div>
    );
  } else if (mode === 'rating') {
    bottom = (
      <div className="cl-np-rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= rating} size={15} />
        ))}
      </div>
    );
  } else if (mode === 'shuffle') {
    bottom = (
      <div className="cl-np-shuffle">
        <ShuffleGlyph size={16} />
        <span className="cl-np-shuffle-label">{tx('Shuffle')}</span>
        {(['off', 'songs', 'albums'] as ShuffleMode[]).map((m) => (
          <span key={m} className={`cl-seg ${shuffle === m ? 'on' : ''}`}>
            {tx(m === 'off' ? 'Off' : m === 'songs' ? 'Songs' : 'Albums')}
          </span>
        ))}
      </div>
    );
  } else {
    bottom = (
      <div className="cl-np-progress">
        <div className="cl-bar">
          <div className="cl-bar-fill" style={{ width: `${frac * 100}%` }} />
          {mode === 'scrub' && <div className="cl-diamond" style={{ left: `${frac * 100}%` }} />}
        </div>
        <div className="cl-np-times">
          <span>{formatTime(pos)}</span>
          <span>{duration > 0 ? `-${formatTime(Math.max(0, duration - pos))}` : '--:--'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`cl-np cl-np-${layout}`}>
      {layout !== 'text' && (
        <div className="cl-np-art" style={{ left: art.left, top: art.top, width: art.size, height: art.size }}>
          <Artwork src={t.artwork} size={art.size} />
          {layout === 'wide' && (
            <div className="cl-np-reflect" style={{ top: art.size + 1, height: 34 }}>
              <Artwork src={t.artwork} size={art.size} style={{ transform: 'scaleY(-1)' }} />
            </div>
          )}
        </div>
      )}
      <div
        className="cl-np-info"
        style={layout === 'wide' ? { left: art.left + art.size + 12 } : layout === 'tall' ? { left: 10, top: art.top + art.size + 8 } : { left: 10, top: 22 }}
      >
        <div className="cl-np-count">
          <span>
            {tx('{n} of {m}', { n: qlen ? index + 1 : 0, m: qlen })}
          </span>
          <span className="cl-np-modes">
            {shuffle !== 'off' && <ShuffleGlyph size={13} />}
            {repeat !== 'off' && <RepeatGlyph size={13} one={repeat === 'one'} />}
          </span>
        </div>
        <Marquee text={t.title || tx('Untitled')} run className="cl-np-title" />
        <Marquee text={t.artist || tx('Unknown Artist')} run className="cl-np-line" />
        <Marquee text={t.album || tx('Unknown Album')} run className="cl-np-line" />
        {status === 'loading' && <div className="cl-np-status">{tx('Loading…')}</div>}
      </div>
      {mode === 'lyrics' && <LyricsPane plain={lyrics.plain} lines={lyrics.lines} scroll={lyricScroll} />}
      <div className="cl-np-bottom">{bottom}</div>
    </div>
  );
}

function LyricsPane({ plain, lines, scroll }: { plain: string | null; lines: { time: number; text: string }[] | null; scroll: number }) {
  const position = usePlayer((s) => s.position);
  const cur = lines ? activeLine(lines, position) : -1;
  const text = useMemo(() => (lines ? lines.map((l) => l.text) : (plain ?? '').split('\n')), [lines, plain]);
  const offset = lines ? Math.max(0, cur - 2) : scroll;
  return (
    <div className="cl-np-lyrics">
      <div className="cl-np-lyrics-mask">
        <div className="cl-np-lyrics-inner" style={{ transform: `translateY(${-offset * 17}px)` }}>
          {text.map((l, i) => (
            <div key={i} className={i === cur ? 'cur' : ''}>
              {l || ' '}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ video

function VideoView({ t }: { t: Track }) {
  const os = useOS();
  useHeader('hidden');
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration) || t.duration || 0;
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const volume = useSettings((s) => s.volume);
  const [fitScreen] = useDeviceSetting<boolean>(os.modelId, 'fitToScreen', true);
  const [overlay, setOverlay] = useState<'info' | 'vol' | null>('info');
  const [poke, setPoke] = useState(0);
  useEffect(() => {
    if (!overlay) return;
    const tm = window.setTimeout(() => setOverlay(null), 3200);
    return () => window.clearTimeout(tm);
  }, [overlay, poke]);
  useEffect(() => {
    setOverlay('info');
    setPoke((p) => p + 1);
  }, [t.id]);

  useMedia({ visible: true, style: {}, fit: fitScreen ? 'cover' : 'contain', under: true });

  useInput((e) => {
    if (e.type === 'scroll') {
      player.volumeBy(e.steps / 32);
      setOverlay('vol');
      setPoke((p) => p + 1);
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      setOverlay((o) => (o === 'info' ? null : 'info'));
      setPoke((p) => p + 1);
      return true;
    }
    if (e.type === 'hold' && e.button === 'select') {
      songMenu(os, t.id, 'nowplaying');
      return true;
    }
    return false;
  });

  const frac = duration > 0 ? clamp(position / duration, 0, 1) : 0;
  const style: CSSProperties = { position: 'absolute', inset: 0 };
  return (
    <div className="cl-video" style={style}>
      {(status === 'loading' || error) && <div className="cl-video-msg">{tx(error ? 'This video can’t be played' : 'Loading…')}</div>}
      {overlay === 'info' && (
        <div className="cl-video-osd">
          <div className="cl-video-title">{t.title}</div>
          <div className="cl-np-progress">
            <div className="cl-bar">
              <div className="cl-bar-fill" style={{ width: `${frac * 100}%` }} />
            </div>
            <div className="cl-np-times">
              <span>{formatTime(position)}</span>
              <span>{duration > 0 ? `-${formatTime(Math.max(0, duration - position))}` : '--:--'}</span>
            </div>
          </div>
        </div>
      )}
      {overlay === 'vol' && (
        <div className="cl-video-osd">
          <div className="cl-np-vol">
            <SpeakerLevel loud={false} />
            <div className="cl-bar">
              <div className="cl-bar-fill" style={{ width: `${volume * 100}%` }} />
            </div>
            <SpeakerLevel loud />
          </div>
        </div>
      )}
    </div>
  );
}
