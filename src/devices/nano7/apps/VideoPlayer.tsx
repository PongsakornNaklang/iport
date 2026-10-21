/**
 * Landscape video playback. The picture is the shared <MediaLayer> (rotated
 * 90° by the Screen); this overlay draws the black backdrop and controls in
 * the same rotated frame.
 */
import { useEffect, useRef, useState } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { player, useCurrentTrack, usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { formatTime } from '../../../core/util/format';
import { useNano } from '../state';
import { clamp } from '../os/gesture';
import { Glyph } from '../os/icons';

/** Slider that works in the rotated frame (maps pointer to the element's long axis). */
function RotSlider({ value, onChange, onEnd, className }: { value: number; onChange: (v: number) => void; onEnd?: (v: number) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useRef(value);
  const calc = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return r.width >= r.height ? clamp((e.clientX - r.left) / r.width, 0, 1) : clamp((e.clientY - r.top) / r.height, 0, 1);
  };
  return (
    <div
      ref={ref}
      className={`n7-vs ${className ?? ''}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        ref.current?.setPointerCapture(e.pointerId);
        v.current = calc(e);
        onChange(v.current);
      }}
      onPointerMove={(e) => {
        if (!ref.current?.hasPointerCapture(e.pointerId)) return;
        v.current = calc(e);
        onChange(v.current);
      }}
      onPointerUp={(e) => {
        if (!ref.current?.hasPointerCapture(e.pointerId)) return;
        onEnd?.(v.current);
      }}
    >
      <div className="n7-vs-rail" />
      <div className="n7-vs-fill" style={{ width: `${clamp(value, 0, 1) * 100}%` }} />
      <div className="n7-vs-knob" style={{ left: `${clamp(value, 0, 1) * 100}%` }} />
    </div>
  );
}

export function VideoPlayer() {
  const track = useCurrentTrack();
  const currentId = usePlayer((s) => s.currentId);
  const status = usePlayer((s) => s.status);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const hasVideo = usePlayer((s) => s.hasVideo);
  const kind = usePlayer((s) => s.kind);
  const volume = useSettings((s) => s.volume);
  const [chrome, setChrome] = useState(true);
  const [scrub, setScrub] = useState<number | null>(null);
  const hideTimer = useRef(0);
  const playing = status === 'playing' || status === 'loading';

  const poke = () => {
    setChrome(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 3500);
  };
  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, []);

  // the video ended: back to the list
  const had = useRef(!!currentId);
  useEffect(() => {
    if (currentId) had.current = true;
    else if (had.current) useNano.setState({ video: false });
  }, [currentId]);

  const done = () => {
    player.pause();
    useNano.setState({ video: false });
  };
  const showPicture = hasVideo || kind === 'youtube';
  const p = scrub ?? (duration ? position / duration : 0);

  return (
    <>
      <div className="n7-video-bg" />
      <div className="n7-video" data-noswipe onClick={() => (chrome ? setChrome(false) : poke())}>
        {!showPicture && track && (
          <div className="n7-video-art">
            <Artwork src={track.artwork} size={150} />
          </div>
        )}
        {status === 'loading' && <div className="n7-video-spinner" />}
        <div className={`n7-video-top ${chrome ? 'on' : ''}`} onClick={(e) => e.stopPropagation()}>
          <button className="n7-video-done" onClick={done}>
            Done
          </button>
          <span className="n7-video-t">{formatTime(scrub != null ? scrub * duration : position)}</span>
          <RotSlider
            className="n7-video-scrub"
            value={p}
            onChange={(v) => {
              setScrub(v);
              poke();
            }}
            onEnd={(v) => {
              if (duration) player.seek(v * duration);
              setScrub(null);
            }}
          />
          <span className="n7-video-t">-{formatTime(Math.max(0, duration - (scrub != null ? scrub * duration : position)))}</span>
        </div>
        <div className={`n7-video-panel ${chrome ? 'on' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="n7-video-title">{track?.title}</div>
          <div className="n7-video-ctrls">
            <button onClick={() => (poke(), player.prev())}>
              <Glyph.prev size={20} color="#fff" />
            </button>
            <button onClick={() => (poke(), player.toggle())}>{playing ? <Glyph.pause size={24} color="#fff" /> : <Glyph.play size={24} color="#fff" />}</button>
            <button onClick={() => (poke(), player.next())}>
              <Glyph.next size={20} color="#fff" />
            </button>
          </div>
          <div className="n7-video-vol">
            <Glyph.volLow size={12} color="#fff" />
            <RotSlider
              value={volume}
              onChange={(v) => {
                player.setVolume(v);
                poke();
              }}
            />
            <Glyph.volHigh size={13} color="#fff" />
          </div>
        </div>
      </div>
    </>
  );
}
