/**
 * Wallpapers, drawn as SVG and used as data-URL images (rasterized once).
 */
import { memo, useMemo } from 'react';
import { useCurrentTrack } from '../../../core/player/player';
import { useArtworkUrl } from '../../../core/library/artwork';

const W = 640;
const H = 1136;

function svg(body: string, defs = ''): string {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const blur = (id: string, d: number) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`;
const lin = (id: string, stops: [number, string][], x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

function ios15(dark: boolean): string {
  const c = dark
    ? { a: '#030a1f', b: '#0a1d4f', l1: '#1747c9', l2: '#0b6e8f', l3: '#2a1f7a', l4: '#3f7ef0', hi: '#5fa8ff' }
    : { a: '#6fa3ec', b: '#3d6fe0', l1: '#2f6ff0', l2: '#52c6e6', l3: '#2a3fb0', l4: '#7fb8ff', hi: '#d6e9ff' };
  const defs =
    lin('bg', [
      [0, c.a],
      [1, c.b],
    ]) +
    blur('b1', 26) +
    blur('b2', 10) +
    lin('g1', [
      [0, c.l4],
      [1, c.l1],
    ], 1, 1) +
    lin('g2', [
      [0, c.l2],
      [1, c.l3],
    ], 1, 0) +
    lin('g3', [
      [0, c.hi],
      [1, c.l1],
    ], 0, 1);
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <path filter="url(#b1)" fill="url(#g2)" opacity=".9" d="M-80 640 C 120 520, 260 760, 460 620 S 760 460, 760 460 L760 1250 L-80 1250Z"/>
    <path filter="url(#b2)" fill="url(#g1)" opacity=".95" d="M-60 380 C 140 300, 300 520, 520 400 S 720 260, 720 260 L720 700 C 520 820, 320 600, 120 720 S -60 760, -60 760Z"/>
    <path filter="url(#b2)" fill="url(#g3)" opacity=".55" d="M-60 420 C 160 330, 300 520, 520 420 S 700 330, 720 300 L720 360 C 520 470, 330 560, 140 470 S -60 470,-60 470Z"/>
    <path filter="url(#b1)" fill="${c.l3}" opacity=".85" d="M-80 900 C 160 780, 360 1000, 720 860 L720 1250 L-80 1250Z"/>
    <path filter="url(#b2)" fill="${c.l2}" opacity=".5" d="M-60 820 C 180 720, 340 900, 720 780 L720 820 C 360 960, 200 790, -60 880Z"/>
    <path filter="url(#b1)" fill="${c.hi}" opacity="${dark ? 0.15 : 0.28}" d="M-60 120 C 200 40, 380 220, 720 120 L720 -60 L-60 -60Z"/>`;
  return svg(body, defs);
}

function ios13(dark: boolean): string {
  const base = dark ? ['#06060a', '#0d0d16'] : ['#f2f1f6', '#dcdbe6'];
  const defs =
    lin('bg', [
      [0, base[0]],
      [1, base[1]],
    ]) +
    blur('b', 22) +
    lin('o', [
      [0, '#ffb340'],
      [1, '#ff375f'],
    ], 1, 1) +
    lin('p', [
      [0, '#bf5af2'],
      [1, '#5e5ce6'],
    ], 1, 1) +
    lin('q', [
      [0, '#64d2ff'],
      [1, '#0a84ff'],
    ], 1, 0);
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <g filter="url(#b)">
      <path fill="url(#o)" d="M-40 200 C 160 120, 420 260, 700 140 L700 420 C 480 520, 220 360, -40 470Z"/>
      <path fill="url(#p)" opacity=".95" d="M-40 470 C 220 360, 480 520, 700 420 L700 700 C 440 800, 200 620, -40 760Z"/>
      <path fill="url(#q)" opacity=".95" d="M-40 760 C 200 620, 440 800, 700 700 L700 990 C 420 1080, 200 900, -40 1040Z"/>
    </g>`;
  return svg(body, defs);
}

function aurora(dark: boolean): string {
  const r = rng(7);
  let stars = '';
  for (let i = 0; i < 140; i++) {
    const x = r() * W;
    const y = r() * H * 0.62;
    const s = r() * 1.6 + 0.3;
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" fill="#fff" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
  }
  const defs =
    lin('sky', [
      [0, dark ? '#01030c' : '#040b24'],
      [0.55, dark ? '#071a2b' : '#0b2a45'],
      [1, dark ? '#0b3b3a' : '#11585a'],
    ]) +
    blur('a', 18) +
    blur('a2', 34) +
    lin('rib', [
      [0, '#7affc4'],
      [0.5, '#2ee6a6'],
      [1, '#7c4dff'],
    ], 1, 0) +
    lin('rib2', [
      [0, '#b46cff'],
      [1, '#36f1cd'],
    ], 1, 0);
  const body = `
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars}
    <path filter="url(#a2)" fill="url(#rib)" opacity=".55" d="M-40 520 C 100 300, 260 460, 360 260 S 560 120, 700 200 L700 360 C 560 300, 480 420, 380 520 S 140 520, -40 700Z"/>
    <path filter="url(#a)" fill="url(#rib2)" opacity=".5" d="M-40 640 C 120 520, 260 600, 380 440 S 600 360, 700 420 L700 470 C 600 430, 460 520, 380 560 S 140 640, -40 720Z"/>
    <path filter="url(#a)" fill="#9dffd8" opacity=".35" d="M120 640 L150 300 L170 640Z M260 600 L300 260 L320 600Z M420 520 L460 210 L470 520Z"/>
    <path fill="#030712" d="M-10 900 L120 780 L200 830 L300 720 L390 800 L470 760 L560 820 L650 770 L650 1150 L-10 1150Z"/>
    <path fill="#000" d="M-10 980 L90 930 L180 970 L260 920 L360 990 L460 950 L560 1000 L650 960 L650 1150 L-10 1150Z"/>`;
  return svg(body, defs);
}

function sunset(dark: boolean): string {
  const defs =
    lin('sky', [
      [0, dark ? '#120726' : '#2a1257'],
      [0.35, dark ? '#4a1640' : '#8a2f6e'],
      [0.62, dark ? '#a8344a' : '#ef5f62'],
      [0.8, dark ? '#d4783a' : '#ffb04a'],
    ]) +
    blur('s', 30) +
    lin('h1', [
      [0, '#5b2a6e'],
      [1, '#2a1240'],
    ]) +
    lin('h2', [
      [0, '#3d1a52'],
      [1, '#180a2a'],
    ]) +
    lin('h3', [
      [0, '#22102f'],
      [1, '#09040f'],
    ]);
  const body = `
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="330" cy="720" r="150" fill="#ffd27a" filter="url(#s)" opacity=".9"/>
    <circle cx="330" cy="720" r="92" fill="#fff2c6"/>
    <path fill="url(#h1)" d="M-10 760 C 120 700, 240 740, 340 780 S 560 720, 650 740 L650 1150 L-10 1150Z"/>
    <path fill="url(#h2)" d="M-10 860 C 140 800, 300 880, 420 850 S 580 800, 650 830 L650 1150 L-10 1150Z"/>
    <path fill="url(#h3)" d="M-10 960 C 160 900, 300 980, 460 950 S 600 920, 650 940 L650 1150 L-10 1150Z"/>`;
  return svg(body, defs);
}

function graphite(dark: boolean): string {
  const defs =
    lin('bg', [
      [0, dark ? '#1e1e20' : '#4a4a4e'],
      [1, dark ? '#050506' : '#1c1c1e'],
    ], 0.4, 1) +
    blur('g', 40) +
    lin('sh', [
      [0, 'rgba(255,255,255,.22)'],
      [1, 'rgba(255,255,255,0)'],
    ], 1, 1);
  let lines = '';
  for (let i = -20; i < 40; i++) {
    lines += `<path d="M${i * 40} 0 L${i * 40 + 700} ${H}" stroke="#fff" stroke-opacity=".035" stroke-width="1.5"/>`;
  }
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${lines}
    <path filter="url(#g)" fill="url(#sh)" d="M-100 200 L700 -100 L700 300 L-100 700Z"/>
    <circle cx="520" cy="980" r="260" fill="#8e8e93" opacity=".08" filter="url(#g)"/>`;
  return svg(body, defs);
}

const MAKERS: Record<string, (dark: boolean) => string> = { ios15, ios13, aurora, sunset, graphite };

const cache = new Map<string, string>();
export function wallpaperImage(id: string, dark: boolean): string {
  const key = `${id}:${dark}`;
  let v = cache.get(key);
  if (!v) {
    v = (MAKERS[id] ?? ios15)(dark);
    cache.set(key, v);
  }
  return v;
}

export const WALLPAPERS = [
  { id: 'ios15', name: 'iOS 15' },
  { id: 'ios13', name: 'iOS 13' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'sunset', name: 'Sunset' },
  { id: 'graphite', name: 'Graphite' },
  { id: 'album', name: 'Now Playing' },
];

export const Wallpaper = memo(function Wallpaper({ id, dark, className, dim = 0 }: { id: string; dark: boolean; className?: string; dim?: number }) {
  if (id === 'album') return <AlbumWallpaper dark={dark} className={className} dim={dim} />;
  return <StaticWallpaper id={id} dark={dark} className={className} dim={dim} />;
});

function StaticWallpaper({ id, dark, className, dim }: { id: string; dark: boolean; className?: string; dim: number }) {
  const bg = useMemo(() => wallpaperImage(id, dark), [id, dark]);
  return (
    <div className={`t7-wall ${className ?? ''}`} style={{ backgroundImage: bg }}>
      {dim > 0 && <div className="t7-wall-dim" style={{ opacity: dim }} />}
    </div>
  );
}

function AlbumWallpaper({ dark, className, dim }: { dark: boolean; className?: string; dim: number }) {
  const t = useCurrentTrack();
  const url = useArtworkUrl(t?.artwork);
  if (!url) return <StaticWallpaper id="ios15" dark={dark} className={className} dim={dim} />;
  return (
    <div className={`t7-wall t7-wall-album ${className ?? ''}`}>
      <img src={url} alt="" draggable={false} />
      <div className="t7-wall-dim" style={{ opacity: 0.18 + dim }} />
    </div>
  );
}
