import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Artwork } from '../../../../core/library/Artwork';
import { albumKey, albums, useTracks, type AlbumInfo } from '../../../../core/library/selectors';
import { useLibrary } from '../../../../core/library/store';
import { usePlayer } from '../../../../core/player/player';
import { compareTitles, formatTime } from '../../../../core/util/format';
import { clamp, useInput, useOS, useScreen } from '../core';
import { SpeakerGlyph } from '../glyphs';
import { playList, songMenu } from './Music';

const COVER = 128;
const TOP = 34;
const SIDE_X = 74;
const SPACING = 25;
const ANGLE = 72;
const FLIP_SIZE = 184;

/**
 * Cover Flow: album covers in 3D perspective with reflections. Wheel to
 * flip through, center to turn the cover around and pick a song.
 */
export function CoverFlow() {
  const os = useOS();
  const { active } = useScreen();
  const tracks = useTracks();
  const list = useMemo(
    () => [...albums(tracks)].sort((a, b) => compareTitles(a.artist, b.artist) || compareTitles(a.title, b.title)),
    [tracks],
  );
  const [target, setTarget] = useState(() => {
    const cur = usePlayer.getState().currentId;
    const t = cur ? useLibrary.getState().tracks[cur] : undefined;
    const k = t ? albumKey(t) : null;
    return Math.max(0, list.findIndex((a) => a.key === k));
  });
  const [pos, setPos] = useState(target);
  const [flipped, setFlipped] = useState(false);
  const [trackSel, setTrackSel] = useState(0);
  const anim = useRef({ x: target, v: 0, target, raf: 0, last: 0 });

  const n = list.length;
  const t = clamp(target, 0, Math.max(0, n - 1));

  // critically-damped spring towards the target cover
  useEffect(() => {
    const a = anim.current;
    a.target = t;
    if (a.raf) return;
    a.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - a.last) / 1000);
      a.last = now;
      const k = 160;
      const diff = a.target - a.x;
      a.v += (diff * k - a.v * 2 * Math.sqrt(k)) * dt;
      a.x += a.v * dt;
      if (Math.abs(diff) < 0.002 && Math.abs(a.v) < 0.01) {
        a.x = a.target;
        a.v = 0;
        a.raf = 0;
        setPos(a.x);
        return;
      }
      setPos(a.x);
      a.raf = requestAnimationFrame(loop);
    };
    a.raf = requestAnimationFrame(loop);
  }, [t]);
  useEffect(() => () => cancelAnimationFrame(anim.current.raf), []);

  const album: AlbumInfo | undefined = list[Math.round(clamp(pos, 0, Math.max(0, n - 1)))];
  const centerAlbum = list[t];

  useInput((e) => {
    if (!n) return false;
    if (e.type === 'scroll') {
      if (flipped) {
        setTrackSel((s) => clamp(s + e.steps, 0, (centerAlbum?.trackIds.length ?? 1) - 1));
      } else {
        const mult = n > 30 && e.velocity > 24 ? 3 : 1;
        setTarget((x) => clamp(x + e.steps * mult, 0, n - 1));
      }
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      if (!flipped) {
        setTrackSel(0);
        setFlipped(true);
      } else if (centerAlbum) {
        playList(os, centerAlbum.trackIds, trackSel);
        setFlipped(false);
      }
      return true;
    }
    if (e.type === 'hold' && e.button === 'select') {
      if (flipped && centerAlbum) songMenu(os, centerAlbum.trackIds[trackSel]);
      return true;
    }
    if (e.type === 'click' && e.button === 'menu' && flipped) {
      setFlipped(false);
      return true;
    }
    return false;
  });

  if (!n)
    return (
      <div className="cl-cf">
        <div className="cl-cf-empty">No Albums</div>
      </div>
    );

  const first = Math.max(0, Math.floor(pos) - 8);
  const last = Math.min(n - 1, Math.ceil(pos) + 8);
  const covers = [];
  for (let i = first; i <= last; i++) {
    const a = list[i];
    const d = i - pos;
    const ad = Math.abs(d);
    const s = Math.sign(d);
    const x = ad <= 1 ? d * SIDE_X : s * (SIDE_X + (ad - 1) * SPACING);
    const rot = -s * Math.min(1, ad) * ANGLE;
    const z = -Math.min(1, ad) * 70;
    const isFlip = flipped && i === t;
    const style: CSSProperties = {
      transform: isFlip
        ? `translate3d(0, ${(COVER - FLIP_SIZE) / 2 + 6}px, 40px) rotateY(180deg) scale(${FLIP_SIZE / COVER})`
        : `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${rot.toFixed(2)}deg)`,
      zIndex: isFlip ? 2000 : 1000 - Math.round(ad * 10),
      opacity: flipped && !isFlip ? 0.25 : 1,
    };
    covers.push(
      <div key={a.key} className={`cl-cf-cover ${isFlip ? 'cl-cf-flipped' : ''}`} style={style}>
        <div className="cl-cf-front">
          <Artwork src={a.artwork} size={COVER} />
          <div className="cl-cf-reflect">
            <Artwork src={a.artwork} size={COVER} style={{ transform: 'scaleY(-1)' }} />
          </div>
        </div>
        {i === t && <CoverBack album={a} sel={trackSel} active={active && flipped} />}
      </div>,
    );
  }

  return (
    <div className="cl-cf">
      <div className="cl-cf-stage" style={{ top: TOP }}>
        <div className="cl-cf-origin" style={{ left: os.width / 2 - COVER / 2 }}>
          {covers}
        </div>
      </div>
      <div className={`cl-cf-caption ${flipped ? 'cl-cf-caption-hide' : ''}`}>
        <div className="cl-cf-title">{album?.title}</div>
        <div className="cl-cf-artist">{album?.artist}</div>
      </div>
    </div>
  );
}

/** The back of a cover: the album's track list. */
function CoverBack({ album, sel, active }: { album: AlbumInfo; sel: number; active: boolean }) {
  const tracks = useTracks();
  const current = usePlayer((s) => s.currentId);
  const rowH = 12.5;
  const visible = 7;
  const top = clamp(sel - visible + 1, 0, Math.max(0, album.trackIds.length - visible));
  return (
    <div className="cl-cf-back" style={{ width: COVER, height: COVER }}>
      <div className="cl-cf-back-head">
        <div className="cl-cf-back-title">{album.title}</div>
        <div className="cl-cf-back-artist">{album.artist}</div>
      </div>
      <div className="cl-cf-back-list">
        {album.trackIds.slice(top, top + visible + 1).map((id, k) => {
          const i = top + k;
          const tr = tracks[id];
          return (
            <div key={id} className={`cl-cf-back-row ${i === sel && active ? 'cl-sel' : ''}`} style={{ height: rowH }}>
              <span className="cl-cf-back-name">{tr?.title}</span>
              {id === current ? <SpeakerGlyph size={7} /> : <span className="cl-cf-back-time">{formatTime(tr?.duration)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
