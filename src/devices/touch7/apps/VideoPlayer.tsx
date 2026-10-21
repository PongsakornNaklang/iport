/**
 * Full-screen video playback (TV app, music videos, YouTube) through the
 * shared MediaLayer. Rotates the iPod body to landscape like a real viewer would.
 */
import { useEffect, useRef, useState } from 'react';
import { player, useCurrentTrack, usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { formatTime } from '../../../core/util/format';
import { Glyph } from '../os/glyphs';
import { useMediaTarget } from '../os/media';
import { os, usePrefs, useOS } from '../os/store';
import { Slider } from '../os/ui';

export function openVideo(ids: string[], index = 0) {
  player.playTracks(ids, index);
  useOS.setState({ videoOpen: true, menu: null });
  if (!usePrefs.getState().rotationLock) useOS.setState({ landscape: true });
}

/** Show the current item full-screen (e.g. tapping a YouTube video on Now Playing). */
export function showVideo() {
  useOS.setState({ videoOpen: true, menu: null });
  if (!usePrefs.getState().rotationLock) useOS.setState({ landscape: true });
}

export function VideoPlayer() {
  const open = useOS((s) => s.videoOpen);
  if (!open) return null;
  return <VideoPlayerInner />;
}

function VideoPlayerInner() {
  const landscape = useOS((s) => s.landscape);
  const t = useCurrentTrack();
  const status = usePlayer((s) => s.status);
  const pos = usePlayer((s) => s.position);
  const dur = usePlayer((s) => s.duration);
  const currentId = usePlayer((s) => s.currentId);
  const vol = useSettings((s) => s.volume);
  const box = useRef<HTMLDivElement>(null);
  const [controls, setControls] = useState(true);
  const [fill, setFill] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const hideT = useRef<number | undefined>(undefined);
  useMediaTarget(box, 'video', true, { z: 41, fit: fill ? 'cover' : 'contain', landscape });

  const bump = () => {
    setControls(true);
    window.clearTimeout(hideT.current);
    hideT.current = window.setTimeout(() => setControls(false), 3500);
  };
  useEffect(() => {
    bump();
    return () => window.clearTimeout(hideT.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the list finished
  useEffect(() => {
    if (!currentId) close();
  }, [currentId]);

  const close = () => {
    useOS.setState({ videoOpen: false, landscape: false });
  };
  const playing = status === 'playing' || status === 'loading';
  const d = dur || t?.duration || 0;
  const p = scrub ?? (d ? pos / d : 0);
  return (
    <div className={`t7-video ${landscape ? 'land' : 'port'}`}>
      <div className="t7-video-box" ref={box} onClick={() => (controls ? setControls(false) : bump())}>
        {status === 'loading' && <div className="t7-spinner light" />}
      </div>
      <div className={`t7-video-ui ${controls ? 'on' : ''}`} onPointerDown={bump}>
        <div className="t7-video-top">
          <button className="t7-vbtn" onClick={close} aria-label="Done">
            <Glyph name="xmark" size={16} />
          </button>
          <button className="t7-vbtn" onClick={() => setFill(!fill)} aria-label="Zoom">
            <Glyph name="arrow.up.left.and.arrow.down.right" size={15} />
          </button>
          <div className="t7-video-title">{t?.title}</div>
          <button
            className="t7-vbtn"
            onClick={() => {
              if (usePrefs.getState().rotationLock) {
                os.toast('Portrait Orientation Lock: On', 'lock.rotation');
                return;
              }
              useOS.setState({ landscape: !landscape });
            }}
            aria-label="Rotate"
          >
            <Glyph name="rotate.right" size={16} />
          </button>
        </div>
        <div className="t7-video-mid">
          <button onClick={() => player.seekBy(-15)} aria-label="Back 15 seconds">
            <Glyph name="gobackward.15" size={34} />
          </button>
          <button className="big" onClick={() => player.toggle()} aria-label="Play/Pause">
            <Glyph name={playing ? 'pause.fill' : 'play.fill'} size={46} />
          </button>
          <button onClick={() => player.seekBy(15)} aria-label="Forward 15 seconds">
            <Glyph name="goforward.15" size={34} />
          </button>
        </div>
        <div className="t7-video-bottom">
          <div className="t7-video-scrub">
            <span>{formatTime(p * d)}</span>
            <Slider
              className="t7-vscrub"
              value={p}
              thumb
              onChange={(v) => setScrub(v)}
              onEnd={(v) => {
                setScrub(null);
                if (d) player.seek(v * d);
              }}
            />
            <span>-{formatTime(Math.max(0, d - p * d))}</span>
          </div>
          <Slider className="t7-vvol" value={vol} thumb={false} onChange={(v) => player.setVolume(v)} minGlyph="speaker.fill" maxGlyph="speaker.wave.3.fill" />
        </div>
      </div>
    </div>
  );
}
