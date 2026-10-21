import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Artwork } from '../../../../core/library/Artwork';
import { useArtworkUrl } from '../../../../core/library/artwork';
import { useLibrary } from '../../../../core/library/store';
import { activeLine, useLyrics } from '../../../../core/lyrics';
import { player, useCurrentTrack, usePlayer } from '../../../../core/player/player';
import { useSettings } from '../../../../core/settings/store';
import { formatTime } from '../../../../core/util/format';
import { claim, localPoint, suppressNextClick, unitScale } from '../../os/gesture';
import { Glyph } from '../../os/glyphs';
import { useMediaTarget } from '../../os/media';
import { os, useOS, useStatusBar } from '../../os/store';
import { Scroller } from '../../os/Scroller';
import { Slider, useApp } from '../../os/ui';
import { showVideo } from '../VideoPlayer';
import { makeLP, trackMenu, useMusic } from './common';

type View = 'main' | 'queue' | 'lyrics';

export function NowPlaying({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useLayoutEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 450);
    return () => window.clearTimeout(t);
  }, [open]);
  useStatusBar('music', 'light', open && app.active);
  if (!mounted || !app.host) return null;
  return createPortal(<NowPlayingCard shown={shown} onClose={onClose} />, app.host);
}

function NowPlayingCard({ shown, onClose }: { shown: boolean; onClose: () => void }) {
  const t = useCurrentTrack();
  const status = usePlayer((s) => s.status);
  const kind = usePlayer((s) => s.kind);
  const hasVideo = usePlayer((s) => s.hasVideo);
  const app = useApp();
  const api = useMusic();
  const [view, setView] = useState<View>('main');
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const bg = useArtworkUrl(t?.artwork);
  const playing = status === 'playing' || status === 'loading';
  const videoArt = !!t && (kind === 'youtube' || hasVideo) && view === 'main';
  const locked = useOS((s) => s.locked);
  useMediaTarget(artRef, 'np-art', videoArt && shown && !dragging && app.active && !locked, { radius: 8, z: 30, fit: 'cover', delay: 380 });

  // close when the queue ends
  useEffect(() => {
    if (!t && shown) onClose();
  }, [t, shown, onClose]);

  const drag = useRef<{ id: number; y0: number; k: number; on: boolean; v: number; t: number; dy: number } | null>(null);

  if (!t) return <div className="t7np-wrap" />;
  return (
    <div className={`t7np-wrap ${shown ? 'shown' : ''}`}>
      <div
        ref={card}
        className={`t7np ${dragging ? 'dragging' : ''}`}
        style={dy ? { transform: `translate3d(0, ${dy}px, 0)` } : undefined}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if ((e.target as HTMLElement).closest('.t7-slider, .t7np-queue-list, .t7np-lyrics')) return;
          drag.current = { id: e.pointerId, y0: e.clientY, k: unitScale(card.current!).ky, on: false, v: 0, t: performance.now(), dy: 0 };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const ddy = (e.clientY - d.y0) * d.k;
          if (!d.on) {
            if (ddy < 10) {
              if (ddy < -10) drag.current = null;
              return;
            }
            if (!claim(e.pointerId, card.current!)) {
              drag.current = null;
              return;
            }
            d.on = true;
            setDragging(true);
            card.current!.setPointerCapture(e.pointerId);
          }
          const now = performance.now();
          d.v = (ddy - d.dy) / Math.max(1, now - d.t);
          d.t = now;
          d.dy = Math.max(0, ddy);
          setDy(d.dy);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (!d?.on) return;
          suppressNextClick();
          setDragging(false);
          setDy(0);
          if (d.dy > 120 || d.v > 0.5) onClose();
        }}
      >
        <div className="t7np-bg">
          {bg && <img src={bg} alt="" draggable={false} />}
          <div className="t7np-bg-dim" />
        </div>
        <button className="t7np-grabber" onClick={onClose} aria-label="Close">
          <span />
        </button>

        {view === 'main' ? (
          <div className={`t7np-art-wrap ${playing ? 'playing' : 'paused'}`}>
            <div
              ref={artRef}
              className="t7np-art"
              onClick={() => {
                if (videoArt) showVideo();
              }}
            >
              <Artwork src={t.artwork} radius={8} />
            </div>
          </div>
        ) : (
          <div className="t7np-mini-head">
            <Artwork src={t.artwork} size={56} radius={5} />
            <div className="t7np-mini-text">
              <div className="t">{t.title}</div>
              <div className="a">{t.artist}</div>
            </div>
            <button className="t7np-more" onClick={(e) => trackMenu(t, localPoint(card.current!, e.clientX, e.clientY).y + 30, api)}>
              <Glyph name="ellipsis" size={16} />
            </button>
          </div>
        )}

        {view === 'main' && (
          <div className="t7np-meta">
            <div className="t7np-meta-text">
              <div className="t7np-title">{t.title}</div>
              <div className="t7np-artist" onClick={() => t.mediaType === 'music' && (onClose(), api.goArtist(t.artist))}>
                {t.artist}
                {t.album && t.album !== t.title ? ` — ${t.album}` : ''}
              </div>
            </div>
            <button className="t7np-more" onClick={(e) => trackMenu(t, localPoint(card.current!.closest('.t7-screen') as HTMLElement, e.clientX, e.clientY).y + 20, api)} aria-label="More">
              <Glyph name="ellipsis" size={16} />
            </button>
          </div>
        )}
        {view === 'queue' && <QueueView />}
        {view === 'lyrics' && <LyricsView />}

        <div className={`t7np-controls ${view !== 'main' ? 'compact' : ''}`}>
          <Scrub />
          <div className="t7np-transport">
            <button onClick={() => player.prev()} aria-label="Previous">
              <Glyph name="backward.fill" size={34} />
            </button>
            <button onClick={() => player.toggle()} aria-label={playing ? 'Pause' : 'Play'} className="pp">
              <Glyph name={playing ? 'pause.fill' : 'play.fill'} size={40} />
            </button>
            <button onClick={() => player.next()} aria-label="Next">
              <Glyph name="forward.fill" size={34} />
            </button>
          </div>
          <VolumeRow />
          <div className="t7np-bottom">
            <button className={view === 'lyrics' ? 'on' : ''} onClick={() => setView(view === 'lyrics' ? 'main' : 'lyrics')} aria-label="Lyrics">
              <Glyph name={view === 'lyrics' ? 'quote.bubble.fill' : 'quote.bubble'} size={20} />
            </button>
            <button onClick={() => os.toast('iPod', 'airplayaudio')} aria-label="AirPlay">
              <Glyph name="airplayaudio" size={22} />
            </button>
            <button className={view === 'queue' ? 'on' : ''} onClick={() => setView(view === 'queue' ? 'main' : 'queue')} aria-label="Playing Next">
              <Glyph name="list.bullet" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scrub() {
  const pos = usePlayer((s) => s.position);
  const dur = usePlayer((s) => s.duration);
  const t = useCurrentTrack();
  const [scrub, setScrub] = useState<number | null>(null);
  const d = dur || t?.duration || 0;
  const live = t?.mediaType === 'radio' || (!d && t?.source === 'radio');
  const p = scrub ?? (d ? pos / d : 0);
  return (
    <div className={`t7np-scrub ${scrub != null ? 'active' : ''}`}>
      <Slider
        className="t7np-slider"
        value={live ? 0 : p}
        thumb
        onChange={(v) => !live && setScrub(v)}
        onEnd={(v) => {
          setScrub(null);
          if (d && !live) player.seek(v * d);
        }}
      />
      <div className="t7np-times">
        <span>{formatTime(live ? pos : p * d)}</span>
        {live ? <span className="live">LIVE</span> : <span>-{formatTime(Math.max(0, d - p * d))}</span>}
      </div>
    </div>
  );
}

function VolumeRow() {
  const vol = useSettings((s) => s.volume);
  return <Slider className="t7np-vol" value={vol} onChange={(v) => player.setVolume(v)} minGlyph="speaker.fill" maxGlyph="speaker.wave.3.fill" />;
}

function QueueView() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const tracks = useLibrary((s) => s.tracks);
  const shuffle = useSettings((s) => s.shuffle);
  const repeat = useSettings((s) => s.repeat);
  const upNext = queue.slice(index + 1);
  return (
    <div className="t7np-queue">
      <div className="t7np-qhead">
        <div>
          <b>Playing Next</b>
        </div>
        <div className="t7np-qbtns">
          <button className={shuffle !== 'off' ? 'on' : ''} onClick={() => player.cycleShuffle()} aria-label="Shuffle">
            <Glyph name="shuffle" size={18} />
            {shuffle === 'albums' && <small>Albums</small>}
          </button>
          <button className={repeat !== 'off' ? 'on' : ''} onClick={() => player.cycleRepeat()} aria-label="Repeat">
            <Glyph name={repeat === 'one' ? 'repeat.1' : 'repeat'} size={18} />
          </button>
        </div>
      </div>
      <Scroller className="t7np-queue-list">
        {upNext.map((id, i) => {
          const t = tracks[id];
          if (!t) return null;
          const qi = index + 1 + i;
          return (
            <div
              key={`${id}-${qi}`}
              className="t7np-qrow"
              onClick={() => player.jumpTo(qi)}
              {...makeLP((y) =>
                os.showMenu(
                  [
                    { label: 'Play Now', glyph: 'play.fill', onPress: () => player.jumpTo(qi) },
                    { label: 'Remove', glyph: 'minus', destructive: true, onPress: () => player.removeFromQueue(qi) },
                  ],
                  y,
                  t.title,
                ),
              )}
            >
              <Artwork src={t.artwork} size={40} radius={4} />
              <div className="t7np-qtext">
                <div className="t">{t.title}</div>
                <div className="a">{t.artist}</div>
              </div>
              <Glyph name="list.bullet" size={16} className="t7np-qgrip" />
            </div>
          );
        })}
        {!upNext.length && <div className="t7np-qempty">{repeat === 'all' ? 'Repeating the list' : 'Nothing up next'}</div>}
      </Scroller>
    </div>
  );
}

function LyricsView() {
  const t = useCurrentTrack();
  const { plain, lines, loading } = useLyrics(t);
  const pos = usePlayer((s) => s.position);
  const box = useRef<HTMLDivElement>(null);
  const cur = lines ? activeLine(lines, pos) : -1;
  useEffect(() => {
    if (!lines || cur < 0) return;
    const scroller = box.current?.closest('.t7-scroll') as HTMLElement | null;
    const el = box.current?.children[cur] as HTMLElement | undefined;
    if (scroller && el) scroller.scrollTo({ top: Math.max(0, el.offsetTop - 70), behavior: 'smooth' });
  }, [cur, lines]);
  return (
    <Scroller className="t7np-lyrics">
      {lines ? (
        <div ref={box} className="t7np-lines">
          {lines.map((l, i) => (
            <div key={i} className={`t7np-line ${i === cur ? 'on' : i < cur ? 'past' : ''}`} onClick={() => player.seek(l.time)}>
              {l.text || '♪'}
            </div>
          ))}
        </div>
      ) : plain ? (
        <div className="t7np-plain">{plain}</div>
      ) : (
        <div className="t7np-nolyrics">{loading ? 'Loading lyrics…' : 'Lyrics aren’t available for this song.'}</div>
      )}
    </Scroller>
  );
}

// ------------------------------------------------------------------ mini player

export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const t = useCurrentTrack();
  const status = usePlayer((s) => s.status);
  const playing = status === 'playing' || status === 'loading';
  const st = useRef<{ y0: number; id: number } | null>(null);
  if (!t) return null;
  return (
    <div
      className="t7m-mini-player"
      onClick={onOpen}
      onPointerDown={(e) => (st.current = { y0: e.clientY, id: e.pointerId })}
      onPointerMove={(e) => {
        const s = st.current;
        if (s && s.y0 - e.clientY > 24) {
          st.current = null;
          suppressNextClick();
          onOpen();
        }
      }}
      onPointerUp={() => (st.current = null)}
    >
      <Artwork src={t.artwork} size={48} radius={4} className="t7m-mini-art" />
      <div className="t7m-mini-title">{status === 'loading' ? t.title : t.title}</div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          player.toggle();
        }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        <Glyph name={playing ? 'pause.fill' : 'play.fill'} size={24} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          player.next();
        }}
        aria-label="Next"
      >
        <Glyph name="forward.fill" size={24} />
      </button>
    </div>
  );
}
