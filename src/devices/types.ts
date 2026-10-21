import type { ComponentType } from 'react';

/** A recolorable part of a device (body, click wheel, bezel…). */
export interface ColorSlot {
  key: string;
  label: string;
}

/** A non-color customization (material, wheel style, screen theme…). */
export type OptionDef =
  | { key: string; label: string; type: 'select'; choices: { value: string; label: string }[] }
  | { key: string; label: string; type: 'toggle' }
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number };

/** An official colorway, e.g. "Space Gray". The first one is the default. */
export interface Finish {
  id: string;
  name: string;
  /** swatch shown in the picker */
  swatch: string;
  colors: Record<string, string>;
  options?: Record<string, string | number | boolean>;
}

export interface Appearance {
  colors: Record<string, string>;
  options: Record<string, string | number | boolean>;
  /** Up to two lines of engraving on the back. */
  engraving: [string, string];
  /** id of the finish this appearance started from */
  finishId?: string;
}

export interface DeviceProps {
  model: DeviceModel;
  appearance: Appearance;
}

export interface DeviceModel {
  id: string;
  /** "iPod touch" */
  name: string;
  /** "7th generation" */
  generation: string;
  year: number;
  /** One-line tagline shown in the picker */
  blurb: string;
  family: 'touch' | 'nano-touch' | 'shuffle' | 'clickwheel';
  /** Design size in CSS px — the component renders at exactly this size. */
  size: { width: number; height: number; depth: number };
  /** Fraction of the stage height the device should fill when fitted (default 0.86). */
  fitHeight?: number;
  colorSlots: ColorSlot[];
  options?: OptionDef[];
  finishes: Finish[];
  engravable: boolean;
  /** Lazy-loaded device implementation. */
  load: () => Promise<{ default: ComponentType<DeviceProps> }>;
}
