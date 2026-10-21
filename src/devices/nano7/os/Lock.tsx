import { useRef, useState } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { player, useCurrentTrack, usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { useNow } from '../../../core/util/hooks';
import { useNano } from '../state';
import { tween, useDrag } from './gesture';
import { Glyph } from './icons';
import { Chevron } from './Nav';
import { Wallpaper } from './wallpaper';
import { t } from './i18n';

export function LockScreen({ wallpaper }: { wallpaper: string }) {
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  const track = useCurrentTrack();
  const status = usePlayer((s) => s.status);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const content = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const x = useRef(0);

  const setX = (v: number) => {
    x.current = v;
    if (content.current) {
      content.current.style.transform = `translate3d(${v}px,0,0)`;
      content.current.style.opacity = String(1 - Math.min(1, v / 240) * 0.9);
    }
  };
  const unlock = () => {
    setLeaving(true);
    tween(x.current, 240, 260, setX, () => useNano.setState({ locked: false }));
  };
  const drag = useDrag({
    axis: 'x',
    onMove: (d) => setX(Math.max(0, d.dx)),
    onEnd: (d, moved) => {
      if (!moved) return;
      if (d.dx > 90 || d.velocity > 0.4) unlock();
      else tween(x.current, 0, 220, setX);
    },
  });

  let h = now.getHours();
  if (!use24h) h = h % 12 || 12;
  const time = `${use24h ? String(h).padStart(2, '0') : h}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const playing = status === 'playing' || status === 'loading';

  return (
    <div className={`n7-lock ${leaving ? 'n7-lock-leaving' : ''}`} {...drag}>
      <Wallpaper id={wallpaper} />
      <div className="n7-lock-dim" />
      <div className="n7-lock-content" ref={content}>
        <div className="n7-lock-time">{time}</div>
        <div className="n7-lock-date">{date}</div>
        {track && (
          <div className="n7-lock-np" data-noswipe onPointerDown={(e) => e.stopPropagation()}>
            <div className="n7-lock-np-top">
              <Artwork src={track.artwork} size={44} radius={2} />
              <div className="n7-lock-np-text">
                <div className="n7-lock-np-title">{track.title}</div>
                <div className="n7-lock-np-artist">{track.artist}</div>
              </div>
            </div>
            <div className="n7-lock-np-bar">
              <div style={{ width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%` }} />
            </div>
            <div className="n7-lock-np-ctrl">
              <button onClick={() => player.prev()}>
                <Glyph.prev size={20} color="#fff" />
              </button>
              <button onClick={() => player.toggle()}>{playing ? <Glyph.pause size={22} color="#fff" /> : <Glyph.play size={22} color="#fff" />}</button>
              <button onClick={() => player.next()}>
                <Glyph.next size={20} color="#fff" />
              </button>
            </div>
          </div>
        )}
        <div className="n7-lock-slide" onClick={unlock}>
          <Chevron dir="right" size={13} color="rgba(255,255,255,0.8)" />
          <span className="n7-shimmer">{t('slide to unlock')}</span>
        </div>
      </div>
    </div>
  );
}
