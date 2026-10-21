/**
 * Colours shared by the Click Wheel games.
 *
 * Colour iPods get each game's own palette; monochrome iPods draw everything
 * in the four shades of the grey-blue LCD below (lightest first).
 */
export const LCD = ['#d1dbe0', '#97a9b6', '#56697a', '#1b2631'] as const;

/** Fonts used on every game screen (the iPod UI font, then fallbacks). */
export const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';

export function font(size: number, weight: number | string = 700): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** Palette for the shared overlays (pause menu, banners, prompts). */
export interface UiPalette {
  text: string;
  textDim: string;
  shadow: string | null;
  scrim: string | null;
  panel: string;
  panelEdge: string;
  panelText: string;
  panelDim: string;
  sel: [string, string];
  selText: string;
  accent: string;
}

export function uiPalette(color: boolean): UiPalette {
  return color
    ? {
        text: '#ffffff',
        textDim: 'rgba(255,255,255,0.72)',
        shadow: 'rgba(0,0,0,0.55)',
        scrim: 'rgba(4,6,12,0.55)',
        panel: 'rgba(250,251,253,0.97)',
        panelEdge: 'rgba(0,0,0,0.35)',
        panelText: '#111',
        panelDim: '#6b7280',
        sel: ['#5ea4f2', '#1e64cf'],
        selText: '#ffffff',
        accent: '#ffd23f',
      }
    : {
        text: LCD[3],
        textDim: LCD[2],
        shadow: null,
        scrim: null,
        panel: LCD[0],
        panelEdge: LCD[3],
        panelText: LCD[3],
        panelDim: LCD[2],
        sel: [LCD[3], LCD[3]],
        selText: LCD[0],
        accent: LCD[3],
      };
}

/** Mix two #rrggbb colours (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => {
    const x = (pa >> s) & 255;
    const y = (pb >> s) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
