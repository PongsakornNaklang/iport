import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { WheelBus } from '../clickwheel/bus';
import { ClickWheel } from '../clickwheel/ClickWheel';
import { useWheelKeyboard } from '../clickwheel/useWheelKeyboard';
import { GAMES } from './registry';

/**
 * Development harness: renders one Click Wheel game in a fake 320×240 screen
 * with a working click wheel (mouse) and the keyboard mapping
 * (↑/↓ scroll · Enter center · Esc menu · Space play · ←/→ prev/next).
 */
export function GamesHarness({ gameId, color = true, width = 320, height = 240 }: { gameId: string; color?: boolean; width?: number; height?: number }) {
  const bus = useMemo(() => new WheelBus(), []);
  useWheelKeyboard(bus);
  const [exited, setExited] = useState(false);
  const info = GAMES.find((g) => g.id === gameId);
  const Game = useMemo(() => (info ? lazy(info.load) : null), [info]);

  useEffect(() => {
    (window as unknown as { __gamesBus?: WheelBus }).__gamesBus = bus;
    // the host OS would consume MENU when no game is running
    return bus.on((e) => {
      if (e.type === 'click' && e.button === 'select') setExited(false);
    });
  }, [bus]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#202226', color: '#ddd', font: '13px system-ui' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {GAMES.map((g) => (
            <a key={g.id} href={`?game=${g.id}${color ? '' : '&mono=1'}`} style={{ color: g.id === gameId ? '#fff' : '#8ab4ff' }}>
              {g.name}
            </a>
          ))}
        </div>
        <div
          id="screen"
          style={{ width, height, borderRadius: 4, overflow: 'hidden', background: '#000', boxShadow: '0 0 0 6px #111, 0 8px 30px rgba(0,0,0,.6)' }}
        >
          {exited || !Game ? (
            <div style={{ width, height, display: 'grid', placeItems: 'center', background: color ? '#fff' : '#d1dbe0', color: '#000' }}>
              {Game ? 'Exited — press Center to reopen' : `Unknown game "${gameId}"`}
            </div>
          ) : (
            <Suspense fallback={null}>
              <Game bus={bus} width={width} height={height} color={color} onExit={() => setExited(true)} />
            </Suspense>
          )}
        </div>
        <ClickWheel bus={bus} size={190} centerSize={72} wheelColor="#f2f2f2" labelColor="#9a9a9a" centerColor="#ffffff" />
      </div>
    </div>
  );
}
