import { usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { formatClock } from '../../../core/util/format';
import { useBattery, useNow } from '../../../core/util/hooks';
import type { HeaderStyle } from './core';
import { BatteryGlyph, LockGlyph, PlayStateGlyph } from './glyphs';

export function StatusBar({ title, style, hold, height }: { title: string; style: HeaderStyle; hold: boolean; height: number }) {
  const status = usePlayer((s) => s.status);
  const hasTrack = usePlayer((s) => !!s.currentId);
  const timeInTitle = useSettings((s) => s.timeInTitle);
  const use24h = useSettings((s) => s.use24h);
  const now = useNow(timeInTitle ? 1000 : 60_000);
  const battery = useBattery();
  if (style === 'hidden') return null;
  const shown = timeInTitle ? formatClock(now, use24h) : title;
  const playing = status === 'playing' || status === 'loading';
  return (
    <div className={`cl-status cl-status-${style}`} style={{ height }}>
      <div className="cl-status-left">
        {hasTrack && <PlayStateGlyph playing={playing} />}
        {hold && <LockGlyph size={11} color={style === 'dark' ? '#ddd' : '#3a3a3a'} />}
      </div>
      <div className="cl-status-title" key={shown}>
        {shown}
      </div>
      <div className="cl-status-right">
        <BatteryGlyph level={battery.level} charging={battery.charging} dark={style === 'dark'} />
      </div>
    </div>
  );
}
