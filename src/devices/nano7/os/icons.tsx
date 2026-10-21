/**
 * Every icon on the nano is drawn here as SVG — the round 2015 (iOS 7-style,
 * flat) app icons and the small UI glyphs.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useNow } from '../../../core/util/hooks';
import type { AppId } from '../state';

let gid = 0;
const nid = (p: string) => `${p}${++gid}`;

function gearPath(cx: number, cy: number, ro: number, ri: number, teeth: number, hole: number): string {
  let d = '';
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [a - step * 0.22, ri],
      [a - step * 0.14, ro],
      [a + step * 0.14, ro],
      [a + step * 0.22, ri],
      [a + step * 0.5, ri],
    ];
    for (const [ang, r] of pts) {
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      d += `${d ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  d += 'Z';
  // hole (counter-clockwise for evenodd)
  d += `M${cx + hole} ${cy}A${hole} ${hole} 0 1 0 ${cx - hole} ${cy}A${hole} ${hole} 0 1 0 ${cx + hole} ${cy}Z`;
  return d;
}

function Disc({ from, to, children, angle = 180, ring }: { from: string; to: string; children: ReactNode; angle?: number; ring?: string }) {
  const id = nid('g');
  const x2 = angle === 180 ? 0 : 1;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2={x2} y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
      {ring && <circle cx="50" cy="50" r="49.3" fill="none" stroke={ring} strokeWidth="1.4" />}
      {children}
    </>
  );
}

const NOTE = 'M66 18v44.5a10 9 -20 1 1-5.5-8V33.5l-24 6.2v28.8a10 9 -20 1 1-5.5-8V27z';

function ClockFaceIcon() {
  const now = useNow(1000 * 30);
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const ha = (h + m / 60) * 30;
  const ma = m * 6;
  return (
    <>
      <circle cx="50" cy="50" r="50" fill="#1c1c1e" />
      <circle cx="50" cy="50" r="44" fill="#fdfdfd" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="50" y1="9.5" x2="50" y2={i % 3 === 0 ? 16 : 13.5} stroke="#1c1c1e" strokeWidth={i % 3 === 0 ? 2.6 : 1.6} transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <line x1="50" y1="50" x2="50" y2="27" stroke="#1c1c1e" strokeWidth="4" strokeLinecap="round" transform={`rotate(${ha} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="15" stroke="#1c1c1e" strokeWidth="3" strokeLinecap="round" transform={`rotate(${ma} 50 50)`} />
      <line x1="50" y1="58" x2="50" y2="14" stroke="#ff9500" strokeWidth="1.4" transform="rotate(200 50 50)" />
      <circle cx="50" cy="50" r="2.6" fill="#ff9500" />
    </>
  );
}

function Flower() {
  const petals = ['#f8a53b', '#f6d23c', '#a6cf4b', '#55c1a1', '#4aa7dd', '#7d72c6', '#c86fb0', '#ef6157'];
  return (
    <>
      <circle cx="50" cy="50" r="50" fill="#fff" />
      <g style={{ mixBlendMode: 'multiply' }}>
        {petals.map((c, i) => (
          <rect key={i} x="43.5" y="17" width="13" height="27" rx="6.5" fill={c} opacity="0.92" transform={`rotate(${i * 45} 50 50)`} />
        ))}
      </g>
    </>
  );
}

export function AppIcon({ id, size = 68 }: { id: AppId; size?: number }) {
  let body: ReactNode;
  switch (id) {
    case 'music':
      body = (
        <Disc from="#ffad2a" to="#ff4d2d">
          <path d={NOTE} fill="#fff" transform="translate(1 4) scale(0.98)" />
        </Disc>
      );
      break;
    case 'videos':
      body = (
        <Disc from="#5ad1fb" to="#1a72f0">
          <rect x="25" y="44" width="50" height="31" rx="3.5" fill="#fff" />
          <path d="M24.5 41.5 72.6 30.2l-2-8.4L22.6 33z" fill="#fff" />
          <path d="M33 31.5l5.5 7.3M46 28.5l5.5 7.3M59 25.4l5.5 7.3" stroke="#3a96f6" strokeWidth="3.4" />
          <path d="M45 52v15l12-7.5z" fill="#2a86f2" />
        </Disc>
      );
      break;
    case 'fitness':
      body = (
        <Disc from="#9be15d" to="#1fb24a">
          <g stroke="#fff" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M53 37 46 56" />
            <path d="M40 41l10-5 9 8 8 1" />
            <path d="M46 56l11 9-2 13" />
            <path d="M46 56l-6 12-11 1" />
          </g>
          <circle cx="58" cy="25" r="6.5" fill="#fff" />
        </Disc>
      );
      break;
    case 'podcasts':
      body = (
        <Disc from="#d482f7" to="#8436d0">
          <g fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round">
            <path d="M37.6 57.5a17 17 0 1 1 24.8 0" />
            <path d="M30.5 66a27 27 0 1 1 39 0" />
          </g>
          <circle cx="50" cy="44" r="7.5" fill="#fff" />
          <path d="M45.5 55h9l-1.8 24h-5.4z" fill="#fff" />
        </Disc>
      );
      break;
    case 'photos':
      body = <Flower />;
      break;
    case 'radio':
      body = (
        <Disc from="#ff5a5f" to="#d0182c">
          <g stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M50 44 39 80M50 44l11 36M43.5 66h13M41 74h18M46 55h8" />
            <path d="M39.5 28a15 15 0 0 0 0 20M60.5 28a15 15 0 0 1 0 20" />
            <path d="M31.5 21a26 26 0 0 0 0 34M68.5 21a26 26 0 0 1 0 34" />
          </g>
          <circle cx="50" cy="38" r="5.5" fill="#fff" />
        </Disc>
      );
      break;
    case 'settings':
      body = (
        <Disc from="#b9bcc2" to="#6f7278">
          <path d={gearPath(50, 50, 33, 26, 18, 13)} fill="#4a4c51" fillRule="evenodd" />
          <path d={gearPath(50, 50, 31, 24.5, 18, 14)} fill="#e9eaec" fillRule="evenodd" />
          <circle cx="50" cy="50" r="19" fill="none" stroke="#bfc1c5" strokeWidth="3" />
          <g stroke="#9a9ca1" strokeWidth="3">
            {[0, 60, 120].map((a) => (
              <line key={a} x1="50" y1="36" x2="50" y2="64" transform={`rotate(${a} 50 50)`} />
            ))}
          </g>
          <circle cx="50" cy="50" r="7" fill="#e9eaec" stroke="#9a9ca1" strokeWidth="2" />
        </Disc>
      );
      break;
    case 'clock':
      body = <ClockFaceIcon />;
      break;
    case 'audiobooks':
      body = (
        <Disc from="#ffb35c" to="#ef6a22">
          <path d="M50 33c-7-5-16-6-25-4v38c9-2 18-1 25 4 7-5 16-6 25-4V29c-9-2-18-1-25 4z" fill="#fff" />
          <path d="M50 34v36" stroke="#f08a3c" strokeWidth="2" />
          <path d="M30 37c6-1 11 0 15 2M30 44c6-1 11 0 15 2M30 51c6-1 11 0 15 2M55 39c4-2 9-3 15-2M55 46c4-2 9-3 15-2M55 53c4-2 9-3 15-2" stroke="#f6b27c" strokeWidth="1.8" fill="none" />
        </Disc>
      );
      break;
    case 'itunesu':
      body = (
        <Disc from="#ffd65a" to="#f39c12">
          <path d="M50 29 18 43l32 14 32-14z" fill="#fff" />
          <path d="M31 50v12c5 6 33 6 38 0V50L50 58z" fill="#fff" />
          <path d="M76 45v17" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="76" cy="64" r="3.2" fill="#fff" />
        </Disc>
      );
      break;
    case 'voicememos':
      body = (
        <Disc from="#55555b" to="#1d1d20">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
            const h = [8, 16, 26, 14, 34, 22, 30, 12, 20, 10, 6][i];
            return <rect key={i} x={23 + i * 5.2} y={50 - h / 2} width="2.8" height={h} rx="1.4" fill={i === 5 ? '#ff3b30' : '#fff'} />;
          })}
        </Disc>
      );
      break;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="n7-appicon" aria-hidden>
      {body}
    </svg>
  );
}

// ---------------------------------------------------------------- glyphs

type GP = { size?: number; color?: string; style?: CSSProperties };

function G({ size = 20, children, style, vb = 24 }: { size?: number; children: ReactNode; style?: CSSProperties; vb?: number }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} style={{ flex: 'none', display: 'block', ...style }} aria-hidden>
      {children}
    </svg>
  );
}

export const Glyph = {
  playlists: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M3 6h12M3 11h12M3 16h7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 8v9.2a2.3 2 0 1 1-1.4-1.9V8l5-1.3v2.2z" fill={color} />
    </G>
  ),
  artists: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <circle cx="12" cy="8" r="4.2" fill="none" stroke={color} strokeWidth="1.7" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </G>
  ),
  albums: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke={color} strokeWidth="1.7" />
      <circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.3" fill={color} />
    </G>
  ),
  songs: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M17 3v12.5a2.8 2.4 0 1 1-1.6-2.2V7.4L9.6 9v8.6A2.8 2.4 0 1 1 8 15.3V5z" fill={color} />
    </G>
  ),
  genres: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M14.5 3.5l6 6-2 1-1.5-1.5-4.7 4.7a4 4 0 0 1-1.1 4.6c-1.9 1.9-5.5 2.4-7 .9s-1-5.1.9-7a4 4 0 0 1 4.6-1.1l4.7-4.7L13.5 5z" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="8.3" cy="15.7" r="1.4" fill={color} />
    </G>
  ),
  composers: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M8 5v14M13 5v14M18 5v14" stroke={color} strokeWidth="1.2" />
      <path d="M6 5h3.4v8H6zM11.2 5h3.4v8h-3.4zM16.4 5h3.4v8h-3.4z" fill={color} />
    </G>
  ),
  compilations: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="6" y="6" width="15" height="15" rx="1.5" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M3 17V4.5A1.5 1.5 0 0 1 4.5 3H17" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </G>
  ),
  audiobooks: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M12 6.5C9.5 4.8 6.5 4.4 3 5v13c3.5-.6 6.5-.2 9 1.5 2.5-1.7 5.5-2.1 9-1.5V5c-3.5-.6-6.5-.2-9 1.5zM12 6.5v13" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </G>
  ),
  shuffle: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M2.5 7h3.5c4.5 0 6.5 10 11 10h3.5M2.5 17h3.5c1.8 0 3-1.5 4.2-3.4M13.8 10.4C15 8.5 16.2 7 18 7h2.5" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18.5 4.2 21.6 7l-3.1 2.8zM18.5 14.2l3.1 2.8-3.1 2.8z" fill={color} />
    </G>
  ),
  repeat: ({ size, color = 'currentColor', one }: GP & { one?: boolean }) => (
    <G size={size}>
      <path d="M4 12V9.5A2.5 2.5 0 0 1 6.5 7H19M20 12v2.5a2.5 2.5 0 0 1-2.5 2.5H5" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 4.2 20 7l-3 2.8zM7 14.2 4 17l3 2.8z" fill={color} />
      {one && (
        <text x="12" y="14.6" fontSize="7.5" fontWeight="700" textAnchor="middle" fill={color} fontFamily="-apple-system, Helvetica, Arial">
          1
        </text>
      )}
    </G>
  ),
  prev: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M11.5 12 21 5.5v13zM2.5 12 12 5.5v13z" fill={color} />
      <rect x="1.5" y="5.5" width="1.8" height="13" fill={color} />
    </G>
  ),
  next: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M12.5 12 3 5.5v13zM21.5 12 12 5.5v13z" fill={color} />
      <rect x="20.7" y="5.5" width="1.8" height="13" fill={color} />
    </G>
  ),
  play: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M6 3.5 20.5 12 6 20.5z" fill={color} />
    </G>
  ),
  pause: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="5.5" y="4" width="4.2" height="16" fill={color} />
      <rect x="14.3" y="4" width="4.2" height="16" fill={color} />
    </G>
  ),
  volLow: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M3 9.5h3.5L11 5.5v13l-4.5-4H3z" fill={color} />
    </G>
  ),
  volHigh: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M2 9.5h3.5L10 5.5v13l-4.5-4H2z" fill={color} />
      <path d="M13 9a4 4 0 0 1 0 6M15.5 6.5a7.5 7.5 0 0 1 0 11M18 4a11 11 0 0 1 0 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </G>
  ),
  list: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M8 6h13M8 12h13M8 18h13" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="3.8" cy="6" r="1.3" fill={color} />
      <circle cx="3.8" cy="12" r="1.3" fill={color} />
      <circle cx="3.8" cy="18" r="1.3" fill={color} />
    </G>
  ),
  more: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.4" />
      <circle cx="7.5" cy="12" r="1.4" fill={color} />
      <circle cx="12" cy="12" r="1.4" fill={color} />
      <circle cx="16.5" cy="12" r="1.4" fill={color} />
    </G>
  ),
  star: ({ size, color = 'currentColor', filled }: GP & { filled?: boolean }) => (
    <G size={size}>
      <path d="M12 2.8l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6z" fill={filled ? color : 'none'} stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </G>
  ),
  eqBars: ({ size, color = 'currentColor', animate }: GP & { animate?: boolean }) => (
    <G size={size}>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} className={animate ? `n7-eqbar n7-eqbar-${i}` : undefined} x={3 + i * 5} y="6" width="3" height="14" fill={color} style={{ transformOrigin: `${4.5 + i * 5}px 20px` }} />
      ))}
    </G>
  ),
  podcast: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <circle cx="12" cy="10" r="2.3" fill={color} />
      <path d="M8.5 13.8a5 5 0 1 1 7 0M6 16.5a8.5 8.5 0 1 1 12 0" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.6 13.5h2.8l-.5 7.5h-1.8z" fill={color} />
    </G>
  ),
  film: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4" stroke={color} strokeWidth="1.3" />
    </G>
  ),
  tv: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="2.5" y="5" width="19" height="13" rx="1.8" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M8 21h8M9 2.5l3 2.5 3-2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </G>
  ),
  mv: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="2.5" y="5" width="19" height="14" rx="1.8" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M10 8.5v7l5.5-3.5z" fill={color} />
    </G>
  ),
  youtube: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M10 9v6l5-3z" fill={color} />
    </G>
  ),
  walk: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <circle cx="13" cy="4" r="2" fill={color} />
      <path d="M12 8l-2 6 3 3v5M10 14l-2 7M12 8l3 3 3 .5M12 8l-4 2-1 3" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  ),
  run: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <circle cx="15" cy="4" r="2" fill={color} />
      <path d="M13.5 8 11 14l4 3-1 5M11 14l-3 4-4 0M9 9l4.5-1 3 3 3.5.5" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  ),
  history: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M4 19V11M9.3 19V5M14.7 19v-9M20 19V8" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
    </G>
  ),
  bluetooth: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  ),
  lock: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="5" y="10.5" width="14" height="10.5" rx="2" fill={color} />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={color} strokeWidth="2" />
    </G>
  ),
  replay: ({ size, color = 'currentColor', n = 15 }: GP & { n?: number }) => (
    <G size={size}>
      <path d="M12 4.5a8 8 0 1 1-7.6 5.5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 1.5v6l-4-3z" fill={color} />
      <text x="12.4" y="16" fontSize="7" fontWeight="600" textAnchor="middle" fill={color} fontFamily="-apple-system, Helvetica, Arial">
        {n}
      </text>
    </G>
  ),
  forward: ({ size, color = 'currentColor', n = 30 }: GP & { n?: number }) => (
    <G size={size}>
      <path d="M12 4.5a8 8 0 1 0 7.6 5.5" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 1.5v6l4-3z" fill={color} />
      <text x="11.6" y="16" fontSize="7" fontWeight="600" textAnchor="middle" fill={color} fontFamily="-apple-system, Helvetica, Arial">
        {n}
      </text>
    </G>
  ),
  photo: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M3 17l5-5 4 4 3-3 6 5.5" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="16" cy="9" r="1.7" fill={color} />
    </G>
  ),
  mic: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <rect x="9" y="2.5" width="6" height="12" rx="3" fill={color} />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </G>
  ),
  cap: ({ size, color = 'currentColor' }: GP) => (
    <G size={size}>
      <path d="M12 5 1.5 9.5 12 14l10.5-4.5z" fill={color} />
      <path d="M6 12v4c2 2.4 10 2.4 12 0v-4" fill="none" stroke={color} strokeWidth="1.6" />
    </G>
  ),
};

export function Battery({ level, charging, color }: { level: number; charging: boolean; color: string }) {
  const w = Math.max(1, Math.round(15 * level));
  const fill = level < 0.2 && !charging ? '#ff3b30' : color;
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden style={{ display: 'block' }}>
      <rect x="0.5" y="0.5" width="18" height="9" rx="2" fill="none" stroke={color} strokeOpacity="0.55" />
      <rect x="2" y="2" width={w} height="6" rx="1" fill={fill} />
      <path d="M19.8 3.4v3.2c.7-.2 1.1-.8 1.1-1.6s-.4-1.4-1.1-1.6z" fill={color} fillOpacity="0.55" />
      {charging && <path d="M10.5 1.2 6.8 5.6h2.7L8.4 8.8l3.8-4.5H9.5z" fill={color === '#fff' ? '#000' : '#fff'} stroke={color} strokeWidth="0.5" />}
    </svg>
  );
}

/** The Apple logo silhouette (used on the back and the boot screen). */
export const APPLE_PATH =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
