import type { ComponentType } from 'react';
import type { WheelBus } from '../clickwheel/bus';

/** Props every Click Wheel game receives from the host OS. */
export interface GameProps {
  /** Input. Subscribe with bus.on(); return true from the listener to consume events. */
  bus: WheelBus;
  /** Size of the area the game owns, in px (the whole screen). */
  width: number;
  height: number;
  /** Leave the game (the host shows its menu again). */
  onExit: () => void;
  /** false on monochrome iPods — draw in 4 shades of grey-blue. */
  color: boolean;
}

export interface GameInfo {
  id: string;
  name: string;
  load: () => Promise<{ default: ComponentType<GameProps> }>;
}
