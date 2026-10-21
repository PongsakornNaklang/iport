import type { GameInfo } from './types';

/** Games shown under Extras ▸ Games on Click Wheel iPods. */
export const GAMES: GameInfo[] = [
  { id: 'brick', name: 'Brick', load: () => import('./brick') },
  { id: 'musicquiz', name: 'Music Quiz', load: () => import('./musicquiz') },
  { id: 'parachute', name: 'Parachute', load: () => import('./parachute') },
  { id: 'solitaire', name: 'Solitaire', load: () => import('./solitaire') },
  { id: 'vortex', name: 'Vortex', load: () => import('./vortex') },
];
