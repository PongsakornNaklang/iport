import { usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { formatClock } from '../../../core/util/format';
import { useBattery, useNow } from '../../../core/util/hooks';
import { nano, useNano, useNanoData, useWorkout } from '../state';
import { Battery, Glyph } from './icons';

export function StatusBar({ theme, hidden }: { theme: 'light' | 'dark'; hidden?: boolean }) {
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  const status = usePlayer((s) => s.status);
  const current = usePlayer((s) => s.currentId);
  const { level, charging } = useBattery();
  const bt = useNanoData((s) => s.bluetooth);
  const locked = useNano((s) => s.locked);
  const workout = useWorkout((s) => !!s.run);
  const color = theme === 'light' ? '#fff' : '#000';
  const playing = status === 'playing' || status === 'loading';
  return (
    <div className={`n7-status ${hidden ? 'n7-status-hidden' : ''}`} style={{ color }}>
      <div className="n7-status-left" onClick={() => current && !locked && nano.openNowPlaying()} data-tap>
        {current && (playing ? <Glyph.play size={9} color={color} /> : <Glyph.pause size={9} color={color} />)}
        {workout && <Glyph.run size={11} color={color} />}
      </div>
      <div className="n7-status-time">{locked ? <Glyph.lock size={10} color={color} /> : formatClock(now, use24h)}</div>
      <div className="n7-status-right">
        {bt && <Glyph.bluetooth size={10} color={color} />}
        <Battery level={level} charging={charging} color={color} />
      </div>
    </div>
  );
}
