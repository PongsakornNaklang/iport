/**
 * The six iPod Socks (2004), matched to Apple's swatches. `color` is the
 * knit rib, the darker of the two stripes (the purl stripe beside it is
 * the same yarn catching more light); `cuff` is the paler band round the
 * opening, on some a different shade altogether (orange's is golden).
 */
export const SOCK_COLORS: { name: string; color: string; cuff: string }[] = [
  { name: 'Grey', color: '#76787c', cuff: '#abacaf' },
  { name: 'Purple', color: '#53519f', cuff: '#a3a7e4' },
  { name: 'Blue', color: '#36a4d6', cuff: '#74d0ec' },
  { name: 'Green', color: '#3fb823', cuff: '#89d33d' },
  { name: 'Orange', color: '#ef7a14', cuff: '#f8b432' },
  { name: 'Pink', color: '#e0428b', cuff: '#f39aac' },
];

/** the cuff for a sock color: Apple's, or for one of your own a paler tint */
export function sockCuff(color: string): string {
  const named = SOCK_COLORS.find((c) => c.color === color.toLowerCase());
  return named ? named.cuff : `color-mix(in srgb, ${color} 58%, #fff)`;
}
