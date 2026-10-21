import { defaultAppearance, DEFAULT_SCENE, type Preset } from '../../core/customize/store';
import { getModel } from '../../devices/registry';

type Showcase = Omit<Preset, 'id' | 'createdAt'>;

function make(name: string, modelId: string, finishId: string, extra: Partial<Showcase['appearance']> = {}, scene: Partial<Showcase['scene']> = {}): Showcase {
  const base = defaultAppearance(getModel(modelId), finishId);
  return {
    name,
    modelId,
    appearance: {
      ...base,
      ...extra,
      colors: { ...base.colors, ...(extra.colors ?? {}) },
      options: { ...base.options, ...(extra.options ?? {}) },
      engraving: extra.engraving ?? ['', ''],
    },
    scene: { ...DEFAULT_SCENE, ...scene },
  };
}

/** Curated looks shown in the Presets tab. */
export const SHOWCASE_PRESETS: Showcase[] = [
  make('U2 Special Edition', 'classic', 'u2', { engraving: ['Vertigo', ''] }, { backdrop: 'studio', color1: '#3a1214', color2: '#0b0405' }),
  make('Silver classic on a desk', 'classic', 'silver', {}, { backdrop: 'desk' }),
  make('Blue touch, sunset', 'touch7', 'blue', { options: { wallpaper: 'sunset', darkMode: false } }, { backdrop: 'gradient', color1: '#ff9a5a', color2: '#5d3fd3' }),
  make('Space Gray, dark mode', 'touch7', 'spacegray', { options: { wallpaper: 'ios13', darkMode: true } }, { backdrop: 'studio' }),
  make('Product RED nano', 'nano7', 'red', {}, { backdrop: 'light' }),
  make('Aurora nano', 'nano7', 'purple', { options: { wallpaper: 'bokeh' } }, { backdrop: 'aurora' }),
  make('Gym shuffle', 'shuffle4', 'green', { engraving: ['Run, Forrest', 'Run!'] }, { backdrop: 'gradient', color1: '#1c2b1a', color2: '#7fb446' }),
  make('Gold everything', 'shuffle4', 'gold', {}, { backdrop: 'solid', color1: '#f3ead9' }),
];
