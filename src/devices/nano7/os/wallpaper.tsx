import type { CSSProperties } from 'react';

export const WALLPAPERS: { id: string; name: string }[] = [
  { id: 'dark', name: 'Dark' },
  { id: 'blue', name: 'Blue' },
  { id: 'bokeh', name: 'Bokeh' },
  { id: 'stripes', name: 'Stripes' },
];

const bokeh = [
  [18, 22, 26, '255,110,170', 0.55],
  [72, 14, 18, '255,190,90', 0.5],
  [84, 40, 30, '120,200,255', 0.42],
  [30, 52, 20, '170,120,255', 0.5],
  [60, 62, 36, '255,120,120', 0.32],
  [12, 78, 28, '90,220,200', 0.4],
  [78, 84, 22, '255,220,120', 0.42],
  [46, 34, 12, '255,255,255', 0.35],
  [40, 90, 16, '255,140,210', 0.4],
  [92, 66, 12, '160,255,190', 0.35],
  [55, 8, 10, '255,255,255', 0.3],
  [24, 64, 9, '255,255,255', 0.3],
] as const;

export function wallpaperStyle(id: string): CSSProperties {
  switch (id) {
    case 'blue':
      return {
        background: [
          'radial-gradient(140% 60% at 100% 100%, rgba(140,230,255,0.55), transparent 60%)',
          'radial-gradient(120% 50% at -10% 60%, rgba(40,120,230,0.6), transparent 65%)',
          'radial-gradient(90% 40% at 70% 30%, rgba(90,180,255,0.35), transparent 70%)',
          'linear-gradient(170deg, #06163f 0%, #0f3f8e 38%, #1f74cf 66%, #61c3f2 100%)',
        ].join(','),
      };
    case 'bokeh':
      return {
        background: [
          ...bokeh.map(([x, y, r, c, a]) => `radial-gradient(circle at ${x}% ${y}%, rgba(${c},${a}) 0, rgba(${c},${a * 0.8}) ${r * 0.62}px, rgba(${c},0) ${r}px)`),
          'radial-gradient(120% 80% at 50% 40%, #2a1745 0%, #12142e 60%, #07070f 100%)',
        ].join(','),
      };
    case 'stripes':
      return {
        background: [
          'linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.35))',
          'repeating-linear-gradient(122deg, #ef4f5f 0 30px, #f88f3f 30px 60px, #f5c842 60px 90px, #66bb6a 90px 120px, #36a2d9 120px 150px, #6f63c9 150px 180px, #c057b8 180px 210px)',
        ].join(','),
      };
    case 'dark':
    default:
      return {
        background: [
          'radial-gradient(90% 40% at 50% 0%, rgba(120,130,160,0.28), transparent 70%)',
          'radial-gradient(100% 50% at 50% 110%, rgba(60,70,110,0.35), transparent 70%)',
          'linear-gradient(180deg, #1d1f26 0%, #0c0d10 55%, #060607 100%)',
        ].join(','),
      };
  }
}

export function Wallpaper({ id, className, style }: { id: string; className?: string; style?: CSSProperties }) {
  return <div className={`n7-wallpaper ${className ?? ''}`} style={{ ...wallpaperStyle(id), ...style }} />;
}
