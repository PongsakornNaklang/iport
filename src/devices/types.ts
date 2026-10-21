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
  /** what the iPod is wearing: a case or an iPod Sock */
  cover?: CoverChoice;
}

export type CoverKind = 'none' | 'silicone' | 'leather' | 'sock';

export interface CoverChoice {
  kind: CoverKind;
  color: string;
}

/**
 * How a case or sock fits this model. Everything is in device px.
 * Openings are on the edges: `at` is along the edge from its centre (x for
 * top/bottom, y for left/right), `len` along the edge and `thick` across
 * it (depth), centred at depth `z` (+ towards the front).
 */
export interface CoverFit {
  /** corner radius of the body outline */
  radius: number;
  /** a case is offered (the shuffle only gets socks) */
  cases: boolean;
  holes: { side: 'top' | 'bottom' | 'left' | 'right'; at: number; len: number; thick: number; z?: number }[];
  /** rear camera: centre from the top-left of the back as seen from behind, and its diameter */
  camera?: { x: number; y: number; d: number };
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
  /**
   * Headphone jack, for the EarPods animation: centre of the hole in device px
   * relative to the device centre (+y down, +z towards the front), which edge
   * it opens to (ny: -1 top, +1 bottom) and the model's px-per-mm scale.
   */
  jack?: { x: number; y: number; z: number; ny: 1 | -1; pxPerMm: number };
  /** How cases and iPod Socks fit (see shell/cover). */
  cover?: CoverFit;
  /** Lazy-loaded device implementation. */
  load: () => Promise<{ default: ComponentType<DeviceProps> }>;
}
