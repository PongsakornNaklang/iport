import { useEffect } from 'react';
import type { GameProps } from './types';

/** Temporary game body: shows the name, MENU exits. */
export function makePlaceholderGame(name: string) {
  return function PlaceholderGame({ bus, width, height, onExit }: GameProps) {
    useEffect(
      () =>
        bus.on((e) => {
          if (e.type === 'click' && e.button === 'menu') onExit();
          return true;
        }),
      [bus, onExit],
    );
    return (
      <div style={{ width, height, display: 'grid', placeItems: 'center', background: '#000', color: '#fff', font: '600 16px Helvetica' }}>
        {name} — coming soon
      </div>
    );
  };
}
